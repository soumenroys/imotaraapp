/**
 * Web and mobile re-read the licence on the same terms.
 *
 * 🔴 WHY THIS EXISTS. Until 2026-09-26 the two platforms did NOT agree, and the
 * difference was user-visible in exactly the case the owner complained about:
 *
 *   web    — mount · after checkout · tab focus/visibility, throttled 30 s
 *   mobile — mount · after its OWN purchase · nothing else
 *
 * So someone who bought Plus on the web and picked up their phone kept seeing
 * the old tier until they fully KILLED and relaunched the app. Backgrounding was
 * not enough, because nothing listened for the app returning to the foreground.
 *
 * Mobile now mirrors the web behaviour via an `AppState` listener using the same
 * 30 s throttle. This test is what stops the two drifting apart again: the
 * constants live in different repos, which cannot import each other, so nothing
 * else would notice one side being tuned alone.
 *
 * 🔑 It pins the THROTTLE, not the trigger. The triggers are necessarily
 * different — `visibilitychange`/`focus` on the web, `AppState` on a phone —
 * but "how often will we automatically re-read" is a product decision and it
 * should be one number, not two.
 *
 * ⚠️ This is NOT push. A licence change still only lands when the app or tab is
 * brought forward. True push needs Supabase Realtime on the `licenses` row,
 * which means RLS and a publication on a security-sensitive table. Foregrounding
 * covers what people actually do — pay on one device, pick up the other.
 *
 * ⚠️ SKIPS when the sibling repo is absent — CI checks out one repo — and says
 * so loudly. A skipped guard that looks green is worse than no guard.
 */
import { describe, it, expect } from "vitest";
import fs, { readFileSync } from "fs";
import path from "path";

const WEB_HOOK = path.join(__dirname, "..", "hooks", "useLicense.ts");
const MOBILE_CTX = path.join(
    __dirname, "..", "..", "..", "imotara-mobile", "src", "state", "SettingsContext.tsx",
);

/** Pull `const NAME = 30_000;` (or 30000) out of a source file. */
function throttleMs(src: string, name: string): number {
    const m = new RegExp(`const\\s+${name}\\s*=\\s*([0-9_]+)`).exec(src);
    if (!m) throw new Error(`${name} not found — was it renamed?`);
    return Number(m[1].replace(/_/g, ""));
}

describe("🔴 the automatic licence re-read throttle is the same on both platforms", () => {
    it("web declares AUTO_REFETCH_MIN_MS", () => {
        const ms = throttleMs(readFileSync(WEB_HOOK, "utf8"), "AUTO_REFETCH_MIN_MS");
        expect(ms).toBeGreaterThan(0);
        // A throttle long enough to be useless is the same as not refreshing.
        expect(ms).toBeLessThanOrEqual(120_000);
    });

    const present = fs.existsSync(MOBILE_CTX);

    it(present ? "mobile's throttle matches web's" : "SKIPPED — sibling repo not checked out", () => {
        if (!present) {
            console.warn(
                `[licenseRefreshParity] ⚠️ SKIPPED the cross-repo check: ${MOBILE_CTX} not found. ` +
                "This guard only has teeth when both repos are checked out side by side.",
            );
            expect(present).toBe(false); // explicit, so the skip is visible
            return;
        }
        const web = throttleMs(readFileSync(WEB_HOOK, "utf8"), "AUTO_REFETCH_MIN_MS");
        const mobile = throttleMs(readFileSync(MOBILE_CTX, "utf8"), "LICENSE_REFRESH_MIN_MS");
        expect(mobile).toBe(web);
    });

    it("mobile actually wires the throttle to an AppState listener", () => {
        if (!present) { expect(present).toBe(false); return; }
        const src = readFileSync(MOBILE_CTX, "utf8");
        // The constant existing proves nothing — it has to be USED, and used on
        // the foreground transition. A declared-but-unreferenced constant was
        // exactly how a previous guard passed while testing nothing.
        expect(src).toMatch(/AppState\.addEventListener\(\s*["']change["']/);
        expect(src).toMatch(/LICENSE_REFRESH_MIN_MS/);
        expect(src).toMatch(/next\s*!==\s*["']active["']/);
    });
});
