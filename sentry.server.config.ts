import * as Sentry from "@sentry/nextjs";

/**
 * Init do Sentry no runtime Node (server). No-op sem SENTRY_DSN — o app roda
 * normalmente, só não envia nada. Ligar = preencher SENTRY_DSN.
 */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // PII financeira NUNCA vai pro Sentry por padrão.
    sendDefaultPii: false,
    beforeSend(event) {
      // Remove corpo da request (pode conter valores/CPF/e-mail).
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
      }
      return event;
    },
  });
}
