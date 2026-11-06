// Catálogo: base compartilhada pelas rotas (Redis, senhas, limites, regras da loja).
// Aceita o Upstash (REST) ou qualquer Redis por URL, igual ao Nós Dois.
const crypto = require("crypto");
const net = require("net");
const tls = require("tls");

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


const DAY = 86400000;
const GRACE_DAYS = 1; // folga depois do vencimento antes de pausar a loja
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const RESERVED = new Set(["admin","painel","api","loja","www","app","static","assets","img","login","entrar","termos","privacidade","ajuda","suporte","index","favicon.ico","robots.txt","sitemap.xml","manifest.webmanifest"]);
const ID_RE = /^[a-z0-9]{6,40}$/;
const IMG_RE = /^[a-z0-9-]{8,80}$/;

const K = {
  stores: "cat:stores",
  meta: (s) => `cat:m:${s}`,
  settings: (s) => `cat:s:${s}`,
  cats: (s) => `cat:c:${s}`,
  products: (s) => `cat:p:${s}`,
  orders: (s) => `cat:o:${s}`,
  orderSeq: (s) => `cat:on:${s}`,
  imgs: (s) => `cat:is:${s}`,
  leads: (s) => `cat:l:${s}`,
  img: (id) => `cat:i:${id}`,
  sess: (t) => `cat:t:${t}`,
  stat: (s, d) => `cat:st:${s}:${d}`,
  lim: (kind, ip) => `cat:lim:${kind}:${ip}`,
};

const newId = (n = 10) => crypto.randomBytes(n).toString("hex").slice(0, n * 2);
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
function sameStr(a, b) {
  const x = Buffer.from(sha(a)), y = Buffer.from(sha(b));
  return crypto.timingSafeEqual(x, y);
}
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  return salt + ":" + crypto.scryptSync(String(pw), salt, 32).toString("hex");
}
function checkPassword(pw, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, h] = stored.split(":");
  const got = crypto.scryptSync(String(pw), salt, 32);
  const want = Buffer.from(h, "hex");
  return want.length === got.length && crypto.timingSafeEqual(got, want);
}
const PW_ALPHA = "abcdefghjkmnpqrstuvwxyz23456789";
const newPassword = () => [...crypto.randomBytes(10)].map((x) => PW_ALPHA[x % PW_ALPHA.length]).join("");

const parse = (raw, dflt) => { if (raw == null) return dflt; try { return JSON.parse(raw); } catch { return dflt; } };
const today = (d = new Date()) => new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 10); // dia em Brasília

// A loja fica no ar até o vencimento + 1 dia de folga, a menos que tenha sido pausada à mão.
function storeState(meta) {
  if (!meta) return { live: false, reason: "missing" };
  if (meta.status === "paused") return { live: false, reason: "paused" };
  if (meta.paidUntil && Date.now() > meta.paidUntil + GRACE_DAYS * DAY) return { live: false, reason: "expired" };
  return { live: true };
}

const clientIp = (req) => String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "anon";
const LIMITS = {
  login: [10, 3600],   // senhas erradas no painel
  admin: [10, 3600],   // chave errada no /admin
  order: [30, 3600],   // pedidos por IP por hora
  lead: [10, 3600],    // cadastros de novidades por IP por hora
  hit: [400, 600],     // contagem de visitas
  upload: [300, 3600], // imagens enviadas por IP por hora
};
async function overLimit(st, kind, ip) {
  const [n] = await redis(st, ["GET", K.lim(kind, ip)]);
  return Number(n || 0) >= LIMITS[kind][0];
}
async function countHit(st, kind, ip) {
  const k = K.lim(kind, ip);
  await redis(st, ["INCR", k], ["EXPIRE", k, String(LIMITS[kind][1])]);
}

function cors(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
}
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return parse(req.body, {});
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return parse(Buffer.concat(chunks).toString("utf8"), {});
}
function send(res, code, obj, extraHeaders) {
  res.statusCode = code;
  res.setHeader("content-type", "application/json; charset=utf-8");
  if (!extraHeaders || !extraHeaders["cache-control"]) res.setHeader("cache-control", "no-store");
  for (const k in extraHeaders || {}) res.setHeader(k, extraHeaders[k]);
  res.end(JSON.stringify(obj));
}

const brand = () => ({
  name: process.env.CATALOGO_MARCA || "Vitrine",
  whatsapp: String(process.env.CATALOGO_WHATSAPP || "").replace(/\D/g, "") || null,
});

// ---------- Limpeza e validação dos dados que o lojista salva ----------
const str = (v, max = 200) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
const cents = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n <= 100000000 ? n : 0; };
const imgId = (v) => (IMG_RE.test(String(v || "")) ? String(v) : null);
const slugify = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "item";
const phone = (v) => String(v || "").replace(/\D/g, "").slice(0, 15);
const color = (v, d) => (/^#[0-9a-fA-F]{6}$/.test(String(v || "")) ? String(v).toLowerCase() : d);

function cleanSettings(s, slug) {
  s = s || {};
  const list = (arr, max, fn) => (Array.isArray(arr) ? arr.slice(0, max).map(fn).filter(Boolean) : []);
  return {
    name: str(s.name, 80) || slug,
    tagline: str(s.tagline, 140),
    about: str(s.about, 1500),
    whatsapp: phone(s.whatsapp),
    greeting: str(s.greeting, 200),
    instagram: str(s.instagram, 60).replace(/^@/, ""),
    email: str(s.email, 120),
    address: str(s.address, 200),
    logo: imgId(s.logo),
    color: color(s.color, "#111827"),
    accent: color(s.accent, "#16a34a"),
    mode: s.mode === "dark" ? "dark" : "light",
    announcement: str(s.announcement, 140),
    messages: list(s.messages, 6, (m) => str(m, 80) || null),
    phone: phone(s.phone),
    contactName: str(s.contactName, 60),
    hours: str(s.hours, 100),
    faq: list(s.faq, 10, (f) => (f && f.q && f.a ? { q: str(f.q, 140), a: str(f.a, 800) } : null)),
    font: ["classico", "elegante", "moderno", "esportivo", "geometrico"].includes(s.font) ? s.font : "classico",
    newsletter: s.newsletter !== false,
    hidePrices: !!s.hidePrices,
    minOrderCents: cents(s.minOrderCents),
    payments: list(s.payments, 8, (p) => str(p, 60)),
    paymentNote: str(s.paymentNote, 140),
    pickup: s.pickup !== false,
    pickupText: str(s.pickupText, 140),
    delivery: s.delivery !== false,
    deliveryText: str(s.deliveryText, 140),
    deliveryFeeCents: cents(s.deliveryFeeCents),
    freeShippingFromCents: cents(s.freeShippingFromCents),
    highlights: list(s.highlights, 4, (h) => (h && (h.title || h.text) ? { title: str(h.title, 40), text: str(h.text, 80) } : null)),
    banners: list(s.banners, 6, (b) => (b && imgId(b.image) ? { id: str(b.id, 20) || newId(4), image: imgId(b.image), imageMobile: imgId(b.imageMobile), title: str(b.title, 80), subtitle: str(b.subtitle, 140), link: str(b.link, 200) } : null)),
  };
}
function cleanCategories(arr) {
  const seen = new Set();
  return (Array.isArray(arr) ? arr : []).slice(0, 60).map((c) => {
    const name = str(c && c.name, 50);
    if (!name) return null;
    let slug = slugify(c.slug || name);
    while (seen.has(slug)) slug += "-2";
    seen.add(slug);
    return { id: ID_RE.test(String(c.id || "")) ? c.id : newId(5), name, slug, image: imgId(c.image), hidden: !!c.hidden };
  }).filter(Boolean);
}
function cleanProduct(p, old) {
  const list = (arr, max, len) => [...new Set((Array.isArray(arr) ? arr : []).map((x) => str(x, len)).filter(Boolean))].slice(0, max);
  const sizes = list(p.sizes, 30, 20);
  const colors = list(p.colors, 20, 30);
  // Estoque por combinação "tamanho|cor". Sem número = sem controle de estoque.
  let stock = null;
  if (p.stock && typeof p.stock === "object") {
    stock = {};
    const keys = [];
    const ss = sizes.length ? sizes : [""], cs = colors.length ? colors : [""];
    for (const a of ss) for (const b of cs) keys.push(a + "|" + b);
    for (const k of keys) {
      const v = p.stock[k];
      if (v !== "" && v != null && Number.isFinite(Number(v))) stock[k] = Math.max(0, Math.min(99999, Math.floor(Number(v))));
    }
    if (!Object.keys(stock).length) stock = null;
  }
  const name = str(p.name, 120);
  return {
    id: old ? old.id : newId(8),
    slug: old && old.slug && slugify(name) === slugify(old.name) ? old.slug : null, // definido fora (precisa ser único)
    name,
    description: str(p.description, 4000),
    category: str(p.category, 60),
    extraCategories: list(p.extraCategories, 5, 60),
    priceCents: cents(p.priceCents),
    promoCents: cents(p.promoCents),
    images: (Array.isArray(p.images) ? p.images : []).map(imgId).filter(Boolean).slice(0, 10),
    sizes, colors, stock,
    featured: !!p.featured,
    hidden: !!p.hidden,
    sku: str(p.sku, 40),
    createdAt: old ? old.createdAt : Date.now(),
    updatedAt: Date.now(),
    sold: old ? old.sold || 0 : 0,
  };
}
const totalStock = (p) => (p.stock ? Object.values(p.stock).reduce((a, b) => a + b, 0) : null);
// O que o público vê de cada produto: estoque vira só "esgotado" por variação.
function publicProduct(p, hidePrices) {
  const out = { id: p.id, slug: p.slug, name: p.name, description: p.description, category: p.category, extraCategories: p.extraCategories, images: p.images, sizes: p.sizes, colors: p.colors, featured: p.featured, createdAt: p.createdAt, sold: p.sold || 0 };
  if (!hidePrices) { out.priceCents = p.priceCents; out.promoCents = p.promoCents; }
  if (p.stock) { out.out = Object.keys(p.stock).filter((k) => p.stock[k] <= 0); out.tracked = Object.keys(p.stock); }
  return out;
}

module.exports = {
  crypto, redis, storage, K, DAY, SLUG_RE, RESERVED, ID_RE, IMG_RE, newId, sha, sameStr, hashPassword, checkPassword, newPassword,
  parse, today, storeState, clientIp, overLimit, countHit, cors, readBody, send, brand, str, cents, phone, slugify,
  cleanSettings, cleanCategories, cleanProduct, publicProduct, totalStock,
};
