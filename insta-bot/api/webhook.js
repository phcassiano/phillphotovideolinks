// Webhook do Instagram: recebe comentários e mensagens de direct e aplica as automações.
// GET  /api/webhook → verificação feita pela Meta ao cadastrar o webhook.
// POST /api/webhook → eventos (assinados com X-Hub-Signature-256 = HMAC do corpo com o App Secret).
const crypto = require("crypto");
const ig = require("./_ig.js");
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

async function onComment(st, myId, v) {
  const from = v.from || {};
  const commentId = String(v.id || "");
  const mediaId = String((v.media && v.media.id) || "");
  if (!commentId || String(from.id) === myId) return; // ignora as respostas da própria conta
  if (!(await firstTime(st, "c:" + commentId))) return;
  const text = String(v.text || "");
  const base = { commentId, mediaId, user: from.username || "", text: text.slice(0, 300) };
  const rule = ig.pickRule(await ig.getRules(st), text, "comment", mediaId);
  if (!rule) return ig.log(st, { type: "comment", ...base });

  const vars = { nome: from.username ? "@" + from.username : "", usuario: from.username || "" };
  const done = [], errors = [];
  const reply = ig.fill(ig.pick(rule.replies), vars);
  if (reply) { try { await ig.replyComment(st, commentId, reply); done.push("respondeu"); } catch (e) { errors.push("resposta: " + e.message); } }
  // Resposta privada: a Meta deixa mandar 1 direct por comentário, em até 7 dias.
  if (rule.dm) { try { await ig.sendDm(st, { comment_id: commentId }, ig.fill(rule.dm, vars), rule.button); done.push("direct"); } catch (e) { errors.push("direct: " + e.message); } }
  if (rule.hide) { try { await ig.hideComment(st, commentId); done.push("ocultou"); } catch (e) { errors.push("ocultar: " + e.message); } }
  await ig.log(st, { type: errors.length ? "error" : "auto_comment", rule: rule.name, ...base, done, errors });
}

async function onMessage(st, myId, m) {
  const sender = String((m.sender && m.sender.id) || "");
  const msg = m.message;
  if (!msg || !sender) return;
  if (msg.is_echo || sender === myId) {
    // Mensagem que a conta mandou (pelo app do Instagram ou por aqui): entra no histórico da conversa.
    const to = String((m.recipient && m.recipient.id) || "");
    if (to && msg.mid && (await firstTime(st, "m:" + msg.mid))) await ig.saveMsg(st, to, { from: "me", text: msg.text || "", mid: msg.mid });
    return;
  }
  if (msg.mid && !(await firstTime(st, "m:" + msg.mid))) return;
  const text = String((msg.quick_reply && msg.quick_reply.payload) || msg.text || "");
  const kind = msg.attachments ? (msg.attachments[0] && msg.attachments[0].type) || "anexo" : msg.reply_to && msg.reply_to.story ? "story" : "";
  const username = await ig.whoIs(st, sender);
  await ig.saveMsg(st, sender, { from: "user", text, kind, mid: msg.mid }, username);
  if (!text) return ig.log(st, { type: "dm", user: username, igsid: sender, text: kind ? `[${kind}]` : "" });

  const rule = ig.pickRule(await ig.getRules(st), text, "dm");
  if (!rule || !rule.dm) return ig.log(st, { type: "dm", user: username, igsid: sender, text: text.slice(0, 300) });
  // "Qualquer mensagem" responde no máximo 1 vez a cada 12 h por pessoa, para não virar conversa com o robô.
  if (rule.match === "any") {
    const [ok] = await redis(st, ["SET", `ib:any:${rule.id}:${sender}`, "1", "NX", "EX", String(12 * 3600)]);
    if (ok !== "OK") return ig.log(st, { type: "dm", user: username, igsid: sender, text: text.slice(0, 300) });
  }
  const reply = ig.fill(rule.dm, { nome: username ? "@" + username : "", usuario: username });
  try {
    await ig.sendDm(st, { id: sender }, reply, rule.button);
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

  let myId = "";
  try { myId = (await ig.me(st)).id; } catch {}
  for (const entry of body.entry || []) {
    myId = myId || String(entry.id || "");
    try {
      for (const ch of entry.changes || []) {
        if (ch.field === "comments" || ch.field === "live_comments") await onComment(st, myId, ch.value || {});
        else if (ch.field === "mentions") await ig.log(st, { type: "mention", mediaId: ch.value && ch.value.media_id, commentId: ch.value && ch.value.comment_id });
      }
      for (const m of entry.messaging || []) await onMessage(st, myId, m);
    } catch (e) {
      await ig.log(st, { type: "error", errors: ["webhook: " + e.message] }).catch(() => {});
    }
  }
  // Sempre 200: se falhar, a Meta reenviaria o mesmo evento várias vezes.
  return res.status(200).send("ok");
};
