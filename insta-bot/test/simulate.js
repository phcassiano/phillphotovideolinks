// Teste local sem internet: simula o Redis (REST do Upstash) e a API do Instagram.
// Rodar: node insta-bot/test/simulate.js
const assert = require("assert");
const crypto = require("crypto");
const { Readable } = require("stream");

process.env.UPSTASH_REDIS_REST_URL = "https://redis.test";
process.env.UPSTASH_REDIS_REST_TOKEN = "t";
process.env.IG_ACCESS_TOKEN = "tok";
process.env.IG_APP_SECRET = "segredo";
process.env.IG_VERIFY_TOKEN = "verifica";
process.env.ADMIN_PASSWORD = "senha-longa-123";
process.env.CRON_SECRET = "cron";

// ---- Redis em memória ----
const kv = new Map(), hashes = new Map(), lists = new Map(), zsets = new Map();
const H = (k) => hashes.get(k) || (hashes.set(k, new Map()), hashes.get(k));
const L = (k) => lists.get(k) || (lists.set(k, []), lists.get(k));
function cmd([c, ...a]) {
  switch (c.toUpperCase()) {
    case "GET": return kv.has(a[0]) ? kv.get(a[0]) : null;
    case "SET": if (a.includes("NX") && kv.has(a[0])) return null; kv.set(a[0], a[1]); return "OK";
    case "DEL": kv.delete(a[0]); lists.delete(a[0]); return 1;
    case "INCR": kv.set(a[0], String(Number(kv.get(a[0]) || 0) + 1)); return Number(kv.get(a[0]));
    case "EXPIRE": return 1;
    case "LPUSH": L(a[0]).unshift(a[1]); return L(a[0]).length;
    case "LTRIM": lists.set(a[0], L(a[0]).slice(Number(a[1]), Number(a[2]) + 1)); return "OK";
    case "LRANGE": return L(a[0]).slice(Number(a[1]), Number(a[2]) + 1);
    case "HSET": for (let i = 1; i < a.length; i += 2) H(a[0]).set(a[i], a[i + 1]); return 1;
    case "HGET": return H(a[0]).get(a[1]) ?? null;
    case "HINCRBY": H(a[0]).set(a[1], String(Number(H(a[0]).get(a[1]) || 0) + Number(a[2]))); return 1;
    case "HGETALL": return [...H(a[0])].flat();
    case "ZADD": (zsets.get(a[0]) || zsets.set(a[0], new Map()).get(a[0])).set(a[2], Number(a[1])); return 1;
    case "ZREM": zsets.get(a[0])?.delete(a[1]); return 1;
    case "ZREVRANGE": return [...(zsets.get(a[0]) || new Map())].sort((x, y) => y[1] - x[1]).flatMap(([m, s]) => [m, String(s)]);
    default: throw new Error("cmd " + c);
  }
}

// ---- Instagram falso ----
const calls = [];
let failButton = false;
global.fetch = async (url, opt = {}) => {
  const u = new URL(url);
  const json = (o, status = 200) => ({ ok: status < 300, status, json: async () => o });
  if (u.host === "redis.test") return json(JSON.parse(opt.body).map((c) => ({ result: cmd(c) })));
  calls.push({ method: opt.method || "GET", path: u.pathname, query: Object.fromEntries(u.searchParams), body: opt.body ? JSON.parse(opt.body) : null });
  const p = u.pathname.replace(/^\/v[\d.]+\//, "");
  if (u.pathname === "/refresh_access_token") return json({ access_token: "tok2", expires_in: 5184000 });
  if (p === "me") return json({ user_id: "999", username: "phill.photovideodf", followers_count: 10, media_count: 3 });
  if (p === "me/messages") {
    const b = JSON.parse(opt.body);
    if (failButton && b.message.attachment) return json({ error: { message: "template não suportado", code: 100 } }, 400);
    return json({ recipient_id: "1", message_id: "mid.sent" + calls.length });
  }
  if (/^\d+\/replies$/.test(p)) return json({ id: "r" + calls.length });
  if (/^\d+$/.test(p) && opt.method === "POST") return json({ success: true });
  if (/^\d+$/.test(p)) return json({ username: "fulano", name: "Fulano" });
  return json({ error: { message: "rota desconhecida " + p } }, 404);
};

const webhook = require("../api/webhook.js");
const admin = require("../api/admin.js");
const cron = require("../api/cron.js");

function call(handler, { method = "POST", body, raw, headers = {}, url = "/api/x", query } = {}) {
  const payload = raw ?? (body !== undefined ? JSON.stringify(body) : "");
  const req = Readable.from([Buffer.from(payload)]);
  Object.assign(req, { method, url, headers, query });
  if (handler === admin && body) req.body = body;
  return new Promise((resolve) => {
    const res = {
      code: 200, headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(c) { this.code = c; return this; },
      send(x) { resolve({ status: this.code, body: x }); },
      json(x) { resolve({ status: this.code, body: x }); },
    };
    handler(req, res);
  });
}
const sign = (s) => "sha256=" + crypto.createHmac("sha256", "segredo").update(s).digest("hex");
const hook = (obj) => { const raw = JSON.stringify(obj); return call(webhook, { raw, headers: { "x-hub-signature-256": sign(raw) } }); };
const adm = (op, extra = {}) => call(admin, { body: { op, senha: "senha-longa-123", ...extra }, headers: { "x-forwarded-for": "1.1.1.1" } });
const comment = (id, text, from = { id: "555", username: "maria" }, media = "111") =>
  hook({ object: "instagram", entry: [{ id: "999", time: 1, changes: [{ field: "comments", value: { id, text, from, media: { id: media } } }] }] });
const dm = (mid, text, sender = "777", extra = {}) =>
  hook({ object: "instagram", entry: [{ id: "999", time: 1, messaging: [{ sender: { id: sender }, recipient: { id: "999" }, timestamp: 1, message: { mid, text, ...extra } }] }] });

(async () => {
  // Verificação do webhook
  let r = await call(webhook, { method: "GET", query: { "hub.mode": "subscribe", "hub.verify_token": "verifica", "hub.challenge": "42" } });
  assert.deepStrictEqual([r.status, r.body], [200, "42"]);
  r = await call(webhook, { method: "GET", query: { "hub.mode": "subscribe", "hub.verify_token": "errado", "hub.challenge": "42" } });
  assert.strictEqual(r.status, 403);

  // Assinatura inválida
  r = await call(webhook, { raw: "{}", headers: { "x-hub-signature-256": "sha256=00" } });
  assert.strictEqual(r.status, 401);

  // Senha errada no painel
  r = await call(admin, { body: { op: "status", senha: "x" }, headers: {} });
  assert.strictEqual(r.status, 401);

  // Cria regras
  r = await adm("saveRules", { rules: [
    { name: "Quero", on: "comment", match: "contains", keywords: ["quero", "link"], replies: ["Te mandei no direct, {nome}!"], dm: "Oi {nome}, aqui está:", button: { title: "Ver oferta", url: "https://exemplo.com" } },
    { name: "Só no post 222", on: "comment", match: "contains", keywords: ["preço"], mediaIds: ["222"], replies: ["Preço no direct!"], hide: true },
    { name: "Direct câmera", on: "dm", match: "contains", keywords: ["camera"], dm: "Minha câmera: https://exemplo.com/cam" },
    { name: "Boas-vindas", on: "dm", match: "any", dm: "Oi! Já te respondo 🙂" },
    { name: "Desligada", active: false, on: "both", match: "any", dm: "não devia" },
  ] });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.rules.length, 5);
  assert.strictEqual(r.body.rules[1].mediaIds[0], "222");

  // Comentário com palavra-chave → resposta pública + direct com botão
  calls.length = 0;
  r = await comment("1001", "EU QUERO!!");
  assert.strictEqual(r.status, 200);
  const rep = calls.find((c) => c.path.endsWith("/1001/replies"));
  assert.ok(rep, "respondeu o comentário");
  assert.strictEqual(rep.query.message, "Te mandei no direct, @maria!");
  const pv = calls.find((c) => c.path.endsWith("/me/messages"));
  assert.deepStrictEqual(pv.body.recipient, { comment_id: "1001" });
  assert.strictEqual(pv.body.message.attachment.payload.buttons[0].url, "https://exemplo.com");
  assert.strictEqual(pv.body.message.attachment.payload.text, "Oi @maria, aqui está:");

  // A Meta reenviou o mesmo evento → não responde de novo
  calls.length = 0;
  await comment("1001", "EU QUERO!!");
  assert.strictEqual(calls.filter((c) => c.method === "POST").length, 0);

  // Palavra dentro de outra não conta; acento não importa
  calls.length = 0;
  await comment("1002", "queroseno");
  assert.strictEqual(calls.filter((c) => c.method === "POST").length, 0);

  // Regra limitada a um post
  calls.length = 0;
  await comment("1003", "qual o preco?", undefined, "111");
  assert.strictEqual(calls.filter((c) => c.method === "POST").length, 0, "post errado");
  await comment("1004", "Qual o PREÇO?", undefined, "222");
  assert.ok(calls.find((c) => c.path.endsWith("/1004/replies")));
  assert.ok(calls.find((c) => c.path.endsWith("/1004") && c.query.hide === "true"), "ocultou");

  // Comentário da própria conta é ignorado
  calls.length = 0;
  await comment("1005", "quero", { id: "999", username: "phill.photovideodf" });
  assert.strictEqual(calls.filter((c) => c.method === "POST").length, 0);

  // Botão recusado → manda texto com o link
  failButton = true; calls.length = 0;
  await comment("1006", "link por favor");
  const sends = calls.filter((c) => c.path.endsWith("/me/messages"));
  assert.strictEqual(sends.length, 2);
  assert.ok(sends[1].body.message.text.includes("https://exemplo.com"));
  failButton = false;

  // Direct com palavra-chave
  calls.length = 0;
  await dm("mid.1", "Qual sua câmera?");
  let s = calls.find((c) => c.path.endsWith("/me/messages"));
  assert.deepStrictEqual(s.body.recipient, { id: "777" });
  assert.ok(s.body.message.text.startsWith("Minha câmera"));

  // "Qualquer texto" responde só 1 vez a cada 12 h
  calls.length = 0;
  await dm("mid.2", "oi", "888");
  await dm("mid.3", "tudo bem?", "888");
  assert.strictEqual(calls.filter((c) => c.path.endsWith("/me/messages")).length, 1);

  // Eco de mensagem enviada pela conta entra na conversa, sem resposta automática
  calls.length = 0;
  await hook({ object: "instagram", entry: [{ id: "999", messaging: [{ sender: { id: "999" }, recipient: { id: "777" }, message: { mid: "mid.echo", text: "respondi pelo app", is_echo: true } }] }] });
  assert.strictEqual(calls.filter((c) => c.method === "POST").length, 0);

  // Painel: conversas, envio manual, histórico, status
  r = await adm("threads");
  const t777 = r.body.items.find((x) => x.igsid === "777");
  assert.strictEqual(t777.username, "fulano");
  assert.strictEqual(t777.last, "respondi pelo app");
  r = await adm("thread", { igsid: "777" });
  assert.deepStrictEqual(r.body.items.map((m) => m.from), ["user", "me"]);
  r = await adm("send", { igsid: "777", text: "Valeu!" });
  assert.strictEqual(r.status, 200);
  r = await adm("thread", { igsid: "777" });
  assert.strictEqual(r.body.items.at(-1).text, "Valeu!");
  r = await adm("log");
  assert.ok(r.body.items.some((e) => e.type === "auto_comment" && e.rule === "Quero"));
  r = await adm("status");
  assert.strictEqual(r.body.account.username, "phill.photovideodf");
  assert.ok(r.body.stats.auto_comment >= 2);
  r = await adm("reply", { commentId: "1007", text: "Obrigado!" });
  assert.strictEqual(r.status, 200);

  // Pedido de exclusão
  r = await adm("forget", { igsid: "888" });
  assert.strictEqual(r.status, 200);
  r = await adm("threads");
  assert.ok(!r.body.items.some((x) => x.igsid === "888"));

  // Cron renova o token e passa a usar o novo
  r = await call(cron, { method: "GET", headers: {} });
  assert.strictEqual(r.status, 401);
  r = await call(cron, { method: "GET", headers: { authorization: "Bearer cron" } });
  assert.strictEqual(r.status, 200);
  calls.length = 0;
  await adm("reply", { commentId: "1008", text: "ok" });
  assert.ok(calls.length);
  console.log("Tudo certo: " + "webhook, regras, direct, painel e token funcionando.");
})().catch((e) => { console.error(e); process.exit(1); });
