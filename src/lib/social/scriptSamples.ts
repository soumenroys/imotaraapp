// src/lib/social/scriptSamples.ts
// One real sentence per script, for judging whether the card renderer can
// draw it.
//
// 🔴 WHY THIS EXISTS. `fonts.ts` gates every complex script behind
// `shapingVerified`, which means *"a person who reads this script has looked
// at a rendered picture and said it is right"*. Twelve of thirteen scripts are
// false — and for eleven of them that is because **nobody has ever looked**,
// not because anything was proven. There was no rendered picture to look at.
//
// 🔑 ONLY BENGALI HAS EVIDENCE AGAINST IT: অভিমান rendered as অভমিান on a
// published post, 18 Oct, found by the owner
// ⇒ trap_a_card_cannot_draw_an_indic_script.
//
// ⛔ NOTHING HERE IS INVENTED. Every line is a string the product already
// ships as its spoken-preview sentence, so it has been read by whoever added
// the language — and it contains the brand name, which is the thing
// `shapingVerified` actually governs.
//
// ⚠️ DUPLICATION, DECLARED RATHER THAN HIDDEN. `src/app/settings/page.tsx`
// holds `PREVIEW_TEXT_BY_LANG` with the same sentences. It should import from
// here instead, and does not, because that file is under a standing
// instruction not to touch the working voice preview
// ⇒ feedback_web_voice_preview_locked. ▶️ Merge them when that file is next
// opened deliberately.

/**
 * The sample for each script in `SCRIPT_FONTS`, keyed the same way.
 *
 * ⚠️ One per SCRIPT, not per language: Hindi and Marathi share Devanagari, and
 * Urdu and Arabic share the Arabic script, so judging the script once is
 * enough. The language whose sentence is used is named, because a reader
 * should know which language they are being asked to read.
 */
export const SCRIPT_SAMPLES: Record<string, { language: string; text: string }> = {
  latin: { language: "English", text: "Hi, I'm Imotara. I'm here with you." },
  devanagari: { language: "Hindi", text: "नमस्ते, मैं इमोतारा हूँ. मैं आपके साथ हूँ।" },
  bengali: { language: "Bengali", text: "হ্যালো, আমি ইমোতারা. আমি তোমার সাথে আছি।" },
  tamil: { language: "Tamil", text: "வணக்கம், நான் இமோதாரா. நான் உங்களுடன் இருக்கிறேன்." },
  telugu: { language: "Telugu", text: "నమస్కారం, నేను ఇమోతారా. నేను మీతో ఉన్నాను." },
  gujarati: { language: "Gujarati", text: "નમસ્તે, હું ઇમોતારા છું. હું તમારી સાથે છું." },
  gurmukhi: { language: "Punjabi", text: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ, ਮੈਂ ਇਮੋਤਾਰਾ ਹਾਂ. ਮੈਂ ਤੁਹਾਡੇ ਨਾਲ ਹਾਂ।" },
  kannada: { language: "Kannada", text: "ನಮಸ್ಕಾರ, ನಾನು ಇಮೋತಾರಾ. ನಾನು ನಿಮ್ಮೊಂದಿಗೆ ಇದ್ದೇನೆ." },
  malayalam: { language: "Malayalam", text: "ഹലോ, ഞാൻ ഇമോതാര. ഞാൻ നിങ്ങളോടൊപ്പം ഉണ്ട്." },
  oriya: { language: "Odia", text: "ନମସ୍କାର, ମୁଁ ଇମୋତାରା. ମୁଁ ଆପଣଙ୍କ ସହ ଅଛି।" },
  arabic: { language: "Urdu", text: "ہیلو، میں اموتارا ہوں. میں آپ کے ساتھ ہوں۔" },
  hebrew: { language: "Hebrew", text: "שלום, אני אימוטרה. אני כאן איתך." },
  japanese: { language: "Japanese", text: "こんにちは、私はイモタラです。ここにいますよ。" },
};

/**
 * 🔑 THE WORD THAT PROVED THE PROBLEM, kept beside its script.
 *
 * A second, shorter string where one is known to exercise the exact failure.
 * ⛔ Only Bengali has one, because only Bengali has a documented failure. A
 * guessed "tricky word" for a script nobody here reads would be a guess
 * presented as a test.
 */
export const SCRIPT_STRESS_WORDS: Record<string, { word: string; why: string }> = {
  bengali: {
    word: "অভিমান",
    why:
      "Published 18 Oct and rendered অভমিান — the pre-base vowel sign ি did not move left of its " +
      "consonant and the া detached. If this line looks right, the renderer has started shaping.",
  },
  /**
   * 🔴 ADDED 19 Oct BECAUSE THE SENTENCE ABOVE DOES NOT TEST THE HARD CASE.
   *
   * "नमस्ते, मैं इमोतारा हूँ…" contains no ि at all — every vowel in it sits
   * above, below or after its consonant (ो ै ू े ा). So Devanagari could pass
   * that sample and still fail exactly the way Bengali did.
   *
   * ⚠️ अभिमान is the direct cognate of অভিমান, same meaning, and भि is
   * भ + ि — pre-base, reordered. It tests the one thing that matters.
   */
  devanagari: {
    word: "अभिमान",
    why:
      "The sentence above contains no ि, so it does not test pre-base reordering at all. " +
      "भि is भ + ि and must render with the hook BEFORE भ. This is the same word that broke " +
      "Bengali — if it reads अभिमान rather than अभमिान, Devanagari reorders correctly.",
  },
};

/**
 * ⚠️ WHICH SAMPLES ACTUALLY TEST THE HARD CASE.
 *
 * 🔴 A sample with no pre-base vowel under-tests its script, and a pass on it
 * means little. Said per script rather than implied, because "it looked fine"
 * on a sample that never exercised reordering is how a script gets unblocked
 * wrongly ⇒ feedback_do_the_check_you_are_capable_of.
 *
 * ⛔ Only scripts whose behaviour can be stated with confidence are listed.
 * An absent entry means "not assessed" — not "fine".
 */
export const SAMPLE_TESTS_REORDERING: Record<string, boolean> = {
  // আমি carries ি, and the stress word doubles it.
  bengali: true,
  // ⛔ The sentence does NOT. The stress word above is what tests it.
  devanagari: false,
  // ਸਤਿ carries ਿ, which is pre-base in Gurmukhi.
  gurmukhi: true,
  // Latin has no reordering to test.
  latin: true,
};
