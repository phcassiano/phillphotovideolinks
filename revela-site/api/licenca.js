// Emite chaves de ativação do Revela. Só quem tem a senha de administrador (variável
// REVELA_ADMIN_SENHA no Vercel) consegue; a chave privada fica em REVELA_CHAVE_PRIVADA.
const crypto = require("crypto");

/** Gera a chave "REVELA-<dados>.<assinatura>" que o app confere com a chave pública. */
function gerarChave(privadaPem, { nome, plano, ate, aparelho }) {
  const dados = JSON.stringify({
    i: crypto.randomBytes(6).toString("base64url"),
    n: String(nome || "").slice(0, 80),
    p: String(plano || "").slice(0, 20),
    a: ate,
    d: (aparelho || "*").toUpperCase(),
  });
  const bytes = Buffer.from(dados, "utf8");
  const assinatura = crypto.sign("sha256", bytes, { key: privadaPem, dsaEncoding: "der" });
  return { id: JSON.parse(dados).i, chave: "REVELA-" + bytes.toString("base64url") + "." + assinatura.toString("base64url") };
}

/** Data de validade: a informada, ou hoje + dias (+5 de folga para a renovação). */
function validade(ate, dias, hoje = new Date()) {
  if (ate && /^\d{4}-\d{2}-\d{2}$/.test(ate)) return ate;
  const d = new Date(hoje.getTime() + (Number(dias) + 5) * 86400000);
  return d.toISOString().slice(0, 10);
}

const DIAS = { mensal: 31, anual: 366, vitalicia: 36500, cortesia: 30 };

function iguais(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erro: "Use POST" });
  const senha = process.env.REVELA_ADMIN_SENHA;
  const privada = process.env.REVELA_CHAVE_PRIVADA;
  if (!senha || !privada) return res.status(500).json({ erro: "Servidor sem configuração" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (!iguais(body.senha || "", senha)) {
    await new Promise((r) => setTimeout(r, 800));
    return res.status(401).json({ erro: "Senha incorreta" });
  }
  const plano = DIAS[body.plano] ? body.plano : "mensal";
  const aparelho = String(body.aparelho || "*").trim().toUpperCase();
  if (aparelho !== "*" && !/^[A-Z0-9]{8}$/.test(aparelho)) return res.status(400).json({ erro: "Código do aparelho tem 8 letras/números" });
  const ate = validade(body.ate, body.dias || DIAS[plano]);
  const { id, chave } = gerarChave(privada.replace(/\\n/g, "\n"), { nome: body.nome, plano, ate, aparelho });
  return res.status(200).json({ id, chave, ate, plano, aparelho });
};

module.exports.gerarChave = gerarChave;
module.exports.validade = validade;
