"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Error boundary de último recurso — captura erros que estouram no próprio
 * root layout (acima de qualquer route group). Substitui o documento inteiro,
 * então precisa renderizar <html>/<body> por conta própria. Mantido minimalista
 * e sem dependências de provider (que podem ser a causa do erro).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { boundary: "global" } });
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#fcfbf8",
          color: "#1a1d23",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#b4431f",
            }}
          >
            Erro inesperado
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 600, margin: "12px 0 8px" }}>
            O app encontrou um problema
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.5, margin: 0 }}>
            O erro foi registrado. Tente recarregar — seus dados estão a salvo.
          </p>
          {error.digest ? (
            <p
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 10.5,
                color: "#9ca3af",
                marginTop: 12,
              }}
            >
              ref: {error.digest}
            </p>
          ) : null}
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              border: "none",
              borderRadius: 8,
              background: "#2d3f54",
              color: "#fff",
              fontSize: 13,
              fontWeight: 500,
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
