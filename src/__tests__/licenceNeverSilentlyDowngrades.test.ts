/**
 * A paying subscriber must never be shown "Free" because we failed to find out.
 *
 * 🔴 WHY THIS EXISTS. On 2026-09-30 `LICENSE_MODE` was flipped to `enforce` and
 * the owner — an account with three paid ₹149 invoices — was shown **FREE, 20
 * replies/day, 7-day history**. It was rolled back within minutes.
 *
 * The data was never wrong. `/api/license/status` returned, for that exact
 * account: `tier: "plus", source: "personal", expiresAt: null`. `/api/invoice`
 * returned all three invoices. Two separate defects conspired:
 *
 *   1. `settings/page.tsx` fetched the licence ONCE on mount and had no
 *      auth-change trigger. On a slow OAuth round-trip `auth/callback` gives up
 *      after 10s and navigates anyway with `?auth_error=timeout`, so the page
 *      mounted before the session cookie existed, correctly got "anonymous ⇒
 *      free", and never asked again.
 *   2. `/api/license/status` returned `free` with `ok: true` whenever
 *      `resolveUserTier()` threw — making a transient database failure
 *      indistinguishable from a genuine free-tier user.
 *
 * Neither is visible while enforcement is off. Both are expensive the moment it
 * is on, which is exactly when nobody is looking for them.
 *
 * ⚠️ Deliberately SOURCE tests. What must hold is a property of the code —
 * "these triggers are wired", "this branch cannot report free" — and asserting
 * it on the source states it without a Supabase/Next request harness that would
 * itself need mocking into the very shapes under test.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (...p: string[]) =>
    fs.readFileSync(path.join(__dirname, "..", ...p), "utf8");

const REFRESH  = read("lib", "imotara", "licenseRefresh.ts");
const HOOK     = read("hooks", "useLicense.ts");
const SETTINGS = read("app", "settings", "page.tsx");
const ROUTE    = read("app", "api", "license", "status", "route.ts");

describe("🔴 the server must not report `free` when it simply could not resolve", () => {
    it("returns a NON-OK response when tier resolution fails for an identified user", () => {
        // The bug: `if (tierResult.ok) { ...real tier... }` with effectiveTier
        // left at the free fallback, returned 200/ok:true. Silent downgrade.
        expect(ROUTE).toMatch(/if\s*\(\s*!tierResult\.ok\s*\)/);
        expect(ROUTE).toMatch(/status:\s*503/);
        expect(ROUTE).toMatch(/tier_unresolved/);
    });

    it("the failure branch returns BEFORE any tier is computed", () => {
        // If the early return were moved below the assignment, the endpoint
        // could still leak a `free` tier alongside the error.
        const guard = ROUTE.indexOf("if (!tierResult.ok)");
        const assign = ROUTE.indexOf("let effectiveTier");
        expect(guard).toBeGreaterThan(-1);
        expect(assign).toBeGreaterThan(guard);
    });

    it("🔑 an ANONYMOUS caller still gets the free fallback, not a 503", () => {
        // Signed-out visitors are a normal case, not an error. Breaking this
        // would 503 the marketing pages for everyone who is not signed in.
        expect(ROUTE).toMatch(/if\s*\(\s*!userId\s*\)/);
        const anon = ROUTE.indexOf("if (!userId)");
        const unresolved = ROUTE.indexOf("if (!tierResult.ok)");
        expect(anon).toBeGreaterThan(-1);
        expect(anon).toBeLessThan(unresolved);
    });
});

describe("🔴 licence state must be reactive to AUTH, not fetched once", () => {
    it("the shared module subscribes to auth state changes", () => {
        // This is THE fix. Focus/visibility already existed and never fires for
        // a user who signs in and stays on the page.
        expect(REFRESH).toContain("onAuthStateChange");
    });

    it("🔴 INITIAL_SESSION WITH a session must trigger a re-fetch", () => {
        /**
         * 🔴 SHIPPED BUG, caught in production 2026-09-30. The first version of
         * this fix listed the events it cared about and deliberately EXCLUDED
         * INITIAL_SESSION, reasoning that "the consumer has already fetched by
         * then". That is precisely wrong for the case that matters.
         *
         * Signing in ends with auth/callback doing a FULL PAGE LOAD into the
         * destination. On a fresh load Supabase fires INITIAL_SESSION, not
         * SIGNED_IN — the sign-in happened on the previous page. The plan card
         * fetched on mount, raced the cookie read, got "free", and nothing ever
         * asked again. Only the manual Refresh link could fix it.
         *
         * 🔑 The discriminator must be the SESSION, not the event name. Skip
         * ONLY INITIAL_SESSION with no session. A filter that names events
         * reintroduces the bug the moment Supabase adds or renames one.
         */
        expect(REFRESH).toMatch(
            /if\s*\(\s*event === "INITIAL_SESSION"\s*&&\s*!session\s*\)\s*return;/,
        );
        // The callback must receive the session to discriminate on it at all.
        expect(REFRESH).toMatch(/onAuthStateChange\(\(event, session\)/);
    });

    it("🔑 SIGNED_OUT still notifies even though it carries no session", () => {
        // The skip is scoped to INITIAL_SESSION on purpose. Broadening it to
        // "any event without a session" would stop sign-out clearing the tier,
        // leaving a signed-out browser showing the previous user's plan.
        const guard = REFRESH.slice(REFRESH.indexOf('if (event === "INITIAL_SESSION"'));
        expect(guard.slice(0, 120)).not.toMatch(/SIGNED_OUT/);
        expect(guard.slice(0, 200)).toContain("notifyAll()");
    });

    it("auth events are NOT throttled", () => {
        // The 30s floor exists to stop alt-tabbing hammering the endpoint.
        // Applying it to auth would reintroduce the very delay being fixed, so
        // the throttle must live in the visibility handler only.
        const visibility = REFRESH.slice(REFRESH.indexOf("function onMaybeVisible"));
        expect(visibility.slice(0, 400)).toContain("AUTO_REFETCH_MIN_MS");

        const authBlock = REFRESH.slice(REFRESH.indexOf("onAuthStateChange"));
        expect(authBlock.slice(0, 600)).not.toContain("AUTO_REFETCH_MIN_MS");
    });

    it("listeners are refcounted so Strict Mode cannot leak a subscription", () => {
        expect(REFRESH).toMatch(/subscribers\.size === 0/);
    });

    it("both consumers subscribe — this is what stopped them drifting", () => {
        // They had two independent implementations; the hook had three triggers
        // and Settings had none. One owner of WHEN, many owners of WHAT.
        expect(HOOK).toContain("onLicenseRefresh");
        expect(SETTINGS).toContain("onLicenseRefresh");
    });

    it("Settings unsubscribes on unmount", () => {
        expect(SETTINGS).toMatch(/unsubscribeLicense\(\)/);
    });

    it("🔴 Settings does NOT rely on its single mount fetch alone", () => {
        // The regression this whole file exists for. If someone removes the
        // subscription and leaves only the mount call, this fails.
        const idx = SETTINGS.indexOf("refreshLicenseStatus();");
        expect(idx).toBeGreaterThan(-1);
        expect(SETTINGS.slice(idx, idx + 1200)).toContain("onLicenseRefresh");
    });
});

describe("🔴 Settings must react to SIGN-OUT too, not just sign-in", () => {
    /**
     * 🔴 WHY. After the httpOnly fix made signing in work again (2026-09-30),
     * the next symptom appeared immediately: signing OUT left the page still
     * showing "Signed in as …" and no sign-in capsule, until a manual reload.
     *
     * Same root cause one layer up — `getSession()` answers "who is signed in
     * right now" ONCE, on mount, and nothing asks again.
     *
     * 🔑 Settings was the ONLY surface in the app without a subscription.
     * /connect, SiteHeader, /upgrade, /auth/accept and /connect/register all
     * already had one. This pins Settings to the same contract.
     */
    it("both session reads are paired with an auth subscription", () => {
        // 3 getSession() calls: two on mount (must subscribe) and one inside
        // the delete-account handler, which is a correct one-shot read at the
        // moment of action.
        const subs = (SETTINGS.match(/onAuthStateChange/g) ?? []).length;
        expect(subs).toBeGreaterThanOrEqual(2);
    });

    it("the subscriptions are released on unmount", () => {
        // Leaking one keeps setState firing into a dead component on every
        // future auth event, for the life of the tab.
        const releases = (SETTINGS.match(/sub\?\.unsubscribe\(\)/g) ?? []).length;
        expect(releases).toBeGreaterThanOrEqual(2);
    });

    it("🔑 a SIGNED_OUT event must be able to CLEAR the email, not only set it", () => {
        // `setSbEmail(s?.user?.email ?? null)` — the `?? null` is what clears
        // it. Writing `if (s) setSbEmail(...)` would fix sign-in and leave
        // sign-out exactly as broken as it was.
        expect(SETTINGS).toMatch(/setSbEmail\(s\?\.user\?\.email \?\? null\)/);
    });
});
