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

/**
 * The help KB must not understate what can actually be bought.
 *
 * Found 2026-10-05: /api/payments/razorpay/corporate has had self-serve org
 * checkout all along — ₹1,999/seat/yr commercial & govt, ₹999 EDU, ₹799 NGO —
 * and the tutorial quoted exactly those numbers. The help centre still said
 * "Contact us" and "Per-seat, for institutions" with no prices, sending org
 * buyers to email for something they could have paid for in the product.
 *
 * ⚠️ These assertions are tied to PER_SEAT_PAISE in that route. If the prices
 * change there, they must change here and in the KB — that is the point.
 */
describe("the help KB matches what org buyers can actually do", () => {
    const KB = fs.readFileSync(
        path.join(ROOT, "content/help/plans-and-payments.md"),
        "utf8",
    );
    const ROUTE = fs.readFileSync(
        path.join(ROOT, "app/api/payments/razorpay/corporate/route.ts"),
        "utf8",
    );

    it("quotes the same per-seat prices the checkout actually charges", () => {
        expect(ROUTE).toMatch(/commercial:\s*199_900/);
        expect(ROUTE).toMatch(/edu:\s*99_900/);
        expect(ROUTE).toMatch(/ngo:\s*79_900/);
        expect(KB).toMatch(/₹1,999\/seat\/year/);
        expect(KB).toMatch(/₹999\/seat\/year/);
        expect(KB).toMatch(/₹799\/seat\/year/);
    });

    it("⛔ no longer sends org buyers to email for a self-serve purchase", () => {
        expect(KB).not.toMatch(/rather than self-serve subscriptions/i);
        expect(KB).toMatch(/self-serve/i);
    });
});
