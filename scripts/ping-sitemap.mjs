// scripts/ping-sitemap.mjs
// Notifies Google and Bing about the updated sitemap after each production build.
// Runs only when VERCEL=1 (or PING_SITEMAP=1) to avoid noise in local builds.

const shouldPing = process.env.VERCEL === "1" || process.env.PING_SITEMAP === "1";

if (!shouldPing) {
  console.log("[ping-sitemap] Skipped (not a Vercel build). Set PING_SITEMAP=1 to force.");
  process.exit(0);
}

const SITEMAP_URL = "https://www.imotara.com/sitemap.xml";

const endpoints = [
  `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`,
  `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`,
];

async function ping(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    console.log(`[ping-sitemap] ${new URL(url).hostname} → HTTP ${res.status}`);
  } catch (err) {
    // Non-fatal — a failed ping should never break the build
    console.warn(`[ping-sitemap] ${url} failed: ${err.message}`);
  }
}

await Promise.all(endpoints.map(ping));
