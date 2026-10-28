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
};

(function () {
  var c = window.REVELA;
  function waitlist(plano) {
    if (!c.whatsapp) return "";
    var msg = "Oi! Quero entrar na lista do Revela" + (plano ? " (plano " + plano + ")" : "") + ".";
    return "https://wa.me/" + c.whatsapp + "?text=" + encodeURIComponent(msg);
  }
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-preco]").forEach(function (el) {
      el.textContent = c[el.getAttribute("data-preco")] || el.textContent;
    });
    document.querySelectorAll("[data-checkout]").forEach(function (el) {
      var plano = el.getAttribute("data-checkout");
      var url = plano === "anual" ? c.checkoutAnual : plano === "mensal" ? c.checkoutMensal : (c.checkoutAnual || c.checkoutMensal);
      if (url) {
        el.href = url;
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
