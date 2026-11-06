// src/lib/seo/indexNow.ts
// Tell Bing (and the engines that share IndexNow) that the site changed.
//
// 🔑 OWNER, 30 Oct 2026 — the S3 search review found that the web-search index
// AI assistants use returned NOTHING for "Imotara app" or "imotara.com". Bing
// feeds ChatGPT search, Copilot and DuckDuckGo, and the site never told Bing
// about a single page: it waited to be found.
//
// ⚠️ ONLY WHAT IS NEW, plus the full list at most once a week.
// 7 Nov 2026: the first design sent all 85 pages on EVERY production
// deployment. On a busy day that was 8 deployments — mostly admin-only
// changes — so Bing logged 680 submissions in 19 hours for pages that had not
// changed. IndexNow asks for changed URLs only, and repeated unchanged
// submissions risk being treated as noise. Nearly every sitemap entry is dated
// "now" at build time, so "what changed" cannot be read from the sitemap.
// What CAN be known: which URLs are NEW since the last submission. So:
//   • a page that was not in the last submitted list ⇒ sent at once;
//   • the whole list ⇒ again only after FULL_EVERY_DAYS;
//   • otherwise ⇒ nothing (the deployment is still remembered).
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

/** The whole list is re-sent at most this often. */
export const FULL_EVERY_DAYS = 7;

/** What the job remembers in app_settings after each run. */
export type IndexNowMemory = { deployment?: string; at?: string; fullAt?: string; sent?: string[] };

/**
 * Which URLs to send for this deployment.
 *   full  ⇒ every URL (first run, or the last full send is FULL_EVERY_DAYS old)
 *   new   ⇒ only URLs not in the list sent before
 *   none  ⇒ nothing to say
 * A memory from the OLD design (`at`, no `sent` list) means the full list WAS
 * sent at `at` — every run did that — so it counts as a full send then, and
 * the change itself does not cause one more flood.
 */
export function planSubmission(memory: IndexNowMemory | null | undefined, urls: string[], now: number):
  { kind: "full" | "new" | "none"; urls: string[] } {
  const legacy = !!memory?.at && !Array.isArray(memory?.sent);
  const fullAt = Date.parse((legacy ? memory!.at : memory?.fullAt) ?? "");
  const prev = legacy ? new Set(urls) : Array.isArray(memory?.sent) ? new Set(memory!.sent) : null;
  if (!prev || !Number.isFinite(fullAt) || now - fullAt >= FULL_EVERY_DAYS * 86_400_000) return { kind: "full", urls };
  const fresh = urls.filter((u) => !prev.has(u));
  return fresh.length ? { kind: "new", urls: fresh } : { kind: "none", urls: [] };
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
