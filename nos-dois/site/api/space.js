// Nós Dois: guarda o espaço de cada casal no Upstash Redis (integração do Vercel Marketplace).
// Uma única rota: POST /api/space com {op, ...}. O casal acessa com id + chave secreta (o link de convite).
const crypto = require("crypto");
const net = require("net");
const tls = require("tls");

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

module.exports = async (req, res) => {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch { return res.status(400).json({ error: "JSON inválido." }); } }
  const st = storage();
  if (body.op === "ping") return res.status(200).json({ ok: true, storage: !!st });
  if (!st) return res.status(503).json({ error: "Armazenamento não configurado." });

  try {
    if (body.op === "create") {
      const id = crypto.randomBytes(8).toString("hex");
      const key = crypto.randomBytes(20).toString("hex");
      const [ok] = await redis(st, ["SET", `nd:${id}:auth`, sha(key), "NX"], ["SET", `nd:${id}:v`, "1", "NX"]);
      if (ok !== "OK") return res.status(409).json({ error: "Tente de novo." });
      return res.status(200).json({ id, key });
    }

    if (body.op === "join") {
      const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "anon";
      const code = String(body.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (code.length !== 8) return res.status(400).json({ error: "O código tem 8 letras e números." });
      const [fails] = await redis(st, ["GET", `nd:jf:${ip}`]);
      if (Number(fails || 0) >= 30) return res.status(429).json({ error: "Muitas tentativas. Tente de novo em 1 hora." });
      const [v] = await redis(st, ["GET", `nd:code:${code}`]);
      if (!v) {
        await redis(st, ["INCR", `nd:jf:${ip}`], ["EXPIRE", `nd:jf:${ip}`, "3600"]);
        return res.status(404).json({ error: "Código não encontrado. Confira as letras e números." });
      }
      const o = JSON.parse(v);
      return res.status(200).json({ id: o.id, key: o.key, slot: o.slot });
    }

    const { id, key } = body;
    if (!ID_RE.test(String(id || "")) || !KEY_RE.test(String(key || ""))) return res.status(401).json({ error: "Link inválido." });
    const [auth] = await redis(st, ["GET", `nd:${id}:auth`]);
    if (!auth || !sameHash(auth, sha(key))) return res.status(404).json({ error: "Espaço não encontrado." });
    const H = `nd:${id}:data`, V = `nd:${id}:v`;

    if (body.op === "get") {
      const [v] = await redis(st, ["GET", V]);
      const ver = Number(v || 0);
      if (Number(body.since || 0) === ver) return res.status(200).json({ changed: false, v: ver });
      const [flat] = await redis(st, ["HGETALL", H]);
      const data = {};
      const pairs = Array.isArray(flat) ? flat : Object.entries(flat || {}).flat();
      for (let i = 0; i + 1 < pairs.length; i += 2) {
        const [col, doc] = String(pairs[i]).split("/");
        try { (data[col] = data[col] || {})[doc] = JSON.parse(pairs[i + 1]); } catch {}
      }
      return res.status(200).json({ changed: true, v: ver, data });
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

    if (body.op === "wipe") {
      const [ca, cb] = await redis(st, ["GET", `nd:${id}:code:a`], ["GET", `nd:${id}:code:b`]);
      const extra = [ca, cb].filter(Boolean).map((c) => `nd:code:${c}`);
      await redis(st, ["DEL", H, V, `nd:${id}:auth`, `nd:${id}:code:a`, `nd:${id}:code:b`, ...extra]);
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
