// Nós Dois: guarda o espaço de cada casal no Upstash Redis (integração do Vercel Marketplace).
// Uma única rota: POST /api/space com {op, ...}. O casal acessa com id + chave secreta (o link de convite).
const crypto = require("crypto");
const net = require("net");
const tls = require("tls");
const push = require("./_push.js");

const COLS = new Set(["meta","tasks","lists","items","dates","wishes","answers","kids","journal","names","logs","bills","fixed","about","polls","notes","plans","capsules","vault","cards"]);
const ID_RE = /^[a-f0-9]{8,32}$/;
const KEY_RE = /^[a-f0-9]{16,64}$/;
const DOC_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
const MAX_DOC_BYTES = 300000;
const MAX_DOCS = 5000;
const CODE_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O, 1/I
const newCode = () => [...crypto.randomBytes(8)].map((x) => CODE_ALPHA[x % 32]).join("");

// Aceita Upstash (REST) ou qualquer Redis por URL (ex.: "Redis" oficial do Vercel, que cria kv_REDIS_URL).
function findEnv(re, exclude) {
  const k = Object.keys(process.env).find((k) => re.test(k) && !(exclude && exclude.test(k)) && process.env[k]);
  return k ? process.env[k] : null;
}
function storage() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || findEnv(/REST_API_URL$/i) || findEnv(/REDIS_REST_URL$/i);
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || findEnv(/REST_API_TOKEN$/i, /READ_ONLY/i) || findEnv(/REDIS_REST_TOKEN$/i, /READ_ONLY/i);
  if (url && token) return { rest: true, url: url.replace(/\/$/, ""), token };
  const tcp = process.env.REDIS_URL || findEnv(/REDIS_URL$/i) || process.env.KV_URL || findEnv(/^KV_URL$/i);
  if (tcp && /^rediss?:\/\//i.test(tcp)) return { rest: false, url: tcp };
  return null;
}

// Cliente RESP mínimo (sem dependências): uma conexão por requisição, comandos em pipeline.
function encode(args) {
  const parts = [Buffer.from(`*${args.length}\r\n`)];
  for (const a of args) { const b = Buffer.from(String(a)); parts.push(Buffer.from(`$${b.length}\r\n`), b, Buffer.from("\r\n")); }
  return Buffer.concat(parts);
}
function parseReply(buf, i) {
  if (i >= buf.length) return null;
  const e = buf.indexOf("\r\n", i);
  if (e < 0) return null;
  const t = String.fromCharCode(buf[i]), line = buf.toString("utf8", i + 1, e);
  if (t === "+") return [line, e + 2];
  if (t === "-") return [{ __err: line }, e + 2];
  if (t === ":") return [Number(line), e + 2];
  if (t === "_") return [null, e + 2];
  if (t === "$") { const n = Number(line); if (n < 0) return [null, e + 2]; if (buf.length < e + 2 + n + 2) return null; return [buf.toString("utf8", e + 2, e + 2 + n), e + 4 + n]; }
  if (t === "*" || t === "%") {
    let n = Number(line); if (n < 0) return [null, e + 2]; if (t === "%") n *= 2;
    const arr = []; let j = e + 2;
    for (let k = 0; k < n; k++) { const r = parseReply(buf, j); if (!r) return null; arr.push(r[0]); j = r[1]; }
    return [arr, j];
  }
  throw new Error("Resposta Redis inesperada: " + t);
}
function tcpPipeline(urlStr, cmds) {
  const u = new URL(urlStr);
  const pre = [];
  if (u.password) pre.push(u.username && u.username !== "default" ? ["AUTH", decodeURIComponent(u.username), decodeURIComponent(u.password)] : ["AUTH", decodeURIComponent(u.password)]);
  const db = u.pathname.replace("/", ""); if (db) pre.push(["SELECT", db]);
  const all = [...pre, ...cmds];
  return new Promise((resolve, reject) => {
    const opts = { host: u.hostname, port: Number(u.port || 6379) };
    const sock = u.protocol === "rediss:" ? tls.connect({ ...opts, servername: u.hostname }) : net.connect(opts);
    let buf = Buffer.alloc(0); const out = []; let pos = 0; let done = false;
    const finish = (err) => { if (done) return; done = true; clearTimeout(timer); sock.destroy(); err ? reject(err) : resolve(out.slice(pre.length)); };
    const timer = setTimeout(() => finish(new Error("Redis: tempo esgotado")), 8000);
    sock.on(u.protocol === "rediss:" ? "secureConnect" : "connect", () => sock.write(Buffer.concat(all.map(encode))));
    sock.on("data", (d) => {
      buf = Buffer.concat([buf, d]);
      try { let r; while (out.length < all.length && (r = parseReply(buf, pos))) { out.push(r[0]); pos = r[1]; } } catch (e) { return finish(e); }
      if (out.length >= all.length) {
        const authErr = out.slice(0, pre.length).find((x) => x && x.__err);
        finish(authErr ? new Error(authErr.__err) : null);
      }
    });
    sock.on("error", finish);
    sock.on("close", () => { if (!done) finish(new Error("Redis: conexão fechada")); });
  });
}

async function redis(st, ...cmds) {
  if (!st.rest) {
    const res = await tcpPipeline(st.url, cmds);
    return res.map((x) => { if (x && x.__err) throw new Error(x.__err); return x; });
  }
  const r = await fetch(st.url + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + st.token, "content-type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error("redis " + r.status);
  const out = await r.json();
  return out.map((i) => { if (i.error) throw new Error(i.error); return i.result; });
}

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
function sameHash(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function deepMerge(a, b) {
  const o = Array.isArray(a) ? [...a] : { ...a };
  for (const k in b) {
    const v = b[k];
    o[k] = v && typeof v === "object" && !Array.isArray(v) && a && typeof a[k] === "object" && a[k] && !Array.isArray(a[k]) ? deepMerge(a[k], v) : v;
  }
  return o;
}

// Planos: espaços criados a partir do teste ganham 7 dias com tudo liberado; depois, plano grátis
// (pergunta do dia, tarefas, listas, datas) até ativarem um código. Espaços antigos (sem plano) seguem completos.
const TRIAL_DAYS = 7;
const DAY = 86400000;
const PREMIUM_COLS = new Set(["bills","fixed","kids","journal","names","logs","about","polls","notes","plans","capsules","vault","cards","wishes"]);
const PREMIUM_META = /^(recado_[ab]|vault)$/;
function planStatus(raw) {
  if (!raw) return { status: "founder" };
  let p = {}; try { p = JSON.parse(raw); } catch {}
  const now = Date.now();
  if (p.premiumUntil && p.premiumUntil > now) return { status: "premium", premiumUntil: p.premiumUntil, trialEnds: p.trialEnds };
  if (p.trialEnds && p.trialEnds > now) return { status: "trial", trialEnds: p.trialEnds };
  return { status: "free", trialEnds: p.trialEnds, premiumUntil: p.premiumUntil || null };
}
const unlocked = (ps) => ps.status !== "free";
function adminOk(given) {
  const want = process.env.NOS_DOIS_ADMIN_KEY || "";
  return want.length >= 10 && sameHash(sha(String(given || "")), sha(want));
}
const clientIp = (req) => String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "anon";
// Limites por IP. Falhas (código errado, senha errada) bloqueiam por 1 hora; criar espaço também tem teto.
// O volume geral (todo pedido, inclusive a sincronização a cada 4 s) tem uma janela de 10 minutos.
const LIMITS = { join: [30, 3600], admin: [10, 3600], redeem: [20, 3600], create: [20, 3600] };
const RATE_MAX = 1500, RATE_WINDOW = 600;
const limitKey = (kind, ip) => `nd:lim:${kind}:${ip}`;
async function overLimit(st, kind, ip) { const [n] = await redis(st, ["GET", limitKey(kind, ip)]); return Number(n || 0) >= LIMITS[kind][0]; }
async function countHit(st, kind, ip) { const k = limitKey(kind, ip); await redis(st, ["INCR", k], ["EXPIRE", k, String(LIMITS[kind][1])]); }
const rateCmds = (ip) => { const k = `nd:rate:${ip}:${Math.floor(Date.now() / (RATE_WINDOW * 1000))}`; return [["INCR", k], ["EXPIRE", k, String(RATE_WINDOW + 60)]]; };
const TOO_MANY = { error: "Muitas tentativas. Tente de novo em 1 hora." };
const contactInfo = () => ({
  whatsapp: String(process.env.NOS_DOIS_WHATSAPP || "").replace(/\D/g, "") || null,
  pix: String(process.env.NOS_DOIS_PIX || "").trim() || null,
});

// Chave VAPID do servidor: criada uma vez e guardada no próprio Redis (nada para configurar no Vercel).
let vapidCache = null;
async function vapidKey(st) {
  if (vapidCache) return vapidCache;
  let [v] = await redis(st, ["GET", "nd:vapid"]);
  if (!v) { await redis(st, ["SET", "nd:vapid", JSON.stringify(push.newVapid()), "NX"]); [v] = await redis(st, ["GET", "nd:vapid"]); }
  vapidCache = JSON.parse(v);
  return vapidCache;
}

module.exports = async (req, res) => {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch { return res.status(400).json({ error: "JSON inválido." }); } }
  const st = storage();
  if (body.op === "ping") return res.status(200).json({ ok: true, storage: !!st, contact: contactInfo() });
  if (!st) return res.status(503).json({ error: "Armazenamento não configurado." });

  try {
    const ip = clientIp(req);
    // A sincronização ("get") conta o volume no mesmo pipeline das leituras; o resto conta aqui.
    if (body.op !== "get") { const [n] = await redis(st, ...rateCmds(ip)); if (n > RATE_MAX) return res.status(429).json({ error: "Muitos pedidos agora. Espere alguns minutos." }); }

    if (body.op === "create") {
      if (await overLimit(st, "create", ip)) return res.status(429).json(TOO_MANY);
      await countHit(st, "create", ip);
      const id = crypto.randomBytes(8).toString("hex");
      const key = crypto.randomBytes(20).toString("hex");
      const now = Date.now();
      // O plano vai no mesmo pipeline da chave: um espaço nunca fica sem plano (o que o tornaria "fundador").
      const [ok] = await redis(st, ["SET", `nd:${id}:auth`, sha(key), "NX"], ["SET", `nd:${id}:v`, "1", "NX"], ["SET", `nd:${id}:plan`, JSON.stringify({ createdAt: now, trialEnds: now + TRIAL_DAYS * DAY }), "NX"]);
      if (ok !== "OK") return res.status(409).json({ error: "Tente de novo." });
      await redis(st, ["INCR", "nd:stats:created"]);
      return res.status(200).json({ id, key });
    }

    if (body.op === "join") {
      const code = String(body.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (code.length !== 8) return res.status(400).json({ error: "O código tem 8 letras e números." });
      if (await overLimit(st, "join", ip)) return res.status(429).json(TOO_MANY);
      const [v] = await redis(st, ["GET", `nd:code:${code}`]);
      if (!v) {
        await countHit(st, "join", ip);
        return res.status(404).json({ error: "Código não encontrado. Confira as letras e números." });
      }
      const o = JSON.parse(v);
      return res.status(200).json({ id: o.id, key: o.key, slot: o.slot });
    }

    if (body.op === "admin") {
      if (await overLimit(st, "admin", ip)) return res.status(429).json(TOO_MANY);
      if (!process.env.NOS_DOIS_ADMIN_KEY) return res.status(503).json({ error: "Falta configurar NOS_DOIS_ADMIN_KEY no Vercel." });
      if (!adminOk(body.admin)) { await countHit(st, "admin", ip); return res.status(401).json({ error: "Senha de administrador errada." }); }
      if (body.action === "generate") {
        const months = body.months === 12 ? 12 : 1;
        const n = Math.max(1, Math.min(20, Number(body.count) || 1));
        const note = String(body.note || "").slice(0, 60);
        const out = [];
        for (let i = 0; i < n; i++) {
          for (let tries = 0; tries < 5; tries++) {
            const c = "ND" + newCode();
            const [ok] = await redis(st, ["SET", `nd:act:${c}`, JSON.stringify({ months, note, createdAt: Date.now() }), "NX"]);
            if (ok === "OK") { out.push(c); await redis(st, ["LPUSH", "nd:acts", c], ["LTRIM", "nd:acts", "0", "199"]); break; }
          }
        }
        return res.status(200).json({ codes: out, months });
      }
      // lista: últimos códigos e se já foram usados
      const [list, created] = await redis(st, ["LRANGE", "nd:acts", "0", "49"], ["GET", "nd:stats:created"]);
      const ids = list || [];
      const [vals] = ids.length ? await redis(st, ["MGET", ...ids.map((c) => `nd:act:${c}`)]) : [[]];
      const codes = ids.map((c, i) => {
        let o = {}; try { o = JSON.parse((vals || [])[i] || "{}"); } catch {}
        return { code: c, months: o.months || 1, note: o.note || "", createdAt: o.createdAt || null, usedAt: o.usedAt || null };
      });
      return res.status(200).json({ codes, created: Number(created || 0) });
    }

    if (body.op === "vapid") return res.status(200).json({ key: push.vapidPublic(await vapidKey(st)) });

    const { id, key } = body;
    if (!ID_RE.test(String(id || "")) || !KEY_RE.test(String(key || ""))) return res.status(401).json({ error: "Link inválido." });
    const [auth] = await redis(st, ["GET", `nd:${id}:auth`]);
    if (!auth || !sameHash(auth, sha(key))) return res.status(404).json({ error: "Espaço não encontrado." });
    const H = `nd:${id}:data`, V = `nd:${id}:v`;

    const PL = `nd:${id}:plan`;
    if (body.op === "get") {
      const [v, planRaw, hits] = await redis(st, ["GET", V], ["GET", PL], ...rateCmds(ip));
      if (hits > RATE_MAX) return res.status(429).json({ error: "Muitos pedidos agora. Espere alguns minutos." });
      const ver = Number(v || 0); const plan = planStatus(planRaw);
      if (Number(body.since || 0) === ver) return res.status(200).json({ changed: false, v: ver, plan });
      const [flat] = await redis(st, ["HGETALL", H]);
      const data = {};
      const pairs = Array.isArray(flat) ? flat : Object.entries(flat || {}).flat();
      for (let i = 0; i + 1 < pairs.length; i += 2) {
        const [col, doc] = String(pairs[i]).split("/");
        try { (data[col] = data[col] || {})[doc] = JSON.parse(pairs[i + 1]); } catch {}
      }
      return res.status(200).json({ changed: true, v: ver, data, plan });
    }

    if (body.op === "redeem") {
      if (await overLimit(st, "redeem", ip)) return res.status(429).json(TOO_MANY);
      const code = String(body.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const [raw] = code.length === 10 ? await redis(st, ["GET", `nd:act:${code}`]) : [null];
      let act = null; try { act = raw ? JSON.parse(raw) : null; } catch {}
      if (!act) { await countHit(st, "redeem", ip); return res.status(404).json({ error: "Código de ativação não encontrado. Confira as letras." }); }
      if (act.usedAt) return res.status(409).json({ error: "Este código já foi usado." });
      // Uma ativação por vez em cada espaço: evita que duas ativações simultâneas leiam o mesmo plano e uma se perca.
      const SL = `${PL}:lock`, CL = `nd:act:${code}:lock`;
      const [gotSpace] = await redis(st, ["SET", SL, "1", "NX", "PX", "10000"]);
      if (gotSpace !== "OK") return res.status(409).json({ error: "Outra ativação em andamento. Tente de novo em instantes." });
      // A trava é solta antes de responder: depois da resposta o Vercel pode congelar a função.
      let out;
      try {
        const [planRaw] = await redis(st, ["GET", PL]);
        const [claimed] = planRaw ? await redis(st, ["SET", CL, id, "NX"]) : [null];
        // Sem plano = casal fundador (tudo liberado, sem prazo): gravar um prazo aqui o rebaixaria ao grátis quando vencesse.
        if (!planRaw) out = [409, { error: "Este espaço já tem tudo liberado (casal fundador). Guarde o código." }];
        else if (claimed !== "OK") out = [409, { error: "Este código já foi usado." }];
        else {
          try {
            let p = {}; try { p = JSON.parse(planRaw); } catch {}
            const base = Math.max(Date.now(), p.premiumUntil || 0, p.trialEnds || 0);
            const until = new Date(base); const day = until.getDate();
            until.setMonth(until.getMonth() + (act.months === 12 ? 12 : 1));
            if (until.getDate() !== day) until.setDate(0); // 31/jan + 1 mês = 28/fev, não 3/mar
            p.premiumUntil = until.getTime(); p.lastCode = code;
            await redis(st, ["SET", PL, JSON.stringify(p)], ["SET", `nd:act:${code}`, JSON.stringify({ ...act, usedAt: Date.now(), space: id })]);
            out = [200, { plan: planStatus(JSON.stringify(p)) }];
          } catch (e) { await redis(st, ["DEL", CL]).catch(() => {}); throw e; }
        }
      } finally { await redis(st, ["DEL", SL]).catch(() => {}); }
      return res.status(out[0]).json(out[1]);
    }

    if (body.op === "codes") {
      const out = {};
      for (const slot of ["a", "b"]) {
        let [c] = await redis(st, ["GET", `nd:${id}:code:${slot}`]);
        if (!c || body.regen === slot) {
          if (c) await redis(st, ["DEL", `nd:code:${c}`]);
          for (let tries = 0; tries < 5; tries++) {
            const nc = newCode();
            const [ok] = await redis(st, ["SET", `nd:code:${nc}`, JSON.stringify({ id, key, slot }), "NX"]);
            if (ok === "OK") { c = nc; break; }
          }
          if (!c) return res.status(500).json({ error: "Tente de novo." });
          await redis(st, ["SET", `nd:${id}:code:${slot}`, c]);
        }
        out[slot] = c;
      }
      return res.status(200).json({ codes: out });
    }

    // Avisos no celular do outro (Web Push). Cada aparelho guarda a própria inscrição.
    const P = `nd:${id}:push`;
    if (body.op === "subscribe") {
      const slot = body.slot === "a" || body.slot === "b" ? body.slot : null;
      if (!slot || !push.validSub(body.sub)) return res.status(400).json({ error: "Inscrição inválida." });
      const sub = { endpoint: String(body.sub.endpoint), keys: { p256dh: String(body.sub.keys.p256dh), auth: String(body.sub.keys.auth) } };
      const [n] = await redis(st, ["HLEN", P]);
      if (n >= 20) return res.status(413).json({ error: "Aparelhos demais." });
      await redis(st, ["HSET", P, `${slot}:${sha(sub.endpoint).slice(0, 24)}`, JSON.stringify(sub)]);
      return res.status(200).json({ ok: true });
    }
    if (body.op === "unsubscribe") {
      const h = sha(String(body.endpoint || "")).slice(0, 24);
      await redis(st, ["HDEL", P, `a:${h}`, `b:${h}`]);
      return res.status(200).json({ ok: true });
    }
    if (body.op === "notify") {
      const to = body.to === "a" || body.to === "b" ? body.to : null;
      if (!to) return res.status(400).json({ error: "Destino inválido." });
      const RL = `nd:${id}:nrl`;
      const [count] = await redis(st, ["INCR", RL], ["EXPIRE", RL, "3600"]);
      if (count > 200) return res.status(429).json({ error: "Avisos demais por agora." });
      const [flat] = await redis(st, ["HGETALL", P]);
      const pairs = Array.isArray(flat) ? flat : Object.entries(flat || {}).flat();
      const subs = [];
      for (let i = 0; i + 1 < pairs.length; i += 2) if (String(pairs[i]).startsWith(to + ":")) { try { subs.push([pairs[i], JSON.parse(pairs[i + 1])]); } catch {} }
      if (!subs.length) return res.status(200).json({ sent: 0 });
      const clip = (s, n) => String(s || "").slice(0, n);
      const payload = JSON.stringify({ title: clip(body.title, 80), body: clip(body.body, 300), view: clip(body.view, 20), tag: clip(body.tag, 40) });
      const jwk = await vapidKey(st);
      const subject = `https://${String(req.headers["x-forwarded-host"] || req.headers.host || "nos-dois.app").split(",")[0].trim()}`;
      let sent = 0;
      await Promise.all(subs.map(async ([field, sub]) => {
        try {
          const status = await push.send(sub, payload, jwk, subject);
          if (status === 404 || status === 410) await redis(st, ["HDEL", P, field]);
          else if (status < 300) sent++;
        } catch {}
      }));
      return res.status(200).json({ sent });
    }

    if (body.op === "wipe") {
      const [ca, cb] = await redis(st, ["GET", `nd:${id}:code:a`], ["GET", `nd:${id}:code:b`]);
      const extra = [ca, cb].filter(Boolean).map((c) => `nd:code:${c}`);
      await redis(st, ["DEL", H, V, PL, `nd:${id}:push`, `nd:${id}:auth`, `nd:${id}:code:a`, `nd:${id}:code:b`, ...extra]);
      return res.status(200).json({ ok: true });
    }

    const { col, doc } = body;
    if (!COLS.has(col) || !DOC_RE.test(String(doc || ""))) return res.status(400).json({ error: "Documento inválido." });
    const field = `${col}/${doc}`;

    if (body.op === "del") {
      const [, v] = await redis(st, ["HDEL", H, field], ["INCR", V]);
      return res.status(200).json({ v });
    }

    if (body.op === "put" || body.op === "merge") {
      if (PREMIUM_COLS.has(col) || (col === "meta" && PREMIUM_META.test(doc))) {
        const [planRaw] = await redis(st, ["GET", PL]);
        if (!unlocked(planStatus(planRaw))) return res.status(402).json({ error: "Esta parte é do Premium. O teste grátis acabou.", premium: true });
      }
      if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) return res.status(400).json({ error: "Dados inválidos." });
      let value = body.data;
      if (body.op === "merge") {
        const [cur] = await redis(st, ["HGET", H, field]);
        let base = {}; try { base = cur ? JSON.parse(cur) : {}; } catch {}
        value = deepMerge(base, body.data);
      }
      const json = JSON.stringify(value);
      if (json.length > MAX_DOC_BYTES) return res.status(413).json({ error: "Documento grande demais." });
      const [exists, count] = await redis(st, ["HEXISTS", H, field], ["HLEN", H]);
      if (!exists && count >= MAX_DOCS) return res.status(413).json({ error: "Espaço cheio." });
      const [, v] = await redis(st, ["HSET", H, field, json], ["INCR", V]);
      return res.status(200).json({ v });
    }

    return res.status(400).json({ error: "Operação desconhecida." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro no servidor." });
  }
};
