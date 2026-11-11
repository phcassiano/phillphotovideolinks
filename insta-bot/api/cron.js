// Renova o token do Instagram (vale 60 dias). Agendado em vercel.json para toda segunda-feira.
const ig = require("./_ig.js");

module.exports = async (req, res) => {
  res.setHeader("cache-control", "no-store");
  const secret = process.env.CRON_SECRET || "";
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "Não autorizado." });
  const st = ig.storage();
  if (!st) return res.status(503).json({ error: "Armazenamento não configurado." });
  try {
    const t = await ig.refreshToken(st);
    await ig.log(st, { type: "token", text: "Token renovado até " + new Date(t.expiresAt).toISOString().slice(0, 10) });
    return res.status(200).json({ ok: true, expiresAt: t.expiresAt });
  } catch (e) {
    await ig.log(st, { type: "error", errors: ["renovar token: " + e.message] }).catch(() => {});
    return res.status(502).json({ error: e.message });
  }
};
