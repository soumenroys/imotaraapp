/**
 * A paid plan must appear without the user reloading the page.
 *
 * 🔴 WHY THIS EXISTS — observed live, not theorised. On 2026-09-26 the first
 * real Razorpay payment on the firm account succeeded: ₹149 captured,
 * `payment_licenses` written, `licenses.tier = plus`. And `/upgrade` still read
 * **"Current plan: Free"** until the page was manually reloaded.
 *
 * `useLicense` fetched `/api/license/status` once with `useEffect(..., [])` and
 * never again, so nothing ever asked the server a second time.
 *
 * 🔑 This is worse than cosmetic. Someone who has just paid and still sees
 * "Free" reasonably concludes it failed — and may pay again. On a payments
 * surface, a stale badge is a refund request.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const strip = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("the hook can be told to re-fetch", () => {
    const hook = strip(read("src/hooks/useLicense.ts"));

    it("🔴 exports refreshLicense", () => {
        expect(hook).toMatch(/export function refreshLicense/);
    });

    it("🔴 a mounted hook subscribes, and unsubscribes on unmount", () => {
        // Subscribing without removing leaks a closure per mount and keeps
        // re-fetching for components that no longer exist.
        expect(hook).toMatch(/licenseSubscribers\.add\(fetchLicense\)/);
        expect(hook).toMatch(/licenseSubscribers\.delete\(fetchLicense\)/);
    });

    it("one broken listener cannot break the others", () => {
        expect(hook).toMatch(/try \{ fn\(\); \} catch/);
    });
});

describe("cross-device: returning to the tab re-checks", () => {
    const hook = strip(read("src/hooks/useLicense.ts"));

    it("re-fetches when the tab becomes visible or regains focus", () => {
        // This is what surfaces a purchase made on ANOTHER device.
        expect(hook).toMatch(/visibilitychange/);
        expect(hook).toMatch(/addEventListener\("focus"/);
    });

    it("🔑 both listeners are removed on unmount", () => {
        expect(hook).toMatch(/removeEventListener\("visibilitychange"/);
        expect(hook).toMatch(/removeEventListener\("focus"/);
    });

    it("🔴 automatic re-fetches are throttled", () => {
        // Without a floor, every alt-tab hits /api/license/status.
        expect(hook).toMatch(/AUTO_REFETCH_MIN_MS/);
        expect(hook).toMatch(/Date\.now\(\) - lastAuto < AUTO_REFETCH_MIN_MS/);
    });

    it("the throttle does NOT apply to a manual refresh", () => {
        // A confirmed payment is an event we caused — it must not be swallowed
        // because the user happened to alt-tab moments earlier.
        const manual = hook.slice(hook.indexOf("export function refreshLicense"),
                                  hook.indexOf("const AUTO_REFETCH_MIN_MS"));
        expect(manual).not.toMatch(/AUTO_REFETCH_MIN_MS|lastAuto/);
    });
});

describe("the checkout handler uses it", () => {
    const page = strip(read("src/app/upgrade/page.tsx"));

    it("🔴 refreshes the licence as soon as the server confirms the grant", () => {
        expect(page).toMatch(/import useLicense, \{ refreshLicense \}/);
        // Must fire on the CONFIRMED branch, before the success message.
        const i = page.indexOf("confirm?.ok");
        const j = page.indexOf("Plan activated!");
        const k = page.indexOf("refreshLicense()");
        expect(i).toBeGreaterThan(-1);
        expect(k).toBeGreaterThan(i);
        expect(k).toBeLessThan(j);
    });
});
