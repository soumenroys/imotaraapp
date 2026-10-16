/**
 * Imotara Connect must never be described as counselling or therapy.
 *
 * 🔴 WHY THIS EXISTS. The codebase already wrote the rule down twice:
 *
 *   src/lib/imotara/replySafetyRules.ts
 *     "This is peer support only — NEVER call a Connect companion a therapist,
 *      counsellor, doctor, or any kind of licensed/medical professional."
 *
 *   src/app/connect/register/page.tsx — the agreement every companion signs
 *     "I am NOT a licensed therapist, psychologist, psychiatrist, counsellor …
 *      I will not represent or imply myself as a professional."
 *
 * And then the product broke it in eleven places. On 2026-10-16 the upgrade
 * page offered "wellness companions, therapists, and counsellors", the tutorial
 * sold "professional companions — counsellors, coaches", the booking flow asked
 * for your "Counselor's language", the mobile feature tip promised "a verified
 * counsellor", and the YouTube banner read "Connect with expert counselors".
 *
 * None of it was true. The twelve Connect roles are Friend, Dad, Mom, Sister,
 * Brother, Wellness Companion, Grandfather, Grandmother, Yoga Instructor and
 * so on. There is no counsellor role and never has been.
 *
 * ⚠️ THIS IS NOT A WORDING PREFERENCE. "Counsellor" and "therapist" are
 * regulated titles. Advertising them while supplying peers is the
 * misrepresentation that would dismantle a liability defence on a
 * mental-health product — and the firm carries unlimited personal liability.
 *
 * ⛔ THE RULE. In product copy, a regulated title may appear ONLY in a sentence
 * that DENIES it ("not a therapist", "never present themselves as…"), or in one
 * of the explicitly allowed files below. Anything else fails.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();

/** Regulated / clinical titles that may not be claimed for Connect people. */
const TITLES = /\b(counsell?ors?|therapists?|psychologists?|psychiatrists?|clinicians?)\b/i;

/**
 * A line is fine if it DENIES the title rather than claiming it.
 * "not a licensed therapist", "never present themselves as…", "not a clinician",
 * and "NO professional-client, doctor-patient, therapist-client relationship".
 *
 * ⚠️ `no` is deliberately included and is the loosest marker here — a
 * contrived line like "no waiting, talk to a therapist now" would slip past.
 * That is an accepted limit: this guards the drift we actually saw (OFFERING
 * counsellors), and a guard that fires on honest disclaimers gets deleted by
 * the next person rather than fixed.
 */
const DENIAL = /\b(not|never|no|non-clinical|without|rather than|instead of|isn't|aren't)\b/i;

/**
 * ⛔ SCOPE: the surfaces that DESCRIBE OR SELL Imotara Connect.
 *
 * 🔴 The first version of this test scanned all of src/ and was useless — it
 * flagged `/compare/ai-companion-vs-human-counsellor` (a page whose entire
 * point is comparing Imotara to a real counsellor) and "Counsellors and
 * wardens" on the schools page (the school's own staff). Both are legitimate
 * references to real professionals OUTSIDE Imotara, and a guard that cries
 * wolf on those gets deleted by the next person.
 *
 * The failure being guarded is narrower: describing the people YOU CAN BOOK
 * ON CONNECT as clinical. So the scan is the Connect-facing surfaces only.
 *
 * ▶️ Adding a page that sells or explains Connect? Add it here.
 */
const SURFACES = [
    "src/app/connect",
    "src/components/connect",
    "src/app/upgrade/page.tsx",
    "src/app/tutorial/page.tsx",
    "src/app/chat/page.tsx",
];

/** Every line on a Connect-facing surface that names a regulated title. */
function titleLines(): { file: string; line: number; text: string }[] {
    const targets = SURFACES.map((s) => `'${s}'`).join(" ");
    const out = execSync(
        `grep -rniE 'counsell?ors?|therapists?|psychologists?|psychiatrists?|clinicians?' ${targets} ` +
            `--include='*.ts' --include='*.tsx' || true`,
        { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );
    return out
        .split("\n")
        .filter(Boolean)
        .map((row) => {
            const m = row.match(/^([^:]+):(\d+):(.*)$/);
            return m ? { file: m[1], line: Number(m[2]), text: m[3] } : null;
        })
        .filter((x): x is { file: string; line: number; text: string } => x !== null);
}

describe("Connect is never described as counselling or therapy", () => {
    it("every regulated title in product copy denies it rather than claims it", () => {
        const claims = titleLines().filter((l) => TITLES.test(l.text) && !DENIAL.test(l.text));
        expect(
            claims.map((c) => `${c.file}:${c.line}  ${c.text.trim().slice(0, 110)}`),
            `A regulated title is being CLAIMED rather than denied.\n` +
                `Connect is peer support: the roles are friend, parent, sibling, wellness ` +
                `companion, yoga instructor — there is no counsellor role.\n` +
                `Rewrite the copy, or add the file to ALLOWED only if the mention is about ` +
                `someone outside Imotara.`,
        ).toEqual([]);
    });

    it("the rule the rest of the product must follow is still in place", () => {
        // If this disappears, the guard above loses the thing it enforces.
        const rules = fs.readFileSync(
            path.join(ROOT, "src/lib/imotara/replySafetyRules.ts"),
            "utf8",
        );
        expect(rules).toMatch(/NEVER call a Connect companion a therapist, counsellor, doctor/);
    });

    it("the companion agreement still disclaims the regulated titles", () => {
        const reg = fs.readFileSync(
            path.join(ROOT, "src/app/connect/register/page.tsx"),
            "utf8",
        );
        expect(reg).toMatch(/I am NOT a licensed therapist/);
        expect(reg).toMatch(/peer wellness companion/i);
    });
});
