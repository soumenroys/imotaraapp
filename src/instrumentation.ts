// src/instrumentation.ts
// Server + edge runtime Sentry init (P2-10, code_review_audit_2026_08_14
// finding F2). Next.js's own instrumentation hook — register() runs once per
// runtime at boot. Env-gated identically to instrumentation-client.ts: with
// no SENTRY_DSN set, Sentry.init() is never called anywhere in this file.

import * as Sentry from "@sentry/nextjs";

export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
      release: process.env.NEXT_PUBLIC_IMOTARA_VERSION ? `web@${process.env.NEXT_PUBLIC_IMOTARA_VERSION}` : undefined,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
      release: process.env.NEXT_PUBLIC_IMOTARA_VERSION ? `web@${process.env.NEXT_PUBLIC_IMOTARA_VERSION}` : undefined,
    });
  }
}

// Reports errors from nested React Server Components (a class of error the
// root error boundary alone doesn't catch) — no-ops safely when Sentry was
// never initialized above (SENTRY_DSN unset).
export const onRequestError = Sentry.captureRequestError;
