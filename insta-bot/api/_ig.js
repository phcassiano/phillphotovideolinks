// Instagram API com login do Instagram (graph.instagram.com) + regras de automação guardadas no Redis.
const crypto = require("crypto");
const { storage, redis } = require("./_db.js");

const VERSION = process.env.IG_GRAPH_VERSION || "v24.0";
const GRAPH = `https://graph.instagram.com/${VERSION}`;
const LOG_MAX = 500;
const THREAD_MAX = 100;

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
function sameHash(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Token de longa duração (60 dias). O cron renova toda semana e guarda o novo no Redis.
async function getToken(st) {
  const [saved] = await redis(st, ["GET", "ib:token"]);
  if (saved) { try { const t = JSON.parse(saved); if (t.token) return t.token; } catch {} }
  return process.env.IG_ACCESS_TOKEN || null;
}
async function refreshToken(st) {
  const token = await getToken(st);
  if (!token) throw new Error("Falta IG_ACCESS_TOKEN.");
  const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(graphErr(j, r.status));
  const saved = { token: j.access_token, refreshedAt: Date.now(), expiresAt: Date.now() + Number(j.expires_in || 0) * 1000 };
  await redis(st, ["SET", "ib:token", JSON.stringify(saved)]);
  return saved;
}

function graphErr(j, status) {
  const e = j && j.error;
  return e ? `${e.message || "erro"}${e.code ? ` (código ${e.code})` : ""}` : `Instagram respondeu ${status}`;
}
async function graph(st, method, path, { query, body } = {}) {
  const token = await getToken(st);
  if (!token) throw new Error("Falta IG_ACCESS_TOKEN.");
  const qs = new URLSearchParams(query || {});
  const url = `${GRAPH}/${path.replace(/^\//, "")}${qs.toString() ? "?" + qs : ""}`;
  const r = await fetch(url, {
    method,
    headers: { Authorization: "Bearer " + token, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(graphErr(j, r.status));
  return j;
}

// Conta conectada (id e @), guardada por 1 dia.
async function me(st) {
  const [c] = await redis(st, ["GET", "ib:me"]);
  if (c) return JSON.parse(c);
  const j = await graph(st, "GET", "me", { query: { fields: "user_id,username,name,profile_picture_url,followers_count,media_count" } });
  const out = { id: String(j.user_id || j.id), username: j.username, name: j.name || "", picture: j.profile_picture_url || "", followers: j.followers_count, media: j.media_count };
  await redis(st, ["SET", "ib:me", JSON.stringify(out), "EX", "86400"]);
  return out;
}

// Ações no Instagram
const replyComment = (st, commentId, message) => graph(st, "POST", `${commentId}/replies`, { query: { message } });
const hideComment = (st, commentId, hide = true) => graph(st, "POST", commentId, { query: { hide: String(hide) } });
const deleteComment = (st, commentId) => graph(st, "DELETE", commentId);
// recipient: {id: IGSID} para conversa aberta (janela de 24 h) ou {comment_id} para a resposta privada a um comentário.
async function sendDm(st, recipient, text, button) {
  const send = (message) => graph(st, "POST", "me/messages", { body: { recipient, message } });
  if (button && button.url && button.title) {
    try {
      return await send({ attachment: { type: "template", payload: { template_type: "button", text: text.slice(0, 640), buttons: [{ type: "web_url", url: button.url, title: button.title.slice(0, 20) }] } } });
    } catch (e) {
      // Nem todo tipo de envio aceita botão; cai para texto com o link.
      return send({ text: `${text}\n\n${button.url}`.slice(0, 1000) });
    }
  }
  return send({ text: text.slice(0, 1000) });
}

// Botão de resposta rápida ("Já sigo!"). Tocar nele conta como a pessoa escrever, o que libera a consulta de follow.
async function sendQuick(st, recipient, text, title, payload) {
  try {
    return await graph(st, "POST", "me/messages", { body: { recipient, message: { text: text.slice(0, 1000), quick_replies: [{ content_type: "text", title: title.slice(0, 20), payload }] } } });
  } catch (e) {
    return graph(st, "POST", "me/messages", { body: { recipient, message: { text: `${text}\n\nQuando seguir, responda SIGO aqui.`.slice(0, 1000) } } });
  }
}
// A Meta só informa se a pessoa segue a conta depois que ela escreveu no direct. Erro → null.
async function isFollower(st, igsid) {
  try {
    const j = await graph(st, "GET", igsid, { query: { fields: "is_user_follow_business" } });
    return typeof j.is_user_follow_business === "boolean" ? j.is_user_follow_business : null;
  } catch { return null; }
}

// ---------- Regras ----------
// { id, name, active, on: "comment" | "dm" | "both", match: "contains" | "exact" | "any", keywords: [],
//   mediaIds: [] (vazio = todos os posts), replies: [] (resposta pública, uma sorteada),
//   dm: "", button: {title, url} | null, hide: false,
//   followOnly: false (só manda o direct para quem segue a conta), followMsg: "" (pedido para seguir) }
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
function matches(rule, text, kind, mediaId) {
  if (!rule.active) return false;
  if (rule.on !== "both" && rule.on !== kind) return false;
  if (kind === "comment" && rule.mediaIds && rule.mediaIds.length && !rule.mediaIds.includes(String(mediaId))) return false;
  if (rule.match === "any") return true;
  const t = norm(text);
  const words = (rule.keywords || []).map(norm).filter(Boolean);
  if (!words.length) return false;
  if (rule.match === "exact") return words.some((w) => t === w);
  // "contains": a palavra precisa aparecer inteira (QUERO acha "eu quero!", mas não "queroseno").
  return words.some((w) => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`).test(t));
}
// Regras com palavra-chave vêm antes das de "qualquer mensagem".
function pickRule(rules, text, kind, mediaId) {
  const ok = rules.filter((r) => matches(r, text, kind, mediaId));
  return ok.find((r) => r.match !== "any") || ok[0] || null;
}
const fill = (tpl, vars) => String(tpl || "").replace(/\{(nome|usuario)\}/g, (_, k) => vars[k] || "");
const pick = (arr) => { const a = (arr || []).filter((x) => String(x).trim()); return a.length ? a[Math.floor(Math.random() * a.length)] : ""; };

function cleanRule(r, i) {
  const s = (v, n) => String(v || "").slice(0, n);
  const list = (v, n, len) => (Array.isArray(v) ? v : String(v || "").split(/[\n,]/)).map((x) => s(x, len).trim()).filter(Boolean).slice(0, n);
  const url = s(r.button && r.button.url, 500).trim();
  return {
    id: typeof r.id === "string" && /^[a-z0-9]{6,20}$/.test(r.id) ? r.id : crypto.randomBytes(5).toString("hex"),
    name: s(r.name, 80).trim() || `Automação ${i + 1}`,
    active: r.active !== false,
    on: ["comment", "dm", "both"].includes(r.on) ? r.on : "comment",
    match: ["contains", "exact", "any"].includes(r.match) ? r.match : "contains",
    keywords: list(r.keywords, 30, 60),
    mediaIds: list(r.mediaIds, 50, 40).filter((x) => /^\d+$/.test(x)),
    replies: (Array.isArray(r.replies) ? r.replies : []).map((x) => s(x, 300).trim()).filter(Boolean).slice(0, 10),
    dm: s(r.dm, 1000).trim(),
    button: /^https:\/\//i.test(url) && s(r.button && r.button.title, 20).trim() ? { title: s(r.button.title, 20).trim(), url } : null,
    hide: !!r.hide,
    followOnly: !!r.followOnly,
    followMsg: s(r.followMsg, 600).trim(),
  };
}
async function getRules(st) {
  const [raw] = await redis(st, ["GET", "ib:rules"]);
  try { return JSON.parse(raw) || []; } catch { return []; }
}
async function saveRules(st, rules) {
  const clean = (Array.isArray(rules) ? rules : []).slice(0, 100).map(cleanRule);
  await redis(st, ["SET", "ib:rules", JSON.stringify(clean)]);
  return clean;
}

// ---------- Histórico ----------
async function log(st, ev) {
  const e = { t: Date.now(), ...ev };
  const day = new Date().toISOString().slice(0, 10);
  await redis(st,
    ["LPUSH", "ib:log", JSON.stringify(e)], ["LTRIM", "ib:log", "0", String(LOG_MAX - 1)],
    ["HINCRBY", "ib:stats", ev.type, "1"], ["HINCRBY", `ib:stats:${day}`, ev.type, "1"], ["EXPIRE", `ib:stats:${day}`, String(90 * 86400)]);
}
// Conversas por direct: uma lista por pessoa (IGSID) + índice ordenado pela última mensagem.
async function saveMsg(st, igsid, msg, username) {
  const cmds = [
    ["LPUSH", `ib:thread:${igsid}`, JSON.stringify({ t: Date.now(), ...msg })], ["LTRIM", `ib:thread:${igsid}`, "0", String(THREAD_MAX - 1)],
    ["ZADD", "ib:threads", String(Date.now()), igsid],
    ["HSET", `ib:who:${igsid}`, "last", String(msg.text || (msg.kind ? `[${msg.kind}]` : "")).slice(0, 140), "lastFrom", msg.from],
  ];
  if (msg.from === "user") cmds.push(["HSET", `ib:who:${igsid}`, "lastUserAt", String(Date.now())], ["HINCRBY", `ib:who:${igsid}`, "unread", "1"]);
  if (username) cmds.push(["HSET", `ib:who:${igsid}`, "username", username]);
  await redis(st, ...cmds);
}
// Nome de quem mandou mensagem (só funciona depois que a pessoa escreveu para a conta).
async function whoIs(st, igsid) {
  const [u] = await redis(st, ["HGET", `ib:who:${igsid}`, "username"]);
  if (u) return u;
  try {
    const j = await graph(st, "GET", igsid, { query: { fields: "username,name" } });
    if (j.username) await redis(st, ["HSET", `ib:who:${igsid}`, "username", j.username, "name", j.name || ""]);
    return j.username || "";
  } catch { return ""; }
}

module.exports = {
  storage, redis, sha, sameHash, VERSION,
  getToken, refreshToken, graph, me,
  replyComment, hideComment, deleteComment, sendDm, sendQuick, isFollower,
  norm, matches, pickRule, fill, pick, getRules, saveRules,
  log, saveMsg, whoIs,
};
