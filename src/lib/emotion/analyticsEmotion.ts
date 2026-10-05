// src/lib/emotion/analyticsEmotion.ts
//
// The emotion label recorded on usage_events, for the EDU/NGO aggregate
// "mindset trend" in the org admin dashboard.
//
// ─────────────────────────────────────────────────────────────────────────────
// ⛔ THIS MODULE MUST NEVER REACH THE REPLY PROMPT.
//
// Owner ruling 2026-10-05, verbatim: "at any cost the reply quality and user
// experience should not be degraded. time is not critical, quality is."
//
// `/api/chat-reply` builds its system prompt from `body.emotion` (the hint the
// CLIENT sends). This module derives a SEPARATE value, used only inside the
// fire-and-forget usage_events insert. The two never meet, so the model's
// input is byte-identical whether or not this module exists — reply safety by
// construction, not by testing. `src/__tests__/analyticsEmotionIsPromptBlind.test.ts`
// fails the build if that separation is ever broken.
// ─────────────────────────────────────────────────────────────────────────────
//
// WHY THIS EXISTS AT ALL (measured on production, 30 days, 2026-10-05):
// 422 chat replies carried only 27 emotion labels — 6.4%. The server never
// inferred emotion; it recorded only what a client sent, and web sends none.
// Worse, every per-language keyword map covers five NEGATIVE categories only
// (sad/stress/anger/fear/confused), so a positive label was unreachable from
// text — an NGO's wellbeing trend could show how much pain existed but never
// that it was easing, which is the one thing an NGO needs to evidence.

import {
  // Negative, per language — 15 languages, already in the codebase.
  TE_SAD_REGEX, TE_STRESS_REGEX, TE_ANGER_REGEX, TE_FEAR_REGEX, TE_CONFUSED_REGEX,
  GU_SAD_REGEX, GU_STRESS_REGEX, GU_ANGER_REGEX, GU_FEAR_REGEX, GU_CONFUSED_REGEX,
  TA_SAD_REGEX, TA_STRESS_REGEX, TA_ANGER_REGEX, TA_FEAR_REGEX, TA_CONFUSED_REGEX,
  BN_SAD_REGEX, BN_STRESS_REGEX, BN_ANGER_REGEX, BN_FEAR_REGEX, BN_CONFUSED_REGEX,
  HI_SAD_REGEX, HI_STRESS_REGEX, HI_ANGER_REGEX, HI_FEAR_REGEX, HI_CONFUSED_REGEX,
  KN_SAD_REGEX, KN_STRESS_REGEX, KN_ANGER_REGEX, KN_FEAR_REGEX, KN_CONFUSED_REGEX,
  ML_SAD_REGEX, ML_STRESS_REGEX, ML_ANGER_REGEX, ML_FEAR_REGEX, ML_CONFUSED_REGEX,
  PA_SAD_REGEX, PA_STRESS_REGEX, PA_ANGER_REGEX, PA_FEAR_REGEX, PA_CONFUSED_REGEX,
  OR_SAD_REGEX, OR_STRESS_REGEX, OR_ANGER_REGEX, OR_FEAR_REGEX, OR_CONFUSED_REGEX,
  MR_SAD_REGEX, MR_STRESS_REGEX, MR_ANGER_REGEX, MR_FEAR_REGEX, MR_CONFUSED_REGEX,
  JP_SAD_REGEX, JP_STRESS_REGEX, JP_ANGER_REGEX, JP_FEAR_REGEX, JP_CONFUSED_REGEX,
  HE_SAD_REGEX, HE_STRESS_REGEX, HE_ANGER_REGEX, HE_FEAR_REGEX, HE_CONFUSED_REGEX,
  AR_SAD_REGEX, AR_STRESS_REGEX, AR_ANGER_REGEX, AR_FEAR_REGEX, AR_CONFUSED_REGEX,
  DE_SAD_REGEX, DE_STRESS_REGEX, DE_ANGER_REGEX, DE_FEAR_REGEX, DE_CONFUSED_REGEX,
  // English helpers + cross-language signals.
  isSadText, isStressText, isConfusedText,
  CRISIS_HINT_REGEX, LONELY_WANTS_COMPANY_REGEX,
} from "./keywordMaps";

// ── The canonical vocabulary ──────────────────────────────────────────────────
//
// 🔑 Deliberately the labels ALREADY in the usage_events column ("sad",
// "stressed") and in /api/chat-reply's own emotionDescriptions map, NOT
// analyzeLocal's palette ("sadness", "anxiety", …). Three vocabularies were in
// play; writing a fourth — or switching to analyzeLocal's — would have given the
// NGO chart two bars for one feeling and required a data migration. This way
// every legacy row stays valid.
export const ANALYTICS_EMOTIONS = [
  // negative
  "sad", "stressed", "anxious", "angry", "afraid", "lonely", "hopeless", "confused",
  // positive
  "joy", "grateful", "hopeful", "calm",
  // neither
  "neutral",
] as const;

export type AnalyticsEmotion = (typeof ANALYTICS_EMOTIONS)[number];

// ── Polarity: what makes the trend a LINE that can go UP ──────────────────────
//
// Category counts alone cannot show improvement — an NGO needs "are our people
// doing better than last month". Averaging polarity over a period gives that in
// one number. Precedent: analyzeLocal's POLARITY_WEIGHT, same -1..+1 scale.
export const EMOTION_POLARITY: Record<AnalyticsEmotion, number> = {
  joy:      +1,
  grateful: +0.9,
  hopeful:  +0.7,
  calm:     +0.5,
  neutral:   0,
  confused: -0.4,
  anxious:  -0.6,
  stressed: -0.7,
  afraid:   -0.8,
  lonely:   -0.8,
  angry:    -0.9,
  sad:      -1,
  hopeless: -1,
};

// ── Legacy / alias normalisation ──────────────────────────────────────────────
//
// Rows already in the column, plus anything a client may still send, plus
// analyzeLocal's palette — all folded onto one canonical label so the chart
// never double-counts. Unknown values return null and are simply not counted,
// which is better than inventing a thirteenth bar.
const ALIASES: Record<string, AnalyticsEmotion> = {
  // analyzeLocal palette
  sadness: "sad", anger: "angry", fear: "afraid", anxiety: "anxious",
  gratitude: "grateful", surprise: "neutral", disgust: "angry",
  // emotionDescriptions + observed production values
  sad: "sad", stressed: "stressed", anxious: "anxious", angry: "angry",
  lonely: "lonely", hopeless: "hopeless", confused: "confused", joy: "joy",
  hopeful: "hopeful", calm: "calm", grateful: "grateful", afraid: "afraid",
  neutral: "neutral",
  // loose synonyms seen in client code over time
  stress: "stressed", worried: "anxious", scared: "afraid", happy: "joy",
  peaceful: "calm", relieved: "calm", excited: "joy", tired: "stressed",
};

/**
 * Fold any historical or client-supplied value onto the canonical vocabulary.
 * Returns null for empty / unrecognised input, so callers can skip it rather
 * than charting a label nobody defined.
 */
export function normaliseAnalyticsEmotion(raw: string | null | undefined): AnalyticsEmotion | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  if (!key) return null;                       // ⚠️ "" is what the old code wrote
  return ALIASES[key] ?? null;
}

// ── Positive detection, multilingual ─────────────────────────────────────────
//
// Deliberately HIGH-PRECISION and short. A false positive is far worse than a
// miss here: it would tell an NGO that someone is improving when they are not.
// Coverage is honest rather than exhaustive — English plus the core "feeling
// better" words in each supported script. This is the extensible seam; adding a
// language means adding a word, not changing logic.
const POSITIVE_JOY_REGEX =
  /(\bhappy\b|\bglad\b|\bdelighted\b|\bjoyful\b|\bwonderful\b|\bso good\b|\bmuch better\b|\bfeeling better\b|\bfeel better\b|खुश|खुशी|आनंद|খুশি|আনন্দ|சந்தோஷ|மகிழ்ச்சி|సంతోష|ಸಂತೋಷ|സന്തോഷ|ખુશ|આનંદ|ਖੁਸ਼|ଖୁସି|आनंदी|سعيد|فرح|שמח|\bglücklich\b|\bfroh\b|嬉しい|幸せ)/i;

const POSITIVE_HOPE_REGEX =
  /(\bhopeful\b|\bhope\b|\boptimistic\b|\blooking forward\b|\bgetting better\b|\bimproving\b|उम्मीद|आशा|আশা|নম্বিকাশ|நம்பிக்கை|ఆశ|ಭರವಸೆ|പ്രതീക്ഷ|આશા|ਉਮੀਦ|ଆଶା|أمل|תקווה|\bHoffnung\b|\bhoffe\b|希望)/i;

const POSITIVE_CALM_REGEX =
  /(\bcalm\b|\bpeaceful\b|\brelaxed\b|\bat peace\b|\brelieved\b|\bsettled\b|शांत|राहत|शांति|শান্ত|স্বস্তি|அமைதி|ప్రశాంత|ಶಾಂತ|ശാന്ത|શાંત|ਸ਼ਾਂਤ|ଶାନ୍ତ|هادئ|راحة|רגוע|\bruhig\b|\bgelassen\b|落ち着|安心)/i;

// ── Gratitude, but not mere politeness ──────────────────────────────────────
//
// 🔴 keywordMaps' GRATITUDE_REGEX matches bare "thanks" / "thank you" /
// "ধন্যবাদ" / "धन्यवाद". Those are how people end ANY message, so reusing it
// here would have scored a polite sign-off as +0.9 and inflated the NGO's
// positive trend on politeness alone — the same over-reporting this module
// exists to prevent. Gratitude counts only when stated as a FEELING.
const STRONG_GRATITUDE_REGEX =
  /(\bgrateful\b|\bgratitude\b|\bthankful\b|\bblessed\b|\bappreciate\b|\bappreciated\b|\bappreciation\b|means a lot|thank you so much|so thankful|কৃতজ্ঞ|কৃতজ্ঞতা|आभार|कृतज्ञ|कृतज्ञता|ਸ਼ੁਕਰਗੁਜ਼ਾਰ|ਕ੍ਰਿਤਜ੍ਞਤਾ|કૃતજ્ઞ|આભારી|କୃତଜ୍ଞ|ଆଭାରୀ|கृதஜ்ஞ|நன்றியுள்ள|కృతజ్ఞత|ಕೃತಜ್ಞತೆ|കൃതജ്ഞത|ممتن|أسير תודה|אסיר תודה|\bdankbar\b|感謝)/i;

// ── English negatives ────────────────────────────────────────────────────────
//
// By design: keywordMaps' isSadText/isStressText cover 14 languages but NOT
// English — "English stays at the call site on purpose" (keywordMaps.ts:385),
// because callers disagree on their English wording. So this call site states
// its own, tuned for precision: bare "down" and "empty" are required to appear
// as a FEELING ("feeling down", not "the server is down" or "the box is empty").
const EN_SAD_RE =
  /(\bsad\b|\bunhappy\b|\bdepressed\b|\blonely\b|\bcry\b|\bcrying\b|\bcried\b|\bin tears\b|\bupset\b|\bheartbroken\b|\bmiserable\b|\bgrief\b|\bgrieving\b|\bdevastated\b|\bhollow\b|\bnumb\b|feel(ing)? down|i'?m down|feel(ing)? empty|feel(ing)? hollow)/i;
const EN_STRESS_RE =
  /(\bstress\b|\bstressed\b|\bstressful\b|\boverwhelmed\b|\boverwhelming\b|burn(t|ed) out|\bburnout\b|\bexhausted\b|\bdrained\b|can'?t cope|cannot cope|can'?t take (it|this)|too much (for me|to handle)|under pressure|no time to)/i;
const EN_ANXIOUS_RE =
  /(\banxious\b|\banxiety\b|\bworried\b|\bworrying\b|\bnervous\b|\bpanic\b|\bpanicking\b|panic attack|on edge|\buneasy\b|\bdread\b|\brestless\b)/i;
const EN_AFRAID_RE =
  /(\bafraid\b|\bscared\b|\bterrified\b|\bfrightened\b|\bfearful\b|\bi fear\b)/i;
const EN_ANGRY_RE =
  /(\bangry\b|\bfurious\b|\bannoyed\b|\bfrustrated\b|\bfrustrating\b|\birritated\b|\benraged\b|\bresentful\b|\bpissed\b|fed up|\boutraged\b)/i;

// ── Negation guard ───────────────────────────────────────────────────────────
//
// 🔴 THE TRAP THIS EXISTS FOR: "ami bhalo nei" / "I'm not happy" / "कोई उम्मीद
// नहीं" are NEGATIVE statements built from positive words. Without this, the
// NGO's trend would drift optimistic exactly when people were doing worst.
// Negators are checked within a short window around the positive match, since
// in most of these languages the negator trails the adjective.
const NEGATORS =
  /(\bnot\b|\bnever\b|\bno\b|n['’]t|\bhardly\b|\bnothing\b|\bnei\b|\bnai\b|\bnahi+n?\b|\bnahin\b|\bmat\b|नहीं|नही|ना|নেই|না|নাই|இல்ல|லேது|లేదు|ಇಲ್ಲ|ഇല്ല|નથી|ਨਹੀਂ|ନାହିଁ|ليس|لا|لم|לא|אין|\bnicht\b|\bkein\b|ない|ません)/i;

function isNegated(text: string, match: RegExpMatchArray | null): boolean {
  if (!match || match.index === undefined) return false;
  const start = Math.max(0, match.index - 24);
  const end   = Math.min(text.length, match.index + match[0].length + 24);
  return NEGATORS.test(text.slice(start, end));
}

function positiveMatch(text: string, re: RegExp): boolean {
  const m = text.match(re);
  if (!m) return false;
  return !isNegated(text, m);
}

// ── Negative detection, multilingual ─────────────────────────────────────────
const SAD      = [HI_SAD_REGEX, BN_SAD_REGEX, TA_SAD_REGEX, TE_SAD_REGEX, GU_SAD_REGEX, KN_SAD_REGEX, ML_SAD_REGEX, PA_SAD_REGEX, OR_SAD_REGEX, MR_SAD_REGEX, JP_SAD_REGEX, HE_SAD_REGEX, AR_SAD_REGEX, DE_SAD_REGEX];
const STRESSED = [HI_STRESS_REGEX, BN_STRESS_REGEX, TA_STRESS_REGEX, TE_STRESS_REGEX, GU_STRESS_REGEX, KN_STRESS_REGEX, ML_STRESS_REGEX, PA_STRESS_REGEX, OR_STRESS_REGEX, MR_STRESS_REGEX, JP_STRESS_REGEX, HE_STRESS_REGEX, AR_STRESS_REGEX, DE_STRESS_REGEX];
const ANGRY    = [HI_ANGER_REGEX, BN_ANGER_REGEX, TA_ANGER_REGEX, TE_ANGER_REGEX, GU_ANGER_REGEX, KN_ANGER_REGEX, ML_ANGER_REGEX, PA_ANGER_REGEX, OR_ANGER_REGEX, MR_ANGER_REGEX, JP_ANGER_REGEX, HE_ANGER_REGEX, AR_ANGER_REGEX, DE_ANGER_REGEX];
const AFRAID   = [HI_FEAR_REGEX, BN_FEAR_REGEX, TA_FEAR_REGEX, TE_FEAR_REGEX, GU_FEAR_REGEX, KN_FEAR_REGEX, ML_FEAR_REGEX, PA_FEAR_REGEX, OR_FEAR_REGEX, MR_FEAR_REGEX, JP_FEAR_REGEX, HE_FEAR_REGEX, AR_FEAR_REGEX, DE_FEAR_REGEX];
const CONFUSED = [HI_CONFUSED_REGEX, BN_CONFUSED_REGEX, TA_CONFUSED_REGEX, TE_CONFUSED_REGEX, GU_CONFUSED_REGEX, KN_CONFUSED_REGEX, ML_CONFUSED_REGEX, PA_CONFUSED_REGEX, OR_CONFUSED_REGEX, MR_CONFUSED_REGEX, JP_CONFUSED_REGEX, HE_CONFUSED_REGEX, AR_CONFUSED_REGEX, DE_CONFUSED_REGEX];

const anyOf = (text: string, list: RegExp[]) => list.some((re) => re.test(text));

/**
 * Derive the analytics emotion label from the user's own message.
 *
 * 🔑 ORDER IS A DELIBERATE ETHICAL CHOICE: distress is checked BEFORE positive
 * states, so a message carrying both ("I was crying but I feel a bit hopeful")
 * records as distress. For a wellbeing metric sold to an NGO, under-reporting
 * improvement is honest; over-reporting it is not. When in doubt, this function
 * does not claim improvement.
 *
 * Returns "neutral" rather than null when nothing matches, so the denominator of
 * the trend is every conversation rather than only the labelled ones — which is
 * precisely the distortion that made the old 6.4% sample misleading.
 */
export function deriveAnalyticsEmotion(message: string): AnalyticsEmotion {
  const raw = String(message ?? "").trim();
  if (!raw) return "neutral";
  const t = raw.toLowerCase().replace(/\s+/g, " ");

  // 1. Gravest signals first.
  if (CRISIS_HINT_REGEX.test(raw) || CRISIS_HINT_REGEX.test(t)) return "hopeless";
  if (LONELY_WANTS_COMPANY_REGEX.test(t)) return "lonely";

  // 2. Negative cascade — 15 languages, plus the English helpers.
  if (EN_SAD_RE.test(t)     || anyOf(raw, SAD)      || anyOf(t, SAD)      || isSadText(raw))    return "sad";
  if (EN_STRESS_RE.test(t)  || anyOf(raw, STRESSED) || anyOf(t, STRESSED) || isStressText(raw)) return "stressed";
  if (EN_ANXIOUS_RE.test(t))                                                                    return "anxious";
  if (EN_AFRAID_RE.test(t)  || anyOf(raw, AFRAID)   || anyOf(t, AFRAID))                        return "afraid";
  if (EN_ANGRY_RE.test(t)   || anyOf(raw, ANGRY)    || anyOf(t, ANGRY))                         return "angry";
  if (anyOf(raw, CONFUSED)  || anyOf(t, CONFUSED)   || isConfusedText(raw))                     return "confused";

  // 3. Positive states — only once no distress was found, and never negated.
  if (positiveMatch(raw, STRONG_GRATITUDE_REGEX)) return "grateful";
  if (positiveMatch(raw, POSITIVE_JOY_REGEX))  return "joy";
  if (positiveMatch(raw, POSITIVE_HOPE_REGEX)) return "hopeful";
  if (positiveMatch(raw, POSITIVE_CALM_REGEX)) return "calm";

  // 4. Emoji-only messages, which carry real signal and no words.
  if (!/[a-z0-9ऀ-ॿঀ-৿଀-୿ఀ-౿ಀ-೿ഀ-ൿ਀-੿઀-૿஀-௿]/i.test(raw)) {
    if (/[\u{1F602}\u{1F604}\u{1F606}\u{1F923}\u{1F60A}\u{1F601}\u{1F60D}\u{1F970}\u{2764}\u{1F389}\u{1F64C}]/u.test(raw)) return "joy";
    if (/[\u{1F622}\u{1F62D}\u{2639}\u{1F641}\u{1F61E}\u{1F614}\u{1F494}\u{1F97A}]/u.test(raw)) return "sad";
    if (/[\u{1F621}\u{1F620}\u{1F92C}]/u.test(raw))                      return "angry";
    if (/[\u{1F628}\u{1F630}\u{1F631}]/u.test(raw))                      return "afraid";
    if (/[\u{1F64F}\u{1F49A}\u{1FAF6}]/u.test(raw))                      return "grateful";
  }

  return "neutral";
}

/** Average polarity of a set of labels: the NGO trend line. null when empty. */
export function averagePolarity(labels: Array<string | null | undefined>): number | null {
  const vals = labels
    .map(normaliseAnalyticsEmotion)
    .filter((e): e is AnalyticsEmotion => e !== null)
    .map((e) => EMOTION_POLARITY[e]);
  if (vals.length === 0) return null;
  return Number((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(3));
}
