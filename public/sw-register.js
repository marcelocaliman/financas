/* Registra o service worker na LANDING (externo por causa do CSP: script-src 'self').
   A landing é servida do PRECACHE do SW → sem esta lógica, um deploy só aparecia na
   2ª visita (a raiz do "não atualiza"). Agora: checa atualização ao carregar/focar e,
   quando o novo SW assume (skipWaiting + clientsClaim), recarrega UMA vez — página
   estática, reload é seguro. A 1ª instalação não recarrega. */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    var hadController = !!navigator.serviceWorker.controller;
    var refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (refreshing || !hadController) return;
      refreshing = true;
      window.location.reload();
    });
    navigator.serviceWorker
      .register("/sw.js")
      .then(function (reg) {
        document.addEventListener("visibilitychange", function () {
          if (document.visibilityState === "visible") reg.update().catch(function () {});
        });
      })
      .catch(function () {});
  });
}
