// Fluxo completo do servidor (Kiwify → chave → ativação → renovação → reembolso) com banco simulado.
// Rodar: node test/fluxo.test.js
const assert = require("assert");
const fs = require("fs");

const SITE = __dirname + "/../api/";
// Chave de teste gerada na hora (a de verdade fica só no Vercel).
process.env.REVELA_CHAVE_PRIVADA = require("crypto").generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey.export({ type: "pkcs8", format: "pem" });
process.env.REVELA_ADMIN_SENHA = "senha-admin";
process.env.REVELA_KIWIFY_K = "segredo-k";
const lib = require(SITE + "_lib");
// Banco simulado, com as mesmas funções revela_* do Supabase.
const lic = new Map(); const trials = new Map(); const events = []; const hits = new Map();
lib.db = async (f, a) => {
  if (f === "revela_trial") { if (!trials.has(a.p_device)) trials.set(a.p_device, "2026-10-20T10:00:00Z"); return trials.get(a.p_device); }
  if (f === "revela_event") { events.push(a); return null; }
  if (f === "revela_license_get") { for (const l of lic.values()) if ((a.p_id && l.id === a.p_id) || (a.p_ref && l.ref === a.p_ref)) return JSON.parse(JSON.stringify(l)); return null; }
  if (f === "revela_license_save") { const l = Object.assign({ created_at: new Date().toISOString() }, lic.get(a.p.id) || {}, a.p); lic.set(l.id, l); return l; }
  if (f === "revela_license_list") return [...lic.values()];
  if (f === "revela_rate_hit") {
    const h = hits.get(a.p_key) || 0;
    if (!a.p_add) return h < a.p_max;
    hits.set(a.p_key, h + 1); return h + 1 <= a.p_max;
  }
  if (f === "revela_license_bind") { const l = lic.get(a.p_id); if (l && !l.device) l.device = a.p_device; return l ? JSON.parse(JSON.stringify(l)) : null; }
  if (f === "revela_revoked") return [...lic.values()].filter((l) => l.status === "reembolsada" || l.status === "revogada").map((l) => l.id);
  throw new Error("função " + f);
};
async function call(name, body, query = {}, ip = "1.1.1.1") {
  const h = require(SITE + name);
  let status = 200, json;
  const res = { setHeader() {}, status(s) { status = s; return this; }, json(j) { json = j; return this; } };
  await h({ method: "POST", body, query, headers: { "x-forwarded-for": ip } }, res);
  return { status, json };
}
(async () => {
  // 1. Webhook sem o segredo: recusado.
  assert.equal((await call("kiwify", {}, { k: "errado" })).status, 401);
  // 2. Venda aprovada (formato da Kiwify).
  const venda = { order_id: "ord1", order_status: "paid", webhook_event_type: "order_approved", subscription_id: "sub1",
    Product: { product_name: "Revela" }, Subscription: { plan: { name: "Anual", frequency: "yearly" } },
    Customer: { full_name: "Maria Souza", email: "maria@exemplo.com", mobile: "+55 (11) 98765-4321" } };
  assert.equal((await call("kiwify", venda, { k: "segredo-k" })).status, 200);
  assert.equal(lic.size, 1);
  const l = [...lic.values()][0];
  assert.equal(l.plan, "anual"); assert.equal(l.status, "ativa"); assert.equal(l.device, null);
  // A mesma notificação repetida não soma outro período.
  const ateAntes = l.until;
  await call("kiwify", venda, { k: "segredo-k" });
  assert.equal([...lic.values()][0].until, ateAntes);
  // 3. Lista de vendas no admin com link de WhatsApp e e-mail.
  assert.equal((await call("vendas", { senha: "x" })).status, 401);
  const v = (await call("vendas", { senha: "senha-admin" })).json.vendas[0];
  assert.ok(v.whatsapp.startsWith("https://wa.me/5511987654321?text="));
  assert.ok(v.email_link.startsWith("mailto:maria%40exemplo.com?subject="));
  assert.ok(decodeURIComponent(v.whatsapp).includes(v.chave));
  const chaveVenda = v.chave;
  assert.equal(lib.ler(chaveVenda).o, "1");
  // 4. Ativação no tablet A: liga a chave a ele.
  const a1 = await call("ativar", { chave: chaveVenda, aparelho: "AAAA2222" });
  assert.equal(a1.status, 200); assert.equal(lib.ler(a1.json.chave).d, "AAAA2222"); assert.equal(lib.ler(a1.json.chave).o, undefined);
  // Outro tablet com a mesma chave: recusado.
  const b1 = await call("ativar", { chave: chaveVenda, aparelho: "BBBB3333" });
  assert.equal(b1.status, 409);
  // 5. Renovação (cobrança nova): a validade cresce e o app pega a chave nova.
  await call("kiwify", Object.assign({}, venda, { order_id: "ord2", webhook_event_type: "subscription_renewed" }), { k: "segredo-k" });
  const depois = [...lic.values()][0].until;
  assert.ok(depois > ateAntes, depois + " > " + ateAntes);
  const a2 = await call("ativar", { chave: a1.json.chave, aparelho: "AAAA2222" });
  assert.equal(lib.ler(a2.json.chave).a, depois);
  // 6. Admin libera a troca de tablet; aí o tablet B consegue.
  await call("vendas", { senha: "senha-admin", acao: "liberar", id: l.id });
  assert.equal((await call("ativar", { chave: chaveVenda, aparelho: "BBBB3333" })).status, 200);
  // 7. Reembolso: chave cancelada, ativação recusada, aparece nas revogadas.
  await call("kiwify", Object.assign({}, venda, { order_id: "ord2", order_status: "refunded", webhook_event_type: "order_refunded" }), { k: "segredo-k" });
  const r = await call("ativar", { chave: a2.json.chave, aparelho: "AAAA2222" });
  assert.equal(r.status, 403); assert.equal(r.json.revogada, true);
  assert.deepEqual((await call("revogadas", {})).json.ids, [l.id]);
  // 8. Plano mensal por nome; teste grátis devolve a data registrada.
  await call("kiwify", { order_id: "ord9", order_status: "paid", Product: { product_name: "Revela Mensal" }, Customer: { full_name: "João" } }, { k: "segredo-k" });
  assert.equal([...lic.values()].find((x) => x.ref === "kiwify:ord9").plan, "mensal");
  assert.deepEqual((await call("trial", { aparelho: "CCCC4444" })).json, { inicio: "2026-10-20", dias: 3 });
  assert.equal((await call("trial", { aparelho: "x" })).status, 400);
  // 9. Chave manual com tablet: liga direto, sem precisar de internet.
  const m = await call("licenca", { senha: "senha-admin", nome: "Cortesia", plano: "cortesia", aparelho: "DDDD5555" });
  assert.equal(lib.ler(m.json.chave).d, "DDDD5555"); assert.equal(lib.ler(m.json.chave).o, undefined);
  // 10. Venda vinda da página de um parceiro: a origem fica registrada.
  await call("kiwify", { order_id: "ord10", order_status: "paid", Product: { product_name: "Revela Mensal" }, Customer: { full_name: "Ana" },
    TrackingParameters: { src: "rodolfo", utm_source: "rodolfo" } }, { k: "segredo-k" });
  assert.equal([...lic.values()].find((x) => x.ref === "kiwify:ord10").origin, "kiwify:rodolfo");
  // 11. Chave de ativação que não está no banco: recusada (não vira chave livre para qualquer tablet).
  const solta = lib.assinar({ nome: "X", plano: "mensal", ate: "2030-01-01", online: true }).chave;
  assert.equal((await call("ativar", { chave: solta, aparelho: "EEEE6666" })).status, 404);
  // 12. Dois tablets ativando a mesma chave nova ao mesmo tempo: só um fica com ela.
  const nova = (await call("licenca", { senha: "senha-admin", nome: "Dupla", plano: "mensal" })).json.chave;
  const [x, y] = await Promise.all([call("ativar", { chave: nova, aparelho: "FFFF7777" }), call("ativar", { chave: nova, aparelho: "GGGG8888" })]);
  assert.deepEqual([x.status, y.status].sort(), [200, 409]);
  // 13. Senha do admin: 10 erros do mesmo IP travam, até com a senha certa.
  for (let i = 0; i < 10; i++) assert.equal((await call("vendas", { senha: "chute" + i }, {}, "6.6.6.6")).status, 401);
  assert.equal((await call("vendas", { senha: "senha-admin" }, {}, "6.6.6.6")).status, 429);
  assert.equal((await call("vendas", { senha: "senha-admin" }, {}, "2.2.2.2")).status, 200);
  // 14. Cadastro de testador com o campo escondido preenchido (robô): recusado.
  assert.equal((await call("testadores", { acao: "cadastrar", nome: "Bot", site: "http://spam" })).status, 400);
  console.log("TODOS OS CENÁRIOS OK");
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
