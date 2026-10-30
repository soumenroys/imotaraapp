// src/lib/seo/indexNow.ts
// Tell Bing (and the engines that share IndexNow) that the site changed.
//
// 🔑 OWNER, 30 Oct 2026 — the S3 search review found that the web-search index
// AI assistants use returned NOTHING for "Imotara app" or "imotara.com". Bing
// feeds ChatGPT search, Copilot and DuckDuckGo, and the site never told Bing
// about a single page: it waited to be found.
//
// ⚠️ ONCE PER DEPLOYMENT, not on a timer. Nearly every sitemap entry is dated
// "now" at build time, so "what changed" cannot be read from the sitemap —
// but a new deployment is exactly the moment pages can have changed. The job
// remembers the last deployment it reported (app_settings) and submits again
// only for a new one. IndexNow asks for changed URLs, not a daily flood.
//
// 🔓 The key is PUBLIC by design: IndexNow proves ownership by fetching
// /<key>.txt from the same host. Only our own public page URLs are sent.

/** ⚠️ Must match public/<KEY>.txt exactly ⇒ src/__tests__/seo/indexNow.test.ts. */
export const INDEXNOW_KEY = "3268e65f4b2056fc4c04107225102ed1";
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
/** IndexNow's own limit per request. */
export const MAX_URLS = 10_000;

export type IndexNowPayload = { host: string; key: string; keyLocation: string; urlList: string[] };

/**
 * The request body. Only URLs on the key's own host are allowed in one
 * submission (IndexNow rejects mixed hosts), so anything else is dropped.
 */
export function buildPayload(urls: string[]): IndexNowPayload | null {
  const parsed = urls.map((u) => { try { return new URL(u); } catch { return null; } }).filter((u): u is URL => !!u && u.protocol === "https:");
  if (parsed.length === 0) return null;
  const host = parsed[0].host;
  const urlList = [...new Set(parsed.filter((u) => u.host === host).map((u) => u.toString()))].slice(0, MAX_URLS);
  return { host, key: INDEXNOW_KEY, keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`, urlList };
}

/** Submit only for a deployment not reported before. No deployment id (local, preview build) ⇒ never. */
export function shouldSubmit(lastReported: string | null | undefined, current: string | undefined): boolean {
  return !!current && current !== lastReported;
}

/** 200 and 202 are both success in IndexNow; anything else is reported back as it came. */
export async function submit(payload: IndexNowPayload): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  return { ok: res.status === 200 || res.status === 202, status: res.status, body: (await res.text()).slice(0, 300) };
}
