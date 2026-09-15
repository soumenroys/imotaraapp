// src/lib/imotara/clientPlatform.ts
// Which surface did this request come from — the website, or the phone app?
//
// Answered in two steps, deliberately in this order:
//
//   1. The X-Imotara-Platform header, which the mobile app sets on every call
//      from inside its two fetchWithTimeout helpers. This is the only source
//      that is actually authoritative, because the app states it directly.
//
//   2. A User-Agent sniff, as a fallback for app builds already in the wild
//      that predate the header (1.3.2 and earlier are on both stores and will
//      be for as long as people delay updating). Without this, every event
//      from an older install would land in 'unknown' and the web/app split
//      would read as though the app had no users.
//
// A request we cannot place returns 'unknown' rather than defaulting to 'web'.
// Defaulting would be worse than admitting ignorance: it would silently
// inflate the web number with traffic that may well be the app, and nothing
// downstream would ever show that it had happened.

export type ClientPlatform = "web" | "ios" | "android" | "unknown";

const ALLOWED: ReadonlySet<string> = new Set(["web", "ios", "android", "unknown"]);

/** Header the mobile app sets. Keep in sync with imotara-mobile's fetch helpers. */
export const PLATFORM_HEADER = "x-imotara-platform";

interface HeaderLike {
  get(name: string): string | null;
}

export function resolvePlatform(req: { headers: HeaderLike }): ClientPlatform {
  // 1. What the client says about itself.
  const declared = req.headers.get(PLATFORM_HEADER)?.trim().toLowerCase();
  if (declared && ALLOWED.has(declared)) return declared as ClientPlatform;

  // 2. What its User-Agent implies. Order matters: React Native on iOS sends a
  //    UA containing both "CFNetwork" and, on some versions, "Mozilla" — so the
  //    native-client markers have to be tested BEFORE the browser markers, or
  //    every iOS app request would be filed as web.
  const ua = req.headers.get("user-agent")?.toLowerCase() ?? "";
  if (!ua) return "unknown";

  // okhttp is React Native's HTTP stack on Android; "expo" covers dev clients.
  if (/okhttp|android/.test(ua) && !/chrome|firefox|edg\//.test(ua)) return "android";
  if (/cfnetwork|darwin/.test(ua)) return "ios";
  if (/\bexpo\b/.test(ua)) return "unknown"; // Expo Go — could be either phone

  // A real browser. Note this is the LAST test, not the first.
  if (/mozilla|chrome|safari|firefox|edg\//.test(ua)) return "web";

  return "unknown";
}
