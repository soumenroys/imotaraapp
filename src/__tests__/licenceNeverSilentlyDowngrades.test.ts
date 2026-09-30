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
        for (const ev of ["SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED"]) {
            expect(REFRESH).toContain(ev);
        }
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
