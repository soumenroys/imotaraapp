import type { NextConfig } from "next";

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
};

export default nextConfig;
