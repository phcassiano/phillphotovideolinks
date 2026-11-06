// Painel do lojista: POST /api/painel {op, token, ...}
// Entrar com o endereço da loja (slug) e a senha. A sessão vale 30 dias.
const db = require("./_db.js");
const { redis, K, send } = db;
const { loadStore } = require("./loja.js");

const SESSION_DAYS = 30;
const MAX_IMAGES = 4000;
const MAX_PRODUCTS = 3000;
const MAX_IMG_BYTES = 1200000;
const STATUSES = ["novo", "confirmado", "enviado", "concluido", "cancelado"];

async function newSession(st, slug) {
  const token = db.newId(24);
  await redis(st, ["SET", K.sess(db.sha(token)), slug, "EX", String(SESSION_DAYS * 86400)]);
  return token;
}
async function sessionSlug(st, token) {
  if (!/^[a-f0-9]{48}$/.test(String(token || ""))) return null;
  const [slug] = await redis(st, ["GET", K.sess(db.sha(token))]);
  return slug || null;
}
async function dropImages(st, slug, ids) {
  ids = [...new Set(ids.filter(Boolean))];
  if (!ids.length) return;
  const own = await redis(st, ...ids.map((id) => ["SISMEMBER", K.imgs(slug), id]));
  const mine = ids.filter((_, i) => Number(own[i]) === 1);
  if (mine.length) await redis(st, ...mine.map((id) => ["DEL", K.img(id)]), ["SREM", K.imgs(slug), ...mine]);
}
const settingsImages = (s) => [s.logo, ...(s.banners || []).flatMap((b) => [b.image, b.imageMobile])].filter(Boolean);

function uniqueSlug(base, taken) {
  let s = base, i = 2;
  while (taken.has(s)) s = `${base}-${i++}`;
  return s;
}

module.exports = async (req, res) => {
  db.cors(res);
  if (req.method !== "POST") return send(res, 405, { error: "Método não permitido." });
  const st = db.storage();
  if (!st) return send(res, 503, { error: "Banco de dados não configurado." });
  const ip = db.clientIp(req);
  try {
    const body = await db.readBody(req);
    const op = body.op;

    if (op === "login") {
      if (await db.overLimit(st, "login", ip)) return send(res, 429, { error: "Muitas tentativas. Tente de novo em 1 hora." });
      const slug = String(body.slug || "").trim().toLowerCase().replace(/^.*\//, "");
      const [raw] = db.SLUG_RE.test(slug) ? await redis(st, ["GET", K.meta(slug)]) : [null];
      const meta = db.parse(raw);
      if (!meta || !db.checkPassword(String(body.password || ""), meta.passHash)) {
        await db.countHit(st, "login", ip);
        return send(res, 401, { error: "Endereço da loja ou senha incorretos." });
      }
      return send(res, 200, { token: await newSession(st, slug), slug });
    }

    const slug = await sessionSlug(st, body.token);
    if (!slug) return send(res, 401, { error: "Sua sessão expirou. Entre de novo." });

    if (op === "logout") {
      await redis(st, ["DEL", K.sess(db.sha(body.token))]);
      return send(res, 200, { ok: true });
    }

    if (op === "me") {
      const store = await loadStore(st, slug);
      if (!store) return send(res, 404, { error: "Loja não encontrada." });
      const m = store.meta;
      store.products.sort((a, b) => b.createdAt - a.createdAt);
      return send(res, 200, {
        slug,
        account: { paidUntil: m.paidUntil || null, status: m.status || "active", plan: m.plan || "start", state: db.storeState(m), createdAt: m.createdAt },
        settings: store.settings, categories: store.categories, products: store.products, brand: db.brand(),
      });
    }

    if (op === "saveSettings") {
      const [oldRaw] = await redis(st, ["GET", K.settings(slug)]);
      const old = db.parse(oldRaw, {});
      const s = db.cleanSettings(body.settings, slug);
      await redis(st, ["SET", K.settings(slug), JSON.stringify(s)]);
      const keep = new Set(settingsImages(s));
      await dropImages(st, slug, settingsImages(old).filter((id) => !keep.has(id)));
      return send(res, 200, { settings: s });
    }

    if (op === "saveCategories") {
      const [oldRaw] = await redis(st, ["GET", K.cats(slug)]);
      const old = db.parse(oldRaw, []);
      const cats = db.cleanCategories(body.categories);
      // Se o nome (e o slug) de uma categoria mudou, leva os produtos junto.
      const renames = {};
      for (const c of cats) { const o = old.find((x) => x.id === c.id); if (o && o.slug !== c.slug) renames[o.slug] = c.slug; }
      const writes = [["SET", K.cats(slug), JSON.stringify(cats)]];
      if (Object.keys(renames).length) {
        const store = await loadStore(st, slug);
        for (const p of store.products) {
          let changed = false;
          if (renames[p.category]) { p.category = renames[p.category]; changed = true; }
          const ex = (p.extraCategories || []).map((c) => renames[c] || c);
          if (ex.join() !== (p.extraCategories || []).join()) { p.extraCategories = ex; changed = true; }
          if (changed) writes.push(["HSET", K.products(slug), p.id, JSON.stringify(p)]);
        }
      }
      await redis(st, ...writes);
      const keep = new Set(cats.map((c) => c.image).filter(Boolean));
      await dropImages(st, slug, old.map((c) => c.image).filter((id) => id && !keep.has(id)));
      return send(res, 200, { categories: cats });
    }

    if (op === "saveProduct") {
      const p = body.product || {};
      const store = await loadStore(st, slug);
      const old = p.id ? store.products.find((x) => x.id === p.id) : null;
      if (p.id && !old) return send(res, 404, { error: "Produto não encontrado." });
      if (!old && store.products.length >= MAX_PRODUCTS) return send(res, 400, { error: `Limite de ${MAX_PRODUCTS} produtos.` });
      const clean = db.cleanProduct(p, old);
      if (!clean.name) return send(res, 400, { error: "Dê um nome ao produto." });
      if (!clean.slug) clean.slug = uniqueSlug(db.slugify(clean.name), new Set(store.products.filter((x) => x.id !== clean.id).map((x) => x.slug)));
      await redis(st, ["HSET", K.products(slug), clean.id, JSON.stringify(clean)]);
      if (old) { const keep = new Set(clean.images); await dropImages(st, slug, old.images.filter((id) => !keep.has(id))); }
      return send(res, 200, { product: clean });
    }

    if (op === "bulkProducts") {
      // Ações em vários produtos: ocultar, mostrar, destacar, mudar categoria.
      const ids = Array.isArray(body.ids) ? body.ids.slice(0, 500).map(String) : [];
      const raws = ids.length ? await redis(st, ...ids.map((id) => ["HGET", K.products(slug), id])) : [];
      const writes = [];
      raws.forEach((r) => {
        const p = db.parse(r); if (!p) return;
        if (body.action === "hide") p.hidden = true;
        else if (body.action === "show") p.hidden = false;
        else if (body.action === "feature") p.featured = true;
        else if (body.action === "unfeature") p.featured = false;
        else if (body.action === "category") p.category = db.str(body.category, 60);
        else return;
        writes.push(["HSET", K.products(slug), p.id, JSON.stringify(p)]);
      });
      if (writes.length) await redis(st, ...writes);
      return send(res, 200, { changed: writes.length });
    }

    if (op === "deleteProduct") {
      const [raw] = await redis(st, ["HGET", K.products(slug), String(body.id || "")]);
      const p = db.parse(raw);
      if (!p) return send(res, 404, { error: "Produto não encontrado." });
      await redis(st, ["HDEL", K.products(slug), p.id]);
      await dropImages(st, slug, p.images);
      return send(res, 200, { ok: true });
    }

    if (op === "uploadImage") {
      if (await db.overLimit(st, "upload", ip)) return send(res, 429, { error: "Muitas imagens em pouco tempo. Tente daqui a pouco." });
      const m = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data || ""));
      if (!m) return send(res, 400, { error: "Formato de imagem inválido." });
      if (m[2].length * 0.75 > MAX_IMG_BYTES) return send(res, 400, { error: "Imagem grande demais." });
      const [count] = await redis(st, ["SCARD", K.imgs(slug)]);
      if (Number(count) >= MAX_IMAGES) return send(res, 400, { error: "Limite de imagens da loja atingido. Apague produtos antigos." });
      const id = `${slug}-${db.newId(8)}`;
      await redis(st, ["SET", K.img(id), `${m[1]};${m[2]}`], ["SADD", K.imgs(slug), id], ["INCR", K.lim("upload", ip)], ["EXPIRE", K.lim("upload", ip), "3600"]);
      return send(res, 200, { id });
    }

    if (op === "orders") {
      const [all] = await redis(st, ["HGETALL", K.orders(slug)]);
      const vals = Array.isArray(all) ? all.filter((_, i) => i % 2) : Object.values(all || {});
      const orders = vals.map((v) => db.parse(v)).filter(Boolean).sort((a, b) => b.n - a.n).slice(0, 500);
      return send(res, 200, { orders });
    }

    if (op === "setOrderStatus") {
      const status = String(body.status || "");
      if (!STATUSES.includes(status)) return send(res, 400, { error: "Status inválido." });
      const [raw] = await redis(st, ["HGET", K.orders(slug), String(body.n || "")]);
      const o = db.parse(raw);
      if (!o) return send(res, 404, { error: "Pedido não encontrado." });
      const wasCancel = o.status === "cancelado", isCancel = status === "cancelado";
      // Cancelar devolve o estoque; reabrir um cancelado tira de novo.
      if (wasCancel !== isCancel) {
        const ids = [...new Set(o.items.map((i) => i.pid))];
        const cur = await redis(st, ...ids.map((id) => ["HGET", K.products(slug), id]));
        const w = [];
        ids.forEach((id, idx) => {
          const p = db.parse(cur[idx]); if (!p) return;
          let changed = false;
          for (const it of o.items.filter((i) => i.pid === id)) {
            const k = (it.size || "") + "|" + (it.color || "");
            if (p.stock && k in p.stock) { p.stock[k] = Math.max(0, p.stock[k] + (isCancel ? it.qty : -it.qty)); changed = true; }
          }
          if (changed) w.push(["HSET", K.products(slug), id, JSON.stringify(p)]);
        });
        if (w.length) await redis(st, ...w);
      }
      o.status = status;
      o.updatedAt = Date.now();
      if (body.note !== undefined) o.storeNote = db.str(body.note, 400);
      await redis(st, ["HSET", K.orders(slug), String(o.n), JSON.stringify(o)]);
      return send(res, 200, { order: o });
    }

    if (op === "stats") {
      const days = Math.max(1, Math.min(90, Number(body.days) || 30));
      const dates = [];
      for (let i = days - 1; i >= 0; i--) dates.push(db.today(new Date(Date.now() - i * db.DAY)));
      const rows = await redis(st, ...dates.map((d) => ["HGETALL", K.stat(slug, d)]));
      const out = dates.map((d, i) => {
        const r = rows[i]; const o = { date: d };
        if (Array.isArray(r)) for (let j = 0; j < r.length; j += 2) o[r[j]] = Number(r[j + 1]);
        else for (const k in r || {}) o[k] = Number(r[k]);
        return o;
      });
      return send(res, 200, { days: out });
    }

    if (op === "changePassword") {
      const [raw] = await redis(st, ["GET", K.meta(slug)]);
      const meta = db.parse(raw);
      if (!meta || !db.checkPassword(String(body.old || ""), meta.passHash)) return send(res, 400, { error: "A senha atual está errada." });
      if (String(body.password || "").length < 8) return send(res, 400, { error: "A nova senha precisa de pelo menos 8 caracteres." });
      meta.passHash = db.hashPassword(body.password);
      await redis(st, ["SET", K.meta(slug), JSON.stringify(meta)]);
      return send(res, 200, { ok: true });
    }

    return send(res, 400, { error: "Operação desconhecida." });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: "Erro no servidor. Tente de novo." });
  }
};
module.exports.newSession = newSession;
