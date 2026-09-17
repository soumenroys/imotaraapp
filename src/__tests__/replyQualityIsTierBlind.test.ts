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

    it("🔴 chat-reply does not resolve a tier at all any more", () => {
        // It used to, purely to feed the constraint above. Nothing in building a
        // reply should need to know what someone pays.
        const code = stripComments(read("src/app/api/chat-reply/route.ts"));
        expect(code).not.toMatch(/resolveUserTier/);
        expect(code).not.toMatch(/effectiveTier/);
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
