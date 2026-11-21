// src/lib/analytics/getAppLink.ts — #162 (owner 21 Nov 2026, option A)
//
// One link for profile buttons (Facebook "Use app", bios): Android ⇒ Google Play,
// iPhone/iPad ⇒ App Store, anything else ⇒ the website. Each carries where it came
// from, so the visit is countable in Play Console (install referrer) and GA.
//
// ⛔ Nothing about the person: the only input is the device family from the
// user-agent and a short `from` label we chose ourselves.

export const PLAY_URL = "https://play.google.com/store/apps/details?id=com.imotara.imotara";
export const APP_STORE_URL = "https://apps.apple.com/app/imotara/id6756697569";
export const SITE_URL = "https://www.imotara.com/";

export type Device = "android" | "ios" | "other";

export function deviceOf(ua: string | null | undefined): Device {
  const s = ua ?? "";
  if (/android/i.test(s)) return "android";
  // iPadOS 13+ says "Macintosh" — only touch-capable Macs are iPads, which a UA cannot tell,
  // so a Mac goes to the website (it can still reach the App Store from there).
  if (/iphone|ipad|ipod/i.test(s)) return "ios";
  return "other";
}

/** ⛔ Only our own short labels survive — never an arbitrary string into a URL we build. */
export function cleanFrom(from: string | null | undefined): string {
  const f = (from ?? "").toLowerCase().trim();
  return /^[a-z][a-z0-9_]{0,19}$/.test(f) ? f : "direct";
}

/** #162: the links we hand out. Any other label still redirects normally, but is counted as "other". */
export const GET_APP_SOURCES = ["fb_button", "fb_pinned", "fb_story", "ig_story"] as const;
export type GetAppSource = (typeof GET_APP_SOURCES)[number] | "other";

export function sourceOf(from: string | null | undefined): GetAppSource {
  const f = cleanFrom(from);
  return (GET_APP_SOURCES as readonly string[]).includes(f) ? (f as GetAppSource) : "other";
}

export function getAppTarget(ua: string | null | undefined, from: string | null | undefined): { device: Device; url: string } {
  const source = cleanFrom(from);
  const tags = `utm_source=${source}&utm_medium=social&utm_campaign=get_app`;
  const device = deviceOf(ua);
  if (device === "android") return { device, url: `${PLAY_URL}&referrer=${encodeURIComponent(tags)}` };
  if (device === "ios") return { device, url: APP_STORE_URL };
  return { device, url: `${SITE_URL}?${tags}` };
}
