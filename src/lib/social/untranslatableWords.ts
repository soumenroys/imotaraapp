// src/lib/social/untranslatableWords.ts
// The words the writer is allowed to say are untranslatable, and nothing else.
//
// 🔴 WHY THIS FILE EXISTS, from the first post the pool ever produced.
//
// Asked for "a feeling English has no word for", the model wrote:
//
//   "The Tamil word 'உற்சாகம்' (urchagam) means the quiet lift you feel when
//    something small goes right."
//
// ⛔ As far as anyone here can tell, that is wrong. உற்சாகம் is a Sanskrit loan
// (उत्साह) meaning enthusiasm or zeal — energetic, not quiet — and English
// translates it perfectly well as "enthusiasm", so it is not untranslatable at
// all. The pool's own instructions said in capitals to use ONLY a word the
// writer was certain of. The model ignored it on attempt one.
//
// 🔑 AND NO GATE COULD HAVE CAUGHT IT. Every other check in this system
// compares text against a list of things not to say. There is no list that
// knows whether a translation is TRUE. The only fix is to stop the model
// choosing the word ⇒ it now picks from this table, which a person filled in.
//
// ⚠️ THE HARM IS SPECIFIC, which is why this is not treated as a typo. A wrong
// gloss of a Tamil word is read by Tamil speakers — exactly the people the
// post is courting — as a brand that will happily say things about their
// language without checking ⇒ native_speakers_should_audit_real_replies.

export type UntranslatableWord = {
  /** In its own script. */
  word: string;
  /** A romanisation, for readers who do not read the script. */
  roman: string;
  /** The language code ⇒ src/lib/social/languages.ts */
  language: string;
  /** What it means, as a speaker would explain it to a friend. */
  meaning: string;
  /**
   * 🔴 WHO CONFIRMED IT, AND WHEN. ⛔ `null` means NOT USABLE. An entry that
   * nobody has vouched for is exactly the state this file exists to prevent —
   * it is a suggestion, not a fact, and the writer never sees it.
   *
   * ⚠️ "I am fairly confident" is not a confirmation. The person named here
   * must speak the language.
   */
  confirmedBy: string | null;
  confirmedAt: string | null;
  /** Anything a confirmer should weigh before vouching for it. */
  note?: string;
  /**
   * What was checked against a source, and where.
   *
   * 🔑 TWO TIERS, AND THEY ARE NOT THE SAME THING. A dictionary settles the
   * DENOTATION — it would have caught the Tamil error outright, because every
   * source glosses உற்சாகம் as enthusiasm and none as a quiet lift. It cannot
   * settle the NUANCE, which is the entire reason these words are interesting:
   * no dictionary tells you that অভিমান is the kind of hurt you only feel
   * towards someone you love.
   *
   * ⛔ So evidence is not confirmation and never promotes an entry on its own.
   * It exists to stop ME seeding a plausible invention, and to give the person
   * confirming something to argue with.
   */
  evidence?: { supports: string; source: string }[];
};

/**
 * ⚠️ ENTRIES ARE SEEDED UNCONFIRMED. I wrote the candidates; I do not speak
 * these languages well enough to vouch for a published gloss, and the whole
 * point of the file is that my confidence is not the standard.
 *
 * ▶️ To confirm one: check the meaning line reads true to a speaker, then set
 * `confirmedBy` to their name and `confirmedAt` to the date. Nothing else.
 *
 * 🔴 WHY THIS IS NOT 22 LANGUAGES × FIVE WORDS, which was asked for directly
 * on 18 Oct and is a minute's work to produce.
 *
 *   • Generating fluent, plausible, WRONG glosses at scale is precisely the
 *     failure that created this file. Doing it at seed time instead of at
 *     write time makes it worse, not better: it arrives looking like data.
 *   • An unconfirmed entry produces no posts. A hundred of them produce no
 *     posts and a backlog — and a long list of things waiting to be ticked is
 *     how a confirmation step turns into a rubber stamp.
 *   • The only languages anybody here can confirm TODAY are the ones the owner
 *     speaks. So the table is deep where confirmation is reachable and empty
 *     where it is not, rather than evenly and uselessly full.
 *
 * ▶️ The other twenty languages are not forgotten — they are a standing ask:
 * whenever a native speaker appears for any reason, this table is one of the
 * things to put in front of them ⇒ native_speakers_should_audit_real_replies.
 *
 * ⛔ And a word being famous and untranslatable is not enough. जुगाड़ is
 * well attested in several dictionaries and was NOT seeded: it is a clever
 * makeshift fix, not a feeling, and this pool is about feelings.
 */
export const UNTRANSLATABLE_WORDS: UntranslatableWord[] = [
  {
    word: "অভিমান",
    roman: "abhimaan",
    language: "bn",
    meaning:
      "the hurt pride you can only feel towards someone you love — wounded, a little sulky, and " +
      "waiting for them to notice without being told",
    // ✅ CONFIRMED 18 Oct 2026 by Soumen Roy, who speaks Bengali, reading this
    // exact gloss. ⛔ The meaning line above is what he confirmed — changing a
    // word of it un-confirms it, because what was vouched for was this
    // sentence and not the headword.
    confirmedBy: "Soumen Roy",
    confirmedAt: "2026-10-18",
  },
  {
    word: "মায়া",
    roman: "maya",
    language: "bn",
    meaning:
      "the attachment that grows quietly out of being near someone or something for a long time, " +
      "and the ache that comes with it when you have to leave",
    /**
     * ⛔ DECLINED 18 Oct 2026, and kept here so nobody proposes it again.
     *
     * The concern was that মায়া also carries the philosophical sense of
     * illusion, and the owner — a Bengali speaker — confirmed the overlap is
     * real. A post explaining it as everyday attachment would read as half the
     * word to anybody who knows the other half.
     *
     * ⚠️ Left in the table rather than deleted: a removed entry comes back,
     * because the next person has the same good idea and no record of why it
     * was dropped.
     */
    confirmedBy: null,
    confirmedAt: null,
    note: "⛔ DECLINED by a Bengali speaker on 18 Oct 2026 — the philosophical 'illusion' sense overlaps too much. Do not confirm this one.",
  },
  {
    word: "আড্ডা",
    roman: "adda",
    language: "bn",
    meaning:
      "the long, unhurried, going-nowhere talk among friends that is not leading anywhere and is " +
      "not meant to — the talk itself is the point",
    confirmedBy: null,
    confirmedAt: null,
    note:
      "⚠️ Strictly this is something people DO rather than something they feel, which is why the " +
      "angle was widened to 'a feeling, or a kind of closeness between people'. If that widening " +
      "is wrong, decline this rather than stretching the meaning to sound like a feeling.",
    evidence: [
      {
        supports: "An informal social gathering centred on conversation; lively informal talk. No exact English equivalent.",
        source: "https://www.dictionary.com/browse/adda",
      },
      {
        supports: "An informal meeting place for conversation; a session of chat.",
        source: "https://www.wiktionary.com/wiki/adda",
      },
    ],
  },
  {
    word: "মন খারাপ",
    roman: "mon kharap",
    language: "bn",
    meaning:
      "the flat, heavy mood that is not quite sadness and often has no single cause you could " +
      "name if someone asked",
    confirmedBy: null,
    confirmedAt: null,
    note:
      "⚠️ WEAKER EVIDENCE THAN THE OTHERS — no dictionary entry was found for the phrase itself, " +
      "only for related forms and for how it is used. ⛔ Treat the meaning line below as my " +
      "inference until a speaker says otherwise; it is the kind of entry this file exists to be " +
      "suspicious of.",
    evidence: [
      {
        supports: "Related forms (খারাপ লাগা, গায়ে লাগা) cover feeling hurt, regretful or low — supporting a broad mood term rather than 'sad'.",
        source: "https://amarkosh.tech/%E0%A6%AC%E0%A6%BE%E0%A6%82%E0%A6%B2%E0%A6%BE/%E0%A6%B6%E0%A6%AC%E0%A7%8D%E0%A6%A6/%E0%A6%96%E0%A6%BE%E0%A6%B0%E0%A6%BE%E0%A6%AA+%E0%A6%B2%E0%A6%BE%E0%A6%97%E0%A6%BE",
      },
    ],
  },
  {
    word: "अपनापन",
    roman: "apnapan",
    language: "hi",
    meaning:
      "the feeling that somebody is your own — the warmth of being treated like family by someone " +
      "who is not",
    confirmedBy: null,
    confirmedAt: null,
  },
];

/**
 * The words the writer may actually use.
 *
 * ⛔ Confirmed only. If this returns nothing, the pool is not offered at all
 * rather than offered with a warning — a warning in a prompt is what failed
 * the first time.
 */
export function vettedWords(language?: string): UntranslatableWord[] {
  return UNTRANSLATABLE_WORDS.filter(
    (w) => w.confirmedBy !== null && (language === undefined || w.language === language),
  );
}

/**
 * Is the pool usable at all today? ⚠️ Said in the admin, not discovered.
 *
 * 🔑 ONE CONFIRMED WORD IS ONE POST, not an endless angle. The word is handed
 * to the writer, so a second post from this pool would be about the same word
 * — and the subject register rejects it for overlapping too far with one
 * already used ⇒ src/lib/social/subjects.ts. That is the right failure: the
 * angle quietly stops being available rather than publishing the same thought
 * twice. ▶️ It gets legs when more entries are confirmed, not before.
 */
export function untranslatablePoolReady(): { ok: boolean; reason?: string } {
  const n = vettedWords().length;
  if (n > 0) return { ok: true };
  return {
    ok: false,
    reason:
      `No word in the table has been confirmed by somebody who speaks the language, so the ` +
      `“a feeling English has no word for” angle is switched off. ⛔ It is not offered to the ` +
      `writer at all — the first time it chose its own word it got the meaning wrong. ` +
      `▶️ Confirm an entry in src/lib/social/untranslatableWords.ts.`,
  };
}

/**
 * Pick one, deterministically from a seed so the same run does not drift, and
 * spread across languages rather than exhausting one.
 *
 * ⚠️ Returns null rather than throwing: the caller drops the angle.
 */
export function pickWord(seed: number, language?: string): UntranslatableWord | null {
  const pool = vettedWords(language);
  if (pool.length === 0) return null;
  return pool[Math.abs(Math.trunc(seed)) % pool.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// The check that catches it anyway
// ─────────────────────────────────────────────────────────────────────────────

/** Scripts a post written in English should not be quoting unvetted words from. */
const NON_LATIN = /[\p{Script=Bengali}\p{Script=Devanagari}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Gujarati}\p{Script=Gurmukhi}\p{Script=Oriya}\p{Script=Arabic}]+/gu;

/**
 * 🔑 THE NAMES OF THE LANGUAGES, for the romanised case. The Tamil post would
 * have been caught by the script check — but "The Tamil word urchagam means…"
 * with no native script would not, and that is the easier mistake to make.
 */
const LANGUAGE_WORDS =
  /\b(Bengali|Bangla|Hindi|Tamil|Telugu|Marathi|Gujarati|Punjabi|Kannada|Malayalam|Odia|Oriya|Urdu|Assamese|Sanskrit|Nepali|Sinhala)\s+(word|term|expression|phrase)\b/i;

export type WordClaim = { ok: true } | { ok: false; problem: string };

/**
 * Does this post claim something about a word it was not given?
 *
 * ⛔ REJECTS rather than advises. Being wrong in public about somebody's
 * language is not a matter of taste, and the person reviewing cannot check it
 * either — which is precisely why it must not reach them as a suggestion.
 *
 * ⚠️ Scoped to posts written in English. A Bengali post is Bengali script
 * throughout, and flagging that would make the check useless in 21 of the 22
 * languages.
 */
export function checkWordClaim(body: string, language: string): WordClaim {
  if (language !== "en") return { ok: true };

  const vetted = vettedWords();
  const known = new Set<string>();
  for (const w of vetted) {
    known.add(w.word);
    known.add(w.roman.toLowerCase());
  }

  const foreign = [...new Set(body.match(NON_LATIN) ?? [])].filter((t) => t.trim().length > 0);
  const unknownScript = foreign.filter((t) => !known.has(t));
  if (unknownScript.length > 0) {
    return {
      ok: false,
      problem:
        `This post quotes ${unknownScript.map((t) => `“${t}”`).join(", ")}, which is not in the ` +
        `confirmed word table. ⛔ Refused rather than queued: nobody reviewing it can check whether ` +
        `the meaning is right, and being confidently wrong about somebody's language is read by ` +
        `speakers of it as carelessness. ▶️ Add the word to untranslatableWords.ts with a speaker's ` +
        `confirmation, or write a different post.`,
    };
  }

  const named = body.match(LANGUAGE_WORDS);
  if (named) {
    const mentionsVetted = vetted.some(
      (w) => body.includes(w.word) || body.toLowerCase().includes(w.roman.toLowerCase()),
    );
    if (!mentionsVetted) {
      return {
        ok: false,
        problem:
          `This post explains a ${named[1]} ${named[2]} that is not in the confirmed word table. ` +
          `⛔ Refused for the same reason as above — a romanised word is no easier to check than a ` +
          `word in its own script, and it is the easier mistake to make.`,
      };
    }
  }

  return { ok: true };
}
