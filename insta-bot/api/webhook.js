// Webhook do Instagram: recebe comentários e mensagens de direct e aplica as automações.
// GET  /api/webhook → verificação feita pela Meta ao cadastrar o webhook.
// POST /api/webhook → eventos (assinados com X-Hub-Signature-256 = HMAC do corpo com o App Secret).
const crypto = require("crypto");
const ig = require("./_ig.js");
const ai = require("./_ai.js");
const { redis } = ig;

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const parts = [];
    req.on("data", (c) => parts.push(c));
    req.on("end", () => resolve(Buffer.concat(parts)));
    req.on("error", reject);
  });
}
function signatureOk(raw, header) {
  const secret = process.env.IG_APP_SECRET || "";
  if (!secret || !header) return false;
  const want = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return ig.sameHash(want, header);
}
// A Meta reenvia o mesmo evento se demorarmos; cada comentário/mensagem é tratado uma vez só.
async function firstTime(st, key) {
  const [ok] = await redis(st, ["SET", `ib:seen:${key}`, "1", "NX", "EX", String(7 * 86400)]);
  return ok === "OK";
}
// Direct enviado pelo robô: o eco que a Meta devolve não pode ser confundido com você escrevendo pelo app.
async function botSend(st, recipient, text, button) {
  const j = await ig.sendDm(st, recipient, text, button);
  if (j && j.message_id) await redis(st, ["SET", `ib:botmid:${j.message_id}`, "1", "EX", "86400"]);
  return j;
}
// Quando você assume a conversa (ou a IA passa para você), a IA fica quieta com essa pessoa por 24 h.
const pauseAi = (st, igsid) => redis(st, ["SET", `ib:ai:pause:${igsid}`, "1", "EX", "86400"]);
async function aiFor(st, kind, who) {
  if (!ai.ready()) return null;
  const s = await ai.getSettings(st);
  if (!s.enabled || !(kind === "dm" ? s.dm : s.comments)) return null;
  if (kind === "dm") { const [p] = await redis(st, ["GET", `ib:ai:pause:${who}`]); if (p) return null; }
  return (await ai.allowed(st, s, kind + ":" + who)) ? s : null;
}

async function onComment(st, me, v) {
  const myId = me.id;
  const from = v.from || {};
  const commentId = String(v.id || "");
  const mediaId = String((v.media && v.media.id) || "");
  if (!commentId || String(from.id) === myId) return; // ignora as respostas da própria conta
  if (!(await firstTime(st, "c:" + commentId))) return;
  const text = String(v.text || "");
  const base = { commentId, mediaId, user: from.username || "", text: text.slice(0, 300) };
  const rule = ig.pickRule(await ig.getRules(st), text, "comment", mediaId);
  if (!rule) return aiComment(st, me, from, base);

  const vars = { nome: from.username ? "@" + from.username : "", usuario: from.username || "" };
  const done = [], errors = [];
  const reply = ig.fill(ig.pick(rule.replies), vars);
  if (reply) { try { await ig.replyComment(st, commentId, reply); done.push("respondeu"); } catch (e) { errors.push("resposta: " + e.message); } }
  // Resposta privada: a Meta deixa mandar 1 direct por comentário, em até 7 dias.
  if (rule.dm) { try { await botSend(st, { comment_id: commentId }, ig.fill(rule.dm, vars), rule.button); done.push("direct"); } catch (e) { errors.push("direct: " + e.message); } }
  if (rule.hide) { try { await ig.hideComment(st, commentId); done.push("ocultou"); } catch (e) { errors.push("ocultar: " + e.message); } }
  await ig.log(st, { type: errors.length ? "error" : "auto_comment", rule: rule.name, ...base, done, errors });
}

async function aiComment(st, me, from, base) {
  const s = from.id && (await aiFor(st, "comment", from.id));
  if (!s || !base.text.trim()) return ig.log(st, { type: "comment", ...base });
  try {
    const r = await ai.ask(s, me.username, "comment", [{ from: "user", text: base.text }], from.username);
    if (r.action === "reply") {
      await ig.replyComment(st, base.commentId, r.reply);
      return ig.log(st, { type: "ai_comment", ...base, done: ["IA: " + r.reply.slice(0, 200)] });
    }
    return ig.log(st, { type: r.action === "human" ? "handoff" : "comment", ...base, ...(r.note ? { errors: ["IA: " + r.note] } : {}) });
  } catch (e) {
    return ig.log(st, { type: "error", ...base, errors: ["IA: " + e.message] });
  }
}

async function aiDm(st, me, sender, username, text) {
  const s = await aiFor(st, "dm", sender);
  if (!s) return false;
  const base = { user: username, igsid: sender, text: text.slice(0, 300) };
  try {
    const [items] = await redis(st, ["LRANGE", `ib:thread:${sender}`, "0", "11"]);
    const history = (items || []).map((x) => { try { return JSON.parse(x); } catch { return null; } })
      .filter((x) => x && (x.text || x.kind)).reverse().map((x) => ({ from: x.from, text: x.text || `[${x.kind}]` }));
    const r = await ai.ask(s, me.username, "dm", history.length ? history : [{ from: "user", text }], username);
    if (r.action === "reply") {
      await botSend(st, { id: sender }, r.reply);
      await ig.log(st, { type: "ai_dm", ...base, done: ["IA: " + r.reply.slice(0, 200)] });
    } else if (r.action === "human") {
      await pauseAi(st, sender);
      await redis(st, ["HSET", `ib:who:${sender}`, "human", "1"]);
      await ig.log(st, { type: "handoff", ...base, ...(r.note ? { errors: ["IA: " + r.note] } : {}) });
    } else await ig.log(st, { type: "dm", ...base });
  } catch (e) {
    await ig.log(st, { type: "error", ...base, errors: ["IA: " + e.message] });
  }
  return true;
}

async function onMessage(st, me, m) {
  const myId = me.id;
  const sender = String((m.sender && m.sender.id) || "");
  const msg = m.message;
  if (!msg || !sender) return;
  if (msg.is_echo || sender === myId) {
    // Mensagem que a conta mandou (pelo app do Instagram ou por aqui): entra no histórico da conversa.
    const to = String((m.recipient && m.recipient.id) || "");
    if (to && msg.mid && (await firstTime(st, "m:" + msg.mid))) {
      await ig.saveMsg(st, to, { from: "me", text: msg.text || "", mid: msg.mid });
      const [bot] = await redis(st, ["GET", `ib:botmid:${msg.mid}`]);
      if (!bot) await pauseAi(st, to); // você respondeu pelo app do Instagram
    }
    return;
  }
  if (msg.mid && !(await firstTime(st, "m:" + msg.mid))) return;
  const text = String((msg.quick_reply && msg.quick_reply.payload) || msg.text || "");
  const kind = msg.attachments ? (msg.attachments[0] && msg.attachments[0].type) || "anexo" : msg.reply_to && msg.reply_to.story ? "story" : "";
  const username = await ig.whoIs(st, sender);
  await ig.saveMsg(st, sender, { from: "user", text, kind, mid: msg.mid }, username);
  if (!text) return ig.log(st, { type: "dm", user: username, igsid: sender, text: kind ? `[${kind}]` : "" });

  const rule = ig.pickRule(await ig.getRules(st), text, "dm");
  // Palavra-chave tem prioridade; o que não bate com nenhuma vai para a IA (se ligada), antes da regra "qualquer texto".
  if ((!rule || rule.match === "any") && (await aiDm(st, me, sender, username, text))) return;
  if (!rule || !rule.dm) return ig.log(st, { type: "dm", user: username, igsid: sender, text: text.slice(0, 300) });
  // "Qualquer mensagem" responde no máximo 1 vez a cada 12 h por pessoa, para não virar conversa com o robô.
  if (rule.match === "any") {
    const [ok] = await redis(st, ["SET", `ib:any:${rule.id}:${sender}`, "1", "NX", "EX", String(12 * 3600)]);
    if (ok !== "OK") return ig.log(st, { type: "dm", user: username, igsid: sender, text: text.slice(0, 300) });
  }
  const reply = ig.fill(rule.dm, { nome: username ? "@" + username : "", usuario: username });
  try {
    await botSend(st, { id: sender }, reply, rule.button);
    await ig.log(st, { type: "auto_dm", rule: rule.name, user: username, igsid: sender, text: text.slice(0, 300), done: ["direct"] });
  } catch (e) {
    await ig.log(st, { type: "error", rule: rule.name, user: username, igsid: sender, text: text.slice(0, 300), errors: ["direct: " + e.message] });
  }
}

module.exports = async (req, res) => {
  res.setHeader("cache-control", "no-store");
  if (req.method === "GET") {
    const q = req.query || Object.fromEntries(new URL(req.url, "http://x").searchParams);
    const want = process.env.IG_VERIFY_TOKEN || "";
    if (q["hub.mode"] === "subscribe" && want && q["hub.verify_token"] === want) return res.status(200).send(String(q["hub.challenge"] || ""));
    return res.status(403).send("Token de verificação não confere.");
  }
  if (req.method !== "POST") return res.status(405).send("Use POST.");

  const raw = await readRaw(req);
  if (!signatureOk(raw, req.headers["x-hub-signature-256"])) return res.status(401).send("Assinatura inválida.");
  const st = ig.storage();
  if (!st) return res.status(503).send("Armazenamento não configurado.");
  let body;
  try { body = JSON.parse(raw.toString("utf8")); } catch { return res.status(400).send("JSON inválido."); }

  let me = { id: "", username: "" };
  try { me = await ig.me(st); } catch {}
  for (const entry of body.entry || []) {
    if (!me.id) me = { ...me, id: String(entry.id || "") };
    try {
      for (const ch of entry.changes || []) {
        if (ch.field === "comments" || ch.field === "live_comments") await onComment(st, me, ch.value || {});
        else if (ch.field === "mentions") await ig.log(st, { type: "mention", mediaId: ch.value && ch.value.media_id, commentId: ch.value && ch.value.comment_id });
      }
      for (const m of entry.messaging || []) await onMessage(st, me, m);
    } catch (e) {
      await ig.log(st, { type: "error", errors: ["webhook: " + e.message] }).catch(() => {});
    }
  }
  // Sempre 200: se falhar, a Meta reenviaria o mesmo evento várias vezes.
  return res.status(200).send("ok");
};
