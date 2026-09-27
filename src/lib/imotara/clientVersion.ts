// src/lib/imotara/clientVersion.ts
//
// Reads the mobile client's version off a request, and decides whether it is
// stale enough to warn about.
//
// 🔴 WHY THIS EXISTS. Retiring `pro_*` and repricing to ₹149/₹1,299 left a fleet
// of installed clients rendering prices the server could not correct — 1.4.1 and
// 1.3.2 both hardcode `plus_monthly ₹99` and `plus_annual ₹699` while Play bills
// ₹149/₹1,299, and 1.3.2 shows two `pro_*` cards for products that no longer
// exist. Nothing could be done, because **no client sent its version**. The
// server could not tell 1.3.2 from 1.4.3, so it could not warn, gate, or even
// measure the exposure.
//
// ⚠️ THIS DOES NOT FIX THAT FLEET. Nothing can: code shipped now never reaches
// an install running 1.3.2. This buys the lever for the NEXT price or SKU
// change. Do not let it be mistaken for a fix to the current one.
//
// 🔑 ADVISORY, AND FAIL-OPEN BY CONSTRUCTION.
//   - A request with no version header is NOT stale. Every client shipped
//     before this — which is all of them — must keep working untouched.
//   - An unparseable version is NOT stale. A malformed header must never be
//     the reason someone cannot use the app.
//   - Nothing here returns a 4xx. It sets a flag in a 200 response; honouring
//     it is the client's choice, and only 1.4.4+ knows how.
//   - The minimum is env-driven and UNSET BY DEFAULT, so this is inert until
//     somebody deliberately turns it on.

/** Header the mobile app sends. Set inside both fetch helpers, not at call sites. */
export const CLIENT_VERSION_HEADER = "x-imotara-version";

/** What `appVersion.ts` sends when it genuinely cannot resolve a version. */
const UNKNOWN = "unknown";

export type ClientVersion = {
    /** Exactly as sent, for logging. Null when absent. */
    raw: string | null;
    /** [major, minor, patch], or null when absent/unparseable. */
    parts: [number, number, number] | null;
};

/**
 * Parse `1.4.3` or `1.4.3+143` into comparable parts.
 *
 * The build suffix is deliberately ignored for comparison: it disambiguates two
 * builds of one version, which matters for a staged rollout but never for "is
 * this client too old to show correct prices".
 */
export function parseVersion(raw: string | null | undefined): ClientVersion {
    if (typeof raw !== "string") return { raw: null, parts: null };
    const trimmed = raw.trim();
    if (!trimmed || trimmed === UNKNOWN) return { raw: trimmed || null, parts: null };

    const m = /^(\d+)\.(\d+)\.(\d+)/.exec(trimmed);
    if (!m) return { raw: trimmed, parts: null };

    const parts: [number, number, number] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (parts.some((n) => !Number.isFinite(n))) return { raw: trimmed, parts: null };
    return { raw: trimmed, parts };
}

/** a < b, comparing major.minor.patch left to right. */
function isOlder(a: [number, number, number], b: [number, number, number]): boolean {
    for (let i = 0; i < 3; i++) {
        if (a[i] !== b[i]) return a[i] < b[i];
    }
    return false;
}

/**
 * The minimum version we consider able to render prices correctly.
 *
 * Unset ⇒ the feature is off and nothing is ever stale. That is the default, on
 * purpose: turning this on is a decision, not a side effect of deploying.
 */
export function minSupportedVersion(): string | null {
    const raw = process.env.IMOTARA_MIN_SUPPORTED_APP_VERSION?.trim();
    if (!raw) return null;
    return parseVersion(raw).parts ? raw : null;
}

/**
 * Should this client be told to update?
 *
 * Returns false whenever we are not certain — no header, unparseable header, or
 * no minimum configured. Being wrong in that direction costs nothing; being
 * wrong the other way nags a user who is already up to date.
 */
export function isClientStale(req: { headers: { get(name: string): string | null } }): boolean {
    const min = minSupportedVersion();
    if (!min) return false;

    const minParts = parseVersion(min).parts;
    if (!minParts) return false;

    const theirs = parseVersion(req.headers.get(CLIENT_VERSION_HEADER));
    if (!theirs.parts) return false; // absent or malformed ⇒ never stale

    return isOlder(theirs.parts, minParts);
}
