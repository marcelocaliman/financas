import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  experimental: {
    // Desabilita o client-side router cache: toda navegação re-fetcha o
    // RSC do server, garantindo que mudanças feitas em uma página
    // (ex: atualizar saldo em /investimentos) apareçam imediatamente
    // ao navegar pra outra (/dashboard, /ir, /patrimonio).
    //
    // Trade-off: navegação fica ~50ms mais lenta. Pra app pessoal de
    // finanças onde dados mudam o tempo todo, freshness > velocidade.
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
  // Headers de segurança (ROADMAP Security). CSP enforcing não entra aqui pra
  // não quebrar Supabase realtime / recharts / leaflet — fica pra um passo
  // dedicado em Report-Only. Estes são seguros e de alto valor.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // CSP em Report-Only: coleta violações sem quebrar (Supabase realtime,
          // recharts/leaflet inline, Sentry, Turnstile). Promover a enforcing
          // depois de revisar os reports.
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://olinda.bcb.gov.br https://api.frankfurter.app https://brapi.dev https://challenges.cloudflare.com",
              "frame-src https://challenges.cloudflare.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

// withSentryConfig é seguro mesmo sem DSN/token: só monta o plugin de build.
// Upload de sourcemaps só acontece quando SENTRY_AUTH_TOKEN está presente.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Sem token, não tenta subir sourcemap (evita warning ruidoso no build local).
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  disableLogger: true,
  tunnelRoute: "/monitoring",
});
