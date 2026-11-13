// Painel do negócio: guarda os dados (um hash Redis por coleção, um campo por item).
// Acesso só com a senha PAINEL_SENHA (variável de ambiente na Vercel, mínimo 10 caracteres).
const { storage, redis, crypto } = require("./_redis.js");

const COLS = ["jobs", "quotes", "clients", "finance", "prices", "prompts", "notes", "tasks", "settings"];
const PREFIX = "painel:";
const MAX_ITEM = 200 * 1024; // 200 KB por item
const MAX_BATCH = 300;
const FAIL_MAX = 10, FAIL_WINDOW = 3600; // 10 senhas erradas por hora por IP

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
function keyOk(given) {
  const want = process.env.PAINEL_SENHA || "";
  return want.length >= 10 && crypto.timingSafeEqual(sha(given || ""), sha(want));
}
const clientIp = (req) => String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "anon";
const validId = (s) => typeof s === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(s);

module.exports = async (req, res) => {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch { return res.status(400).json({ error: "JSON inválido." }); } }

  const st = storage();
  const configured = (process.env.PAINEL_SENHA || "").length >= 10;
  if (body.op === "ping") return res.status(200).json({ ok: true, storage: !!st, configured });
  if (!st) return res.status(503).json({ error: "Armazenamento não configurado. Conecte um Redis/Upstash ao projeto na Vercel." });
  if (!configured) return res.status(503).json({ error: "Defina a variável PAINEL_SENHA (mínimo 10 caracteres) na Vercel." });

  try {
    const ip = clientIp(req);
    const failKey = `${PREFIX}fail:${ip}`;
    const [fails] = await redis(st, ["GET", failKey]);
    if (Number(fails || 0) >= FAIL_MAX) return res.status(429).json({ error: "Muitas tentativas com senha errada. Tente de novo em 1 hora." });
    if (!keyOk(req.headers["x-painel-key"] || body.key)) {
      await redis(st, ["INCR", failKey], ["EXPIRE", failKey, String(FAIL_WINDOW)]);
      return res.status(401).json({ error: "Senha incorreta." });
    }

    if (body.op === "load") {
      const flat = await redis(st, ...COLS.map((c) => ["HGETALL", PREFIX + c]));
      const data = {};
      COLS.forEach((c, i) => {
        const arr = flat[i] || [];
        const items = [];
        if (Array.isArray(arr)) for (let j = 0; j < arr.length; j += 2) { try { items.push(JSON.parse(arr[j + 1])); } catch {} }
        else for (const v of Object.values(arr)) { try { items.push(JSON.parse(v)); } catch {} }
        data[c] = items;
      });
      return res.status(200).json({ ok: true, data, now: Date.now() });
    }

    if (body.op === "put") {
      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length > MAX_BATCH) return res.status(413).json({ error: "Lote grande demais." });
      for (const it of items) {
        if (!it || !COLS.includes(it.col) || !it.item || !validId(it.item.id)) return res.status(400).json({ error: "Item inválido." });
        if (JSON.stringify(it.item).length > MAX_ITEM) return res.status(413).json({ error: "Item grande demais." });
      }
      if (!items.length) return res.status(200).json({ ok: true, saved: 0 });
      const current = await redis(st, ...items.map((it) => ["HGET", PREFIX + it.col, it.item.id]));
      const writes = [];
      const kept = [];
      items.forEach((it, i) => {
        let old = null; try { old = current[i] ? JSON.parse(current[i]) : null; } catch {}
        const newer = !old || Number(it.item.updatedAt || 0) >= Number(old.updatedAt || 0);
        if (newer) writes.push(["HSET", PREFIX + it.col, it.item.id, JSON.stringify(it.item)]);
        else kept.push({ col: it.col, item: old });
      });
      if (writes.length) await redis(st, ...writes);
      // "kept": itens em que o servidor tinha uma versão mais nova; o app troca a dele por essa.
      return res.status(200).json({ ok: true, saved: writes.length, kept });
    }

    return res.status(400).json({ error: "Operação desconhecida." });
  } catch (e) {
    return res.status(500).json({ error: "Erro no servidor: " + (e && e.message ? e.message : "desconhecido") });
  }
};
