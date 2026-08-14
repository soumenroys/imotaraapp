"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// P2-10 (code_review_audit_2026_08_14 finding F2): catches errors thrown by
// the ROOT layout itself — a narrower, rarer case than src/app/error.tsx
// (which only catches errors in segments nested under a working root
// layout). Must render its own <html>/<body> since it replaces the entire
// document when it fires. captureException no-ops safely when Sentry was
// never initialized (no SENTRY_DSN configured).
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
          <div>
            <h1>Something went wrong</h1>
            <p>Please refresh the page.</p>
          </div>
        </div>
      </body>
    </html>
  );
}
