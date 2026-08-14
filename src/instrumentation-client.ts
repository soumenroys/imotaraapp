// src/instrumentation-client.ts
// Browser-side Sentry init (P2-10, code_review_audit_2026_08_14 finding F2 —
// "zero real error/crash reporting on either platform"). Next.js auto-loads
// this file client-side; under Turbopack (this project's dev/build engine)
// the legacy sentry.client.config.ts convention no longer works, so this is
// the only supported location.
//
// Env-gated exactly like GEMINI_API_KEY / ALERT_GMAIL_* elsewhere in this
// codebase: with no NEXT_PUBLIC_SENTRY_DSN set, Sentry.init() is simply never
// called — zero behavior change, zero network calls, safe to ship right now
// and wire up a real DSN whenever a Sentry project exists for this app.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Routes browser-side event submission through this app's own
    // /monitoring route instead of directly to Sentry's ingest domain —
    // avoids needing to add sentry.io to the strict CSP connect-src in
    // next.config.ts, and avoids ad-blockers that target Sentry's default
    // domain. See the tunnelRoute option in next.config.ts.
    tracesSampleRate: 0.1,
    // Session replay is off by default — a wellness/companion app's chat
    // content is sensitive; enabling replay would need explicit masking
    // review first, not a default-on decision made here.
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_IMOTARA_VERSION
      ? `web@${process.env.NEXT_PUBLIC_IMOTARA_VERSION}`
      : undefined,
  });
}

// Required for Sentry to instrument client-side route transitions — a no-op
// export when Sentry.init() above was never called (no DSN configured).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
