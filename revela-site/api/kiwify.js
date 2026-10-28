// Webhook da Kiwify: venda aprovada cria a chave, renovação estende a validade, reembolso e
// estorno cancelam. O endereço leva ?k=<segredo> (variável REVELA_KIWIFY_K).
const crypto = require("crypto");
const lib = require("./_lib");

function pick(o, ...caminhos) {
  for (const c of caminhos) {
    let v = o;
    for (const p of c.split(".")) v = v == null ? undefined : v[p];
    if (v != null && v !== "") return v;
  }
  return undefined;
}

/** Plano pelo que a Kiwify manda (frequência da assinatura ou nome do plano/produto). */
function planoDe(b) {
  const texto = [pick(b, "Subscription.plan.frequency", "subscription.plan.frequency", "Subscription.plan.name", "subscription.plan.name", "plan.name"), pick(b, "Product.product_name", "product.name")]
    .filter(Boolean).join(" ").toLowerCase();
  return /anual|annual|year|yearly|12 ?mes/.test(texto) ? "anual" : "mensal";
}

/** "aprovada", "renovada", "reembolsada", "cancelada" ou null (eventos que não mudam nada). */
function tipoDe(b) {
  const evento = String(pick(b, "webhook_event_type", "event", "type") || "").toLowerCase();
  const status = String(pick(b, "order_status", "status") || "").toLowerCase();
  if (/refund|reembols|chargeback|estorn/.test(evento + " " + status)) return "reembolsada";
  if (/subscription_canceled|subscription_cancelled|cancel/.test(evento)) return "cancelada";
  if (/renew|renovad/.test(evento)) return "renovada";
  if (/approved|aprovad|paid|pago/.test(evento + " " + status)) return "aprovada";
  return null;
}

function assinaturaOk(req, raw) {
  const token = process.env.REVELA_KIWIFY_TOKEN;
  const sig = req.query && req.query.signature;
  if (!token || !sig) return null; // sem token configurado: vale só o ?k=
  const calc = crypto.createHmac("sha1", token).update(raw).digest("hex");
  return lib.iguais(calc, sig);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Use POST" });
  if (!lib.iguais(req.query && req.query.k, process.env.REVELA_KIWIFY_K)) return res.status(401).json({ erro: "não autorizado" });
  const b = lib.corpo(req);
  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
  if (assinaturaOk(req, raw) === false) return res.status(401).json({ erro: "assinatura inválida" });

  const pedido = String(pick(b, "order_id", "order_ref", "id") || "");
  const ref = "kiwify:" + String(pick(b, "subscription_id", "Subscription.id", "subscription.id") || pedido);
  const tipo = tipoDe(b);
  try {
    await lib.db("revela_event", { p_kind: tipo || String(pick(b, "webhook_event_type", "order_status") || "outro"), p_ref: ref, p_payload: b });
  } catch (e) {
    console.error(e);
  }
  if (!tipo || ref === "kiwify:") return res.status(200).json({ ok: true, ignorado: true });

  try {
    const atual = await lib.db("revela_license_get", { p_id: null, p_ref: ref });
    const plano = atual ? atual.plan : planoDe(b);
    if (tipo === "aprovada" || tipo === "renovada") {
      if (!atual) {
        const id = lib.novoId();
        await lib.db("revela_license_save", {
          p: {
            id, ref, origin: "kiwify", plan: plano, status: "ativa", until: lib.validadeNova(plano), device: null, last_order: pedido,
            name: pick(b, "Customer.full_name", "customer.full_name", "Customer.name", "customer.name") || null,
            email: pick(b, "Customer.email", "customer.email") || null,
            phone: pick(b, "Customer.mobile", "customer.mobile", "Customer.phone", "customer.phone") || null,
          },
        });
      } else if (atual.last_order !== pedido && atual.status !== "reembolsada" && atual.status !== "revogada") {
        // Cada cobrança nova (pedido diferente) soma um período; a mesma notificação repetida não.
        atual.until = lib.validadeRenovada(atual.until, plano);
        atual.status = "ativa";
        atual.last_order = pedido;
        await lib.db("revela_license_save", { p: atual });
      }
    } else if (atual) {
      atual.status = tipo;
      await lib.db("revela_license_save", { p: atual });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: "falha ao gravar" });
  }
  return res.status(200).json({ ok: true });
};

module.exports.planoDe = planoDe;
module.exports.tipoDe = tipoDe;
