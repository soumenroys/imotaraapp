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

/**
 * ⚠️ Comment-stripped view. Several assertions below look for phrases that ALSO
 * appear in the source's own explanatory comments — `prompt: "select_account"`
 * most of all. Matching against raw SRC made that guard pass even with the
 * option deleted from the code: it was matching the prose explaining why the
 * option matters. Caught by mutation testing on 2026-10-01.
 */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("🔴 the header offers Sign in when signed out", () => {
    it("renders both a Sign in and a Sign out control", () => {
        // Labels are ternaries now ("Signing in…" while the OAuth redirect is
        // in flight), so match the strings rather than the JSX shape.
        expect(SRC).toMatch(/"Sign in"/);
        expect(SRC).toMatch(/>\s*Sign out\s*</);
    });

    it("🔴 the auth slot is a ternary, not a signed-in-only guard", () => {
        // The bug was `mounted && user && (...)` — no else branch, so the slot
        // vanished entirely for signed-out visitors.
        expect(SRC).toMatch(/mounted && \(user \?/);
        expect(SRC).not.toMatch(/\{mounted && user && \(\s*<button/);
    });

    it("🔴 Sign in uses Google OAuth — NOT the /login org form", () => {
        /**
         * 🔴 SHIPPED BUG, 2026-10-01. The header first linked to
         * `/login?redirect=…`. That page is the ORGANISATION email+password
         * form — its own heading reads "For organisation accounts set up by an
         * Imotara admin". An ordinary user clicking Sign in in the header was
         * shown a login they could not use, while the identical-looking button
         * in Settings signed them in fine.
         *
         * The header must do what the Settings capsule's primary button does.
         */
        expect(CODE).toMatch(/signInWithOAuth/);
        expect(CODE).toMatch(/provider: "google"/);
        expect(CODE).not.toMatch(/href=\{`\/login\?redirect=/);
    });

    it("🔴 forces Google's account chooser", () => {
        // Without prompt:"select_account" Google silently reuses whichever
        // account is already active in the browser, signing someone into a
        // different Imotara account with no visible choice. Already fixed once
        // in settings/page.tsx — do not let the header reintroduce it.
        expect(CODE).toMatch(/prompt: "select_account"/);
    });

    it("🔑 Sign in returns you to the page you were on", () => {
        expect(CODE).toMatch(/\/auth\/callback\?redirectTo=\$\{encodeURIComponent\(target\)\}/);
        expect(CODE).toMatch(/pathname \?\? "\/chat"/);
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
        // Tapping must close the drawer, or it stays open over the page while
        // the OAuth redirect happens underneath it.
        expect(drawer).toMatch(/setMobileOpen\(false\)/);
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
        // The store starts empty. Rendering before `loading` clears would flash
        // "Free" at a Plus subscriber — precisely what cost 2026-09-30.
        // Hidden-then-correct is fine; wrong-then-corrected is not.
        expect(CODE).toMatch(/mounted && !license\.loading &&/);
    });

    it("🔑 shows in BOTH states — signed in and signed out", () => {
        // Was signed-in-only. Reported twice as "the licence type is not
        // showing", both times while signed out: a control that silently
        // vanishes reads as broken even when it is behaving. "Free" is accurate
        // for an anonymous visitor — the 20/day quota applies to them too.
        expect(CODE).not.toMatch(/mounted && user && !license\.loading/);
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


});
