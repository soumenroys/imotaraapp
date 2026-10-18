// src/lib/social/voiceGate.ts
// What a post may not say, checked before it can be queued — whether a model
// wrote it or a person did.
//
// 🔴 WHY THIS EXISTS AT ALL. On 17 Oct 2026, eight claims that this product
// must never make were found in copy written by people who knew the rules:
// "expert counselors", "Human Consultation", "therapy alternative", and
// "emotional healing" — the last of which was live on Facebook and Instagram.
// ⇒ trap_marketing_copy_claims_a_regulated_title, four occurrences before this.
//
// ⚠️ SO IT IS NOT A FILTER ON THE MODEL. It is a filter on everything that
// reaches a public channel, us included. A hand-written post goes through the
// identical check for exactly that reason.
//
// ⛔ WHAT IT CANNOT DO. It reads words. It cannot tell whether a post is
// gentle, whether it leaves the reader anything to think, whether it has
// drifted towards one audience, or how it would land on somebody having a bad
// day. Those are read by a person, which is the honest reason a draft waits.

import { REVIEWED_LANGUAGES, isSupportedLanguage } from "@/lib/social/languages";
// ⚠️ `platforms` has no imports of its own, so the gate stays as light as it
// was. It is the single source for every per-channel number below.
import { PLATFORMS, PLATFORM_IDS, type PlatformId } from "@/lib/social/platforms";
import { checkWordClaim } from "@/lib/social/untranslatableWords";

/**
 * ⚠️ `unvetted-word` added 18 Oct. It is not a vocabulary list like the other
 * three — it is the one finding that fires on a FACT the reviewer cannot check
 * either ⇒ src/lib/social/untranslatableWords.ts.
 */
export type GateListId = "clinical" | "abuse" | "careless" | "unvetted-word";

export type GateFinding = {
  list: GateListId;
  /** The pattern that fired, in human terms. */
  rule: string;
  /** What was actually in the text. */
  matched: string;
  /** Why it is a problem, for the reviewer who sees this in the admin. */
  because: string;
};

/**
 * Vocabulary a speaker has contributed since this file was written.
 *
 * 🔑 THE OWNER'S INSTRUCTION, 17 Oct: ship the English list and let "the
 * speaker can enhance this later". ⇒ So the extension point is a parameter and
 * a table (`social_abuse_terms`), not an edit to the constant above. The day
 * somebody who speaks Bengali is willing to spend ten minutes on it is not the
 * day to be waiting on a deploy.
 *
 * ⚠️ The gate itself stays a PURE FUNCTION. The caller reads the table and
 * passes the result in; nothing in this module touches a database, which is
 * what keeps all 101 of its tests able to run without one.
 */
export type GateOverlay = {
  /** language code → extra abuse and profanity terms. */
  abuse?: Record<string, string[]>;
  /** languages a speaker has since read real drafts in. */
  reviewed?: Iterable<string>;
};

export type GateResult = {
  ok: boolean;
  findings: GateFinding[];
  listsRun: GateListId[];
  /** Lists with no authored vocabulary for this language ⇒ nothing was checked. */
  listsUnavailable: GateListId[];
  language: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. CLINICAL CLAIMS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single words that are never an honest self-description for this product.
 *
 * ⚠️ Note what is NOT here, and why each omission is deliberate:
 *   • "treat"   — "treat yourself kindly" is the register we want. Banned as a
 *                 phrase below instead ("treats anxiety").
 *   • "patient" — "be patient with yourself" is a sentence worth writing.
 *                 Banned as a noun below ("our patients").
 *   • "mental"  — "mental health" is the category we are in. Banning the word
 *                 would make the gate fire on every honest post.
 *   • "doctor"  — appears innocently far too often to word-match usefully.
 * 🔑 A gate that fires on good sentences gets switched off. Precision is not a
 * nicety here, it is what keeps it running.
 */
const CLINICAL_TITLES: { word: string; because: string }[] = [
  { word: "therapist", because: "a regulated title; the companions here are peers, not clinicians" },
  { word: "therapists", because: "a regulated title" },
  { word: "counsellor", because: "a regulated title — 'expert counselors' was live copy on 17 Oct" },
  { word: "counselor", because: "a regulated title — 'expert counselors' was live copy on 17 Oct" },
  { word: "counsellors", because: "a regulated title" },
  { word: "counselors", because: "a regulated title" },
  { word: "counselling", because: "names a regulated service this product does not provide" },
  { word: "counseling", because: "names a regulated service this product does not provide" },
  { word: "psychologist", because: "a regulated title" },
  { word: "psychologists", because: "a regulated title" },
  { word: "psychiatrist", because: "a regulated title" },
  { word: "psychiatrists", because: "a regulated title" },
  { word: "clinician", because: "a regulated title" },
  { word: "clinicians", because: "a regulated title" },
  { word: "clinical", because: "implies a clinical standard nothing here has been tested against" },
  { word: "clinically", because: "implies a clinical standard nothing here has been tested against" },
  { word: "diagnose", because: "the product does not diagnose, and says so in 22 languages" },
  { word: "diagnoses", because: "the product does not diagnose" },
  { word: "diagnosis", because: "the product does not diagnose" },
  { word: "prescribe", because: "nothing here prescribes anything" },
  { word: "prescription", because: "nothing here prescribes anything" },
  { word: "heal", because: "'emotional healing' was live on Facebook and Instagram until 17 Oct" },
  { word: "healer", because: "claims a role this product does not have" },
  { word: "healers", because: "claims a role this product does not have" },
  { word: "cure", because: "nothing here cures anything" },
  { word: "cured", because: "nothing here cures anything" },
  { word: "curing", because: "nothing here cures anything" },
  { word: "diagnosing", because: "the product does not diagnose" },

  /**
   * 🔴 THE WORDS THAT SLIPPED PAST THE FIRST VERSION, and the most clinical
   * ones available. "psychotherapist" contains "therapist" and did not match
   * it, because the letter before it is a letter — so the list's most serious
   * entry was defeated by a four-letter prefix.
   *
   * ⚠️ Note what is still absent: bare "therapy". "If you need therapy, find
   * someone qualified" is a sentence this brand should be able to write, and
   * banning the word would stop it. The ban is on claiming the role, not on
   * naming the thing ⇒ the same line the markup guard draws.
   */
  { word: "psychotherapy", because: "names a regulated service this product does not provide" },
  { word: "psychotherapist", because: "a regulated title, and it hides inside a word the list already had" },
  { word: "psychotherapists", because: "a regulated title" },
  { word: "therapeutic", because: "claims a therapeutic effect nothing here has been tested for" },
  { word: "therapeutically", because: "claims a therapeutic effect nothing here has been tested for" },

  /**
   * ⚠️ The plural and the possessive only. Bare "patient" stays allowed
   * because "be patient with yourself" is worth writing — and neither
   * "patients" nor "patient's" has an innocent reading, since the adjective
   * has no plural and no possessive.
   */
  { word: "patients", because: "the people here are not patients" },
  { word: "patient's", because: "the people here are not patients" },
];

/**
 * Multi-word claims. Several of these are the exact strings found in shipped
 * copy, kept verbatim so the gate recognises the real mistake and not a
 * paraphrase of it.
 */
const CLINICAL_PHRASES: { phrase: string; because: string }[] = [
  { phrase: "therapy alternative", because: "found in site metadata 17 Oct; an assistant lifts a keyword with no page around it" },
  { phrase: "alternative to therapy", because: "offers the product as a stand-in for professional care" },
  { phrase: "replace therapy", because: "offers the product as a stand-in for professional care" },
  { phrase: "replacement for therapy", because: "offers the product as a stand-in for professional care" },
  { phrase: "instead of therapy", because: "offers the product as a stand-in for professional care" },
  { phrase: "therapy at home", because: "offers the product as a stand-in for professional care" },
  { phrase: "online therapy", because: "names a regulated service this product does not provide" },
  { phrase: "free therapy", because: "names a regulated service this product does not provide" },
  { phrase: "ai therapy", because: "names a regulated service this product does not provide" },
  { phrase: "human consultation", because: "the exact phrase found on the Facebook cover, 17 Oct" },
  { phrase: "expert counsel", because: "claims an expertise and a regulated role" },
  { phrase: "mental health care", because: "'care' is the regulated part; this is support, not care" },
  { phrase: "mental healthcare", because: "'care' is the regulated part; this is support, not care" },
  { phrase: "treats anxiety", because: "a treatment claim" },
  { phrase: "treats depression", because: "a treatment claim" },
  { phrase: "treat anxiety", because: "a treatment claim" },
  { phrase: "treat depression", because: "a treatment claim" },
  { phrase: "treatment for", because: "a treatment claim" },
  { phrase: "cure for", because: "a cure claim" },
  { phrase: "our patients", because: "the people here are not patients" },
  { phrase: "the patient", because: "the people here are not patients" },
  { phrase: "a patient's", because: "the people here are not patients" },
  { phrase: "medical advice", because: "nothing here is medical advice" },
  { phrase: "proven to reduce", because: "an efficacy claim nothing here has been tested for" },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. ABUSE AND PROFANITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⛔ AUTHORED PER LANGUAGE, AND ONLY WHERE IT CAN BE AUTHORED HONESTLY.
 *
 * 🔴 The temptation here is to write a list for all 22 and feel covered. That
 * would be the worst outcome available: a wrong list in a language nobody here
 * reads is invisibly wrong, and it reports "checked" while checking nothing.
 * It is the same shape as the Urdu and Kannada spelling defects — every file
 * internally consistent, and the error only visible between them.
 *
 * ⇒ So: a language with no authored list is reported as UNCHECKED, loudly, and
 * `canAutoPublishIn()` refuses it. In practice that means unattended posting is
 * English-only until a speaker contributes a list for their language.
 *
 * ⚠️ Transliteration matters as much as script. Abuse in Indic languages is
 * written in Latin letters at least as often as in its own script, so each
 * language's list must carry both forms. An English-only check on a Bengali
 * post checks nothing at all.
 */
const ABUSE_BY_LANGUAGE: Record<string, string[]> = {
  en: [
    "fuck", "fucking", "shit", "bullshit", "bastard", "bitch", "asshole",
    "arsehole", "dickhead", "prick", "cunt", "slut", "whore", "retard",
    "retarded", "moron", "idiot", "stupid", "pathetic", "loser", "freak",
    "scum", "worthless", "useless", "shut up", "damn you", "go to hell",
  ],
  // ⬜ bn, hi and the other 19: not authored. See the note above — an invented
  // list here would be worse than none, because it would report success.
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. CARELESS LANGUAGE — the list an ordinary profanity filter does not have
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 THE LIST MOST LIKELY TO FIRE HERE, and the one that matters most.
 *
 * Nothing below is profanity. Every item is ordinary, well-meant English that
 * is fine almost anywhere else — and wrong on a page about how people feel.
 * "Crazy good" is the sentence that gets screenshot.
 *
 * Grouped so the reviewer sees *why*, not just *what*.
 */
const CARELESS_IDIOM: { rule: string; patterns: string[]; because: string }[] = [
  {
    rule: "a condition used as a casual intensifier",
    patterns: ["crazy", "insane", "insanely", "insanity", "psycho", "schizo", "lunatic", "nutcase", "deranged", "unhinged"],
    because: "borrows a condition people actually live with to mean 'very'. On this page, from us, it reads as contempt",
  },
  {
    rule: "a diagnosis used as a personality trait",
    patterns: ["ocd about", "so ocd", "a bit bipolar", "so bipolar", "my ocd"],
    because: "turns a diagnosis into a quirk, in front of people who have it",
  },
  {
    rule: "'triggered' used loosely",
    patterns: ["triggered by how", "so triggered", "gets me triggered"],
    because: "the word has a specific meaning to the people this product is for",
  },
  {
    rule: "unsafe suicide phrasing",
    patterns: ["commit suicide", "committed suicide", "commits suicide", "successful suicide", "failed suicide", "failed attempt"],
    because: "'commit' frames it as a crime and 'successful' as an achievement. Safe-messaging guidance is 'died by suicide'. ⚠️ This matters more here than anywhere: the app shows a helpline when it detects crisis language, and the voice on the channel has to match that seriousness",
  },
  {
    rule: "urgency, scarcity or streak language",
    patterns: ["don't miss out", "dont miss out", "last chance", "limited time", "act now", "hurry", "keep your streak", "don't break your streak", "only today"],
    because: "the product has no feed, no streak and no badge on purpose. Copy that manufactures urgency contradicts the thing being sold",
  },
  {
    rule: "guilt or shame aimed at the reader",
    patterns: ["you owe yourself", "no excuses", "stop making excuses", "stop feeling sorry", "man up", "just get over it", "snap out of it"],
    because: "blames the reader for the state they are in, which is the opposite of the register",
  },
  {
    rule: "a manufactured engagement prompt",
    patterns: ["what do you think?", "thoughts?", "comment below", "tag someone who", "drop a", "let us know in the comments", "double tap if"],
    because: "an open ending is a thought left standing, not a question begged. This is the tell of copy written for a feed",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Matching
// ─────────────────────────────────────────────────────────────────────────────

/** Clause boundaries. A negation only excuses a term inside its own clause. */
const CLAUSE_BREAK = /[.;!?\n]/;

/**
 * Words that turn a claim into a denial.
 *
 * 🔑 THIS IS WHY THE GATE NEEDS CONTEXT AT ALL. "It is not therapy" and
 * "Peer companions, not clinicians" are the two most important sentences this
 * brand says, and a blunt word match flags both as violations. That exact
 * false positive happened on 17 Oct — a banner guard rejected its own
 * disclaimer. ⇒ trap_blunt_fix_trades_one_failure_for_its_opposite
 *
 * ⛔ "instead of" and "alternative to" are NOT negators, deliberately: they
 * are how the substitute claim is usually phrased. But "we are not an
 * alternative to therapy" is still correctly excused, because "not" appears
 * earlier in the same clause.
 */
/**
 * ⚠️ CONTRACTIONS ARE LISTED WITHOUT THEIR APOSTROPHE, because `isDenied`
 * strips apostrophes before matching — so "doesn't" arrives as "doesnt". An
 * earlier version also carried an `"n't"` entry with a special branch to handle
 * it, which could never fire for exactly that reason. ⛔ Dead code that looks
 * like a general mechanism is worse than a missing case: the next person reads
 * it and assumes every contraction is covered.
 */
const NEGATORS = [
  "not", "never", "no", "nor", "neither", "cannot", "cant", "isnt", "arent",
  "wasnt", "werent", "doesnt", "dont", "didnt", "wont", "wouldnt", "shouldnt",
  "couldnt", "havent", "hasnt", "aint", "without", "far from",
  // ⚠️ The pronoun negators were missing in the first version, and the test
  // caught it on "Nobody here is a therapist." — a sentence this brand
  // genuinely says. `no` does not match inside `nobody`, which is correct for
  // word matching and wrong for meaning, so each one needs naming.
  "nothing", "nobody", "no one", "noone", "none",
];

function clauseBefore(text: string, index: number): string {
  let start = 0;
  for (let i = index - 1; i >= 0; i--) {
    if (CLAUSE_BREAK.test(text[i])) {
      start = i + 1;
      break;
    }
  }
  return text.slice(start, index);
}

function isDenied(lower: string, index: number): boolean {
  const before = clauseBefore(lower, index).replace(/'/g, "");
  return NEGATORS.some((n) => new RegExp(`(^|[^a-z])${n}([^a-z]|$)`).test(before));
}

/**
 * What the matcher actually reads.
 *
 * 🔴 FOUR HOLES CLOSED HERE, every one of them from ordinary pasted text rather
 * than from anybody trying to defeat anything:
 *   • a ZERO-WIDTH SPACE inside a word — "thera<ZWSP>pist" looks identical on
 *     screen and matched nothing. Design tools, PDFs and chat windows all emit
 *     them.
 *   • a SOFT HYPHEN, same shape, from anything that was once justified text.
 *   • a NON-BREAKING SPACE between the words of a phrase.
 *   • a CURLY APOSTROPHE, which every word processor inserts by default, so
 *     "patient’s" and "patient's" were two different strings.
 *
 * ⚠️ Normalising is not cosmetic here. An invisible character is the one way a
 * banned phrase can be in a published post while the gate reports it clean —
 * and nobody reviewing the draft would see anything wrong either.
 */
function normaliseForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "")
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    // ⛔ NO GENERAL WHITESPACE FOLD HERE, and that is deliberate. An earlier
    // version carried `.replace(/\s/g, " ")`, which looked harmless and did
    // two things. Nothing useful — NFKC already maps a non-breaking space to a
    // plain one, and the phrase matcher joins on `\s+` — and one harmful thing:
    // it flattened NEWLINES, which are clause boundaries. A post reading
    // "Not therapy" then "Our therapist is here" on the next line became one
    // clause, the denial reached across the line break, and the claim was
    // excused.
    // ⚠️ Found by a mutation run: deleting the line broke no test, which is the
    // only reason it was noticed ⇒ trap_mutation_harness_can_report_false_caught.
    .toLowerCase();
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Common inflections, so the list does not have to carry every form.
 *
 * ⚠️ Deliberately short. "heal" plus this group reaches healed, heals and
 * healing and stops short of "healthy" — which must keep passing, because
 * "a healthy amount of sleep" is a sentence this brand wants to write. A
 * greedier group, or substring matching, would flag it.
 */
const INFLECTIONS = "(?:s|es|ed|ing|ly)?";

/**
 * Every position a single word appears at, as a whole word.
 *
 * 🔴 THE HOLE THIS CLOSES, and it was the worst one. The matcher used to find
 * the FIRST occurrence and ask whether that one was denied — so a post reading
 * "Not a therapist. Our therapist will see you now." passed cleanly. That is
 * the most likely real shape of the mistake, because everyone writing here
 * knows to put the disclaimer in first.
 */
type Occurrence = { at: number; surface: string };

function findAllWord(lower: string, word: string): Occurrence[] {
  const re = new RegExp(`(?<![a-z])${escapeRe(word)}${INFLECTIONS}(?![a-z])`, "g");
  return [...lower.matchAll(re)].map((m) => ({ at: m.index, surface: m[0] }));
}

/** Every position a phrase appears at, tolerant of any run of whitespace. */
function findAllPhrase(lower: string, phrase: string): Occurrence[] {
  const pattern = phrase.split(/\s+/).map(escapeRe).join("\\s+");
  return [...lower.matchAll(new RegExp(pattern, "g"))].map((m) => ({ at: m.index, surface: m[0] }));
}

/**
 * The first occurrence that is NOT denied in its own clause, or null.
 *
 * 🔑 "Any occurrence" rather than "the first occurrence" is the whole fix: a
 * term is a finding if a single appearance is an unqualified claim, and a post
 * that denies it every time stays clean.
 *
 * ⚠️ It returns the SURFACE form, not the list entry. The `matched` field says
 * it is what was in the text, and a reviewer shown "heal" when they wrote
 * "heals" has to go hunting. Reporting the list entry made that field a lie —
 * caught by a test that had passed before the matcher was rewritten, which is
 * the only reason it was noticed.
 */
function firstClaim(lower: string, occurrences: Occurrence[]): Occurrence | null {
  return occurrences.find((o) => !isDenied(lower, o.at)) ?? null;
}

/**
 * Run every applicable list over a piece of text.
 *
 * `text` should be everything a reader will see — subject, body, and any words
 * destined for the picture. ⛔ The composer must never put a word into an image
 * that was not in the text handed to this function: the gate cannot read a
 * picture, so the picture may only contain words it has already read.
 */
export function checkVoice(text: string, language: string, overlay?: GateOverlay): GateResult {
  if (!isSupportedLanguage(language)) {
    throw new Error(`voiceGate: ${language} is not one of the 22 languages this product speaks.`);
  }

  const lower = normaliseForMatch(text);
  const findings: GateFinding[] = [];
  const listsRun: GateListId[] = [];
  const listsUnavailable: GateListId[] = [];

  /** One finding per term, however many times it appears. A reviewer reading
   *  forty copies of the same line stops reading, which costs more than it saves. */
  const seen = new Set<string>();
  const add = (key: string, f: GateFinding) => {
    // ⚠️ Deduped on the LIST ENTRY, not on the surface form, so "heals" and
    // "healing" in one post report once rather than twice.
    if (seen.has(key)) return;
    seen.add(key);
    findings.push(f);
  };

  // ── Clinical. Runs for every language: the vocabulary is English, and
  // English clinical words turn up inside otherwise non-English marketing copy
  // constantly ("AI therapist" in a Hindi post). Checking it everywhere costs
  // nothing and catches the common case.
  listsRun.push("clinical");
  for (const { word, because } of CLINICAL_TITLES) {
    const claim = firstClaim(lower, findAllWord(lower, word));
    if (claim) {
      add(`clinical:${word}`, {
        list: "clinical",
        rule: `the word “${word}”`,
        matched: claim.surface,
        because,
      });
    }
  }
  for (const { phrase, because } of CLINICAL_PHRASES) {
    const claim = firstClaim(lower, findAllPhrase(lower, phrase));
    if (claim) {
      add(`clinical:${phrase}`, {
        list: "clinical",
        rule: `the phrase “${phrase}”`,
        matched: claim.surface,
        because,
      });
    }
  }

  // ── Abuse. Only where there is an authored list for this language.
  const abuse = abuseTermsFor(language, overlay);
  if (abuse.length > 0) {
    listsRun.push("abuse");
    for (const term of abuse) {
      const found = term.includes(" ") ? findAllPhrase(lower, term) : findAllWord(lower, term);
      if (found.length > 0) {
        add(`abuse:${term}`, {
          list: "abuse",
          rule: `the word “${term}”`,
          matched: found[0].surface,
          because: "abusive or demeaning, and never in this voice",
        });
      }
    }
  } else {
    listsUnavailable.push("abuse");
  }

  // ── Careless language. English vocabulary, so it is only a real check on an
  // English post; reported as unavailable elsewhere rather than pretended.
  if (language === "en") {
    listsRun.push("careless");
    for (const group of CARELESS_IDIOM) {
      for (const p of group.patterns) {
        const occurrences =
          p.includes(" ") || p.includes("?") ? findAllPhrase(lower, p) : findAllWord(lower, p);
        const claim = firstClaim(lower, occurrences);
        if (claim) {
          add(`careless:${p}`, {
            list: "careless",
            rule: group.rule,
            matched: claim.surface,
            because: group.because,
          });
        }
      }
    }
  } else {
    listsUnavailable.push("careless");
  }

  /**
   * 🔴 THE ONE CHECK THAT IS NOT ABOUT WORDS WE FORBID, but about a claim
   * nobody here can verify. The first post the untranslatable angle produced
   * glossed a Tamil word wrongly and confidently, and would have passed every
   * list above ⇒ src/lib/social/untranslatableWords.ts.
   */
  const claim = checkWordClaim(text, language);
  if (!claim.ok) {
    findings.push({
      list: "unvetted-word",
      rule: "a foreign word must come from the confirmed table",
      matched: text.slice(0, 120),
      because: claim.problem,
    });
    listsRun.push("unvetted-word");
  } else if (language === "en") {
    listsRun.push("unvetted-word");
  }

  return { ok: findings.length === 0, findings, listsRun, listsUnavailable, language };
}

/**
 * May a schedule post in this language with nobody reading it first?
 *
 * TWO conditions, and both are about us rather than about the language:
 *   1. somebody here can read it, so a bad draft would be noticed, and
 *   2. the abuse list for it has actually been written, so "no abusive words"
 *      is a check and not a hope.
 *
 * ⚠️ Condition 2 currently fails for Bengali and Hindi even though condition 1
 * passes. That is correct and not an oversight: the owner's instruction was
 * that posts carry no abusive words, and in those two languages nothing here
 * can yet verify that. ▶️ The fix is a dozen words from a speaker, not code.
 */
export function abuseTermsFor(language: string, overlay?: GateOverlay): string[] {
  const authored = ABUSE_BY_LANGUAGE[language] ?? [];
  const contributed = overlay?.abuse?.[language] ?? [];
  // Deduped and lowercased, because a contributed list is typed by a person.
  return [...new Set([...authored, ...contributed].map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

export function canAutoPublishIn(
  language: string,
  overlay?: GateOverlay,
): { ok: boolean; reason?: string } {
  if (!isSupportedLanguage(language)) {
    return { ok: false, reason: `${language} is not one of the 22 languages this product speaks.` };
  }
  const reviewed = new Set<string>([...REVIEWED_LANGUAGES, ...(overlay?.reviewed ?? [])]);
  if (!reviewed.has(language)) {
    return {
      ok: false,
      reason:
        `Nobody here reads ${language} yet, so a post that sounded like a translation — or worse — ` +
        `would go out unnoticed. It can be written, pictured and queued; it waits for a person.`,
    };
  }
  if (abuseTermsFor(language, overlay).length === 0) {
    return {
      ok: false,
      reason:
        `There is no abuse-and-profanity list for ${language}, so that check does not run. ` +
        `An invented list would report "checked" while checking nothing, which is worse than none. ` +
        `A speaker contributing one moves this language to unattended posting.`,
    };
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// House style — mechanical, and separate from the gate on purpose
// ─────────────────────────────────────────────────────────────────────────────

export type HouseStyleResult = {
  ok: boolean;
  problems: string[];
  characters: number;
  emoji: number;
  hashtags: number;
  links: number;
  /** Which machine-written tells were found, if any. */
  aiTells: string[];
};

/**
 * 🔴 THE PHRASES THAT ANNOUNCE A MACHINE WROTE IT.
 *
 * The owner, 18 Oct: *"try to be more humanized than AI generated content"*.
 * ⛔ That cannot live only in the prompt. A model asked to sound human still
 * reaches for these, because they are the median of what it was trained on —
 * and this codebase's own rule is that a prompt is an instruction while
 * anything that must be true is checked afterwards ⇒ src/lib/social/writer.ts.
 *
 * ⚠️ WHAT THESE HAVE IN COMMON, so the list can be extended honestly: every
 * one is a phrase that fills the shape of a sentence without committing to
 * anything. They are not banned for being unfashionable — they are banned
 * because a post built from them says nothing, and a post that says nothing is
 * scrolled past, which is the reach problem underneath the style problem.
 *
 * ⛔ NOT a list of "AI words". `delve`, `realm` and the rest of that folklore
 * are ordinary English and are deliberately absent: banning real words makes
 * the writing worse, which is the opposite of the point.
 */
export const AI_TELLS: string[] = [
  // Openings that clear the throat instead of starting.
  "in today's fast-paced world",
  "in today's world",
  "in a world where",
  "we all know that",
  "let's face it",
  "let's be honest",
  "let's dive in",
  "let's talk about",
  "it's no secret that",
  "picture this",
  // The shapes that sound like a conclusion without being one.
  "at the end of the day",
  "it's important to remember",
  "it's worth remembering",
  "the truth is",
  "here's the thing",
  "that's where we come in",
  "that's where imotara comes in",
  // Brochure vocabulary.
  "game-changer",
  "game changer",
  "unlock the power",
  "unlock your",
  "take it to the next level",
  "elevate your",
  "embark on",
  "navigate the journey",
  "transformative journey",
  "revolutionize",
  "revolutionise",
  "seamless experience",
  "empowering you to",
  "dive deep into",
  // The balanced constructions a person almost never speaks.
  "not just a",
  "not just another",
  "whether you're",
  "whether you are",
  "more than just",
  // Engagement bait, which Meta demotes by policy — a reach rule, not taste.
  "tag a friend",
  "comment below",
  "double tap if",
  "share if you agree",
  "drop a ❤️",
  "like and share",
];

/**
 * ⚠️ Case-insensitive and apostrophe-insensitive, because a curly apostrophe
 * is what a model actually emits and `it's` would otherwise never match
 * `it’s` — a list that silently matches nothing is worse than no list.
 */
function normaliseForTells(text: string): string {
  return text.toLowerCase().replace(/[’‘`´]/g, "'").replace(/\s+/g, " ");
}

export function findAiTells(text: string): string[] {
  const hay = normaliseForTells(text);
  return AI_TELLS.filter((t) => hay.includes(normaliseForTells(t)));
}

/**
 * 🔴 COUNT WHAT A READER SEES, WHICH IS GRAPHEMES — NOT CODE POINTS.
 *
 * `\p{Extended_Pictographic}` counts 👩‍👩‍👧 as **three**, because it is three
 * people joined by zero-width joiners. A skin-toned 👋🏽 counts as two. A flag
 * 🇮🇳 is two regional indicators.
 *
 * ⛔ THIS WAS HARMLESS UNTIL IT WASN'T. While the rule was "no emoji at all",
 * over-counting changed nothing — one or three, both are more than zero. The
 * moment the rule became "at most one", the same code started rejecting a
 * single ordinary emoji as three, and the only post it would have hit is one
 * written by somebody using the kind of emoji that names a family or a country
 * ⇒ trap_blunt_fix_trades_one_failure_for_its_opposite.
 *
 * ⚠️ The test that was supposed to catch this was called "counts a
 * multi-codepoint emoji as one" and asserted `toBeGreaterThan(0)`. It did not
 * test its own title, and it passed for weeks.
 */
export function countEmoji(text: string): number {
  /**
   * ⛔ `Extended_Pictographic` ALONE MISSES EVERY FLAG. 🇮🇳 is two Regional
   * Indicator letters and carries no pictographic code point at all, so the
   * old counter scored it ZERO — a caption made entirely of flags passed a
   * rule that said "no emoji". Nothing tested it, in either direction.
   */
  const emojiish = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    let n = 0;
    for (const { segment } of new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text)) {
      if (emojiish.test(segment)) n += 1;
    }
    return n;
  }
  // ⚠️ Fallback only. Over-counts joined sequences, which is the bug above —
  // but a runtime without Intl.Segmenter is a runtime where silently counting
  // nothing would be worse.
  return (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;
}

/**
 * 🔴 THIS WAS A SECOND COPY OF THE PLATFORM LIMITS and it had already drifted:
 * it carried no `youtube` row at all, so a YouTube post was the one kind this
 * check never measured — it fell through `Object.hasOwn` and reported nothing,
 * which looks exactly like passing.
 *
 * ⛔ It also held LinkedIn's fold at 1300, which is wrong by a factor of six.
 * Two copies of a number do not disagree loudly; they disagree silently, and
 * the one you are not reading is the one in use ⇒ the same shape as the five
 * copies of the content-type list ⇒ src/lib/social/contentTypes.ts.
 *
 * ⚠️ Kept as a named export because callers and tests use it; it is now a view
 * of `PLATFORMS` rather than a rival to it.
 */
export const PLATFORM_LIMITS: Record<string, { hard: number; soft: number }> =
  Object.fromEntries(PLATFORM_IDS.map((id) => [id, PLATFORMS[id].limits]));

/**
 * The countable rules, PER CHANNEL.
 *
 * 🔴 THEY USED TO BE GLOBAL, and the global values were costing reach for no
 * safety reason — zero emoji anywhere, two hashtags everywhere (too few for
 * Instagram, too many for Facebook where they do nothing), and one link
 * allowed in a body where Facebook and LinkedIn both demote it and Instagram
 * does not even make it clickable. The owner's instruction on 18 Oct was to
 * take out anything that costs reach and is not there for safety.
 *
 * ⛔ WHAT DID NOT MOVE, and must not: the clinical vocabulary, the crisis
 * language, the abuse lists and the no-invented-people rule all live in
 * `checkVoice` and are untouched by any of this. They are not style, and
 * reach is not a reason to relax one of them.
 *
 * ⚠️ Still kept out of `checkVoice` because these are advice a person may
 * knowingly overrule, while the gate's lists are not.
 */
export function checkHouseStyle(text: string, platform: string): HouseStyleResult {
  const problems: string[] = [];
  const emoji = countEmoji(text);
  const hashtags = (text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;
  const links = (text.match(/https?:\/\/\S+/g) ?? []).length;
  const characters = [...text].length;

  // ⚠️ `hasOwn`, not a bare index: `PLATFORMS["constructor"]` returns
  // something truthy off the prototype, and every comparison below would then
  // read `undefined` and quietly report nothing — which looks like passing.
  const spec = Object.hasOwn(PLATFORMS, platform) ? PLATFORMS[platform as PlatformId] : undefined;

  if (!spec) {
    // ⛔ An unknown channel is not silently waved through. Reporting nothing
    // is the failure mode this whole function exists to avoid.
    problems.push(`${platform} is not a channel this product knows, so nothing could be checked.`);
    return { ok: false, problems, characters, emoji, hashtags, links, aiTells: [] };
  }

  if (emoji > spec.emoji) {
    problems.push(
      spec.emoji === 0
        ? `${emoji} emoji — none on ${spec.label}.`
        : `${emoji} emoji — at most ${spec.emoji} on ${spec.label}, and it should be one a person ` +
          `would actually type, never decoration.`,
    );
  }

  if (hashtags > spec.hashtags) {
    problems.push(
      spec.hashtags === 0
        ? `${hashtags} hashtags — none on ${spec.label}; they do nothing here and read as advertising.`
        : `${hashtags} hashtags — at most ${spec.hashtags} on ${spec.label}.`,
    );
  }

  if (!spec.linksInBody && links > 0) {
    problems.push(
      `${links} link${links === 1 ? "" : "s"} in the body — ⛔ none on ${spec.label}. ` +
        `It sends people off-platform, which costs the post most of its reach` +
        (platform === "instagram" ? ", and Instagram does not make it clickable anyway." : "."),
    );
  } else if (spec.linksInBody && links > 1) {
    problems.push(`${links} links — one, so the reader knows which one matters.`);
  }

  if (characters > spec.limits.hard) {
    problems.push(`${characters} characters — ${spec.label} will not accept more than ${spec.limits.hard}.`);
  } else if (characters > spec.limits.soft) {
    problems.push(
      `${characters} characters — ${spec.label} folds the post at about ${spec.limits.soft}, so the ` +
        `rest is behind "see more".`,
    );
  }

  const aiTells = findAiTells(text);
  if (aiTells.length > 0) {
    problems.push(
      `Reads as machine-written: ${aiTells.map((t) => `“${t}”`).join(", ")}. ` +
        `▶️ Say it the way you would say it to one person.`,
    );
  }

  return { ok: problems.length === 0, problems, characters, emoji, hashtags, links, aiTells };
}

/** Exported for the tests, and so the admin can show the reviewer what ran. */
export const GATE_VOCABULARY = {
  CLINICAL_TITLES,
  CLINICAL_PHRASES,
  ABUSE_BY_LANGUAGE,
  CARELESS_IDIOM,
  NEGATORS,
};
