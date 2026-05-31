import * as Sentry from "@sentry/nextjs";

/** Init do Sentry no runtime Edge (middleware). No-op sem SENTRY_DSN. */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}
