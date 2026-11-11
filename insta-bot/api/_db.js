// Acesso ao Redis sem dependências (mesmo cliente de nos-dois/site/api/space.js).
// Aceita Upstash (REST) ou qualquer Redis por URL (ex.: "Redis" oficial do Vercel, que cria REDIS_URL).
const net = require("net");
const tls = require("tls");

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

module.exports = { storage, redis };
