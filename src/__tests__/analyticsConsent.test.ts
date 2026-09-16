/**
 * Google Analytics must not fire without consent — and must not exist at all
 * until it is configured.
 *
 * This is the file that keeps a privacy claim true. The privacy policy now says
 * analytics is "switched off until you choose Allow", and the Play Data Safety
 * declaration says the APPS contain no analytics SDK. Both statements are
 * enforceable — an inaccurate Play declaration is a takedown risk, not a
 * paperwork nit — so the behaviour they describe is pinned here rather than
 * left to a future reader's good intentions.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";

// This suite runs in vitest's default "node" environment — there is no jsdom or
// happy-dom in this project and adding one just for this file would grow the
// dependency surface for no other gain. A minimal localStorage + window stub is
// enough, because that is genuinely all the consent module touches.
class MemoryStorage {
    private store = new Map<string, string>();
    getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
    setItem(k: string, v: string) { this.store.set(k, String(v)); }
    removeItem(k: string) { this.store.delete(k); }
    clear() { this.store.clear(); }
}
const storage = new MemoryStorage();
const target = new EventTarget();
vi.stubGlobal("localStorage", storage);
vi.stubGlobal("window", {
    localStorage: storage,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
});

import {
    ANALYTICS_CONSENT_KEY,
    analyticsAllowed,
    gaMeasurementId,
    readAnalyticsConsent,
    setAnalyticsConsent,
    shouldAskForAnalyticsConsent,
} from "@/lib/analytics/consent";

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const GA = strip(read("src/components/analytics/GoogleAnalytics.tsx"));
const BANNER = strip(read("src/components/analytics/AnalyticsConsentBanner.tsx"));
// ⚠️ NOT via strip(). That helper removes /* … */ blocks, and a CSP contains
// `https://*.supabase.co` — the `/*` inside `//*` opens a block comment as far
// as the regex is concerned, so everything to the next `*/` disappears and the
// directive silently reads as truncated. Parse the quoted directive instead.
const CONFIG_RAW = read("next.config.ts");
const cspDirective = (name: string): string => {
    const m = CONFIG_RAW.match(new RegExp(`"${name} ([^"]*)"`));
    return m ? m[1] : "";
};
const LAYOUT = strip(read("src/app/layout.tsx"));
const PRIVACY = read("src/app/privacy/page.tsx");

describe("consent state", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TESTID1234");
    });
    afterEach(() => vi.unstubAllEnvs());

    it("defaults to unset — never to granted", () => {
        expect(readAnalyticsConsent()).toBe("unset");
        expect(analyticsAllowed(readAnalyticsConsent())).toBe(false);
    });

    it("only 'granted' allows analytics", () => {
        expect(analyticsAllowed("granted")).toBe(true);
        expect(analyticsAllowed("denied")).toBe(false);
        expect(analyticsAllowed("unset")).toBe(false);
    });

    it("round-trips a choice and announces it", () => {
        const seen: unknown[] = [];
        window.addEventListener("imotara:analytics-consent", (e) => seen.push((e as CustomEvent).detail));
        setAnalyticsConsent("granted");
        expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe("granted");
        expect(readAnalyticsConsent()).toBe("granted");
        expect(seen).toEqual(["granted"]);
    });

    it("treats a corrupted stored value as 'unset', not as permission", () => {
        localStorage.setItem(ANALYTICS_CONSENT_KEY, "yes-please");
        expect(readAnalyticsConsent()).toBe("unset");
    });

    it("⚠️ a storage read that THROWS denies rather than assumes", () => {
        // Private mode / blocked site data. The failure has to be closed here:
        // an exception must never be read as "they said yes".
        const spy = vi.spyOn(storage, "getItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        expect(readAnalyticsConsent()).toBe("unset");
        expect(analyticsAllowed(readAnalyticsConsent())).toBe(false);
        spy.mockRestore();
    });
});

describe("⚠️ with no measurement id configured, analytics cannot exist", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "");
    });
    afterEach(() => vi.unstubAllEnvs());

    it("reports no id", () => {
        expect(gaMeasurementId()).toBeNull();
    });

    it("never loads, even with consent explicitly granted", () => {
        // The env gate wins over consent. This is what makes the code safe to
        // merge and deploy before any GA property exists.
        expect(analyticsAllowed("granted")).toBe(false);
    });

    it("never shows the banner either", () => {
        expect(shouldAskForAnalyticsConsent("unset")).toBe(false);
    });
});

describe("the banner asks everyone, and only when unanswered", () => {
    beforeEach(() => vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TESTID1234"));
    afterEach(() => vi.unstubAllEnvs());

    it("shows only for an unset choice", () => {
        expect(shouldAskForAnalyticsConsent("unset")).toBe(true);
        expect(shouldAskForAnalyticsConsent("granted")).toBe(false);
        expect(shouldAskForAnalyticsConsent("denied")).toBe(false);
    });

    it("⚠️ does NOT gate on geography", () => {
        // Deliberate: client-side geo is heuristic, and a wrong guess is an
        // unconsented tracker on an EU visitor rather than a lost data point.
        for (const re of [/timeZone/i, /navigator\.language/i, /country/i, /\bEU\b/, /EEA/]) {
            expect(BANNER).not.toMatch(re);
        }
    });

    it("offers a real refusal, not just a dismiss", () => {
        expect(BANNER).toMatch(/choose\("denied"\)/);
        expect(BANNER).toMatch(/choose\("granted"\)/);
    });
});

describe("the tag itself", () => {
    it("renders nothing unless configured AND allowed", () => {
        expect(GA).toMatch(/if \(!measurementId \|\| !analyticsAllowed\(consent\)\) return null;/);
    });

    it("⚠️ runs with advertising features OFF — this is what keeps 'no ad-tech' true", () => {
        expect(GA).toMatch(/ad_storage: 'denied'/);
        expect(GA).toMatch(/ad_user_data: 'denied'/);
        expect(GA).toMatch(/ad_personalization: 'denied'/);
        expect(GA).toMatch(/allow_google_signals: false/);
        expect(GA).toMatch(/allow_ad_personalization_signals: false/);
    });

    it("anonymises IP and drives its own page views", () => {
        expect(GA).toMatch(/anonymize_ip: true/);
        // send_page_view false + a manual event, because GA's SPA detection is
        // unreliable on the App Router — otherwise routes are missed or doubled.
        expect(GA).toMatch(/send_page_view: false/);
        expect(GA).toMatch(/gtag\("event", "page_view"/);
    });

    it("reacts to a consent change without a reload", () => {
        expect(GA).toMatch(/addEventListener\(ANALYTICS_CONSENT_EVENT, handler\)/);
        expect(GA).toMatch(/removeEventListener\(ANALYTICS_CONSENT_EVENT, handler\)/);
    });
});

describe("🔴 the CSP must actually allow it, or it fails silently", () => {
    it("script-src permits the gtag loader", () => {
        expect(cspDirective("script-src")).toContain("https://www.googletagmanager.com");
    });

    it("connect-src permits the measurement endpoints", () => {
        const connect = cspDirective("connect-src");
        expect(connect).toContain("https://www.google-analytics.com");
        expect(connect).toContain("https://*.analytics.google.com");
        // and the directive we actually parsed is the real one, not a fragment
        expect(connect).toContain("https://*.supabase.co");
    });

    it("⚠️ does NOT open the CSP to advertising hosts", () => {
        const all = cspDirective("script-src") + " " + cspDirective("connect-src");
        for (const host of ["doubleclick.net", "googleadservices", "googlesyndication"]) {
            expect(all).not.toContain(host);
        }
    });
});

describe("it is wired into the site", () => {
    it("both components are mounted in the root layout", () => {
        expect(LAYOUT).toMatch(/<AnalyticsConsentBanner \/>/);
        expect(LAYOUT).toMatch(/<GoogleAnalytics \/>/);
    });

    it("🔴 the privacy policy discloses it, and still says the APPS have no SDK", () => {
        // The disclosure must never lag the tag. The mobile claim matters
        // separately: Play Data Safety declares no analytics SDK in the app.
        expect(PRIVACY).toMatch(/Google Analytics/);
        expect(PRIVACY).toMatch(/switched off until you choose/i);
        expect(PRIVACY).toMatch(/mobile apps contain no analytics SDK/i);
    });
});
