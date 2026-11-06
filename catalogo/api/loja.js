// Rota pública do catálogo.
// GET  /api/loja?slug=x          → dados da vitrine (com cache curto na CDN)
// GET  /api/loja?op=info         → nome e WhatsApp da plataforma (página inicial)
// POST /api/loja {op:"order"}    → registra o pedido e devolve a mensagem para o WhatsApp
// POST /api/loja {op:"hit"}      → conta visita, visualização de produto ou clique no WhatsApp
// GET  /api/loja?op=track&slug=x&n=12&code=abc → acompanhamento do pedido pelo cliente
const db = require("./_db.js");
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
    const v = [it.size && `Tam. ${it.size}`, it.color].filter(Boolean).join(" / ");
    L.push(`• ${it.qty}x ${it.name}${v ? ` (${v})` : ""} — ${brl(it.unitCents * it.qty)}`);
  }
  L.push("");
  L.push(`Subtotal: ${brl(order.subtotalCents)}`);
  if (order.shippingCents) L.push(`Entrega: ${brl(order.shippingCents)}`);
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

module.exports = async (req, res) => {
  db.cors(res);
  const st = db.storage();
  if (!st) return send(res, 503, { error: "Banco de dados não configurado." });
  const url = new URL(req.url, "http://x");
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
        return send(res, 200, { n: o.n, createdAt: o.createdAt, status: o.status, items: o.items, subtotalCents: o.subtotalCents, shippingCents: o.shippingCents, totalCents: o.totalCents, delivery: o.customer.delivery, store: { name: s.name, whatsapp: s.whatsapp, logo: s.logo, color: s.color } });
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

    if (body.op === "order") {
      if (await db.overLimit(st, "order", ip)) return send(res, 429, { error: "Muitos pedidos seguidos. Tente de novo mais tarde." });
      const store = await loadStore(st, slug);
      if (!store || !db.storeState(store.meta).live) return send(res, 404, { error: "Esta loja não está recebendo pedidos agora." });
      const s = store.settings;
      if (!s.whatsapp) return send(res, 400, { error: "A loja ainda não cadastrou o WhatsApp." });
      const byId = new Map(store.products.map((p) => [p.id, p]));
      const items = Array.isArray(body.items) ? body.items.slice(0, 60) : [];
      if (!items.length) return send(res, 400, { error: "O carrinho está vazio." });

      // Preço e estoque sempre do servidor; o carrinho só diz o que foi escolhido.
      const lines = [];
      const need = new Map(); // productId → {key → qty}
      for (const it of items) {
        const p = byId.get(String(it.pid || ""));
        if (!p || p.hidden) return send(res, 409, { error: "Um produto do carrinho não está mais disponível. Atualize a página." });
        const size = db.str(it.size, 20), color = db.str(it.color, 30);
        if (p.sizes.length && !p.sizes.includes(size)) return send(res, 400, { error: `Escolha o tamanho de ${p.name}.` });
        if (p.colors.length && !p.colors.includes(color)) return send(res, 400, { error: `Escolha a cor de ${p.name}.` });
        const qty = Math.max(1, Math.min(999, Math.floor(Number(it.qty) || 1)));
        const unit = p.promoCents && p.promoCents < p.priceCents ? p.promoCents : p.priceCents;
        lines.push({ pid: p.id, name: p.name, size: p.sizes.length ? size : "", color: p.colors.length ? color : "", qty, unitCents: unit, image: p.images[0] || null });
        const k = (p.sizes.length ? size : "") + "|" + (p.colors.length ? color : "");
        if (p.stock && k in p.stock) {
          const m = need.get(p.id) || {}; m[k] = (m[k] || 0) + qty; need.set(p.id, m);
        }
      }
      for (const [pid, m] of need) {
        const p = byId.get(pid);
        for (const k in m) if (p.stock[k] < m[k]) {
          const [a, b] = k.split("|"); const v = [a && `tam. ${a}`, b].filter(Boolean).join(" / ");
          return send(res, 409, { error: p.stock[k] > 0 ? `Só temos ${p.stock[k]} de ${p.name}${v ? ` (${v})` : ""}.` : `${p.name}${v ? ` (${v})` : ""} esgotou.` });
        }
      }

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

      const subtotal = lines.reduce((a, l) => a + l.unitCents * l.qty, 0);
      if (s.minOrderCents && subtotal < s.minOrderCents) return send(res, 400, { error: `O pedido mínimo é ${brl(s.minOrderCents)}.` });
      let shipping = 0;
      if (customer.delivery === "entrega" && s.deliveryFeeCents && !(s.freeShippingFromCents && subtotal >= s.freeShippingFromCents)) shipping = s.deliveryFeeCents;

      // Baixa do estoque (relê cada produto logo antes de gravar).
      if (need.size) {
        const ids = [...need.keys()];
        const fresh = await redis(st, ...ids.map((id) => ["HGET", K.products(slug), id]));
        const writes = [];
        for (let i = 0; i < ids.length; i++) {
          const p = db.parse(fresh[i]); if (!p || !p.stock) continue;
          const m = need.get(ids[i]);
          for (const k in m) if (k in p.stock) {
            if (p.stock[k] < m[k]) return send(res, 409, { error: `${p.name} acabou de esgotar. Atualize a página.` });
            p.stock[k] -= m[k];
          }
          writes.push(["HSET", K.products(slug), p.id, JSON.stringify(p)]);
        }
        if (writes.length) await redis(st, ...writes);
      }

      const [n] = await redis(st, ["INCR", K.orderSeq(slug)]);
      const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const code = db.newId(4);
      const order = {
        n: Number(n), code, createdAt: Date.now(), status: "novo", items: lines, customer,
        subtotalCents: subtotal, shippingCents: shipping, totalCents: subtotal + shipping,
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
