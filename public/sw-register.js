/* Registra o service worker na LANDING (externo por causa do CSP: script-src 'self').
   Só registra — sem auto-reload (a lógica de atualização que recarrega fica no app).
   Habilita: instalação como PWA (beforeinstallprompt) e funcionar offline. */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
}
