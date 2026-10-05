/**
 * Pricing claims must stay true now that licensing is enforced.
 *
 * 🔴 FOUND LIVE IN PRODUCTION, 2026-10-05. www.imotara.com was serving this to
 * Google as FAQ structured data — eligible for rich results — while paid gates
 * were enforced and Imotara Plus sold at ₹149/month:
 *
 *   "Yes. Imotara is completely free. There are no paywalls, no required
 *    subscriptions, and no hidden costs."
 *
 * The launch-offer BANNER had correctly disappeared when the offer expired
 * (NEXT_PUBLIC_IMOTARA_LAUNCH_DATE + FREE_DAYS), but the FAQ copy, two landing
 * pages and two help articles were never updated when LICENSE_MODE went to
 * `enforce` on 2026-10-01. Nothing failed, because nothing was watching.
 *
 * ✅ What remains TRUE and may still be said: Imotara is free to use, no
 * subscription is required, there are no ads and no data selling. A free
 * account really does get 20 cloud replies a day, unlimited on-device replies,
 * 7 days of history and cloud sync.
 * ⛔ What is FALSE: that ALL features are free, or that there are no paywalls.
 * Trends insights, unlimited history, export, advanced TTS, search mode, reply
 * cadence, Companion Letters and Growth Arc are Plus-only.
 */
import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

const ROOT = path.join(__dirname, "..");
const FILES = [
    "app/layout.tsx",
    "app/page.tsx",
    "app/ai-emotional-support/page.tsx",
    "app/ai-mental-wellness/page.tsx",
    "content/help/plans-and-payments.md",
    "content/help/mood-history-insights.md",
    "content/help/helpKb.json",
];

// Claims that are false while licensing is enforced.
const FALSE_CLAIMS: [string, RegExp][] = [
    ["Imotara is completely free", /Imotara is completely free/i],
    ["completely free to use", /completely free to use/i],
    ["no paywalls", /no paywalls/i],
    ["all features are free", /all features (are|remain) (completely )?free/i],
    ["everything is unlocked for everyone", /everything is unlocked for everyone/i],
];

describe("no false 'everything is free' claims", () => {
    for (const rel of FILES) {
        const full = path.join(ROOT, rel);
        it(`${rel} makes no false pricing claim`, () => {
            const src = fs.readFileSync(full, "utf8");
            for (const [label, re] of FALSE_CLAIMS) {
                expect(src, `${rel} still claims "${label}"`).not.toMatch(re);
            }
        });
    }

    it("⛔ the JSON-LD FAQ in layout.tsx is the one Google reads — keep it honest", () => {
        const src = fs.readFileSync(path.join(ROOT, "app/layout.tsx"), "utf8");
        // It may say free to use / no subscription required. It may not say the
        // product is free of paywalls.
        expect(src).toMatch(/free to use/i);
        expect(src).not.toMatch(/no paywalls|completely free/i);
    });
});
