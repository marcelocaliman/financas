import * as Sentry from "@sentry/nextjs";

/**
 * Hook nativo de instrumentação do Next 16. Carrega o init do Sentry conforme
 * o runtime e expõe `onRequestError` pra capturar erros de Server Components,
 * route handlers e server actions que de outra forma morreriam sem rastro.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
