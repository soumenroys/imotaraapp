// src/lib/imotara/latestAppVersion.ts
// "A new version of Imotara is available" — which version the phone app should
// offer (owner, 7 Nov 2026).
//
// 🔑 WHY OUR OWN NUMBER, NOT THE STORE'S. We bump the version everywhere BEFORE
// a build goes to review, and review takes hours to days. If the app compared
// itself with our release number it would send people to a store that does not
// have that version yet. Apple's lookup API lags per country (see memory
// trap_itunes_lookup_api_lags_the_store) and Google has no public one. So the
// number is set by hand, per store, only AFTER that store shows the version as
// live:
//
//   IMOTARA_LATEST_APP_VERSION_IOS      e.g. 1.6.6
//   IMOTARA_LATEST_APP_VERSION_ANDROID  e.g. 1.6.6
//
// ⚠️ Unset or not a version ⇒ null ⇒ the app shows NOTHING. That is the default
// on purpose: an update notice is a decision, never a side effect of a deploy.

import { parseVersion } from "@/lib/imotara/clientVersion";

export type LatestAppVersions = { ios: string | null; android: string | null };

function read(raw: string | undefined): string | null {
    const v = raw?.trim();
    if (!v) return null;
    const p = parseVersion(v).parts;
    return p ? p.join(".") : null;
}

export function latestAppVersions(env: Record<string, string | undefined> = process.env): LatestAppVersions {
    return {
        ios: read(env.IMOTARA_LATEST_APP_VERSION_IOS),
        android: read(env.IMOTARA_LATEST_APP_VERSION_ANDROID),
    };
}
