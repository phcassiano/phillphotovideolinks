/*
 * Tudo o que muda sem mexer no texto das páginas: preços e para onde vão os botões.
 * Quando o checkout existir (Hotmart, Kiwify, Stripe…), cole os links em checkoutMensal
 * e checkoutAnual. Sem checkout, os botões levam ao WhatsApp (lista de espera); sem
 * WhatsApp, mostram "Em breve".
 */
window.REVELA = {
  precoMensal: "39",
  precoAnual: "348",
  precoAnualPorMes: "29",
  checkoutMensal: "https://pay.kiwify.com.br/bFX2A4c",
  checkoutAnual: "https://pay.kiwify.com.br/xK6NFjb",
  // Só números, com DDI e DDD. Ex.: "5511987654321"
  whatsapp: "",
  /*
   * Parceiros: cada um tem uma página (/<id>) cujos botões levam o código dele no checkout
   * (src=<id>), e a venda aparece no /admin como "kiwify:<id>". Quando o parceiro tiver link
   * de afiliado da Kiwify, cole em checkoutMensal/checkoutAnual dele.
   */
  parceiros: {
    rodolfo: { nome: "Rodolfo Santos", instagram: "rodolfosantosfotografo", checkoutMensal: "", checkoutAnual: "" },
  },
};

(function () {
  var c = window.REVELA;
  function waitlist(plano) {
    if (!c.whatsapp) return "";
    var msg = "Oi! Quero entrar na lista do Revela" + (plano ? " (plano " + plano + ")" : "") + ".";
    return "https://wa.me/" + c.whatsapp + "?text=" + encodeURIComponent(msg);
  }
  /** Acrescenta o código do parceiro ao link do checkout, para a venda ser atribuída a ele. */
  function comOrigem(url, id) {
    if (!url || !id) return url;
    return url + (url.indexOf("?") < 0 ? "?" : "&") + "src=" + encodeURIComponent(id) + "&utm_source=" + encodeURIComponent(id);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var pid = document.body.getAttribute("data-parceiro");
    var parceiro = pid && c.parceiros ? c.parceiros[pid] : null;
    if (parceiro) {
      document.querySelectorAll("[data-parceiro-nome]").forEach(function (el) { el.textContent = parceiro.nome; });
      document.querySelectorAll("[data-parceiro-instagram]").forEach(function (el) {
        el.textContent = "@" + parceiro.instagram;
        el.href = "https://instagram.com/" + parceiro.instagram;
      });
    }
    document.querySelectorAll("[data-preco]").forEach(function (el) {
      el.textContent = c[el.getAttribute("data-preco")] || el.textContent;
    });
    document.querySelectorAll("[data-checkout]").forEach(function (el) {
      var plano = el.getAttribute("data-checkout");
      var fonte = parceiro && (parceiro.checkoutMensal || parceiro.checkoutAnual) ? parceiro : c;
      var url = plano === "anual" ? fonte.checkoutAnual : plano === "mensal" ? fonte.checkoutMensal : (fonte.checkoutAnual || fonte.checkoutMensal);
      if (url) {
        el.href = comOrigem(url, parceiro ? pid : "");
        return;
      }
      var wa = waitlist(plano);
      if (wa) {
        el.href = wa;
        el.target = "_blank";
        el.rel = "noopener";
        if (el.hasAttribute("data-label-espera")) el.textContent = el.getAttribute("data-label-espera");
      } else {
        el.removeAttribute("href");
        el.classList.add("is-soon");
        el.setAttribute("aria-disabled", "true");
        el.textContent = "Em breve";
      }
    });
  });
})();
