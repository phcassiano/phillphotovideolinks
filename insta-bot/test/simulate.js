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
process.env.GEMINI_API_KEY = "gm-test";

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
    case "HDEL": H(a[0]).delete(a[1]); return 1;
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
// Gemini falso: responde o que estiver em aiAnswer. Seguidores: quem está em followers.
const aiCalls = [];
let aiAnswer = { action: "reply", reply: "Uso uma Sony ZV-E10 😄" }, aiStop = "STOP";
const followers = new Set();
global.fetch = async (url, opt = {}) => {
  const u = new URL(typeof url === "string" ? url : url.url || String(url));
  const json = (o, status = 200) => ({ ok: status < 300, status, json: async () => o });
  if (u.host === "generativelanguage.googleapis.com") {
    const b = JSON.parse(opt.body);
    aiCalls.push({ path: u.pathname, headers: opt.headers, body: b, system: b.systemInstruction.parts[0].text, prompt: b.contents[0].parts[0].text });
    if (aiStop === "BLOCK") return json({ promptFeedback: { blockReason: "SAFETY" } });
    return json({ candidates: [{ finishReason: aiStop, content: { role: "model", parts: [{ text: JSON.stringify(aiAnswer) }] } }] });
  }
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
  if (/^\d+$/.test(p) && (u.searchParams.get("fields") || "").includes("is_user_follow_business")) return json({ is_user_follow_business: followers.has(p), id: p });
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
  assert.ok(r.body.rules.every((x) => /^[a-f0-9]{10}$/.test(x.id)), "cada automação ganha um id");

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

  // ---------- IA ----------
  // Desligada: direct sem palavra-chave cai na regra "qualquer texto", sem chamar a IA
  aiCalls.length = 0;
  await dm("mid.a0", "oi tudo bem", "900");
  assert.strictEqual(aiCalls.length, 0);

  r = await adm("saveAi", { settings: { enabled: true, dm: true, comments: true, about: "Sou fotógrafo em Brasília.", maxPerDay: 50 } });
  assert.strictEqual(r.body.settings.enabled, true);
  r = await adm("ai");
  assert.strictEqual(r.body.ready, true);

  // Direct sem palavra-chave → IA responde (antes da regra "qualquer texto")
  aiCalls.length = 0; calls.length = 0;
  await dm("mid.a1", "Que lente você usa no casamento?", "901");
  assert.strictEqual(aiCalls.length, 1);
  const req = aiCalls[0];
  assert.strictEqual(req.path, "/v1beta/models/gemini-3.8-flash:generateContent");
  assert.strictEqual(req.headers["x-goog-api-key"], "gm-test");
  assert.strictEqual(req.body.generationConfig.responseMimeType, "application/json");
  assert.deepStrictEqual(req.body.generationConfig.responseSchema.required, ["action", "reply"]);
  assert.ok(req.system.includes("Sou fotógrafo em Brasília."));
  assert.ok(req.prompt.includes("Que lente você usa no casamento?"));
  let sent = calls.find((c) => c.path.endsWith("/me/messages"));
  assert.deepStrictEqual(sent.body, { recipient: { id: "901" }, message: { text: "Uso uma Sony ZV-E10 😄" } });

  // O eco da resposta do robô não pausa a IA; o histórico vai junto na próxima pergunta
  await hook({ object: "instagram", entry: [{ id: "999", messaging: [{ sender: { id: "999" }, recipient: { id: "901" }, message: { mid: "mid.sent" + (calls.indexOf(sent) + 1), text: "eco", is_echo: true } }] }] });
  aiCalls.length = 0;
  await dm("mid.a2", "E o tripé?", "901");
  assert.strictEqual(aiCalls.length, 1);
  assert.ok(aiCalls[0].prompt.includes("Que lente você usa no casamento?"), "manda o histórico");

  // Palavra-chave continua ganhando da IA
  aiCalls.length = 0;
  await dm("mid.a3", "me passa o link da camera", "901");
  assert.strictEqual(aiCalls.length, 0);

  // IA passa para você → marca "precisa de você" e fica quieta com a pessoa
  aiAnswer = { action: "human", reply: "" }; calls.length = 0;
  await dm("mid.a4", "Quero fechar um casamento, faz desconto?", "902");
  assert.strictEqual(calls.filter((c) => c.path.endsWith("/me/messages")).length, 0);
  r = await adm("threads");
  assert.strictEqual(r.body.items.find((x) => x.igsid === "902").human, true);
  aiCalls.length = 0;
  await dm("mid.a5", "alô?", "902");
  assert.strictEqual(aiCalls.length, 0, "pausada");
  r = await adm("aiResume", { igsid: "902" });
  aiAnswer = { action: "reply", reply: "Oi!" };
  await dm("mid.a6", "alô??", "902");
  assert.strictEqual(aiCalls.length, 1, "voltou");

  // Você respondeu pelo app do Instagram → IA pausa para essa pessoa
  await hook({ object: "instagram", entry: [{ id: "999", messaging: [{ sender: { id: "999" }, recipient: { id: "903" }, message: { mid: "mid.app", text: "deixa comigo", is_echo: true } }] }] });
  aiCalls.length = 0;
  await dm("mid.a7", "valeu!", "903");
  assert.strictEqual(aiCalls.length, 0);

  // Comentário sem regra → IA responde em público
  aiAnswer = { action: "reply", reply: "É a ZV-E10!" }; calls.length = 0; aiCalls.length = 0;
  await comment("2001", "que câmera é essa?", { id: "556", username: "joao" });
  assert.strictEqual(aiCalls.length, 1);
  assert.strictEqual(calls.find((c) => c.path.endsWith("/2001/replies")).query.message, "É a ZV-E10!");
  // "skip" não responde
  aiAnswer = { action: "skip", reply: "" }; calls.length = 0;
  await comment("2002", "🔥🔥", { id: "557", username: "ana" });
  assert.strictEqual(calls.filter((c) => c.method === "POST").length, 0);

  // Recusa do modelo vira "precisa de você", sem resposta
  aiStop = "BLOCK"; calls.length = 0;
  await dm("mid.a8", "pergunta estranha", "904");
  assert.strictEqual(calls.filter((c) => c.path.endsWith("/me/messages")).length, 0);
  aiStop = "STOP";

  // Teto por pessoa por hora (8)
  aiAnswer = { action: "reply", reply: "ok" }; aiCalls.length = 0;
  for (let i = 0; i < 10; i++) await dm("mid.lim" + i, "pergunta " + i, "905");
  assert.strictEqual(aiCalls.length, 8);

  // Testar pelo painel
  aiAnswer = { action: "reply", reply: "Teste ok" };
  r = await adm("aiTest", { text: "oi", kind: "dm", settings: { about: "texto novo" } });
  assert.deepStrictEqual(r.body, { action: "reply", reply: "Teste ok" });
  assert.ok(aiCalls.at(-1).system.includes("texto novo"));

  // ---------- Só para quem segue ----------
  r = await adm("saveRules", { rules: [{ name: "Preset", on: "both", keywords: ["preset"], replies: ["Te chamei no direct!"], dm: "Aqui o preset:", button: { title: "Baixar", url: "https://exemplo.com/p" }, followOnly: true }] });
  const gid = r.body.rules[0].id;
  assert.strictEqual(r.body.rules[0].followOnly, true);
  const dms = () => calls.filter((c) => c.path.endsWith("/me/messages")).map((c) => c.body);

  // Comentou → pede para seguir com botão "Já sigo!", sem link
  calls.length = 0; aiCalls.length = 0;
  await comment("3001", "quero o preset", { id: "700", username: "bia" });
  let out = dms();
  assert.strictEqual(out.length, 1);
  assert.deepStrictEqual(out[0].recipient, { comment_id: "3001" });
  assert.ok(out[0].message.text.includes("@bia") && !JSON.stringify(out[0]).includes("exemplo.com/p"));
  assert.deepStrictEqual(out[0].message.quick_replies[0], { content_type: "text", title: "Já sigo!", payload: "SIGO:" + gid });

  // Tocou mas não segue → pede de novo
  calls.length = 0;
  await dm("mid.g1", "Já sigo!", "700", { quick_reply: { payload: "SIGO:" + gid } });
  out = dms();
  assert.strictEqual(out.length, 1);
  assert.ok(out[0].message.text.startsWith("Ainda não apareceu seu follow"));
  assert.ok(!JSON.stringify(out[0]).includes("exemplo.com/p"));
  assert.strictEqual(aiCalls.length, 0, "a IA não entra no botão");

  // Seguiu e tocou → manda o link
  followers.add("700"); calls.length = 0;
  await dm("mid.g2", "Já sigo!", "700", { quick_reply: { payload: "SIGO:" + gid } });
  out = dms();
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].message.attachment.payload.buttons[0].url, "https://exemplo.com/p");
  r = await adm("log");
  assert.strictEqual(r.body.items[0].type, "follow_ok");

  // Sem botão: escreveu "sigo" depois do pedido
  await comment("3002", "PRESET!", { id: "701", username: "caio" });
  followers.add("701"); calls.length = 0; aiCalls.length = 0;
  await dm("mid.g3", "sigo!", "701");
  out = dms();
  assert.strictEqual(out[0].message.attachment.payload.buttons[0].url, "https://exemplo.com/p");
  assert.strictEqual(aiCalls.length, 0);
  // "sigo" sem pedido pendente não é tratado como botão
  calls.length = 0;
  await dm("mid.g4", "sigo", "701");
  assert.ok(!JSON.stringify(dms()).includes("exemplo.com/p"));

  // Palavra-chave no direct: seguidor recebe direto; quem não segue recebe o pedido
  followers.add("702"); calls.length = 0;
  await dm("mid.g5", "me manda o preset", "702");
  assert.strictEqual(dms()[0].message.attachment.payload.buttons[0].url, "https://exemplo.com/p");
  calls.length = 0;
  await dm("mid.g6", "me manda o preset", "703");
  out = dms();
  assert.deepStrictEqual(out[0].recipient, { id: "703" });
  assert.strictEqual(out[0].message.quick_replies[0].payload, "SIGO:" + gid);

  // Cron renova o token e passa a usar o novo
  r = await call(cron, { method: "GET", headers: {} });
  assert.strictEqual(r.status, 401);
  r = await call(cron, { method: "GET", headers: { authorization: "Bearer cron" } });
  assert.strictEqual(r.status, 200);
  calls.length = 0;
  await adm("reply", { commentId: "1008", text: "ok" });
  assert.ok(calls.length);
  console.log("Tudo certo: " + "webhook, regras, só seguidores, direct, IA, painel e token funcionando.");
})().catch((e) => { console.error(e); process.exit(1); });
