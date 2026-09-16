/**
 * Google Analytics on the website.
 *
 * ⚠️ There is deliberately NO consent gate — owner decision 2026-09-16, taken
 * with the GDPR/ePrivacy trade-off stated explicitly. What this file protects is
 * everything that decision did NOT cover, and that would quietly turn a
 * measurement tool into a profiling one, or turn a true privacy claim false:
 *
 *   - advertising features stay off  → keeps "No ad-tech" true in the policy
 *   - the mobile apps stay SDK-free  → keeps the Play Data Safety declaration
 *     true, which is enforceable (takedown risk, not a paperwork nit)
 *   - the CSP keeps allowing the tag → otherwise GA fails SILENTLY
 *   - the privacy policy keeps describing reality, with no opt-in claim it
 *     cannot back up
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";

import { analyticsEnabled, gaMeasurementId } from "@/lib/analytics/ga";

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const GA = strip(read("src/components/analytics/GoogleAnalytics.tsx"));
const LAYOUT = strip(read("src/app/layout.tsx"));
// Whitespace-normalised: this is JSX, so sentences wrap across lines with
// indentation in between, and a naive regex misses phrases that are plainly
// there on the rendered page.
const PRIVACY = read("src/app/privacy/page.tsx").replace(/\s+/g, " ");
/** Just the analytics bullet — "opt-in" appears elsewhere on the page about
 *  other things, and a page-wide negative match would fail on that. */
const PRIVACY_ANALYTICS = (() => {
    const i = PRIVACY.indexOf("Website analytics");
    expect(i).toBeGreaterThan(-1);
    return PRIVACY.slice(i, PRIVACY.indexOf("</li>", i));
})();
// ⚠️ NOT via strip(). That helper removes /* … */ blocks, and a CSP contains
// `https://*.supabase.co` — the `/*` inside `//*` opens a block comment as far
// as the regex is concerned, so everything to the next `*/` disappears and the
// directive silently reads as truncated. Parse the quoted directive instead.
const CONFIG_RAW = read("next.config.ts");
const cspDirective = (name: string): string => {
    const m = CONFIG_RAW.match(new RegExp(`"${name} ([^"]*)"`));
    return m ? m[1] : "";
};

describe("the env gate", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("is enabled when a measurement id is configured", () => {
        vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TESTID1234");
        expect(gaMeasurementId()).toBe("G-TESTID1234");
        expect(analyticsEnabled()).toBe(true);
    });

    it("⚠️ with no id, analytics cannot exist at all", () => {
        // This is what made the code safe to merge before any GA property
        // existed, and what makes switching it off a one-variable operation.
        vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "");
        expect(gaMeasurementId()).toBeNull();
        expect(analyticsEnabled()).toBe(false);
    });

    it("treats a whitespace-only id as unset", () => {
        vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "   ");
        expect(gaMeasurementId()).toBeNull();
    });
});

describe("the tag", () => {
    it("renders nothing without a measurement id", () => {
        expect(GA).toMatch(/if \(!measurementId\) return null;/);
    });

    it("🔴 advertising features are OFF — this is what keeps 'No ad-tech' true", () => {
        // The owner opted out of a consent banner, NOT into ad profiling.
        // Turning any of these on makes the privacy policy false.
        expect(GA).toMatch(/ad_storage: 'denied'/);
        expect(GA).toMatch(/ad_user_data: 'denied'/);
        expect(GA).toMatch(/ad_personalization: 'denied'/);
        expect(GA).toMatch(/allow_google_signals: false/);
        expect(GA).toMatch(/allow_ad_personalization_signals: false/);
    });

    it("anonymises IP", () => {
        expect(GA).toMatch(/anonymize_ip: true/);
    });

    it("🔴 queues page_view into dataLayer instead of bailing when gtag is absent", () => {
        // THE BUG THIS EXISTS FOR (2026-09-16): the first version did
        //     if (typeof window.gtag !== "function") return;
        // The effect runs after hydration, ga-init is `afterInteractive`, so
        // gtag was usually undefined on first mount — it returned early and
        // NEVER ran again, because no dependency changes when gtag loads.
        // With send_page_view:false, that meant ZERO page views were ever sent
        // and GA reported "Data collection isn't active".
        expect(GA).not.toMatch(/if \(typeof window\.gtag !== "function"\) return;/);
        expect(GA).toMatch(/w\.dataLayer = w\.dataLayer \|\| \[\];/);
        expect(GA).toMatch(/w\.dataLayer!\.push\(arguments\)/);
    });

    it("⚠️ drives its own page views, exactly once", () => {
        // send_page_view false + a manual event, because GA's SPA detection is
        // unreliable on the App Router. The web stream also has Enhanced
        // Measurement disabled — re-enabling it in the GA console would
        // double-count every navigation against this.
        expect(GA).toMatch(/send_page_view: false/);
        expect(GA).toMatch(/gtag\("event", "page_view"/);
    });

    it("is mounted in the root layout", () => {
        expect(LAYOUT).toMatch(/<GoogleAnalytics \/>/);
    });
});

describe("🔴 the CSP must allow it, or it fails silently", () => {
    it("script-src permits the gtag loader", () => {
        expect(cspDirective("script-src")).toContain("https://www.googletagmanager.com");
    });

    it("connect-src permits the measurement endpoints", () => {
        const connect = cspDirective("connect-src");
        expect(connect).toContain("https://www.google-analytics.com");
        expect(connect).toContain("https://*.analytics.google.com");
        // proves we parsed the real directive rather than a truncated fragment
        expect(connect).toContain("https://*.supabase.co");
    });

    it("⚠️ does NOT open the CSP to advertising hosts", () => {
        const all = cspDirective("script-src") + " " + cspDirective("connect-src");
        for (const host of ["doubleclick.net", "googleadservices", "googlesyndication"]) {
            expect(all).not.toContain(host);
        }
    });
});

describe("🔴 the privacy policy describes what actually happens", () => {
    it("discloses that the website uses GA", () => {
        expect(PRIVACY).toMatch(/Google Analytics/);
    });

    it("⚠️ makes NO opt-in claim it cannot back up", () => {
        // There is no banner. A policy promising one would be worse than no
        // policy line at all — a written, dated false statement.
        for (const re of [/switched off until/i, /choose .?Allow/i, /only if you say yes/i, /opt[- ]in/i]) {
            expect(PRIVACY_ANALYTICS).not.toMatch(re);
        }
    });

    it("still states the MOBILE APPS have no analytics SDK", () => {
        // Separate claim, separate enforcement: this is the Play Data Safety
        // declaration. Web GA does not touch it; a mobile SDK would.
        expect(PRIVACY).toMatch(/mobile apps contain no analytics SDK/i);
    });

    it("keeps the 'No ad-tech' commitment on the page", () => {
        expect(PRIVACY).toMatch(/No ad-tech/);
    });
});

describe("the consent banner is gone, not merely hidden", () => {
    it("no banner component remains in the tree", () => {
        expect(fs.existsSync(path.join(ROOT, "src/components/analytics/AnalyticsConsentBanner.tsx"))).toBe(false);
        expect(LAYOUT).not.toMatch(/AnalyticsConsentBanner/);
    });
});
