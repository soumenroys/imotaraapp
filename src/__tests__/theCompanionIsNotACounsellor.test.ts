/**
 * ⛔ IMOTARA DESCRIBES ITSELF WITHOUT A CLINICAL TITLE — 29 Oct 2026.
 *
 * The identity line of every chat reply said the companion combines "the
 * gentle direction of a good counsellor", and an example joke had it compare
 * itself with "therapists". Imotara is not a counselling service
 * ⇒ trap_marketing_copy_claims_a_regulated_title. Changed only those two
 * lines; measured on 66 messages × 22 languages before/after (questions 29 vs
 * 27–31, stories 13 vs 14, no wrong-language change, no clinical words).
 * ⚠️ The craft notes ("what a seasoned counsellor notices") are deliberately
 * left: they describe a skill, not who Imotara is.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const route = readFileSync(join(process.cwd(), "src/app/api/chat-reply/route.ts"), "utf8");

describe("the companion's self-description", () => {
  it("the identity line names no clinical role", () => {
    const line = route.split("\n").find((l) => l.includes("a warm, perceptive companion who listens deeply"))!;
    expect(line).toBeTruthy();
    expect(line).not.toMatch(/counsell?or|therapist|psychologist/i);
  });
  it("no example reply compares the companion with therapists", () => {
    expect(route).not.toMatch(/something therapists technically aren't supposed to do/);
  });
});
