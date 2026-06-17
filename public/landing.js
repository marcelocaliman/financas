/* Progressive enhancement da landing — a página já funciona 100% sem isto.
   Externo porque o CSP do app é script-src 'self' (bloqueia <script> inline). */
(function () {
  var owner = "marcelo.salgado.caliman@gmail.com";

  // Header ganha borda ao rolar.
  var header = document.querySelector("header.site");
  if (header) {
    var onScroll = function () { header.classList.toggle("scrolled", window.scrollY > 20); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // Inclui o e-mail digitado no corpo do mailto da lista de espera.
  var input = document.getElementById("leadEmail");
  var btn = document.getElementById("leadBtn");
  if (input && btn) {
    var update = function () {
      var email = (input.value || "").trim();
      var body = "Quero entrar na lista de acesso antecipado." + (email ? "\nMeu e-mail: " + email : "");
      btn.href =
        "mailto:" + owner +
        "?subject=" + encodeURIComponent("Lista de espera — Nossas Finanças") +
        "&body=" + encodeURIComponent(body);
    };
    input.addEventListener("input", update);
    update();
  }

  var y = document.getElementById("year");
  if (y) y.textContent = String(new Date().getFullYear());
})();
