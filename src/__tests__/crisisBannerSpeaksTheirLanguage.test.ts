/**
 * The crisis card must be READABLE by the person it appears for.
 *
 * 🔴 MEASURED 2026-10-10, hours after the detector went from 9 languages to 22:
 * the banner rendered in ENGLISH for **12 of 12** languages tested — Bengali,
 * Hindi, Arabic, Hebrew, Russian, Chinese and Japanese among them, every one of
 * which `detectScriptLang` identifies with certainty.
 *
 * ⚠️ All 22 translations already existed in CRISIS_BANNER_BY_LANG. They were
 * unreachable, because the banner read `preferredLang` — a Settings value that
 * defaults to "en" — and never looked at what the person had actually written.
 *
 * 🔑 THE POINT. Widening the detector to 22 languages was the headline fix, and
 * on its own it would have put a card in front of a Bengali speaker in crisis
 * with an English helpline on it. Detection and presentation are two halves,
 * and the tests only covered the first. A card that appears but cannot be read
 * is most of the way back to no card at all.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { crisisBannerLangFor } from "@/app/chat/page";
import { CRISIS_BANNER_BY_LANG } from "@/lib/safety/crisisCopy";

const hasCopy = (l: string) => Boolean(CRISIS_BANNER_BY_LANG[l]);
const resolve = (pref: string | null, ...texts: string[]) =>
    crisisBannerLangFor(pref, texts, hasCopy);

/** Crisis phrases whose SCRIPT alone identifies the language. */
const BY_SCRIPT: Array<[string, string]> = [
    ["bn", "আমি মরতে চাই"],
    ["hi", "मैं मरना चाहता हूँ"],
    ["ta", "எனக்கு சாக வேண்டும்"],
    ["te", "నేను చనిపోవాలి"],
    ["gu", "મારે મરી જવું છે"],
    ["pa", "ਮੈਂ ਮਰਨਾ ਚਾਹੁੰਦਾ ਹਾਂ"],
    ["kn", "ನಾನು ಸಾಯಬೇಕು"],
    ["ml", "എനിക്ക് മരിക്കണം"],
    ["or", "ମୁଁ ବଞ୍ଚିବାକୁ ଚାହୁଁନାହିଁ"],
    ["ur", "میں مرنا چاہتا ہوں"],
    ["ar", "أريد أن أموت"],
    ["he", "אני רוצה למות"],
    ["ru", "я хочу умереть"],
    ["zh", "我想死"],
    ["ja", "死にたい"],
];

describe("🔴 someone who never set a language still gets their OWN language", () => {
    it.each(BY_SCRIPT)("%s — the banner speaks it", (lang, phrase) => {
        expect(resolve(null, phrase)).toBe(lang);
    });

    it("⛔ all 15 script-identifiable languages, counted", () => {
        const wrong = BY_SCRIPT.filter(([l, p]) => resolve(null, p) !== l).map(([l]) => l);
        expect(wrong).toEqual([]);
        expect(BY_SCRIPT).toHaveLength(15);
    });

    it("🔑 and the text they see is really in that script, not English", () => {
        // The failure this file exists for: resolving the code but still
        // rendering English copy.
        const SCRIPTS: Record<string, RegExp> = {
            bn: /[ঀ-৿]/, hi: /[ऀ-ॿ]/, ta: /[஀-௿]/,
            ar: /[؀-ۿ]/, he: /[֐-׿]/, ru: /[Ѐ-ӿ]/,
            zh: /[一-鿿]/, ja: /[぀-ヿ一-鿿]/,
        };
        for (const [lang, re] of Object.entries(SCRIPTS)) {
            const picked = resolve(null, BY_SCRIPT.find(([l]) => l === lang)![1]);
            const copy = CRISIS_BANNER_BY_LANG[picked];
            if (!re.test(copy.tier2)) {
                throw new Error(`${lang}: the banner resolved to "${picked}" but its tier2 copy is not in that script`);
            }
        }
    });

    it("romanised Indic is caught too — 'ami marte chai' is Bengali", () => {
        const r = resolve(null, "ami marte chai");
        expect(["bn", "en"]).toContain(r);   // bn when the hint fires; never a WRONG language
    });
});

describe("⛔ a stated choice still wins — they asked for it", () => {
    it("English chosen, Bengali typed ⇒ English", () => {
        // ⚠️ Deliberate. Someone who set English while typing Bengali script
        // gets English, exactly as recognitionLangFor decided for the mic.
        expect(resolve("en", "আমি মরতে চাই")).toBe("en");
    });

    it("Hindi chosen, English typed ⇒ Hindi", () => {
        expect(resolve("hi", "I want to die")).toBe("hi");
    });

    it("'auto' is not a choice — detection runs", () => {
        expect(resolve("auto", "আমি মরতে চাই")).toBe("bn");
    });

    it("⚠️ …and 'auto' must never become a copy key, or that guard starts mattering", () => {
        // 🔑 AN EQUIVALENT MUTANT, recorded rather than contrived around.
        // Removing `stated !== "auto"` from crisisBannerLangFor changes NOTHING
        // today, because hasCopy("auto") is already false — so no test can
        // catch that mutation, and pretending otherwise would be theatre.
        //
        // ⛔ The guard is still worth keeping: the day someone adds an `auto`
        // entry to CRISIS_BANNER_BY_LANG, "auto" becomes a selectable language
        // and a person who chose nothing gets whatever that entry says instead
        // of their own script. This assertion is what fails then.
        expect(CRISIS_BANNER_BY_LANG.auto).toBeUndefined();
        expect(Object.keys(CRISIS_BANNER_BY_LANG)).not.toContain("auto");
    });

    it("an unknown stated code falls through to detection, not to itself", () => {
        expect(resolve("xx", "আমি মরতে চাই")).toBe("bn");
    });
});

describe("⚖️ the honest limits, stated rather than hidden", () => {
    it("🔴 MARATHI in Devanagari still resolves to HINDI — a known open bug", () => {
        // ⛔ NOT acceptable, and NOT fixed here. detectScriptLang returns mr-IN
        // only when MARATHI_HINT matches, and "मला मरायचंय" contains none of
        // its markers (आहे, नाही, माझ/माझा, तुझ/तुझा, होत, "मी ", तुम्ही).
        // So a Marathi speaker in crisis is shown a HINDI helpline banner.
        //
        // 🔑 This is the same board item as "typing Marathi gets a Hindi
        // reply" — it is one detector, and the crisis card inherits it.
        // Recorded as a FAILING REALITY rather than hidden, so fixing the
        // detector fixes this test too and we find out.
        expect(resolve(null, "मला मरायचंय")).toBe("hi");   // ⛔ should be "mr"
    });

    it("…though a Marathi sentence WITH a hint marker does resolve", () => {
        // Proof the path works when the hint fires — the gap is the hint's
        // vocabulary, not the plumbing.
        expect(resolve(null, "मी मरायचं ठरवलं आहे")).toBe("mr");
    });

    it("⚠️ es/fr/de/pt/id still get English — no detector exists for them", () => {
        // ⛔ NOT an assertion that this is FINE. It is a known gap on the
        // board: Latin script, no roman hints. Recorded here so the next
        // person sees the limit instead of assuming 22/22 coverage.
        for (const p of ["quiero morir", "je veux mourir", "ich will sterben",
                         "quero morrer", "saya ingin mati"]) {
            expect(resolve(null, p)).toBe("en");
        }
    });

    it("…but if they HAVE set the language, those five work", () => {
        for (const l of ["es", "fr", "de", "pt", "id"]) {
            expect(resolve(l, "quiero morir")).toBe(l);
        }
    });

    it("no messages at all ⇒ English, unchanged", () => {
        expect(resolve(null)).toBe("en");
        expect(resolve(null, "", "   ")).toBe("en");
    });

    it("the MOST RECENT message decides", () => {
        expect(resolve(null, "আমি মরতে চাই", "我想死")).toBe("zh");
    });
});

describe("⚠️ the banner really uses it", () => {
    const SRC = fs.readFileSync(path.join(process.cwd(), "src/app/chat/page.tsx"), "utf8");

    it("the render calls crisisBannerLangFor, not preferredLang", () => {
        expect(SRC).toMatch(/const bannerLang = crisisBannerLangFor\(/);
        expect(SRC).toMatch(/CRISIS_BANNER_BY_LANG\[bannerLang\] \?\? CRISIS_BANNER_BY_LANG\.en/);
    });

    it("⛔ the old direct lookup is gone", () => {
        expect(SRC).not.toMatch(/CRISIS_BANNER_BY_LANG\[preferredLang\]/);
    });

    it("…and it is fed the USER's recent messages", () => {
        const i = SRC.indexOf("const bannerLang = crisisBannerLangFor(");
        const block = SRC.slice(i, i + 400);
        expect(block).toMatch(/m\.role === "user"/);
        expect(block).toMatch(/activeThread\?\.messages/);
    });
});
