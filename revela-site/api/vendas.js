// Lista das vendas para o /admin, com a chave e os links prontos de WhatsApp e e-mail.
const lib = require("./_lib");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erro: "Use POST" });
  const body = lib.corpo(req);
  if (lib.recusarAdmin(res, await lib.admin(req, body.senha))) return;
  try {
    if (body.acao === "enviada" || body.acao === "revogar" || body.acao === "liberar") {
      const l = await lib.db("revela_license_get", { p_id: String(body.id || ""), p_ref: null });
      if (!l) return res.status(404).json({ erro: "Chave não encontrada" });
      if (body.acao === "enviada") l.sent_at = new Date().toISOString();
      if (body.acao === "revogar") l.status = "revogada";
      if (body.acao === "liberar") l.device = null; // cliente trocou de tablet
      await lib.db("revela_license_save", { p: l });
    }
    const lista = (await lib.db("revela_license_list", { p_limit: 300 })) || [];
    const vendas = lista.map((l) => {
      // Ainda sem tablet: a chave é de ativação (liga ao primeiro tablet). Com tablet: chave dele.
      const { chave } = lib.assinar({ id: l.id, nome: l.name, plano: l.plan, ate: l.until, aparelho: l.device || "", online: !l.device });
      const msg = lib.mensagemCliente(l.name, chave, l.plan);
      const wa = lib.whatsappDe(l.phone);
      return {
        id: l.id, nome: l.name, email: l.email, telefone: l.phone, plano: l.plan, situacao: l.status, ate: l.until,
        aparelho: l.device, origem: l.origin, criada: l.created_at, enviada: l.sent_at, chave,
        whatsapp: wa ? `https://wa.me/${wa}?text=${encodeURIComponent(msg)}` : "",
        email_link: l.email ? `mailto:${encodeURIComponent(l.email)}?subject=${encodeURIComponent("Sua chave do Revela")}&body=${encodeURIComponent(msg)}` : "",
        mensagem: msg,
      };
    });
    return res.status(200).json({ vendas });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ erro: "Banco indisponível" });
  }
};
