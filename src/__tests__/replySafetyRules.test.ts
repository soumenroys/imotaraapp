/**
 * The safety rules reach BOTH system prompts, and keep saying what they said.
 *
 * 🔴 THE INCIDENT THIS DEFENDS AGAINST. /api/chat-reply builds two system
 * prompts — the full therapeutic framework, and a short one used when someone
 * types their own language in Latin letters ("ami valo achi"). The short one
 * REPLACES the full one. In the 2026-08-14 pre-release review the entire
 * crisis-safety framework and the Connect referral rule turned out to be
 * missing from it, and a romanized-Hindi message carrying BOTH crisis and
 * loneliness signals got a warm reply with no crisis referral at all.
 *
 * They were hand-ported — which left two copies of every safety string and
 * the next rule one edit away from the same hole. This file is the thing that
 * notices.
 *
 * ⚠️ The prompts stay separate on purpose: the route records that the full
 * prompt makes the model abandon romanized script. Merging them would trade a
 * maintenance problem for a worse output, so what is shared is the RULES.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
    SAFETY_BASELINE, CONNECT_REFERRAL_RULE, CONNECT_REMINDER, CRISIS_REMINDER,
    SAFETY_RULE_IDS, safetyRuleText, safetyEndReminders,
} from "@/lib/imotara/replySafetyRules";

const ROUTE = "src/app/api/chat-reply/route.ts";
const SRC = fs.readFileSync(path.join(process.cwd(), ROUTE), "utf8");

/** The eight strings as the route sent them BEFORE the extraction. */
const PRE = JSON.parse(fs.readFileSync(
    path.join(process.cwd(), "src/__tests__/fixtures/replySafetyStrings.pre.json"), "utf8"),
) as Record<string, string>;

describe("⛔ BYTE-IDENTICAL — extracting these must not have reworded one", () => {
    // A prompt string is not a comment. Rewording one changes what the model
    // says to someone in crisis, so the extraction is pinned against a
    // fixture captured from the source before it happened.
    it("the baseline rule, both variants", () => {
        expect(SAFETY_BASELINE.full).toBe(PRE.baseline_full);
        expect(SAFETY_BASELINE.brief).toBe(PRE.baseline_brief);
    });

    it("the Connect referral rule, both variants", () => {
        expect(CONNECT_REFERRAL_RULE.full).toBe(PRE.connect_rule_full);
        expect(CONNECT_REFERRAL_RULE.brief).toBe(PRE.connect_rule_brief);
    });

    it("the two near-end reminders, both variants", () => {
        expect(CONNECT_REMINDER.full).toBe(PRE.connect_remind_full);
        expect(CONNECT_REMINDER.brief).toBe(PRE.connect_remind_brief);
        expect(CRISIS_REMINDER.full).toBe(PRE.crisis_remind_full);
        expect(CRISIS_REMINDER.brief).toBe(PRE.crisis_remind_brief);
    });

    it("⛔ no safety string is left inline in the route", () => {
        // If one survives as a literal, it is a second copy again and this
        // whole file stops meaning anything.
        for (const [name, text] of Object.entries(PRE)) {
            if (SRC.includes(text)) {
                throw new Error(`${name} is still a literal in ${ROUTE} — the duplicate is back`);
            }
        }
    });
});

describe("🔑 THE DRIFT TEST — every rule reaches BOTH prompts", () => {
    /** The source of one prompt array, so references can be counted in it. */
    function promptRegion(startMarker: string): string {
        const i = SRC.indexOf(startMarker);
        if (i < 0) throw new Error(`prompt start not found: ${startMarker}`);
        const j = SRC.indexOf("].filter(Boolean)", i);
        if (j < 0) throw new Error(`prompt end not found after: ${startMarker}`);
        return SRC.slice(i, j);
    }
    const mainPrompt = promptRegion("const prompt = [");
    const romanPrompt = promptRegion("const romanizedPrompt = isRomanInput");

    it("…the main prompt pulls its rules from the shared module", () => {
        expect(mainPrompt).toMatch(/SAFETY_BASELINE\.full/);
        expect(mainPrompt).toMatch(/CONNECT_REFERRAL_RULE\.full/);
        expect(mainPrompt).toMatch(/safetyEndReminders\(\{[^}]*\}, "full"\)/);
    });

    it("…and so does the romanized prompt", () => {
        expect(romanPrompt).toMatch(/SAFETY_BASELINE\.brief/);
        expect(romanPrompt).toMatch(/CONNECT_REFERRAL_RULE\.brief/);
        expect(romanPrompt).toMatch(/safetyEndReminders\(\{[^}]*\}, "brief"\)/);
    });

    it("🔴 the two prompts reference the SAME set of safety symbols", () => {
        // ⚠️ THIS IS THE POINT OF THE FILE. A rule added to one prompt and not
        // the other fails here, which is the exact 2026-08-14 failure.
        const symbols = (region: string) => {
            const found = new Set<string>();
            for (const m of region.matchAll(
                /\b(SAFETY_BASELINE|CONNECT_REFERRAL_RULE|CONNECT_REMINDER|CRISIS_REMINDER|safetyEndReminders)\b/g,
            )) found.add(m[1]);
            return [...found].sort();
        };
        const inMain = symbols(mainPrompt);
        const inRoman = symbols(romanPrompt);
        expect(inRoman).toEqual(inMain);
        // and it is not vacuously empty
        expect(inMain.length).toBeGreaterThanOrEqual(3);
    });

    it("⛔ every rule the module owns has text in BOTH variants", () => {
        // The other half: a rule could be in the module and reach neither.
        for (const id of SAFETY_RULE_IDS) {
            for (const variant of ["full", "brief"] as const) {
                const t = safetyRuleText(id, variant);
                if (!t || t.trim().length < 40) {
                    throw new Error(`rule "${id}" is empty or stubbed in the "${variant}" variant`);
                }
            }
        }
    });

    it("🔑 the brief variant is SHORTER but says the same things", () => {
        // "brief" must mean shorter wording, never a dropped rule. Each
        // concept below is checked in both variants independently.
        const required: Array<[string, RegExp]> = [
            ["points at professional crisis services", /professional crisis services/i],
            ["points at a trusted person", /trusted (?:people|person)/i],
            ["forbids medical or diagnostic advice", /No medical, diagnostic/i],
        ];
        for (const [what, re] of required) {
            for (const variant of ["full", "brief"] as const) {
                if (!re.test(SAFETY_BASELINE[variant])) {
                    throw new Error(`the "${variant}" baseline no longer ${what}`);
                }
            }
        }
        // Connect is peer support in both, never a professional.
        for (const variant of ["full", "brief"] as const) {
            expect(CONNECT_REFERRAL_RULE[variant]).toMatch(/peer support only/i);
            expect(CONNECT_REMINDER[variant]).toMatch(/peer support only/i);
            expect(CONNECT_REMINDER[variant]).toMatch(/never (?:call it )?therapy/i);
        }
    });
});

describe("🔴 at most ONE end reminder, and crisis always wins", () => {
    const R = (c: boolean, l: boolean, v: "full" | "brief" = "full") =>
        safetyEndReminders({ isCrisisAdjacent: c, isLonelyOrWantsCompany: l }, v);

    it("crisis ⇒ the crisis reminder", () => {
        expect(R(true, false)).toBe(CRISIS_REMINDER.full);
        expect(R(true, false, "brief")).toBe(CRISIS_REMINDER.brief);
    });

    it("lonely ⇒ the Connect reminder", () => {
        expect(R(false, true)).toBe(CONNECT_REMINDER.full);
        expect(R(false, true, "brief")).toBe(CONNECT_REMINDER.brief);
    });

    it("neither ⇒ nothing", () => {
        expect(R(false, false)).toBe("");
        expect(R(false, false, "brief")).toBe("");
    });

    it("🔴 BOTH ⇒ crisis only, never the Connect referral", () => {
        // ⚠️ Unreachable today (see the source invariant below) and tested
        // anyway, because the two reminders CONTRADICT each other — "you MUST
        // name Imotara Connect" against "do NOT mention Imotara Connect
        // anywhere in this reply, in any language" — and they sit where the
        // model's recall is strongest. If the invariant is ever relaxed, this
        // decides it correctly instead of leaving a suicidal person in front
        // of a peer-support referral.
        expect(R(true, true)).toBe(CRISIS_REMINDER.full);
        expect(R(true, true, "brief")).toBe(CRISIS_REMINDER.brief);
        expect(R(true, true)).not.toContain("Imotara Connect in this reply");
    });

    it("⛔ the crisis reminder forbids Connect; the Connect one requires it", () => {
        // The contradiction, asserted so nobody "harmonises" the two texts
        // and quietly removes the prohibition.
        for (const v of ["full", "brief"] as const) {
            expect(CRISIS_REMINDER[v]).toMatch(/Do NOT mention Imotara Connect/);
            expect(CONNECT_REMINDER[v]).toMatch(/Imotara Connect/);
        }
    });
});

describe("⚠️ the invariant that keeps them mutually exclusive, pinned", () => {
    it("🔴 isLonelyOrWantsCompany is gated on !isCrisisAdjacent", () => {
        // 🔑 This is load-bearing and lives ~3,300 lines from the prompt that
        // depends on it. Deleting the `!isCrisisAdjacent` term would read as a
        // harmless simplification. From the route's own comment, live testing
        // showed the Connect reminder "crowded out the professional/
        // trusted-person crisis referral entirely — the reply mentioned ONLY
        // Connect."
        expect(SRC).toMatch(
            /const isLonelyOrWantsCompany\s*=\s*\n?\s*!isCrisisAdjacent\s*&&/,
        );
    });

    it("…and the reason is still written down next to it", () => {
        const i = SRC.indexOf("const isLonelyOrWantsCompany");
        const before = SRC.slice(Math.max(0, i - 1200), i);
        expect(before).toMatch(/crowded out|crisis safety must never be diluted/i);
    });
});

describe("⚖️ PROOF the assembled prompt did not change", () => {
    /**
     * 🔴 The one structural edit. The main prompt had TWO independent
     * conditional slots:
     *
     *     isLonelyOrWantsCompany ? CONNECT_REMINDER : "",
     *     isCrisisAdjacent       ? CRISIS_REMINDER  : "",
     *
     * and they are now one `safetyEndReminders(...)` slot. Both arrays are
     * `.filter(Boolean).join("\n")`, so this reproduces that join for every
     * flag combination and compares old against new. The standing rule is that
     * reply quality must not change — so "identical" has to be demonstrated,
     * not asserted.
     */
    const joinOld = (c: boolean, l: boolean) =>
        [l ? CONNECT_REMINDER.full : "", c ? CRISIS_REMINDER.full : ""]
            .filter(Boolean).join("\n");
    const joinNew = (c: boolean, l: boolean) =>
        [safetyEndReminders({ isCrisisAdjacent: c, isLonelyOrWantsCompany: l }, "full")]
            .filter(Boolean).join("\n");

    it("✅ identical in every REACHABLE state", () => {
        // Reachable means consistent with `isLonelyOrWantsCompany =
        // !isCrisisAdjacent && …`, i.e. never both true.
        for (const [c, l] of [[false, false], [false, true], [true, false]] as const) {
            if (joinOld(c, l) !== joinNew(c, l)) {
                throw new Error(`output changed for crisis=${c} lonely=${l}`);
            }
        }
    });

    it("🔑 and in the UNREACHABLE state the new behaviour is strictly safer", () => {
        // The only divergence, and it is the right direction: the old code
        // emitted both contradictory reminders, the new one emits the crisis
        // reminder alone.
        const old = joinOld(true, true);
        const now = joinNew(true, true);
        expect(old).not.toBe(now);
        expect(old).toContain("You MUST name 'Imotara Connect'");   // the hazard
        expect(now).not.toContain("You MUST name 'Imotara Connect'");
        expect(now).toBe(CRISIS_REMINDER.full);
    });
});
