// Programa de testadores: 15 vagas, chave de 15 dias na hora do cadastro e formulário de feedback.
const lib = require("./_lib");

const VAGAS = 15;
const DIAS_TESTE = 15;

function texto(v, max = 120) {
  return String(v || "").trim().slice(0, max);
}

function digitos(v) {
  return String(v || "").replace(/\D/g, "");
}

async function cadastrar(req, body, res) {
  // Campo escondido na página: só robô preenche.
  if (texto(body.site)) return res.status(400).json({ erro: "Não foi possível cadastrar." });
  if (!(await lib.limite("testador:" + lib.ip(req), 5, 3600))) return res.status(429).json({ erro: "Muitas tentativas deste endereço. Tente de novo mais tarde ou fale comigo no WhatsApp." });
  const nome = texto(body.nome, 80);
  const email = texto(body.email, 120).toLowerCase();
  const telefone = digitos(body.whatsapp).slice(0, 15);
  const camera = texto(body.camera, 80);
  const tablet = texto(body.tablet, 80);
  if (nome.length < 2) return res.status(400).json({ erro: "Coloque o seu nome." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ erro: "Confira o e-mail." });
  if (telefone.length < 10) return res.status(400).json({ erro: "Confira o WhatsApp, com DDD." });
  if (!camera || !tablet) return res.status(400).json({ erro: "Conte qual é a sua câmera e o seu tablet." });
  if (body.compromisso !== true) return res.status(400).json({ erro: "Para entrar, aceite o compromisso de feedback." });

  const licencaId = lib.novoId();
  const r = await lib.db("revela_tester_register", {
    p: { id: lib.novoId(), license_id: licencaId, name: nome, email, phone: telefone, instagram: texto(body.instagram, 60).replace(/^@/, ""), camera, tablet },
    p_limit: VAGAS,
  });

  if (r.cheio) return res.status(409).json({ erro: "As 15 vagas já foram preenchidas. Obrigado pelo interesse!", cheio: true });

  if (r.existente) {
    // Recuperar a chave: só com o mesmo e-mail e o mesmo WhatsApp do cadastro.
    if (digitos(r.tester.phone) !== telefone) return res.status(409).json({ erro: "Este e-mail já está cadastrado com outro WhatsApp." });
    const l = await lib.db("revela_license_get", { p_id: r.tester.license_id, p_ref: null });
    if (!l) return res.status(404).json({ erro: "Não achei a sua chave. Fale comigo no WhatsApp." });
    const { chave } = lib.assinar({ id: l.id, nome: l.name, plano: l.plan, ate: l.until, online: true });
    return res.status(200).json({ chave, ate: l.until, apk: lib.APK_URL, recuperada: true });
  }

  const ate = lib.somarDias(lib.hoje(), DIAS_TESTE);
  await lib.db("revela_license_save", {
    p: { id: licencaId, ref: "teste:" + r.tester.id, origin: "testador", name: nome, email, phone: telefone, plan: "teste", status: "ativa", until: ate },
  });
  const { chave } = lib.assinar({ id: licencaId, nome, plano: "teste", ate, online: true });
  return res.status(200).json({ chave, ate, apk: lib.APK_URL });
}

async function feedback(req, body, res) {
  if (!(await lib.limite("feedback:" + lib.ip(req), 30, 3600))) return res.status(429).json({ erro: "Muitos envios seguidos. Tente de novo mais tarde." });
  const email = texto(body.email, 120).toLowerCase();
  const nota = parseInt(body.nota, 10);
  const dia = parseInt(body.dia, 10);
  const r = await lib.db("revela_feedback_save", {
    p: {
      email,
      day: dia > 0 ? String(Math.min(dia, 30)) : "",
      rating: nota >= 0 && nota <= 10 ? String(nota) : "",
      helped: texto(body.ajudou, 2000),
      blocked: texto(body.travou, 2000),
      client: texto(body.cliente, 2000),
      ideas: texto(body.ideias, 2000),
    },
  });
  if (!r || !r.ok) return res.status(404).json({ erro: "Não achei esse e-mail entre os testadores. Use o e-mail do cadastro." });
  return res.status(200).json({ ok: true });
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const usadas = await lib.db("revela_tester_count", {});
      return res.status(200).json({ vagas: VAGAS, restantes: Math.max(0, VAGAS - Number(usadas || 0)) });
    }
    if (req.method !== "POST") return res.status(405).json({ erro: "Use GET ou POST" });
    const body = lib.corpo(req);
    if (body.acao === "feedback") return await feedback(req, body, res);
    return await cadastrar(req, body, res);
  } catch (e) {
    console.error(e);
    return res.status(503).json({ erro: "Servidor indisponível. Tente de novo em instantes." });
  }
};
