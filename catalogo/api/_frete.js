// Frete pelo Melhor Envio: cada loja usa o token da própria conta Melhor Envio.
// O token fica numa chave separada (cat:sec:<loja>) e nunca vai para o navegador.
const db = require("./_db.js");
const { redis, K } = db;

const secKey = (s) => `cat:sec:${s}`;
const DEFAULT_BOX = { g: 500, h: 12, w: 20, l: 30 }; // gramas e centímetros
const CACHE_SECONDS = 1800;

async function getConfig(st, slug) {
  const [raw] = await redis(st, ["GET", secKey(slug)]);
  return db.parse(raw, {});
}
async function saveConfig(st, slug, cfg) {
  await redis(st, ["SET", secKey(slug), JSON.stringify(cfg)]);
}
const cep = (v) => String(v || "").replace(/\D/g, "").slice(0, 8);
const num = (v, min, max, d) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? n : d; };

function cleanConfig(c, old) {
  c = c || {};
  const box = c.box || {};
  return {
    token: c.token === undefined ? old.token || "" : String(c.token || "").trim().slice(0, 2000),
    sandbox: !!c.sandbox,
    originCep: cep(c.originCep),
    markupCents: db.cents(c.markupCents),
    extraDays: Math.floor(num(c.extraDays, 0, 30, 0)),
    insurance: !!c.insurance,
    box: { g: Math.round(num(box.g, 1, 30000, DEFAULT_BOX.g)), h: num(box.h, 1, 100, DEFAULT_BOX.h), w: num(box.w, 1, 100, DEFAULT_BOX.w), l: num(box.l, 1, 100, DEFAULT_BOX.l) },
    hidden: (Array.isArray(c.hidden) ? c.hidden : []).map((x) => Number(x)).filter(Number.isFinite).slice(0, 50),
  };
}
const publicConfig = (c) => ({ ...c, token: undefined, hasToken: !!c.token, tokenEnd: c.token ? c.token.slice(-6) : "" });

// Monta a lista de produtos no formato do Melhor Envio (medidas por unidade).
function meProducts(lines, cfg) {
  return lines.map((l, i) => {
    const d = l.p.ship || {};
    return {
      id: String(l.p.id || i),
      width: num(d.w, 1, 200, cfg.box.w),
      height: num(d.h, 1, 200, cfg.box.h),
      length: num(d.l, 1, 200, cfg.box.l),
      weight: Math.max(0.001, num(d.g, 1, 100000, cfg.box.g) / 1000),
      insurance_value: cfg.insurance ? Math.round(l.unitCents) / 100 : 0,
      quantity: l.qty,
    };
  });
}

async function callMelhorEnvio(cfg, toCep, products, contact) {
  const base = process.env.MELHOR_ENVIO_BASE || (cfg.sandbox ? "https://sandbox.melhorenvio.com.br" : "https://melhorenvio.com.br");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(base + "/api/v2/me/shipment/calculate", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer " + cfg.token,
        "User-Agent": `${db.brand().name} catalogo (${contact || "sem contato"})`,
      },
      body: JSON.stringify({ from: { postal_code: cfg.originCep }, to: { postal_code: toCep }, products, options: { receipt: false, own_hand: false } }),
    });
    const text = await r.text();
    if (r.status === 401 || r.status === 403) throw Object.assign(new Error("O token do Melhor Envio é inválido ou expirou."), { code: "token" });
    if (!r.ok) throw new Error(`Melhor Envio respondeu ${r.status}.`);
    const data = db.parse(text, null);
    if (!Array.isArray(data)) throw new Error("Resposta inesperada do Melhor Envio.");
    return data;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("O Melhor Envio demorou para responder. Tente de novo.");
    throw e;
  } finally { clearTimeout(timer); }
}

// Cotação: devolve as opções em centavos já com acréscimo, prazo extra e frete grátis aplicados.
async function quote(st, slug, settings, lines, toCep, opts = {}) {
  toCep = cep(toCep);
  if (toCep.length !== 8) throw Object.assign(new Error("Digite um CEP com 8 números."), { status: 400 });
  const cfg = opts.cfg || (await getConfig(st, slug));
  if (!cfg.token || cfg.originCep.length !== 8) throw Object.assign(new Error("O cálculo de frete desta loja ainda não foi configurado."), { status: 400 });
  const products = meProducts(lines, cfg);
  const subtotal = lines.reduce((a, l) => a + l.unitCents * l.qty, 0);
  const ck = `cat:fq:${slug}:${db.sha(JSON.stringify([cfg.originCep, toCep, products, cfg.sandbox, cfg.insurance])).slice(0, 32)}`;
  let raw = null;
  if (!opts.noCache) { const [c] = await redis(st, ["GET", ck]); raw = db.parse(c, null); }
  if (!raw) {
    raw = await callMelhorEnvio(cfg, toCep, products, settings.email);
    await redis(st, ["SET", ck, JSON.stringify(raw), "EX", String(CACHE_SECONDS)]);
  }
  const hidden = new Set(cfg.hidden || []);
  let list = raw
    .filter((s) => s && !s.error && (s.custom_price || s.price) && !hidden.has(Number(s.id)))
    .map((s) => {
      const price = Math.round(parseFloat(String(s.custom_price || s.price).replace(",", ".")) * 100) + cfg.markupCents;
      const range = s.custom_delivery_range || s.delivery_range || {};
      const days = Number(s.custom_delivery_time || s.delivery_time) || 0;
      return {
        id: Number(s.id), name: String(s.name || ""), company: String((s.company && s.company.name) || ""), picture: String((s.company && s.company.picture) || ""),
        priceCents: price, daysMin: (Number(range.min) || days) + cfg.extraDays, daysMax: (Number(range.max) || days) + cfg.extraDays,
      };
    })
    .filter((s) => s.priceCents > 0)
    .sort((a, b) => a.priceCents - b.priceCents)
    .slice(0, 8);
  // Frete grátis acima do valor configurado: vale para a opção mais barata.
  if (list.length && settings.freeShippingFromCents && subtotal >= settings.freeShippingFromCents) list[0] = { ...list[0], free: true, originalCents: list[0].priceCents, priceCents: 0 };
  const errors = raw.filter((s) => s && s.error).map((s) => `${(s.company && s.company.name) || ""} ${s.name || ""}: ${s.error}`.trim());
  return { options: list, errors, subtotal };
}

const describe = (o) => `${o.company} ${o.name}`.trim() + (o.daysMax ? ` (${o.daysMin === o.daysMax ? o.daysMax : `${o.daysMin} a ${o.daysMax}`} dias úteis)` : "");

module.exports = { getConfig, saveConfig, cleanConfig, publicConfig, quote, describe, cep, DEFAULT_BOX };
