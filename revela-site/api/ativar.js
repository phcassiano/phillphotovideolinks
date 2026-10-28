// Ativação e renovação: o app manda a chave e o código do tablet; o servidor liga a chave ao
// primeiro tablet e devolve uma chave dele com a validade atual da assinatura.
const lib = require("./_lib");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erro: "Use POST" });
  const body = lib.corpo(req);
  const aparelho = String(body.aparelho || "").toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(aparelho)) return res.status(400).json({ erro: "Código do aparelho inválido" });
  const dados = lib.ler(body.chave);
  if (!dados) return res.status(400).json({ erro: "Chave inválida. Confira se copiou inteira." });

  let licenca;
  try {
    licenca = await lib.db("revela_license_get", { p_id: dados.i, p_ref: null });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ erro: "Servidor indisponível. Tente de novo em instantes." });
  }
  // Chave feita fora do banco (as antigas, a do dono): vale como está.
  if (!licenca) return res.status(200).json({ chave: body.chave, ate: dados.a });

  if (licenca.status === "reembolsada" || licenca.status === "revogada") {
    return res.status(403).json({ erro: "Esta chave foi cancelada.", revogada: true });
  }
  if (licenca.device && licenca.device !== aparelho) {
    return res.status(409).json({ erro: `Esta chave já está ativada em outro tablet (${licenca.device}). Fale com o suporte para trocar de aparelho.` });
  }
  if (!licenca.device) {
    licenca.device = aparelho;
    await lib.db("revela_license_save", { p: licenca });
  }
  const { chave } = lib.assinar({ id: licenca.id, nome: licenca.name, plano: licenca.plan, ate: licenca.until, aparelho });
  return res.status(200).json({ chave, ate: licenca.until, situacao: licenca.status });
};
