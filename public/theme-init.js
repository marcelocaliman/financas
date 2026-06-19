/* Aplica o tema salvo ANTES da pintura (evita flash claro↔escuro). Externo (não inline) por
   causa do CSP da landing (script-src 'self'). Roda como script BLOQUEANTE no <head>.
   Preferência própria da landing (nf_theme); se não houver, herda o tema salvo do app. */
(function () {
  try {
    var t = localStorage.getItem("nf_theme");
    if (t !== "light" && t !== "dark") {
      var ui = localStorage.getItem("financas-ui");
      if (ui) {
        try {
          var s = JSON.parse(ui);
          t = (s && s.state && s.state.theme) || null;
        } catch (e) {}
      }
    }
    if (t === "light") {
      document.documentElement.classList.add("light");
      var m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute("content", "#ecedef");
    }
  } catch (e) {}
})();
