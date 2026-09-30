/**
 * The header's auth slot must never be empty.
 *
 * 🔴 WHY. The slot immediately right of the conflict capsule rendered ONLY when
 * signed in — `{mounted && user && (<button>Sign out</button>)}`. A signed-out
 * visitor therefore had no way into the app from the header at all; the only
 * sign-in control was a capsule buried inside Settings. Reported 2026-10-01.
 *
 * ⚠️ BOTH states must stay behind `mounted`. `user` is resolved client-side from
 * the Supabase session, so rendering either label during SSR guesses wrong half
 * the time and hydrates into a flicker — briefly offering "Sign in" to someone
 * who is already signed in, which is exactly the kind of thing that makes people
 * think they have been signed out.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(
    path.join(__dirname, "..", "components", "SiteHeader.tsx"),
    "utf8",
);

describe("🔴 the header offers Sign in when signed out", () => {
    it("renders both a Sign in and a Sign out control", () => {
        expect(SRC).toMatch(/>\s*Sign in\s*</);
        expect(SRC).toMatch(/>\s*Sign out\s*</);
    });

    it("🔴 the auth slot is a ternary, not a signed-in-only guard", () => {
        // The bug was `mounted && user && (...)` — no else branch, so the slot
        // vanished entirely for signed-out visitors.
        expect(SRC).toMatch(/mounted && \(user \?/);
        expect(SRC).not.toMatch(/\{mounted && user && \(\s*<button/);
    });

    it("🔑 Sign in preserves where the user was", () => {
        // Sending everyone to /chat regardless would lose the page they were on.
        // /login already guards this param against open redirects.
        expect(SRC).toMatch(/\/login\?redirect=\$\{encodeURIComponent\(pathname \?\? "\/chat"\)\}/);
    });

    it("⚠️ both states stay behind `mounted` — no SSR flicker", () => {
        const slot = SRC.slice(SRC.indexOf("{mounted && (user ?"));
        expect(slot.slice(0, 900)).toContain("Sign out");
        expect(slot.slice(0, 900)).toContain("Sign in");
    });

    it("the mobile drawer mirrors it", () => {
        const drawer = SRC.slice(SRC.indexOf("Sign in / Sign out — mobile drawer"));
        expect(drawer).toMatch(/mounted && \(/);
        expect(drawer).toMatch(/Sign out/);
        expect(drawer).toMatch(/Sign in/);
        // Tapping a link must close the drawer, or it stays open over the page.
        expect(drawer).toMatch(/onClick=\{\(\) => setMobileOpen\(false\)\}/);
    });
});

describe("🔑 the header shows the current plan, left of the search box", () => {
    /**
     * Requested 2026-10-01, right after the "always Free" bug was fixed — so the
     * one thing this must never do is show the WRONG plan, even for a moment.
     */
    it("renders the plan capsule BEFORE the search button", () => {
        const plan = SRC.indexOf("aria-label={`Your plan:");
        const search = SRC.indexOf('aria-label="Search"');
        expect(plan).toBeGreaterThan(-1);
        expect(search).toBeGreaterThan(-1);
        expect(plan).toBeLessThan(search);
    });

    it("🔴 is hidden while the licence is still loading", () => {
        // useLicense starts from the env snapshot, which is `free`. Rendering
        // before `loading` clears would flash "Free" at a Plus subscriber —
        // precisely the thing that cost 2026-09-30.
        expect(SRC).toMatch(/mounted && user && !license\.loading &&/);
    });

    it("🔑 reuses prettyTier — no second tier→label mapping in the header", () => {
        // `edu` once rendered as two different words in two places because the
        // map was duplicated. One mapping, one source of truth.
        expect(SRC).toMatch(/prettyTier\(license\.tier\)/);
        expect(SRC).toMatch(/import \{ prettyTier \} from "@\/types\/license"/);
        expect(SRC).not.toMatch(/"Imotara Plus"|case "plus":/);
    });

    it("uses the same useLicense hook as the rest of the app", () => {
        // So the header can never disagree with the Settings plan card.
        expect(SRC).toMatch(/import useLicense from "@\/hooks\/useLicense"/);
        expect(SRC).toMatch(/const license = useLicense\(\)/);
    });

    it("only shows when signed in", () => {
        // "Free" next to a "Sign in" button would be noise — a signed-out
        // visitor has no plan, they have no account.
        const slot = SRC.slice(SRC.indexOf("Current plan — desktop"));
        expect(slot.slice(0, 900)).toMatch(/mounted && user &&/);
    });
});
