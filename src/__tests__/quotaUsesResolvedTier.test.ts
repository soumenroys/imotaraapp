/**
 * The free 20-replies/day cap must read the RESOLVED tier, never the raw column.
 *
 * 🔴 WHY THIS EXISTS. `chat-reply` decided `isFree` from `licenses.tier` read
 * straight out of the table. Expiry is COMPUTED by `resolve_user_tier`, never
 * written back — so the column still says `plus` (or `edu`, `family`) long after
 * a licence lapses. `isFree` stayed false and the lapsed subscriber **bypassed
 * the cap forever**. Someone who stopped paying kept unlimited replies.
 *
 * It mattered more than the other licensing gaps because the quota is the ONLY
 * enforcement actually live: `LICENSE_MODE` is "off" and mobile bypasses every
 * gate, so this one path is where licensing touches money.
 *
 * L2 (2026-09-18) made expiry real inside `resolve_user_tier`. It never reached
 * this call site, because this one never asked.
 *
 * Live case at the time of the fix: user `d8d09efe`, tier `edu`, expired
 * 2026-09-01, still uncapped.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT  = path.join(__dirname, "..", "..");
const route = fs.readFileSync(path.join(ROOT, "src/app/api/chat-reply/route.ts"), "utf8");
/** Comments explain the OLD bug by name, so strip them before asserting. */
const code  = route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("the quota resolves the tier", () => {
    it("🔴 it does NOT select `tier` out of the licenses table", () => {
        // The exact shape of the bug: reading the stored column as if it were
        // the effective tier.
        expect(code).not.toMatch(/from\("licenses"\)[\s\S]{0,120}select\([^)]*tier/);
    });

    it("🔴 it calls resolveUserTier", () => {
        expect(code).toMatch(/resolveUserTier\(/);
        expect(code).toMatch(/from "@\/lib\/imotara\/org"/);
    });

    it("the cap is decided from effectiveTier", () => {
        expect(code).toMatch(/tier:\s*resolved\.data\.effectiveTier/);
    });

    it("🔑 it FAILS OPEN when the resolve fails", () => {
        // The old select's failure reached the caller's `.catch(() => null)`,
        // and a null quotaInfo applies no cap. Throttling a paying subscriber
        // because an RPC hiccuped is worse than one extra free reply.
        expect(code).toMatch(/if \(!resolved\.ok\) throw new Error/);
        expect(code).toMatch(/fetchQuotaInfo\([^)]*\)\.catch\(\(\) => null\)/);
    });

    it("the launch-offer exemption survives", () => {
        // A FREE tier with a future expiry is a launch-offer grant and stays
        // uncapped. Removing this would start capping those users on day one.
        expect(code).toMatch(/trialActive/);
        expect(code).toMatch(/isFree && !trialActive && usageCount >= 20/);
    });

    it("🔴 reply quality is still never branched on tier", () => {
        // The standing rule: tier may decide HOW MANY enhanced replies someone
        // gets, never how GOOD one is. This fix touches the quota, which is the
        // legitimate lever — it must not have grown a quality branch.
        expect(code).not.toMatch(/RESPONSE LENGTH/);
        expect(code).not.toMatch(/tier[^\n]{0,40}(concise|shorter|close_friend)/i);
    });
});
