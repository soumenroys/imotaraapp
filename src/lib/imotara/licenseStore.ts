// src/lib/imotara/licenseStore.ts
"use client";

/**
 * ONE copy of the licence, shared by everything that needs it.
 *
 * 🔴 WHY THIS EXISTS. There were EIGHT independent copies: every `useLicense()`
 * call site owned its own `useState` AND fired its own request — header, chat,
 * upgrade, the badge, useFeatureGate, license-debug — plus `settings/page.tsx`
 * kept a private eighth with its own fetch.
 *
 * Eight fetches at eight different moments produce eight different answers, and
 * whichever one raced the session lost. Reported 2026-10-01, all three symptoms
 * being the same flaw:
 *
 *   1. the header plan capsule appearing after one sign-in and not the next
 *   2. **the header showing "Plus" while Settings showed "Free" at the same
 *      time** — two copies, two answers, both rendered on screen at once
 *   3. the plan appearing only after a delay
 *
 * 🔑 Fixing the *triggers* (licenseRefresh.ts) was necessary but not sufficient:
 * telling eight caches to refresh still leaves eight caches. They converge only
 * if there is one.
 *
 * 🔑 IN-FLIGHT DEDUPE IS THE POINT. Eight mounting consumers now produce ONE
 * request, and all eight read the same result. Without it we would keep the
 * disagreement and merely add load.
 *
 * ⚠️ ON FAILURE WE KEEP THE LAST GOOD DATA. Never null it, never substitute a
 * default. A failed fetch means "we could not find out", and rendering "free"
 * for that is how a paying subscriber gets shown the free plan — the bug that
 * started this whole night. See [[trap_tier_lives_at_license_tier]].
 */

/** Exactly the shape `/api/license/status` returns. Nothing invented. */
export type LicenseResponse = {
    ok?: boolean;
    /** Enforcement mode — this one IS top-level. */
    mode?: string;
    error?: string;
    /** 🔑 THE TIER LIVES HERE, never at the root. */
    license?: {
        status?: string;
        tier?: string;
        mode?: string;
        source?: string;
        expiresAt?: string | null;
        tokenBalance?: number;
    };
    org?: { orgId: string; orgName: string; orgRole: string; billingType?: string | null } | null;
    user?: { id: string; email: string | null } | null;
};

export type LicenseSnapshot = {
    /** Last successful response, or null before the first one lands. */
    data: LicenseResponse | null;
    /** True until the FIRST fetch settles. Never true again after that. */
    loading: boolean;
    /** True while any fetch is in flight, including refreshes. */
    refreshing: boolean;
    /** Message from the last failed fetch; `data` is deliberately preserved. */
    error: string | null;
};

let snapshot: LicenseSnapshot = { data: null, loading: true, refreshing: false, error: null };

const subscribers = new Set<() => void>();
let inflight: Promise<void> | null = null;

function emit(): void {
    subscribers.forEach((fn) => { try { fn(); } catch { /* one listener must not break the rest */ } });
}

function patch(next: Partial<LicenseSnapshot>): void {
    snapshot = { ...snapshot, ...next };
    emit();
}

/** For useSyncExternalStore. Must return a stable reference between emits. */
export function getLicenseSnapshot(): LicenseSnapshot {
    return snapshot;
}

/**
 * Server render sees "not loaded yet".
 *
 * ⚠️ A SEPARATE FROZEN OBJECT ON PURPOSE. useSyncExternalStore calls this during
 * SSR and hydration; returning the mutable `snapshot` would let a client fetch
 * that resolved before hydration change the value underneath React and throw a
 * hydration mismatch.
 */
const SERVER_SNAPSHOT: LicenseSnapshot = Object.freeze({
    data: null, loading: true, refreshing: false, error: null,
});
export function getLicenseServerSnapshot(): LicenseSnapshot {
    return SERVER_SNAPSHOT;
}

export function subscribeLicenseStore(fn: () => void): () => void {
    subscribers.add(fn);
    return () => { subscribers.delete(fn); };
}

/**
 * Fetch the licence. Concurrent callers share one request.
 *
 * Returns the in-flight promise when one exists, so eight consumers mounting
 * together cause one round-trip rather than eight racing ones.
 */
export function fetchLicense(): Promise<void> {
    if (inflight) return inflight;

    patch({ refreshing: true });

    inflight = (async () => {
        try {
            const res = await fetch("/api/license/status", {
                method: "GET",
                credentials: "same-origin",
            });

            if (!res.ok) {
                // ⚠️ KEEP `data`. The server now answers 503 when it genuinely
                // cannot resolve a tier; treating that as "free" is the exact
                // silent downgrade this codebase has already paid for.
                patch({ loading: false, refreshing: false, error: `HTTP ${res.status}` });
                return;
            }

            const json = (await res.json()) as LicenseResponse;
            patch({ data: json, loading: false, refreshing: false, error: null });
        } catch (err) {
            patch({ loading: false, refreshing: false, error: String(err) });
        } finally {
            inflight = null;
        }
    })();

    return inflight;
}

/** Test-only reset. Not exported from any barrel; do not call in app code. */
export function __resetLicenseStoreForTests(): void {
    snapshot = { data: null, loading: true, refreshing: false, error: null };
    inflight = null;
    subscribers.clear();
}
