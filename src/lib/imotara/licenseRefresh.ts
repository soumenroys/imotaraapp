// src/lib/imotara/licenseRefresh.ts
"use client";

/**
 * The ONE place that decides WHEN the licence should be re-read.
 *
 * 🔴 WHY THIS EXISTS. On 2026-09-30 `LICENSE_MODE` was flipped to `enforce` and
 * a subscriber with three paid ₹149 invoices was shown **FREE — 20 replies/day,
 * 7-day history**. The data was never wrong: `/api/license/status` returned
 * `tier: "plus", source: "personal", expiresAt: null` for that exact account,
 * and `/api/invoice` returned all three invoices. The page was simply showing an
 * answer it had fetched *before the session existed*, and had no way to learn
 * better.
 *
 * 🔑 THE ROOT CAUSE, stated once: **licence state was fetched imperatively and
 * was never reactive to AUTH state.** A page that mounts before the Supabase
 * session is established reads the anonymous fallback — which is `free` — and
 * then nothing ever tells it to look again.
 *
 * That window is not rare, it is *guaranteed* on a slow sign-in:
 * `src/app/auth/callback/page.tsx` gives the OAuth exchange 10 seconds and then
 * navigates ANYWAY with `?auth_error=timeout`. The destination page therefore
 * mounts, by design, without a settled session.
 *
 * 🔑 WHY A SHARED MODULE AND NOT A FIX IN EACH PLACE. There were already two
 * implementations of "re-read the licence" and they had drifted:
 *
 *   - `useLicense()` re-fetched on focus/visibility and on a manual trigger,
 *     but NOT on auth change — so it had the same hole for anyone who never
 *     left the tab.
 *   - `settings/page.tsx` used neither; it called its own fetch once on mount
 *     and had no automatic trigger at all.
 *
 * Fixing them separately would have left a third copy to drift later. The
 * triggers live here, once, and both consumers subscribe. Add a trigger here
 * and every surface gets it.
 *
 * ⚠️ THIS MODULE NEVER FETCHES ANYTHING. It owns *when*, not *what*. Callers
 * keep their own fetch, because they need different shapes — `useLicense` wants
 * tier/status/expiry, Settings additionally wants org context and token balance.
 */

/** Callbacks to run when something suggests the licence may have changed. */
type RefreshFn = () => void;

const subscribers = new Set<RefreshFn>();

/**
 * Minimum gap between AUTOMATIC re-fetches (focus / tab-visible).
 *
 * 🔑 Deliberately NOT applied to auth events or to manual refreshLicense().
 * A throttle exists to stop alt-tabbing hammering the endpoint. An auth change
 * or a completed purchase is a real event we caused, and delaying it is exactly
 * the bug this file exists to prevent.
 */
const AUTO_REFETCH_MIN_MS = 30_000;

let lastAuto = 0;
let detach: (() => void) | null = null;

function notifyAll(): void {
    // One listener throwing must never stop the others.
    subscribers.forEach((fn) => {
        try { fn(); } catch { /* ignore */ }
    });
}

function onMaybeVisible(): void {
    if (typeof document === "undefined") return;
    if (document.visibilityState !== "visible") return;
    if (Date.now() - lastAuto < AUTO_REFETCH_MIN_MS) return;
    lastAuto = Date.now();
    notifyAll();
}

/**
 * Attach the shared listeners. Called when the FIRST subscriber registers.
 *
 * 🔑 The auth subscription is the fix. Every other trigger here already existed
 * somewhere; none of them fires for the user who signs in and stays put.
 */
function attach(): void {
    if (typeof window === "undefined") return;

    document.addEventListener("visibilitychange", onMaybeVisible);
    window.addEventListener("focus", onMaybeVisible);

    // Supabase's browser client is imported lazily so this module stays cheap
    // for pages that never sign anyone in.
    let unsubscribeAuth: (() => void) | null = null;
    let cancelled = false;

    void (async () => {
        try {
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            if (!url || !key) return;

            const { createBrowserClient } = await import("@supabase/ssr");
            if (cancelled) return;

            const sb = createBrowserClient(url, key);
            const { data } = sb.auth.onAuthStateChange((event) => {
                // INITIAL_SESSION fires on every mount, including for signed-out
                // visitors, and the consumer has already fetched once by then.
                // The events below are the ones that mean "who you are has
                // changed, so what you're entitled to may have changed too".
                if (
                    event === "SIGNED_IN" ||
                    event === "SIGNED_OUT" ||
                    event === "TOKEN_REFRESHED" ||
                    event === "USER_UPDATED"
                ) {
                    notifyAll();
                }
            });

            if (cancelled) { data.subscription.unsubscribe(); return; }
            unsubscribeAuth = () => data.subscription.unsubscribe();
        } catch {
            // No auth subscription is a degraded state, not a broken one:
            // focus/visibility and manual refresh still work.
        }
    })();

    detach = () => {
        cancelled = true;
        document.removeEventListener("visibilitychange", onMaybeVisible);
        window.removeEventListener("focus", onMaybeVisible);
        try { unsubscribeAuth?.(); } catch { /* already gone */ }
        unsubscribeAuth = null;
    };
}

/**
 * Register a callback to run whenever the licence should be re-read.
 * Returns an unsubscribe function — call it on unmount.
 *
 * 🔑 Listeners are refcounted, so React Strict Mode's double mount/unmount in
 * development does not leave a dangling auth subscription behind.
 */
export function onLicenseRefresh(fn: RefreshFn): () => void {
    const first = subscribers.size === 0;
    subscribers.add(fn);
    if (first) attach();

    return () => {
        subscribers.delete(fn);
        if (subscribers.size === 0) {
            try { detach?.(); } finally { detach = null; }
        }
    };
}

/**
 * Ask every subscriber to re-read the licence, right now, ignoring the throttle.
 *
 * Call this after any action that CHANGES entitlement — a completed checkout, a
 * redeemed key, an org join. The checkout handler calls it so the badge updates
 * without a reload; before that existed, someone who had just paid still saw
 * "Free" and could reasonably conclude the payment had failed and pay again.
 */
export function refreshLicense(): void {
    notifyAll();
}
