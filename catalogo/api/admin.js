// Seu painel de dono da plataforma: POST /api/admin {op, key, ...}
// A chave é a variável CATALOGO_ADMIN_KEY (mínimo 10 caracteres).
const db = require("./_db.js");
const { redis, K, send } = db;
const { newSession } = require("./painel.js");

function adminOk(given) {
  const want = process.env.CATALOGO_ADMIN_KEY || "";
  return want.length >= 10 && db.sameStr(String(given || ""), want);
}

module.exports = async (req, res) => {
  db.cors(res);
  if (req.method !== "POST") return send(res, 405, { error: "Método não permitido." });
  const st = db.storage();
  if (!st) return send(res, 503, { error: "Banco de dados não configurado." });
  const ip = db.clientIp(req);
  try {
    if (await db.overLimit(st, "admin", ip)) return send(res, 429, { error: "Muitas tentativas. Tente de novo em 1 hora." });
    const body = await db.readBody(req);
    if (!adminOk(body.key)) { await db.countHit(st, "admin", ip); return send(res, 401, { error: "Chave incorreta." }); }
    const op = body.op;
    const slug = String(body.slug || "").trim().toLowerCase();

    if (op === "list") {
      const [slugs] = await redis(st, ["SMEMBERS", K.stores]);
      const list = (slugs || []).sort();
      if (!list.length) return send(res, 200, { stores: [], brand: db.brand() });
      const cmds = [];
      for (const s of list) cmds.push(["GET", K.meta(s)], ["GET", K.settings(s)], ["HLEN", K.products(s)], ["GET", K.orderSeq(s)], ["SCARD", K.imgs(s)]);
      const r = await redis(st, ...cmds);
      const stores = list.map((s, i) => {
        const meta = db.parse(r[i * 5], {}), set = db.parse(r[i * 5 + 1], {});
        return {
          slug: s, name: set.name || s, whatsapp: set.whatsapp || "", owner: meta.owner || "", ownerPhone: meta.ownerPhone || "",
          plan: meta.plan || "start", status: meta.status || "active", paidUntil: meta.paidUntil || null, createdAt: meta.createdAt,
          notes: meta.notes || "", state: db.storeState(meta), products: Number(r[i * 5 + 2]) || 0, orders: Number(r[i * 5 + 3]) || 0, images: Number(r[i * 5 + 4]) || 0,
        };
      });
      return send(res, 200, { stores, brand: db.brand() });
    }

    if (!db.SLUG_RE.test(slug)) return send(res, 400, { error: "Endereço inválido. Use letras minúsculas, números e hífen (ex.: minha-loja)." });
    const [metaRaw] = await redis(st, ["GET", K.meta(slug)]);
    const meta = db.parse(metaRaw);

    if (op === "create") {
      if (db.RESERVED.has(slug)) return send(res, 400, { error: "Esse endereço é reservado. Escolha outro." });
      if (meta) return send(res, 409, { error: "Já existe uma loja com esse endereço." });
      const password = String(body.password || "") || db.newPassword();
      if (password.length < 8) return send(res, 400, { error: "A senha precisa de pelo menos 8 caracteres." });
      const days = Math.max(0, Math.min(400, Number(body.days ?? 30)));
      const m = {
        slug, createdAt: Date.now(), status: "active", plan: body.plan === "growth" ? "growth" : "start",
        paidUntil: Date.now() + days * db.DAY, passHash: db.hashPassword(password),
        owner: db.str(body.owner, 80), ownerPhone: db.phone(body.ownerPhone), notes: db.str(body.notes, 500),
      };
      const settings = db.cleanSettings({
        name: body.name || slug, whatsapp: body.whatsapp, color: body.color,
        payments: ["Pix", "Cartão de crédito", "Dinheiro"], greeting: "Olá! Vim pelo catálogo.",
        highlights: [{ title: "Pedido pelo WhatsApp", text: "Escolha e finalize em poucos cliques" }, { title: "Atendimento rápido", text: "Resposta na hora em horário comercial" }, { title: "Compra segura", text: "Você combina tudo direto com a loja" }],
      }, slug);
      const cats = db.cleanCategories([{ name: "Novidades" }]);
      await redis(st, ["SET", K.meta(slug), JSON.stringify(m)], ["SET", K.settings(slug), JSON.stringify(settings)], ["SET", K.cats(slug), JSON.stringify(cats)], ["SADD", K.stores, slug]);
      return send(res, 200, { slug, password });
    }

    if (!meta) return send(res, 404, { error: "Loja não encontrada." });

    if (op === "update") {
      if (body.status) meta.status = body.status === "paused" ? "paused" : "active";
      if (body.plan) meta.plan = body.plan === "growth" ? "growth" : "start";
      if (body.paidUntil !== undefined) { const t = Number(body.paidUntil); if (t > 0) meta.paidUntil = t; }
      if (body.addDays !== undefined) {
        const base = Math.max(Date.now(), meta.paidUntil || 0);
        meta.paidUntil = base + Math.max(-400, Math.min(400, Number(body.addDays) || 0)) * db.DAY;
      }
      if (body.owner !== undefined) meta.owner = db.str(body.owner, 80);
      if (body.ownerPhone !== undefined) meta.ownerPhone = db.phone(body.ownerPhone);
      if (body.notes !== undefined) meta.notes = db.str(body.notes, 500);
      await redis(st, ["SET", K.meta(slug), JSON.stringify(meta)]);
      return send(res, 200, { ok: true, paidUntil: meta.paidUntil, status: meta.status, state: db.storeState(meta) });
    }

    if (op === "resetPassword") {
      const password = db.newPassword();
      meta.passHash = db.hashPassword(password);
      await redis(st, ["SET", K.meta(slug), JSON.stringify(meta)]);
      return send(res, 200, { password });
    }

    if (op === "loginAs") return send(res, 200, { token: await newSession(st, slug), slug });

    if (op === "delete") {
      if (body.confirm !== slug) return send(res, 400, { error: "Digite o endereço da loja para confirmar." });
      const [imgs] = await redis(st, ["SMEMBERS", K.imgs(slug)]);
      const dels = (imgs || []).map((id) => ["DEL", K.img(id)]);
      for (let i = 0; i < dels.length; i += 200) await redis(st, ...dels.slice(i, i + 200));
      await redis(st, ["DEL", K.meta(slug)], ["DEL", K.settings(slug)], ["DEL", K.cats(slug)], ["DEL", K.products(slug)], ["DEL", K.orders(slug)], ["DEL", K.orderSeq(slug)], ["DEL", K.imgs(slug)], ["DEL", K.leads(slug)], ["SREM", K.stores, slug]);
      return send(res, 200, { ok: true });
    }

    return send(res, 400, { error: "Operação desconhecida." });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: "Erro no servidor. Tente de novo." });
  }
};
