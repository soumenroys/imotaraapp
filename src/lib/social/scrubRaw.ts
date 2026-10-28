// src/lib/social/scrubRaw.ts
// What a platform said, minus anything that would let somebody act as us.
//
// 🔴 28 Oct 2026: every `social_channel_stats.raw` row (20, 18–27 Oct) held the
// Page access token in plain text. Graph's insights reply carries `paging`
// links with `access_token=…` baked into the URL, and the reply was stored
// whole. ⛔ The token is encrypted everywhere else precisely so that a copy
// of the database cannot post as Imotara — this column quietly undid that.
//
// 🔑 Applied at the WRITE, so no caller has to remember it.

const TOKEN_PARAM = /([?&](?:access_token|refresh_token|client_secret|token)=)[^&"\s]+/gi;

export function scrubRaw<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(TOKEN_PARAM, "$1[removed]") as T;
  }
  if (Array.isArray(value)) return value.map((v) => scrubRaw(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // ⚠️ `paging` is only ever links to more of the same — dropped whole.
      if (k === "paging") continue;
      if (/^(access_token|refresh_token|client_secret)$/i.test(k)) continue;
      out[k] = scrubRaw(v);
    }
    return out as T;
  }
  return value;
}
