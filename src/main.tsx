import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/i18n";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA: aplica novas versões AUTOMATICAMENTE — sem o usuário precisar recarregar.
// Quando o novo service worker assume (skipWaiting + clientsClaim) a aba se recarrega
// sozinha. Checa atualização periodicamente e ao focar a aba (cobre sessões longas).
// O dado é local-first (já persistido), então o reload é seguro e instantâneo.
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing || !hadController) return; // 1ª instalação não recarrega
    refreshing = true;
    window.location.reload();
  });
  navigator.serviceWorker.ready
    .then((reg) => {
      setInterval(() => void reg.update(), 60_000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void reg.update();
      });
    })
    .catch(() => {});
}
