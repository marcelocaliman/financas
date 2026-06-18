import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Fase 0a: 100% local. Sem servidor, sem auth, sem cripto. PWA instalável e offline.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      // Nova versão entra no ar e aplica sozinha (skipWaiting + clientsClaim); o
      // main.tsx recarrega a aba automaticamente ao assumir o controle.
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        // Navegações sob /app* (ex.: /app/admin no refresh) caem no shell do APP, não na
        // landing. A landing (/) NÃO está na allowlist → segue servida do precache.
        navigateFallback: "/app.html",
        navigateFallbackAllowlist: [/^\/app(\/|$)/],
      },
      manifest: {
        name: "Nossas Finanças — patrimônio multimoeda",
        short_name: "Nossas Finanças",
        description:
          "Gestão patrimonial e orçamento multimoeda, privado por criptografia ponta a ponta — local-first.",
        lang: "pt-BR",
        theme_color: "#0a0b0d",
        background_color: "#0a0b0d",
        display: "standalone",
        start_url: "/app",
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // O app sai do index.html (que passa a ser a LANDING, na raiz) e vira app.html, servido
  // em /app. Mantém base "/" — assets em /assets continuam na raiz, sem mexer no ícone.
  build: {
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL("./app.html", import.meta.url)),
        // Página pública (sem auth) p/ acompanhar um ticket de suporte por token: /ticket?t=…
        ticket: fileURLToPath(new URL("./ticket.html", import.meta.url)),
      },
    },
  },
});
