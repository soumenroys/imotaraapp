import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const CSP = [
  "default-src 'self'",
  // Next.js injects inline hydration scripts; Razorpay checkout.js loaded dynamically
  "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com",
  // Tailwind + Next.js inject inline styles
  "style-src 'self' 'unsafe-inline'",
  // Supabase REST + realtime WebSocket (browser-side auth/subscribe calls)
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "media-src 'self' blob:",
  // Razorpay checkout opens an iframe
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  // Belt-and-suspenders with X-Frame-Options: DENY
  "frame-ancestors 'none'",
  // PWA service worker
  "worker-src 'self' blob:",
]
  .join("; ")
  .trim();

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: CSP,
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=()",
  },
  {
    // Vercel injects this at the edge automatically, but enforcing it in-repo
    // means the guarantee doesn't silently disappear on a different host.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  async redirects() {
    return [
      // /reflect and /grow were the same screen — app/reflect/page.tsx was a
      // component whose entire body was redirect("/grow") (UX-24).
      //
      // The route file is gone, but the redirect is NOT. Deleting it outright
      // would 404 anyone still holding the link, and a redirect is exactly the
      // thing you leave behind when a URL moves. Here it is also cheaper: it
      // resolves at the edge instead of booting a React page to call
      // redirect(), and 308 tells a browser or crawler it is permanent, which
      // rendering a component never did.
      { source: "/reflect", destination: "/grow", permanent: true },
    ];
  },
};

// P2-10 (code_review_audit_2026_08_14 finding F2): env-gated exactly like
// GEMINI_API_KEY/ALERT_GMAIL_* elsewhere — withSentryConfig is safe to apply
// unconditionally (it only instruments build output; instrumentation-client.ts
// and instrumentation.ts are what actually decide whether Sentry.init() ever
// runs, gated on SENTRY_DSN/NEXT_PUBLIC_SENTRY_DSN). Source-map upload is
// explicitly skipped without a real SENTRY_AUTH_TOKEN so the build never
// depends on Sentry credentials existing.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  // Routes browser-side event submission through this app's own domain
  // instead of directly to Sentry's ingest endpoint — avoids needing to add
  // sentry.io to the strict CSP connect-src above, and avoids ad-blockers
  // that specifically target Sentry's default domain.
  tunnelRoute: "/monitoring",
  widenClientFileUpload: true,
});
