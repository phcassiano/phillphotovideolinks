// Rota pública do catálogo.
// GET  /api/loja?slug=x          → dados da vitrine (com cache curto na CDN)
// GET  /api/loja?op=info         → nome e WhatsApp da plataforma (página inicial)
// POST /api/loja {op:"order"}    → registra o pedido e devolve a mensagem para o WhatsApp
// POST /api/loja {op:"hit"}      → conta visita, visualização de produto ou clique no WhatsApp
// GET  /api/loja?op=track&slug=x&n=12&code=abc → acompanhamento do pedido pelo cliente
const db = require("./_db.js");
const frete = require("./_frete.js");
const cupom = require("./_cupom.js");
const { redis, K, send } = db;

const brl = (c) => "R$ " + (c / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

async function loadStore(st, slug) {
  const [meta, settings, cats, prods] = await redis(st,
    ["GET", K.meta(slug)], ["GET", K.settings(slug)], ["GET", K.cats(slug)], ["HGETALL", K.products(slug)]);
  if (!meta) return null;
  const products = [];
  if (Array.isArray(prods)) for (let i = 1; i < prods.length; i += 2) { const p = db.parse(prods[i]); if (p) products.push(p); }
  else if (prods && typeof prods === "object") for (const k in prods) { const p = db.parse(prods[k]); if (p) products.push(p); }
  return { meta: db.parse(meta, {}), settings: db.parse(settings, {}), categories: db.parse(cats, []), products };
}

function orderMessage(store, order) {
  const s = store.settings;
  const L = [];
  L.push(`*Pedido #${order.n}* · ${s.name}`);
  L.push("");
  for (const it of order.items) {
    const v = [it.size && (it.sizeLabel ? `${it.sizeLabel}: ${it.size}` : `Tam. ${it.size}`), it.color].filter(Boolean).join(" / ");
    L.push(`• ${it.qty}x ${it.name}${v ? ` (${v})` : ""} — ${brl(it.unitCents * it.qty)}`);
  }
  L.push("");
  L.push(`Subtotal: ${brl(order.subtotalCents)}`);
  if (order.couponCode) L.push(`Cupom ${order.couponCode}: ${order.discountCents ? "-" + brl(order.discountCents) : ""}${order.couponFreeShip ? (order.discountCents ? " + " : "") + "frete grátis" : ""}`);
  if (order.shippingInfo) L.push(`Frete: ${order.shippingInfo} — ${order.shippingCents ? brl(order.shippingCents) : "grátis"}`);
  else if (order.shippingCents) L.push(`Entrega: ${brl(order.shippingCents)}`);
  L.push(`*Total: ${brl(order.totalCents)}*`);
  L.push("");
  const c = order.customer;
  L.push(`Nome: ${c.name}`);
  if (c.delivery === "entrega") L.push(`Entrega em: ${c.address}${c.cep ? ` · CEP ${c.cep}` : ""}`);
  else if (c.delivery === "retirada") L.push("Vou retirar na loja");
  if (c.payment) L.push(`Pagamento: ${c.payment}`);
  if (c.note) L.push(`Obs.: ${c.note}`);
  if (order.trackUrl) { L.push(""); L.push(`Acompanhe: ${order.trackUrl}`); }
  return L.join("\n");
}

// Confere o carrinho com os dados do servidor: preço, opções e estoque.
function buildLines(store, rawItems) {
  const byId = new Map(store.products.map((p) => [p.id, p]));
  const items = Array.isArray(rawItems) ? rawItems.slice(0, 60) : [];
  if (!items.length) return { status: 400, error: "O carrinho está vazio." };
  const lines = [];
  const need = new Map(); // productId → {key → qty}
  for (const it of items) {
    const p = byId.get(String(it.pid || ""));
    if (!p || p.hidden) return { status: 409, error: "Um produto do carrinho não está mais disponível. Atualize a página." };
    const size = db.str(it.size, 20), color = db.str(it.color, 30);
    if (p.sizes.length && !p.sizes.includes(size)) return { status: 400, error: `Escolha o tamanho de ${p.name}.` };
    if (p.colors.length && !p.colors.includes(color)) return { status: 400, error: `Escolha a cor de ${p.name}.` };
    const qty = Math.max(1, Math.min(999, Math.floor(Number(it.qty) || 1)));
    const unit = p.promoCents && p.promoCents < p.priceCents ? p.promoCents : p.priceCents;
    lines.push({ pid: p.id, name: p.name, sizeLabel: p.sizeLabel || "", size: p.sizes.length ? size : "", color: p.colors.length ? color : "", qty, unitCents: unit, image: p.images[0] || null, p });
    const k = (p.sizes.length ? size : "") + "|" + (p.colors.length ? color : "");
    if (p.stock && k in p.stock) { const m = need.get(p.id) || {}; m[k] = (m[k] || 0) + qty; need.set(p.id, m); }
  }
  for (const [pid, m] of need) {
    const p = byId.get(pid);
    for (const k in m) if (p.stock[k] < m[k]) {
      const [a, b] = k.split("|"); const v = [a && (p.sizeLabel ? `${p.sizeLabel.toLowerCase()} ${a}` : `tam. ${a}`), b].filter(Boolean).join(" / ");
      return { status: 409, error: p.stock[k] > 0 ? `Só temos ${p.stock[k]} de ${p.name}${v ? ` (${v})` : ""}.` : `${p.name}${v ? ` (${v})` : ""} esgotou.` };
    }
  }
  return { lines, need, byId };
}

module.exports = async (req, res) => {
  db.cors(res);
  const url = new URL(req.url, "http://x");
  if (req.method === "GET" && url.searchParams.get("op") === "info") return send(res, 200, db.brand(), { "cache-control": "public, s-maxage=300" });
  const st = db.storage();
  if (!st) return send(res, 503, { error: "Banco de dados não configurado." });
  try {
    if (req.method === "GET") {
      const op = url.searchParams.get("op");
      if (op === "info") return send(res, 200, db.brand(), { "cache-control": "public, s-maxage=300" });
      const slug = String(url.searchParams.get("slug") || "").toLowerCase();
      if (!db.SLUG_RE.test(slug)) return send(res, 404, { error: "Loja não encontrada." });

      if (op === "track") {
        const n = String(url.searchParams.get("n") || "");
        const code = String(url.searchParams.get("code") || "");
        const [raw, settingsRaw] = await redis(st, ["HGET", K.orders(slug), n], ["GET", K.settings(slug)]);
        const o = db.parse(raw);
        if (!o || !code || !db.sameStr(code, o.code)) return send(res, 404, { error: "Pedido não encontrado." });
        const s = db.parse(settingsRaw, {});
        return send(res, 200, { n: o.n, createdAt: o.createdAt, status: o.status, items: o.items, subtotalCents: o.subtotalCents, shippingCents: o.shippingCents, shippingInfo: o.shippingInfo || "", couponCode: o.couponCode || "", discountCents: o.discountCents || 0, totalCents: o.totalCents, delivery: o.customer.delivery, store: { name: s.name, whatsapp: s.whatsapp, logo: s.logo, color: s.color } });
      }

      const store = await loadStore(st, slug);
      if (!store) return send(res, 404, { error: "Loja não encontrada." }, { "cache-control": "public, s-maxage=30" });
      const state = db.storeState(store.meta);
      if (!state.live) return send(res, 200, { unavailable: true, name: store.settings.name || slug }, { "cache-control": "public, s-maxage=15" });
      const s = store.settings;
      const hidden = new Set(store.categories.filter((c) => c.hidden).map((c) => c.slug));
      const products = store.products
        .filter((p) => !p.hidden && !hidden.has(p.category))
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((p) => db.publicProduct(p, s.hidePrices));
      return send(res, 200, { slug, settings: s, categories: store.categories.filter((c) => !c.hidden), products, brand: db.brand().name },
        { "cache-control": "public, s-maxage=10, stale-while-revalidate=60" });
    }

    if (req.method !== "POST") return send(res, 405, { error: "Método não permitido." });
    const body = await db.readBody(req);
    const ip = db.clientIp(req);
    const slug = String(body.slug || "").toLowerCase();
    if (!db.SLUG_RE.test(slug)) return send(res, 404, { error: "Loja não encontrada." });

    if (body.op === "hit") {
      if (await db.overLimit(st, "hit", ip)) return send(res, 204, {});
      const kind = ["view", "wa", "pv"].includes(body.kind) ? body.kind : null;
      if (!kind) return send(res, 400, { error: "Tipo inválido." });
      const [exists] = await redis(st, ["EXISTS", K.meta(slug)]);
      if (!exists) return send(res, 404, { error: "Loja não encontrada." });
      const key = K.stat(slug, db.today());
      const field = kind === "pv" ? (db.ID_RE.test(String(body.pid || "")) ? "pv:" + body.pid : null) : kind;
      if (!field) return send(res, 400, { error: "Produto inválido." });
      await redis(st, ["HINCRBY", key, field, "1"], ["EXPIRE", key, String(120 * 86400)], ["INCR", db.K.lim("hit", ip)], ["EXPIRE", db.K.lim("hit", ip), "600"]);
      return send(res, 200, { ok: true });
    }

    if (body.op === "cupom") {
      if (await db.overLimit(st, "cupom", ip)) return send(res, 429, { error: "Muitas tentativas de cupom. Tente mais tarde." });
      await redis(st, ["INCR", K.lim("cupom", ip)], ["EXPIRE", K.lim("cupom", ip), "3600"]);
      const store = await loadStore(st, slug);
      if (!store || !db.storeState(store.meta).live) return send(res, 404, { error: "Loja indisponível." });
      const built = buildLines(store, body.items);
      if (built.error) return send(res, built.status, { error: built.error });
      const code = cupom.normCode(body.code);
      if (!code) return send(res, 400, { error: "Digite o código do cupom." });
      const r = cupom.evaluate(await cupom.get(st, slug, code), built.lines);
      if (!r.ok) return send(res, 400, { error: r.error });
      return send(res, 200, r);
    }

    if (body.op === "frete") {
      if (await db.overLimit(st, "frete", ip)) return send(res, 429, { error: "Muitas cotações seguidas. Tente daqui a pouco." });
      await redis(st, ["INCR", K.lim("frete", ip)], ["EXPIRE", K.lim("frete", ip), "3600"]);
      const store = await loadStore(st, slug);
      if (!store || !db.storeState(store.meta).live) return send(res, 404, { error: "Loja indisponível." });
      if (!store.settings.shipCalc) return send(res, 400, { error: "Esta loja não calcula frete pelo site." });
      // Na página do produto, cota um único item; no carrinho, os itens do carrinho.
      const built = buildLines(store, body.items);
      if (built.error) return send(res, built.status, { error: built.error });
      try {
        const q = await frete.quote(st, slug, store.settings, built.lines, body.cep);
        if (!q.options.length) return send(res, 200, { options: [], message: "Nenhuma transportadora atende esse CEP com esses produtos. Fale com a loja pelo WhatsApp." });
        return send(res, 200, { options: q.options });
      } catch (e) {
        console.error("frete", slug, e.message);
        return send(res, e.status || 502, { error: e.code === "token" ? "Não foi possível calcular o frete agora. Fale com a loja pelo WhatsApp." : e.message });
      }
    }

    if (body.op === "lead") {
      if (await db.overLimit(st, "lead", ip)) return send(res, 429, { error: "Muitos cadastros seguidos. Tente mais tarde." });
      const [exists] = await redis(st, ["EXISTS", K.meta(slug)]);
      if (!exists) return send(res, 404, { error: "Loja não encontrada." });
      const lead = { name: db.str(body.name, 80), phone: db.phone(body.phone), email: db.str(body.email, 120).toLowerCase(), at: Date.now() };
      if (!lead.phone && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) return send(res, 400, { error: "Informe o WhatsApp ou um e-mail válido." });
      const [n] = await redis(st, ["HLEN", K.leads(slug)]);
      if (Number(n) >= 20000) return send(res, 200, { ok: true });
      await redis(st, ["HSET", K.leads(slug), lead.phone || lead.email, JSON.stringify(lead)], ["INCR", K.lim("lead", ip)], ["EXPIRE", K.lim("lead", ip), "3600"]);
      return send(res, 200, { ok: true });
    }

    if (body.op === "order") {
      if (await db.overLimit(st, "order", ip)) return send(res, 429, { error: "Muitos pedidos seguidos. Tente de novo mais tarde." });
      const store = await loadStore(st, slug);
      if (!store || !db.storeState(store.meta).live) return send(res, 404, { error: "Esta loja não está recebendo pedidos agora." });
      const s = store.settings;
      if (!s.whatsapp) return send(res, 400, { error: "A loja ainda não cadastrou o WhatsApp." });
      const built = buildLines(store, body.items);
      if (built.error) return send(res, built.status, { error: built.error });
      const { lines, need, byId } = built;
      const c = body.customer || {};
      const customer = {
        name: db.str(c.name, 80),
        phone: db.phone(c.phone),
        delivery: ["entrega", "retirada"].includes(c.delivery) ? c.delivery : "",
        address: db.str(c.address, 240),
        cep: db.str(c.cep, 10),
        payment: db.str(c.payment, 60),
        note: db.str(c.note, 400),
      };
      if (!customer.name) return send(res, 400, { error: "Informe o seu nome." });
      if (customer.delivery === "entrega" && !customer.address) return send(res, 400, { error: "Informe o endereço de entrega." });
      if (customer.delivery === "entrega" && s.shipCalc && frete.cep(customer.cep).length !== 8) return send(res, 400, { error: "Informe o CEP de entrega." });

      const subtotal = lines.reduce((a, l) => a + l.unitCents * l.qty, 0);
      if (s.minOrderCents && subtotal < s.minOrderCents) return send(res, 400, { error: `O pedido mínimo é ${brl(s.minOrderCents)}.` });
      let shipping = 0, shippingInfo = "";
      if (customer.delivery === "entrega" && s.shipCalc) {
        // Frete do Melhor Envio: refaz a cotação (normalmente vem do cache) e usa a opção escolhida.
        if (!body.shippingId) return send(res, 400, { error: "Calcule o frete e escolha uma opção de entrega." });
        let q;
        try { q = await frete.quote(st, slug, s, lines, customer.cep); }
        catch (e) { return send(res, e.status || 502, { error: e.message }); }
        const opt = q.options.find((o) => o.id === Number(body.shippingId));
        if (!opt) return send(res, 409, { error: "Essa opção de frete não está mais disponível. Calcule de novo." });
        shipping = opt.priceCents;
        shippingInfo = frete.describe(opt) + (opt.free ? " · frete grátis" : "");
      } else if (customer.delivery === "entrega" && s.deliveryFeeCents && !(s.freeShippingFromCents && subtotal >= s.freeShippingFromCents)) shipping = s.deliveryFeeCents;

      // Cupom: confere de novo no servidor e gasta uma vez (devolvido se o pedido falhar ou for cancelado).
      let coupon = null, discount = 0;
      if (body.coupon) {
        const c = await cupom.get(st, slug, cupom.normCode(body.coupon));
        const r = cupom.evaluate(c, lines);
        if (!r.ok) return send(res, 400, { error: `Cupom ${cupom.normCode(body.coupon)}: ${r.error} Remova o cupom ou use outro.` });
        if (!(await cupom.consume(st, slug, c))) return send(res, 409, { error: "Este cupom acabou de atingir o limite de usos." });
        coupon = r; discount = r.discountCents;
        if (r.freeShipping && customer.delivery === "entrega") { shipping = 0; if (shippingInfo) shippingInfo += " · cupom de frete grátis"; }
      }
      const giveBack = () => (coupon ? cupom.giveBack(st, slug, coupon.code, -1) : null);

      // Baixa do estoque (relê cada produto logo antes de gravar).
      if (need.size) {
        const ids = [...need.keys()];
        const fresh = await redis(st, ...ids.map((id) => ["HGET", K.products(slug), id]));
        const writes = [];
        for (let i = 0; i < ids.length; i++) {
          const p = db.parse(fresh[i]); if (!p || !p.stock) continue;
          const m = need.get(ids[i]);
          for (const k in m) if (k in p.stock) {
            if (p.stock[k] < m[k]) { await giveBack(); return send(res, 409, { error: `${p.name} acabou de esgotar. Atualize a página.` }); }
            p.stock[k] -= m[k];
          }
          writes.push(["HSET", K.products(slug), p.id, JSON.stringify(p)]);
        }
        if (writes.length) await redis(st, ...writes);
      }

      lines.forEach((l) => delete l.p);
      const [n] = await redis(st, ["INCR", K.orderSeq(slug)]);
      const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const code = db.newId(4);
      const order = {
        n: Number(n), code, createdAt: Date.now(), status: "novo", items: lines, customer,
        subtotalCents: subtotal, shippingCents: shipping, shippingInfo, couponCode: coupon ? coupon.code : "", discountCents: discount, couponFreeShip: !!(coupon && coupon.freeShipping), totalCents: Math.max(0, subtotal - discount) + shipping,
        trackUrl: host ? `${proto}://${host}/${slug}/pedido/${n}-${code}` : "",
      };
      const statKey = K.stat(slug, db.today());
      const soldCmds = lines.map((l) => ["HINCRBY", statKey, "sold:" + l.pid, String(l.qty)]);
      await redis(st,
        ["HSET", K.orders(slug), String(order.n), JSON.stringify(order)],
        ["HINCRBY", statKey, "orders", "1"], ["HINCRBY", statKey, "revenue", String(order.totalCents)], ...soldCmds,
        ["EXPIRE", statKey, String(120 * 86400)],
        ["INCR", K.lim("order", ip)], ["EXPIRE", K.lim("order", ip), "3600"]);
      // Contador de vendidos (para "Mais vendidos"), sem travar o pedido se falhar.
      try {
        const ids = [...new Set(lines.map((l) => l.pid))];
        const cur = await redis(st, ...ids.map((id) => ["HGET", K.products(slug), id]));
        const w = [];
        ids.forEach((id, i) => { const p = db.parse(cur[i]); if (!p) return; p.sold = (p.sold || 0) + lines.filter((l) => l.pid === id).reduce((a, l) => a + l.qty, 0); w.push(["HSET", K.products(slug), id, JSON.stringify(p)]); });
        if (w.length) await redis(st, ...w);
      } catch {}

      const text = orderMessage(store, order);
      return send(res, 200, { n: order.n, code, totalCents: order.totalCents, whatsapp: s.whatsapp, text, trackUrl: order.trackUrl });
    }

    return send(res, 400, { error: "Operação desconhecida." });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: "Erro no servidor. Tente de novo." });
  }
};
module.exports.loadStore = loadStore;
