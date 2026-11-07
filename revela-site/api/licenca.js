// Chave feita à mão no /admin (cortesia, venda fora da Kiwify, a sua própria).
const lib = require("./_lib");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erro: "Use POST" });
  const body = lib.corpo(req);
  if (lib.recusarAdmin(res, await lib.admin(req, body.senha))) return;
  const plano = lib.DIAS[body.plano] ? body.plano : "mensal";
  const aparelho = String(body.aparelho || "*").trim().toUpperCase();
  if (aparelho !== "*" && !/^[A-Z0-9]{8}$/.test(aparelho)) return res.status(400).json({ erro: "Código do aparelho tem 8 letras/números" });
  const ate = body.ate && /^\d{4}-\d{2}-\d{2}$/.test(body.ate) ? body.ate : lib.validadeNova(plano);
  const { id, chave } = lib.assinar({ nome: body.nome, plano, ate, aparelho: aparelho === "*" ? "" : aparelho, online: aparelho === "*" && body.online !== false });
  try {
    await lib.db("revela_license_save", {
      p: { id, ref: "manual:" + id, origin: "manual", name: String(body.nome || "").slice(0, 80), email: body.email || null, phone: body.telefone || null, plan: plano, status: "ativa", until: ate, device: aparelho === "*" ? null : aparelho },
    });
  } catch (e) {
    console.error(e);
    // Chave de ativação sem registro no banco não ativaria: melhor avisar do que entregar uma chave que não funciona.
    return res.status(503).json({ erro: "Banco indisponível: a chave não foi registrada. Tente de novo." });
  }
  return res.status(200).json({ id, chave, ate, plano, aparelho });
};
