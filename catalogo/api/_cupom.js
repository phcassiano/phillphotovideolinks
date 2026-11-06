// Cupons de desconto de cada loja.
// cat:cp:<loja>  hash código → cupom (JSON)
// cat:cpu:<loja> hash código → quantas vezes foi usado (contador atômico)
const db = require("./_db.js");
const { redis } = db;

const KC = (s) => `cat:cp:${s}`;
const KU = (s) => `cat:cpu:${s}`;
const CODE_RE = /^[A-Z0-9_-]{3,30}$/;
const normCode = (c) => String(c || "").trim().toUpperCase().replace(/\s+/g, "");
const brl = (c) => "R$ " + (c / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

function clean(c, old) {
  c = c || {};
  const code = normCode(c.code);
  if (!CODE_RE.test(code)) throw Object.assign(new Error("O código precisa ter de 3 a 30 letras ou números, sem espaço (ex.: BEMVINDO10)."), { status: 400 });
  const type = ["percent", "fixed", "freeship"].includes(c.type) ? c.type : "percent";
  let value = 0;
  if (type === "percent") { value = Math.round(Number(c.value)); if (!(value >= 1 && value <= 100)) throw Object.assign(new Error("A porcentagem precisa ser de 1 a 100."), { status: 400 }); }
  if (type === "fixed") { value = db.cents(c.value); if (!value) throw Object.assign(new Error("Informe o valor do desconto."), { status: 400 }); }
  const date = (v) => { const t = Number(v); return Number.isFinite(t) && t > 0 ? t : null; };
  return {
    code, type, value,
    minCents: db.cents(c.minCents),
    maxUses: Math.max(0, Math.floor(Number(c.maxUses) || 0)), // 0 = sem limite
    startsAt: date(c.startsAt),
    endsAt: date(c.endsAt),
    categories: (Array.isArray(c.categories) ? c.categories : []).map((x) => db.str(x, 60)).filter(Boolean).slice(0, 30),
    active: c.active !== false,
    note: db.str(c.note, 120),
    createdAt: old ? old.createdAt : Date.now(),
  };
}

async function list(st, slug) {
  const [all, uses] = await redis(st, ["HGETALL", KC(slug)], ["HGETALL", KU(slug)]);
  const pairs = (r) => { const o = {}; if (Array.isArray(r)) for (let i = 0; i < r.length; i += 2) o[r[i]] = r[i + 1]; else Object.assign(o, r || {}); return o; };
  const u = pairs(uses);
  return Object.values(pairs(all)).map((v) => db.parse(v)).filter(Boolean).map((c) => ({ ...c, used: Number(u[c.code]) || 0 })).sort((a, b) => b.createdAt - a.createdAt);
}
async function get(st, slug, code) {
  const [raw, used] = await redis(st, ["HGET", KC(slug), code], ["HGET", KU(slug), code]);
  const c = db.parse(raw);
  return c ? { ...c, used: Number(used) || 0 } : null;
}
async function save(st, slug, input) {
  const old = input.originalCode ? await get(st, slug, normCode(input.originalCode)) : null;
  const c = clean(input, old);
  const [count] = await redis(st, ["HLEN", KC(slug)]);
  if (!old && Number(count) >= 200) throw Object.assign(new Error("Limite de 200 cupons. Apague os antigos."), { status: 400 });
  if (!old || old.code !== c.code) {
    const [exists] = await redis(st, ["HEXISTS", KC(slug), c.code]);
    if (Number(exists)) throw Object.assign(new Error("Já existe um cupom com esse código."), { status: 409 });
  }
  const cmds = [["HSET", KC(slug), c.code, JSON.stringify(c)]];
  if (old && old.code !== c.code) cmds.push(["HDEL", KC(slug), old.code], ["HSET", KU(slug), c.code, String(old.used || 0)], ["HDEL", KU(slug), old.code]);
  await redis(st, ...cmds);
  return c;
}
async function remove(st, slug, code) {
  await redis(st, ["HDEL", KC(slug), normCode(code)], ["HDEL", KU(slug), normCode(code)]);
}

// Confere o cupom contra o carrinho (linhas já conferidas no servidor). Não gasta o cupom.
function evaluate(c, lines, now = Date.now()) {
  const fail = (error) => ({ ok: false, error });
  if (!c || !c.active) return fail("Cupom inválido.");
  if (c.startsAt && now < c.startsAt) return fail("Este cupom ainda não começou a valer.");
  if (c.endsAt && now > c.endsAt) return fail("Este cupom expirou.");
  if (c.maxUses && c.used >= c.maxUses) return fail("Este cupom já foi usado o número máximo de vezes.");
  const subtotal = lines.reduce((a, l) => a + l.unitCents * l.qty, 0);
  if (c.minCents && subtotal < c.minCents) return fail(`Este cupom vale para compras a partir de ${brl(c.minCents)}.`);
  const inCats = (l) => !c.categories.length || c.categories.includes(l.p.category) || (l.p.extraCategories || []).some((x) => c.categories.includes(x));
  const base = lines.filter(inCats).reduce((a, l) => a + l.unitCents * l.qty, 0);
  if (c.type !== "freeship" && !base) return fail("Este cupom não vale para os produtos do carrinho.");
  let discount = 0;
  if (c.type === "percent") discount = Math.round((base * c.value) / 100);
  if (c.type === "fixed") discount = Math.min(c.value, base);
  return { ok: true, code: c.code, discountCents: discount, freeShipping: c.type === "freeship", label: describe(c) };
}
function describe(c) {
  const what = c.type === "percent" ? `${c.value}% de desconto` : c.type === "fixed" ? `${brl(c.value)} de desconto` : "Frete grátis";
  return what + (c.categories.length ? " em produtos selecionados" : "");
}

// Gasta uma vez o cupom de forma atômica; devolve false se o limite acabou de estourar.
async function consume(st, slug, c) {
  const [n] = await redis(st, ["HINCRBY", KU(slug), c.code, "1"]);
  if (c.maxUses && Number(n) > c.maxUses) { await redis(st, ["HINCRBY", KU(slug), c.code, "-1"]); return false; }
  return true;
}
async function giveBack(st, slug, code, delta) {
  if (code) await redis(st, ["HINCRBY", KU(slug), normCode(code), String(delta)]);
}

module.exports = { normCode, list, get, save, remove, evaluate, describe, consume, giveBack, KC, KU };
