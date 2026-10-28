// Peças comuns das funções do Revela no Vercel: assinatura das chaves, banco (Supabase) e regras.
const crypto = require("crypto");

const APK_URL = "https://github.com/phcassiano/phillphotovideolinks/raw/ccr-728020fa-1g3t9z/sony-tether/Revela.apk";
const TRIAL_DIAS = 3;
const FOLGA_DIAS = 5;
const DIAS = { mensal: 31, anual: 366, vitalicia: 36500, cortesia: 30 };

function privada() {
  return String(process.env.REVELA_CHAVE_PRIVADA || "").replace(/\\n/g, "\n");
}

function novoId() {
  return crypto.randomBytes(6).toString("base64url");
}

/** Chave "REVELA-<dados>.<assinatura>". online=true: precisa ser ativada pela internet (liga ao 1º tablet). */
function assinar({ id, nome, plano, ate, aparelho, online }, chavePrivada = privada()) {
  const dados = { i: id || novoId(), n: String(nome || "").slice(0, 80), p: String(plano || "").slice(0, 20), a: ate, d: (aparelho || "*").toUpperCase() };
  if (online) dados.o = "1";
  const bytes = Buffer.from(JSON.stringify(dados), "utf8");
  const sig = crypto.sign("sha256", bytes, { key: chavePrivada, dsaEncoding: "der" });
  return { id: dados.i, chave: "REVELA-" + bytes.toString("base64url") + "." + sig.toString("base64url") };
}

/** Lê e confere uma chave; devolve os dados ou null. */
function ler(chave, chavePrivada = privada()) {
  const corpo = String(chave || "").replace(/\s+/g, "").replace(/^REVELA-/, "");
  const [d, s] = corpo.split(".");
  if (!d || !s) return null;
  try {
    const pub = crypto.createPublicKey(chavePrivada);
    const bytes = Buffer.from(d, "base64url");
    if (!crypto.verify("sha256", bytes, { key: pub, dsaEncoding: "der" }, Buffer.from(s, "base64url"))) return null;
    return JSON.parse(bytes.toString("utf8"));
  } catch (e) {
    return null;
  }
}

function hoje(agora = new Date()) {
  return agora.toISOString().slice(0, 10);
}

function somarDias(dataIso, dias) {
  const d = new Date(dataIso + "T12:00:00Z");
  return new Date(d.getTime() + dias * 86400000).toISOString().slice(0, 10);
}

/** Validade de uma assinatura nova: hoje + dias do plano + folga para a renovação. */
function validadeNova(plano, agora = new Date()) {
  return somarDias(hoje(agora), (DIAS[plano] || DIAS.mensal) + FOLGA_DIAS);
}

/** Renovação: soma o período ao que ainda restava (ou a partir de hoje, se já venceu). */
function validadeRenovada(ateAtual, plano, agora = new Date()) {
  const base = ateAtual && ateAtual > hoje(agora) ? ateAtual : hoje(agora);
  return somarDias(base, (DIAS[plano] || DIAS.mensal) + (ateAtual && ateAtual > hoje(agora) ? 0 : FOLGA_DIAS));
}

function iguais(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

/** Chama uma função revela_* do Supabase (todas exigem o segredo do servidor). */
async function db(funcao, args) {
  const url = process.env.REVELA_SUPABASE_URL;
  const chave = process.env.REVELA_SUPABASE_CHAVE;
  const r = await fetch(`${url}/rest/v1/rpc/${funcao}`, {
    method: "POST",
    headers: { apikey: chave, "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ p_secret: process.env.REVELA_DB_SEGREDO }, args)),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`banco: ${funcao} ${r.status} ${texto.slice(0, 200)}`);
  return texto ? JSON.parse(texto) : null;
}

/** Celular brasileiro para o wa.me: só números, com 55. */
function whatsappDe(telefone) {
  let n = String(telefone || "").replace(/\D/g, "");
  if (!n) return "";
  if (n.length <= 11) n = "55" + n;
  return n;
}

function mensagemCliente(nome, chave, plano) {
  const primeiro = String(nome || "").trim().split(/\s+/)[0] || "";
  return (
    `Oi${primeiro ? ", " + primeiro : ""}! ${plano === "teste" ? "Obrigado por testar o Revela" : "Obrigado por assinar o Revela"} 📸\n\n` +
    `1) Instale o app no tablet: ${APK_URL}\n` +
    `2) Abra o Revela → Assinatura → Inserir chave\n` +
    `3) Cole esta chave (precisa de internet na primeira vez):\n\n${chave}\n\n` +
    `A chave fica ligada ao primeiro tablet em que for ativada. Qualquer dúvida, é só responder aqui.`
  );
}

function corpo(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }
  return req.body;
}

module.exports = { APK_URL, TRIAL_DIAS, FOLGA_DIAS, DIAS, novoId, assinar, ler, hoje, somarDias, validadeNova, validadeRenovada, iguais, db, whatsappDe, mensagemCliente, corpo };
