// Teste grátis por aparelho: reinstalar o app não começa um teste novo.
const lib = require("./_lib");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erro: "Use POST" });
  const aparelho = String(lib.corpo(req).aparelho || "").toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(aparelho)) return res.status(400).json({ erro: "Código do aparelho inválido" });
  try {
    const inicio = await lib.db("revela_trial", { p_device: aparelho });
    return res.status(200).json({ inicio: String(inicio).slice(0, 10), dias: lib.TRIAL_DIAS });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ erro: "Servidor indisponível" });
  }
};
