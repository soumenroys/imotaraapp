/**
 * A reply is a reply. What someone pays changes how MANY they get, never how
 * good one is.
 *
 * 🔴 WHY THIS EXISTS. Until 2026-09-17, chat-reply/route.ts appended this to the
 * SYSTEM PROMPT whenever enforce mode was on and the tier resolved to `free`:
 *
 *     "RESPONSE LENGTH: Keep your reply concise — ideally 2–3 sentences.
 *      Do not use extended storytelling, mythology, or multi-paragraph
 *      reflections."
 *
 * and silently rewrote the companion the user had chosen — coach, mentor and
 * calm_companion all became close_friend. It was invisible only because
 * LICENSE_MODE is "off"; flipping enforce would have shortened every free
 * user's replies and swapped their companion, with no code change to point at.
 *
 * Owner decision, verbatim: "chat reply quality should be exactly same for any
 * licensing tier. whatever the license type is, may be free, maybe plus".
 *
 * ⚠️ Quota is NOT this. Running out of enhanced replies falls back to a local
 * reply with a gentle nudge — a different reply, not a deliberately worse one —
 * and it is advertised on the pricing page. That distinction is the whole point:
 * tier may gate QUANTITY, never QUALITY.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** Everything that shapes what the model is told, or what comes back. */
const REPLY_PATH = [
    "src/app/api/chat-reply/route.ts",
    "src/app/api/respond/route.ts",
    "src/lib/ai/orchestrator/runImotara.ts",
];

/** Comments explain the removal by quoting it — strip them before searching. */
const stripComments = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/**
 * Returns `src` with the body of `fnName` removed, by brace matching from its
 * declaration. Used to assert on "everything except the quota".
 */
function withoutFunctionBody(src: string, fnName: string): string {
    const start = src.indexOf(`function ${fnName}(`);
    if (start === -1) throw new Error(`${fnName} not found — the guard would pass vacuously`);
    const open = src.indexOf("{", start);
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}" && --depth === 0) return src.slice(0, start) + src.slice(i + 1);
    }
    throw new Error(`unbalanced braces in ${fnName}`);
}

describe("reply quality does not depend on the licence tier", () => {
    it("🔴 no reply-path file instructs the model to be briefer for anyone", () => {
        for (const f of REPLY_PATH) {
            const code = stripComments(read(f));
            expect(code, `${f} caps reply length`).not.toMatch(/RESPONSE LENGTH/i);
            expect(code, `${f} bans storytelling`).not.toMatch(/extended storytelling|multi-paragraph reflections/i);
        }
    });

    it("🔴 nobody's chosen companion tone is rewritten for them", () => {
        for (const f of REPLY_PATH) {
            const code = stripComments(read(f));
            expect(code, `${f} reassigns the tone`).not.toMatch(/\bbody\.tone\s*=[^=]/);
            expect(code, `${f} has a premium-tone list`).not.toMatch(/premiumTones/);
        }
    });

    it("🔴 chat-reply learns the tier ONLY inside the quota, nowhere else", () => {
        // ⚠️ NARROWED 2026-09-25, deliberately. This used to assert that
        // `resolveUserTier` appeared NOWHERE in the file. That was right while
        // the quota read `licenses.tier` straight from the table — but that read
        // was itself a bug: the stored column still says `plus` after a licence
        // expires, so a lapsed subscriber bypassed the cap forever (L28).
        //
        // Fixing it means the quota must resolve the tier properly. Banning the
        // function name would have forced the fix to keep using the wrong
        // source, which is the opposite of what this file is protecting.
        //
        // The RULE is unchanged and the teeth are the same: the tier may reach
        // the QUOTA and nothing else. So the quota's own function is excised
        // and the assertion runs on everything that is left — every line that
        // builds a prompt, picks a tone, or shapes a reply.
        const code = stripComments(read("src/app/api/chat-reply/route.ts"));
        // Import lines are excluded: importing a symbol is not using it, and
        // the quota's own import necessarily lives at the top of the file.
        // What this guard cares about is CALL SITES.
        const outsideQuota = withoutFunctionBody(code, "fetchQuotaInfo")
            .replace(/^\s*import[\s\S]*?;$/gm, "");

        // Sanity: the excision must actually have removed something, or this
        // assertion silently passes on the whole file.
        expect(outsideQuota.length).toBeLessThan(code.length);

        expect(outsideQuota, "tier resolved outside the quota").not.toMatch(/resolveUserTier/);
        expect(outsideQuota, "effective tier read outside the quota").not.toMatch(/effectiveTier/);
    });

    it("🔴 no reply-path file imports a feature gate", () => {
        // The structural guarantee behind L5a: server-side enforcement lands on
        // other routes as a pre-handler guard, never inside a reply.
        for (const f of REPLY_PATH) {
            const code = stripComments(read(f));
            expect(code, `${f} imports a gate`).not.toMatch(
                /from\s+"@\/lib\/imotara\/(serverGate|featureGates)"/,
            );
            expect(code, `${f} calls requireFeature`).not.toMatch(/requireFeature\s*\(/);
        }
    });

    it("quota still works — this test must not be read as banning quota", () => {
        // If this ever fails, the free-tier daily allowance was removed by
        // accident while tightening the rules above. Quota is intended.
        const respond = read("src/app/api/respond/route.ts");
        expect(respond).toMatch(/usage_events/);
        expect(respond).toMatch(/isFree/);
    });
});
