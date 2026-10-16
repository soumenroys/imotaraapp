/**
 * The product must spell its own name the same way on every surface, in all
 * 22 languages.
 *
 * 🔴 THE DEFECTS THIS PINS, both found 2026-10-17, both the same shape.
 *   • Urdu   — the voice preview said اموتارا as امتارا. The و missing, so the
 *              spoken name dropped its "o": Imtara.
 *   • Kannada— the voice preview said ಇಮೋತಾರಾ as ಇಮೋತಾರ, a vowel short.
 * In both cases SIXTEEN-plus written occurrences agreed and the two
 * voice-preview maps disagreed — because those maps were written separately
 * from the copy and nobody compared them.
 *
 * 🔑 WHY NOTHING CAUGHT THEM. Nobody here reads Urdu or Kannada, so no
 * reviewer could see it, and every file was internally consistent. The defect
 * only existed BETWEEN files.
 *
 * ▶️ THE GENERALISABLE PART: cross-surface comparison finds language defects
 * that neither a test nor a reviewer lacking the language ever will. This
 * guard needs none of the 22 languages — it only asks whether they agree.
 *
 * ⛔ IT CANNOT TELL YOU A SPELLING IS RIGHT. They could all be wrong together.
 * That needs a native speaker ⇒ native_speakers_should_audit_real_replies.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

/**
 * 🔑 ALL 22 SHIPPED LANGUAGES, not just the ones in another script.
 *
 * ⚠️ An earlier version of this guard covered only the 14 native-script
 * languages and skipped `en es fr pt de ru id zh` BECAUSE they write the name
 * in Latin — which is exactly backwards. "Imotera" in the Spanish copy would
 * have passed silently. Eight of twenty-two were asserting nothing.
 * ⇒ feedback_full_language_matrix_testing: the matrix is all of them.
 *
 * Forms taken from the shipped product, never transliterated here
 * ⇒ brand_name_in_native_scripts. hi and mr share Devanagari; ru and zh keep
 * the Latin form on text surfaces.
 */
const BRAND_BY_LANGUAGE: Record<string, string> = {
    "en/es/fr/pt/de/ru/id/zh": "Imotara",
    "hi/mr": "इमोतारा",
    bn: "ইমোতারা",
    ta: "இமோதாரா",
    te: "ఇమోతారా",
    gu: "ઇમોતારા",
    pa: "ਇਮੋਤਾਰਾ",
    kn: "ಇಮೋತಾರಾ",
    ml: "ഇമോതാര",
    or: "ଇମୋତାରା",
    ur: "اموتارا",
    ar: "إيموتارا",
    he: "אימוטרה",
    ja: "イモタラ",
};

/** Surfaces that write the name to a user, and what each is not expected to carry. */
const SURFACES: Record<string, string[]> = {
    "src/lib/legal/consentCopy.ts": ["ja"],   // ja has no consent copy
    "src/data/faqLang.ts": [],
    "src/app/settings/page.tsx": [],
};

/** Levenshtein, capped — we only care whether it is 0, 1 or 2. */
function distance(a: string, b: string): number {
    if (Math.abs(a.length - b.length) > 2) return 99;
    let prev = [...Array(b.length + 1).keys()];
    for (let i = 1; i <= a.length; i++) {
        const row = [i];
        for (let j = 1; j <= b.length; j++) {
            row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = row;
    }
    return prev[b.length];
}

const tokensIn = (body: string): string[] =>
    // ⚠️ Spanish opens questions with ¿ and Arabic/Urdu punctuate with ، ؟ —
    // all of which attach to the word and would otherwise read as a misspelling.
    body.match(/[^\s",.;:!?{}()\[\]<>/\\|=+*&^%$#@~`'’।॥、。「」¿¡«»،؟؛]+/g) ?? [];

/** Every canonical form, so one language's spelling is never read as another's typo. */
const ALL_FORMS = new Set(Object.values(BRAND_BY_LANGUAGE));

describe("the brand is spelled one way per language, on every surface", () => {
    for (const [file, skip] of Object.entries(SURFACES)) {
        const body = read(file);
        const words = [...new Set(tokensIn(body))];

        // ⚠️ Built ONCE per file. It does not depend on the language, and
        // rebuilding it inside the loop cost 14 passes over every file.
        const hay = body.toLowerCase();
        const masked = new Uint8Array(body.length);
        for (const form of ALL_FORMS) {
            const f = form.toLowerCase();
            for (let i = hay.indexOf(f); i !== -1; i = hay.indexOf(f, i + 1)) {
                masked.fill(1, i, i + f.length);
            }
        }
        const run = new Int32Array(body.length + 1);
        for (let i = 0; i < body.length; i++) run[i + 1] = run[i] + masked[i];
        const overlaps = (a: number, b: number) => run[b] - run[a] > 0;

        for (const [lang, brand] of Object.entries(BRAND_BY_LANGUAGE)) {
            if (skip.some((s) => lang.split("/").includes(s))) continue;

            it(`${lang} — one spelling in ${path.basename(file)}`, () => {
                // A near-miss is a word within two edits of the brand that is
                // NOT the brand extended. ⚠️ The extension case is the one that
                // matters: these languages agglutinate — ইমোতারায় ("in
                // Imotara"), ઇમોતારામાં, इमोताराशी, イモタラは are all correct and
                // must not be reported. Unrelated words that merely open the
                // same way (امتحان "exam", ਇਮਤਿਹਾਨ "exam") are far enough away
                // in edit distance to fall out on their own.
                const variants = words.filter((w) => {
                    if (w.toLowerCase() === brand.toLowerCase()) return false;
                    // ⚠️ INFLECTION ATTACHES ON BOTH SIDES. Indic and Japanese
                    // suffix it — ইমোতারায় "in Imotara", イモタラは. Hebrew and
                    // Arabic PREFIX it — לאימוטרה "to Imotara", באימוטרה "in".
                    // Checking only startsWith reported every Hebrew sentence
                    // as a misspelling.
                    if (w.includes(brand)) return false;
                    // Urdu and Arabic share a script and have DIFFERENT correct
                    // forms. Neither is a typo of the other.
                    if (ALL_FORMS.has(w)) return false;
                    return distance(w, brand) <= 2;
                });
                expect(
                    variants,
                    `${lang} is written ${variants.length + 1} ways in ${file}: ${[brand, ...variants].join(" vs ")}`,
                ).toEqual([]);
            });

            it(`${lang} — no near-miss anywhere in ${path.basename(file)}, spaces or not`, () => {
                // 🔴 WHY THIS EXISTS SEPARATELY. Japanese and Chinese are written
                // WITHOUT SPACES, so splitting on whitespace yields one enormous
                // token per sentence and the word is never examined. Mutation
                // testing caught it: イモタラ → イモタレ passed the check above.
                // Two of the twenty-two languages were unguarded.
                //
                // So scan the raw text instead. Windows that overlap a correct
                // occurrence are skipped — otherwise every window straddling the
                // real name differs from it by one or two characters and reports
                // itself.
                // ⚠️ Safe ranges cover EVERY canonical form, not just this
                // language's. The Arabic إيموتارا literally contains موتارا, and
                // a window landing inside it is a correct spelling of a
                // different language, not a typo of this one. Lowercase too:
                // "imotara.com" is a domain, not a misspelling of the brand.

                const hits = new Set<string>();
                // Cheap gate before the expensive one: a window that cannot
                // reach the brand in two edits must at least OPEN with one of
                // its first three characters. This rejects almost every
                // position without running the distance function at all.
                const opens = new Set(brand.slice(0, 3));
                for (let i = 0; i < body.length; i++) {
                    if (!opens.has(body[i])) continue;
                    for (let len = brand.length - 1; len <= brand.length + 1; len++) {
                        const w = body.slice(i, i + len);
                        if (w.length !== len || overlaps(i, i + len)) continue;
                        if (w.includes(brand) || ALL_FORMS.has(w)) continue;
                        if (w.toLowerCase() === brand.toLowerCase()) continue;
                        if (distance(w, brand) <= 1) hits.add(w);
                    }
                }
                expect(
                    [...hits],
                    `${lang}: near-miss of "${brand}" in ${file}: ${[...hits].join(", ")}`,
                ).toEqual([]);
            });

            it(`${lang} — still names the brand in ${path.basename(file)}`, () => {
                // ⛔ The opposite failure. Deleting the name silences the check
                // above, because there is then nothing left to disagree with.
                expect(body, `the brand vanished from ${file} (${lang})`).toContain(brand);
            });
        }
    }
});
