/**
 * 🔴 THE FIRST POST THE "UNTRANSLATABLE" ANGLE EVER WROTE WAS WRONG.
 *
 *   "The Tamil word 'உற்சாகம்' (urchagam) means the quiet lift you feel when
 *    something small goes right."
 *
 * ⛔ உற்சாகம் is a Sanskrit loan (उत्साह) meaning enthusiasm or zeal —
 * energetic, not quiet — and English renders it fine as "enthusiasm", so it is
 * not untranslatable at all. The pool's instructions said IN CAPITALS to use
 * only a word the writer was certain of. The model ignored that on attempt one.
 *
 * 🔑 AND NOTHING COULD HAVE CAUGHT IT. Every other check compares text against
 * a list of things not to say. No list knows whether a translation is TRUE —
 * and the person reviewing the draft cannot check it either, which is what
 * makes this different from a typo. It would have been published: confidently
 * wrong about Tamil, to Tamil speakers, under the brand's name.
 *
 * ⇒ So the model no longer chooses the word, and a claim about one is refused
 * unless a person has vouched for it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  UNTRANSLATABLE_WORDS,
  vettedWords,
  untranslatablePoolReady,
  pickWord,
  checkWordClaim,
} from "@/lib/social/untranslatableWords";
import { checkVoice } from "@/lib/social/voiceGate";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** The actual sentence that prompted all of this. */
const THE_TAMIL_POST =
  "The Tamil word 'உற்சாகம்' (urchagam) means the quiet lift you feel when something small goes " +
  "right — a bus arriving, a message answered, tea just how you like it. There's no single word " +
  "for that in English.";

describe("nothing is usable until a person vouches for it", () => {
  it("⛔ an unconfirmed entry is never offered", () => {
    expect(UNTRANSLATABLE_WORDS.length).toBeGreaterThan(0);
    for (const w of vettedWords()) {
      expect(w.confirmedBy, `${w.roman} is offered with nobody's name on it`).not.toBeNull();
    }
  });

  /**
   * ⚠️ THIS TEST PASSES TODAY BECAUSE THE TABLE IS ENTIRELY UNCONFIRMED, and
   * it is meant to. I seeded the words; I do not speak those languages well
   * enough to vouch for a published gloss, and my confidence is not the
   * standard the file sets. It starts switched off.
   */
  it("says plainly when the angle is switched off, and why", () => {
    const ready = untranslatablePoolReady();
    if (vettedWords().length === 0) {
      expect(ready.ok).toBe(false);
      expect(ready.reason).toMatch(/confirmed by somebody who speaks the language/i);
      expect(pickWord(0)).toBeNull();
    } else {
      expect(ready.ok).toBe(true);
    }
  });

  it("every seeded entry carries a word, a romanisation, a language and a meaning", () => {
    for (const w of UNTRANSLATABLE_WORDS) {
      expect(w.word.length, "a word with no word").toBeGreaterThan(0);
      expect(w.roman.length, `${w.word} has no romanisation`).toBeGreaterThan(0);
      expect(w.language.length, `${w.roman} has no language`).toBe(2);
      expect(w.meaning.length, `${w.roman} has no meaning to confirm`).toBeGreaterThan(20);
    }
  });
});

describe("the claim check refuses what nobody can verify", () => {
  it("🔴 refuses the exact post that caused this", () => {
    const r = checkWordClaim(THE_TAMIL_POST, "en");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.problem).toMatch(/confirmed word table/i);
  });

  it("the gate rejects it too, so it never reaches a reviewer", () => {
    const g = checkVoice(THE_TAMIL_POST, "en");
    expect(g.ok, "a post nobody can fact-check was queued for review").toBe(false);
    expect(g.findings.some((f) => f.list === "unvetted-word")).toBe(true);
  });

  /**
   * 🔑 THE HARDER CASE. The Tamil post had the word in its own script, which a
   * script check catches. "The Tamil word urchagam means…" has no non-Latin
   * character at all — and it is the easier mistake to make.
   */
  it("⛔ catches a romanised claim with no native script in it", () => {
    const r = checkWordClaim("The Tamil word urchagam means a quiet lift when something goes right.", "en");
    expect(r.ok).toBe(false);
  });

  /**
   * ⚠️ THE TWO CHECKS HAVE TO BE PINNED SEPARATELY. The Tamil post trips BOTH
   * — it has the script AND the words "The Tamil word" — so deleting the
   * script check broke no test at all until this case existed. Found by
   * mutation ⇒ trap_mutation_harness_can_report_false_caught.
   */
  it("⛔ catches a script the post never names as a language", () => {
    // ⚠️ Deliberately NOT অভিমান any more. That word was confirmed on 18 Oct,
    // so using it here would have quietly turned this case into a test of
    // nothing — the fixture has to be a word still outside the table.
    const r = checkWordClaim("Some evenings you just feel உற்சாகம் and could not explain it.", "en");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.problem).toContain("உற்சாகம்");
  });

  it("leaves an ordinary English post alone", () => {
    const r = checkWordClaim(
      "Most of the hard hours are not office hours. Imotara is awake then, and it is not therapy.",
      "en",
    );
    expect(r.ok).toBe(true);
  });

  /**
   * ⛔ A BENGALI POST IS BENGALI SCRIPT THROUGHOUT. Flagging that would make
   * the check useless in 21 of the 22 languages, which is the way a safety
   * check gets switched off for being annoying.
   */
  it("does not fire on a post written IN that script", () => {
    expect(checkWordClaim("আজ একটু ভালো লাগছে। কথা বলতে ইচ্ছে করছে।", "bn").ok).toBe(true);
  });

  /**
   * ✅ A CONFIRMED WORD GOES THROUGH. অভিমান was confirmed on 18 Oct by a
   * Bengali speaker reading the gloss in the table.
   *
   * ⛔ Which is the half of this that is easy to get wrong: a check that
   * refuses everything is not safe, it is broken, and somebody would turn it
   * off within a week.
   */
  it("lets a confirmed word through", () => {
    const w = vettedWords("bn").find((x) => x.roman === "abhimaan");
    expect(w, "অভিমান is no longer confirmed — this test now proves nothing").toBeTruthy();
    const body = `The Bengali word ${w!.word} (${w!.roman}) means ${w!.meaning}.`;
    expect(checkWordClaim(body, "en").ok).toBe(true);
    expect(checkVoice(body, "en").ok).toBe(true);
  });

  it("⛔ still refuses an entry that is in the table but unconfirmed", () => {
    // 🔑 Being listed is not being vouched for. अपनापन is seeded and unsigned.
    const unsigned = UNTRANSLATABLE_WORDS.find((w) => w.confirmedBy === null && w.language === "hi");
    expect(unsigned, "no unconfirmed entry left to test with").toBeTruthy();
    const body = `The Hindi word ${unsigned!.word} (${unsigned!.roman}) means ${unsigned!.meaning}.`;
    expect(checkWordClaim(body, "en").ok).toBe(false);
  });

  /**
   * ⛔ মায়া WAS DECLINED, not merely left unconfirmed — a Bengali speaker
   * judged the philosophical "illusion" sense too close. It stays in the table
   * so the next person does not have the same good idea again.
   */
  it("keeps the declined word listed, unconfirmed, with the reason", () => {
    const maya = UNTRANSLATABLE_WORDS.find((w) => w.roman === "maya");
    expect(maya, "the declined entry was deleted, so it will be proposed again").toBeTruthy();
    expect(maya!.confirmedBy).toBeNull();
    expect(maya!.note).toMatch(/DECLINED/);
  });
});

describe("the writer is not trusted to pick the word", () => {
  const writer = read("src/lib/social/writer.ts");

  it("⛔ drops the angle entirely when no word is confirmed", () => {
    expect(writer).toMatch(/chosen\.filter\(\(p\) => p\.id !== "untranslatable"\)/);
  });

  it("hands over the exact word and meaning when there is one", () => {
    expect(writer).toContain("THE WORD IS");
    expect(writer).toMatch(/Do not pick a different word/);
    expect(writer).toMatch(/Do not widen, narrow or prettify that meaning/);
  });

  /**
   * ⚠️ A warning in a prompt is what failed the first time, so the prompt text
   * above is the SECOND line of defence. This is the first: the angle is not
   * in the list at all.
   */
  it("the angle list is built from the filtered pools, not the raw ones", () => {
    expect(writer).toMatch(/angles\.map\(\(p\) => `- \$\{p\.label\}: \$\{p\.angle\}`\)/);
    expect(writer).toMatch(/const angles = word \? chosen :/);
  });
});

/**
 * 🔴 A SECOND, QUIETER FAILURE IN THE SAME POST. The schedule asked for "words
 * and a picture". The new, more specific opening sentence ran past the
 * headline limit, the composer correctly refused to truncate it, and the row
 * in the queue then read exactly like a plain text post. The reason existed —
 * three clicks down, in the notes.
 */
describe("a post that lost its card says so on the row", () => {
  const page = read("src/app/admin/social/page.tsx");

  it("reads the reason the pipeline already wrote", () => {
    expect(page).toMatch(/n\.startsWith\("No picture:"\)/);
  });

  it("⛔ matches the START of a note, not a substring of the body", () => {
    // A post whose words happen to contain "no picture" must not be flagged.
    expect(page).not.toMatch(/includes\("No picture/);
  });

  it("shows it as a chip on the row, not only in the notes list", () => {
    expect(page).toMatch(/Asked for a picture — none made/);
  });

  it("the pipeline still writes that note", () => {
    const pipeline = read("src/lib/social/pipeline.ts");
    expect(pipeline).toMatch(/"No picture: the opening sentence is too long/);
  });
});
