// src/app/api/voice/transcribe/route.ts
// Speech-to-text for mobile voice input. Accepts a multipart/form-data POST
// with a single "file" field (audio/m4a) and returns { text: string }.
//
// Two models: gpt-transcribe, falling back to whisper-1. The choice is not
// arbitrary and gpt-4o-transcribe is deliberately NOT one of them — see the
// note above STT_PRIMARY before changing either.
//
// ⚠️ The web app does not use this route; it uses the browser's own
// SpeechRecognition. Everything here is the iOS and Android voice path.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { supabaseUserServer } from "@/lib/supabase/userServer";
import { getClientIp, checkPersistentIpRateLimit } from "@/lib/imotara/ipRateLimit";
import { resolvePlatform } from "@/lib/imotara/clientPlatform";

export const runtime = "nodejs";
export const maxDuration = 60;

// Max audio size: 10 MB (Whisper limit is 25 MB; 60s m4a ≈ 1 MB in practice)
const MAX_BYTES = 10 * 1024 * 1024;

// Same quota shape as /api/tts — anonymous identities get real Whisper STT
// instead of no identity at all, but need a bound since they're cheap to
// create. Real signed-in accounts remain unlimited, unchanged.
const ANONYMOUS_TRANSCRIBE_DAILY_LIMIT = 20;

// Defense against one script minting many cheap anonymous identities from a
// single IP — see code_review_audit_2026_08_14 (P0-2).
const RATE_LIMIT_PER_MIN = 30;

/**
 * Whisper invents speech when it hears none.
 *
 * Fed a silent or noisy recording it does not return "" — it returns fluent,
 * confident sentences lifted from its training data, overwhelmingly YouTube
 * outro boilerplate. Observed on a real phone 2026-09-12, three recordings of
 * a quiet room in a row:
 *
 *   "If you liked it, give it a thumbs up. If you have any questions or
 *    suggestions, feel free to comment below . ... ....."
 *   "This is a video of a cat that was trapped by a dog. It's a dog. It's a dog…"
 *   "Okay. Okay. Okay."
 *
 * Each landed in the message box, and with "send voice notes automatically"
 * switched on it would have been sent to the companion as the person's own
 * words. For an app someone talks to about how they feel, putting invented
 * sentences in their mouth and then replying to them warmly is the worst
 * failure this route has.
 *
 * TWO INDEPENDENT CHECKS, deliberately biased towards letting speech through.
 * A false reject means someone spoke and the app ignored them, which is its own
 * small betrayal — so each check only fires on strong evidence.
 */

/** Phrases Whisper emits from silence. None is plausible in this app. */
const HALLUCINATION_PATTERNS: RegExp[] = [
    /thanks? (?:for|you for) watching/i,
    /(?:don'?t forget to |please )?(?:like,? )?(?:and )?subscribe/i,
    /(?:give it a |leave a )?thumbs? up/i,
    /comment (?:below|down below)/i,
    /(?:see|catch) you (?:in the )?next (?:video|time)/i,
    /this is a video of/i,
    /(?:copyright|transcription|subtitles?) (?:by|©)/i,
    /amara\.org/i,
    /^(?:you|bye|thank you)[.!\s]*$/i,
];

/** A single short word or phrase repeated — "It's a dog. It's a dog. It's a dog." */
function isDegenerateRepetition(text: string): boolean {
    const parts = text.split(/[.!?]+/).map((p) => p.trim().toLowerCase()).filter(Boolean);
    if (parts.length < 3) return false;
    const unique = new Set(parts);
    // Three or more sentences, and at most a third of them distinct.
    return unique.size <= Math.max(1, Math.floor(parts.length / 3));
}

/**
 * Whisper ANNOTATING non-speech audio — a second failure mode, found on the
 * same phone a day later (2026-09-13). Hands-free, quiet room, auto-sent:
 *
 *     "**Scary music starts playing** keep an eye out.."
 *     "Wheeze"
 *
 * Neither is boilerplate and neither repeats, so both checks above let them
 * straight through. This is not Whisper inventing a sentence; it is Whisper
 * truthfully describing the room and the transport handing that to the
 * companion as something the person said.
 *
 * The signal is the MARKUP, not the vocabulary. Someone speaking into a
 * microphone cannot produce an asterisk, a square bracket or a musical note —
 * those characters only ever come from Whisper marking audio it heard and did
 * not treat as speech. So their presence condemns the whole transcription,
 * trailing residue included: the residue came out of the same decode of the
 * same non-speech audio, which is exactly how "keep an eye out.." arrived.
 *
 * Anything talking ABOUT music, coughing or sighing is left alone — this app
 * exists for those sentences.
 */
const ANNOTATION_MARKUP = /\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]*\]|[\u266a\u266b\u266c\u2669]/;

/**
 * Involuntary sounds Whisper labels. Deliberately narrow: every word here is
 * one nobody offers as their entire reply to "how are you feeling?".
 *
 * "silence", "breathing", "music" and "noise" are NOT here on purpose — each
 * is a plausible one-word answer in this app, and the bracket rule already
 * catches them in their annotated forms.
 */
const SOUND_EVENT_WORDS = new Set([
    "wheeze", "wheezes", "wheezing",
    "cough", "coughs", "coughing",
    "sneeze", "sneezes", "sneezing",
    "sniffle", "sniffles", "sniffling",
    "gasp", "gasps", "gasping",
    "grunt", "grunts", "groan", "groans",
    "chuckle", "chuckles", "chuckling",
    "laughter", "applause", "clapping",
    "clattering", "rustling", "creaking", "squeaking",
    "static", "beeping", "buzzing", "humming", "ticking", "whirring", "rumbling",
    "snoring", "whimper", "whimpers", "gurgling", "clanging", "footsteps",
    "inaudible", "unintelligible",
]);

/**
 * A wider vocabulary, safe ONLY inside brackets.
 *
 * "(sighs)", "(wind blowing)" and "(soft music)" cannot be speech, but the
 * bare words sigh, wind and music can all be someone's whole answer here — so
 * these are trusted only when the brackets have already told us the span is an
 * annotation. The narrow set above is the one allowed to stand on its own.
 */
const BRACKETED_SOUND_WORDS = new Set([
    ...SOUND_EVENT_WORDS,
    "sigh", "sighs", "sighing", "exhales", "inhales", "breathing", "breathes",
    "silence", "music", "noise", "wind", "blowing", "rain", "thunder",
    "laughing", "laughs", "crying", "sobbing", "sniffing", "whispering",
    "indistinct", "chatter", "mumbling", "beep", "bell", "ringing",
    "door", "engine", "traffic", "birds", "barking", "playing", "creaks",
]);

/**
 * Round brackets are the one ambiguous delimiter — Whisper does use them for
 * real parenthetical speech ("he said (and I quote) ..."), so they only count
 * as an annotation when what they hold is short AND names a sound.
 */
function hasParentheticalSoundEvent(text: string): boolean {
    for (const m of text.matchAll(/\(([^)]*)\)/g)) {
        const words = m[1].toLowerCase().split(/[^a-z]+/).filter(Boolean);
        if (words.length && words.length <= 4 && words.some((w) => BRACKETED_SOUND_WORDS.has(w))) {
            return true;
        }
    }
    return false;
}

/** The whole utterance is nothing but a sound label — "Wheeze", "Coughing". */
function isBareSoundEvent(text: string): boolean {
    const words = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    if (words.length === 0 || words.length > 2) return false;
    return words.every((w) => SOUND_EVENT_WORDS.has(w));
}

/** Exported for tests: is this Whisper describing audio rather than speech? */
export function isSoundEventAnnotation(text: string): boolean {
    const t = text.trim();
    if (!t) return false;
    return ANNOTATION_MARKUP.test(t) || hasParentheticalSoundEvent(t) || isBareSoundEvent(t);
}

/**
 * Content-free words Whisper emits from noise, as the entire transcription.
 *
 * Found in production on 2026-09-13 by running hands-free on room noise
 * against the deployed route: annotations had stopped getting through, but
 * "the" was auto-sent and the companion replied to it earnestly. Same shape as
 * the "you" / "bye" entry in HALLUCINATION_PATTERNS above, so it is
 * generalised here rather than bolted on as a third one-off.
 *
 * Function words ONLY. A single word is often all someone can manage here —
 * "tired", "numb", "no", "why" — so this list must contain nothing a person
 * could possibly mean on its own. Interjections ("hmm", "oh", "well") are
 * deliberately absent: they carry feeling, and feeling is the point.
 */
const CONTENT_FREE_WORDS = new Set([
    "the", "a", "an",
    "and", "but", "or", "nor", "so", "yet",
    "of", "to", "in", "on", "at", "for", "with", "from", "by", "as",
    "into", "onto", "upon", "than", "then",
    "is", "was", "are", "were", "be", "been", "am",
    "that", "this", "these", "those", "it", "its",
    "you", "bye",
]);

/** Exported for tests: is the whole utterance nothing but function words? */
export function isContentFree(text: string): boolean {
    const words = text.toLowerCase().split(/[^a-z']+/).filter(Boolean);
    if (words.length === 0 || words.length > 2) return false;
    return words.every((w) => CONTENT_FREE_WORDS.has(w));
}

/** Exported for tests: does this look like something Whisper made up? */
export function isLikelyHallucination(text: string, prompt: string = WHISPER_PROMPT): boolean {
    const t = text.trim();
    if (!t) return false;
    if (HALLUCINATION_PATTERNS.some((re) => re.test(t))) return true;
    if (isSoundEventAnnotation(t)) return true;
    if (isContentFree(t)) return true;
    if (isPromptEcho(t, prompt)) return true;
    return isDegenerateRepetition(t);
}

/**
 * A vocabulary hint for Whisper, so it stops writing the app's own name wrong.
 *
 * Found on a real iPad, 2026-09-16: the owner said "Hi Imotara, not feeling
 * well today" and it was transcribed "Hi **Emotara**, not feeling well today".
 * Whisper has never heard of the product, so it spells it phonetically, and
 * the mangled version is then saved into the person's own history.
 *
 * ⚠️ This parameter is NOT free. Whisper is known to EMIT THE PROMPT VERBATIM
 * when the audio contains no speech — the prompt is prepended to the decoder's
 * context, so on silence the most likely continuation is the prompt itself.
 * For most apps that is a curiosity; for this one it would manufacture exactly
 * the failure we spent this whole session removing: words in someone's history
 * that nobody said. Hence `isPromptEcho` below, and hence a prompt of one word
 * rather than a chatty sentence — the smaller the prompt, the smaller the
 * surface it can leak.
 */
export const WHISPER_PROMPT = "Imotara";

const normalizeForEcho = (s: string) =>
    s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Exported for tests: is this transcript just our own prompt handed back?
 *
 * Deliberately an EXACT match after normalisation, not a substring test. A
 * real sentence that happens to contain the app's name ("Imotara, I feel
 * awful") must survive; only a transcript that is *nothing but* the hint is
 * rejected. The cost is that someone saying the single word "Imotara" and
 * nothing else loses it — an acceptable trade for a one-word utterance that
 * carries no feeling to record.
 */
export function isPromptEcho(text: string, prompt: string = WHISPER_PROMPT): boolean {
    return normalizeForEcho(text) === normalizeForEcho(prompt);
}

/**
 * The hint Whisper actually receives. A renamed companion ("Maya") must be
 * hinted as "Maya" — hinting "Imotara" would actively mis-hear the one word
 * the person is most likely to say to it. Found while wiring the companion
 * name through the UI, 2026-09-16.
 */
export function whisperPromptFor(companionName: unknown): string {
    const n = typeof companionName === "string" ? companionName.trim() : "";
    // Keep it to one word for the same echo-hazard reason as WHISPER_PROMPT.
    return n && n.length <= 40 && !/\s/.test(n) ? n : WHISPER_PROMPT;
}

type WhisperSegment = { no_speech_prob?: number; avg_logprob?: number };

/**
 * Exported for tests: did Whisper itself think there was no speech?
 *
 * Both conditions must hold, on EVERY segment — OpenAI's own decoder uses the
 * same pairing, because no_speech_prob alone is noisy on quiet speech. A
 * recording where any segment looks like real speech is kept whole.
 */
export function hasNoSpeech(segments: WhisperSegment[] | undefined): boolean {
    if (!segments || segments.length === 0) return false; // no data — never reject
    return segments.every(
        (seg) =>
            typeof seg.no_speech_prob === "number" &&
            typeof seg.avg_logprob === "number" &&
            seg.no_speech_prob > 0.6 &&
            seg.avg_logprob < -0.4,
    );
}

/**
 * THE TWO MODELS, and why there are two.
 *
 * 🔴 `whisper-1` could not spell Bengali. Reported 2026-10-10: "the words
 * which are getting typed in bengali, those words does not exists in bengali
 * dictionary." Measured against the API the same day, spoken Bengali for
 * "I feel very tired today":
 *
 *   spoken            আমার আজ খুব ক্লান্ত লাগছে
 *   whisper-1         আমার আজ খুব ট্লান তো লাগ্ছে     ❌ ট্লান and লাগ্ছে are not words
 *   gpt-transcribe    আমার আজ খুব ক্লান্ত লাগছে       ✅
 *
 * Same for Hindi (ठकान for थकान) and for a second Bengali clip (নে for নেই,
 * লাক্ছে for লাগছে). gpt-transcribe was correct on every clip tested.
 *
 * ⚠️ AND IT IS SAFER ON SILENCE, which is the reason this route has a whole
 * hallucination apparatus. Four seconds of silence, with the Bengali script
 * prompt attached exactly as this route sends it:
 *
 *   whisper-1          invented "আমার খুব ক্লান্ত লাগছে।" — caught ONLY because
 *                      verbose_json reported no_speech_prob = 0.96
 *   gpt-4o-transcribe  invented "আমি ভালো আছি।" and offers NO such signal  ⛔
 *   gpt-transcribe     returned ""                                         ✅
 *
 * ⛔ THAT IS WHY THE MODEL HERE IS `gpt-transcribe` AND NOT
 * `gpt-4o-transcribe`. The 4o variant is the better-known name and the
 * obvious-looking upgrade, and it would have put sentences nobody said into
 * people's own histories with nothing able to detect it. Do not "simplify"
 * this to 4o.
 *
 * 🔑 whisper-1 stays as the FALLBACK, not as dead code: if a new model has a
 * bad hour, a person talking to this app about how they feel should not lose
 * their words to it. The fallback keeps verbose_json and keeps the
 * no_speech_prob guard, because it still needs it.
 */
export const STT_PRIMARY = "gpt-transcribe";
export const STT_FALLBACK = "whisper-1";
export type SttModel = typeof STT_PRIMARY | typeof STT_FALLBACK;

/**
 * Which `language` codes each model's API actually ACCEPTS (ISO-639-1).
 *
 * Sending a code the API does not take is a 400; omitting the parameter lets
 * the model auto-detect, which is markedly worse on short Indic utterances.
 *
 * ⛔ EVERY DIFFERENCE BELOW WAS MEASURED, 2026-10-10, by asking the API about
 * all 22 app languages against both models. Twice in one day this set was
 * edited on inference instead, in both directions:
 *
 *   - bn/te/gu/ml/pa were first added with the comment "Whisper supports all
 *     five". The MODEL does; the `language` PARAMETER does not. Every Bengali
 *     turn cost a wasted 400 and fell back to bare auto-detect, which returned
 *     Devanagari for Bengali speech — "i tried to talk in bengali but it
 *     typed in hindi".
 *   - They were then removed, then four of them RESTORED on the reasoning
 *     that production had only ever logged a rejection for bn. It had only
 *     logged bn because nobody had yet spoken Gujarati. The API rejects all
 *     four: `Language 'gu' is not supported.`
 *
 * 🔑 The lesson is not about these codes. It is that a log tells you what
 * someone happened to try, and a measurement tells you what is true. Ask the
 * API before editing this.
 */
const UNREACHABLE_BUT_DOCUMENTED = [
    // Codes from OpenAI's published list that no app language maps to, so no
    // user input can reach them. Left in place deliberately: removing an
    // untested code is the exact inference mistake described above, and the
    // retry below makes a wrong one cost a single round-trip.
    "af","hy","az","be","bs","bg","ca","hr","cs","da","et","fi","gl","el","hu",
    "is","kk","lv","lt","mk","ms","mi","no","ro","sr","sk","sl","sw","tl","cy",
] as const;

/** The 22 app languages both models take, plus the reachable extras. */
const ACCEPTED_BY_BOTH = [
    "en","hi","mr","ta","kn","ur",                        // Indian, accepted by both
    "ar","he","ru","zh","ja","es","fr","de","pt","id",    // the foreign ten
    "ne","fa","tr","vi","th","ko","it","nl","pl","sv",    // reachable via BCP-47
    ...UNREACHABLE_BUT_DOCUMENTED,
] as const;

/**
 * ⚠️ `pa` (Punjabi) and `or` (Odia) are in NEITHER set — both models reject
 * them outright:
 *   whisper-1       Language 'pa' is not supported.
 *   gpt-transcribe  Language code 'pa' is not recognized.
 * Those two rely on a script prompt instead. See SCRIPT_PROMPTS.
 */
export const WHISPER_LANGS = new Set<string>(ACCEPTED_BY_BOTH);

/**
 * 🔑 THE FOUR LANGUAGES THE NEW MODEL UNLOCKS. Bengali, Telugu, Gujarati and
 * Malayalam are accepted as a `language` by gpt-transcribe and rejected by
 * whisper-1 — so switching model does not merely transcribe Bengali better,
 * it lets us TELL the model it is Bengali for the first time. That is the
 * stronger of the two signals, and the script prompt was only ever a
 * stand-in for it.
 */
export const GPT_TRANSCRIBE_LANGS = new Set<string>([
    ...ACCEPTED_BY_BOTH, "bn", "te", "gu", "ml",
]);

/** The codes a given model will accept. */
export function langsFor(model: SttModel): Set<string> {
    return model === STT_FALLBACK ? WHISPER_LANGS : GPT_TRANSCRIBE_LANGS;
}

/** Which set a rejected code should be removed from — for the warning log. */
export function langsNameFor(model: SttModel): string {
    return model === STT_FALLBACK ? "WHISPER_LANGS" : "GPT_TRANSCRIBE_LANGS";
}

/**
 * ⚠️ `verbose_json` IS NOT AVAILABLE on the new model, measured:
 *   response_format 'verbose_json' is not compatible with model
 *   'gpt-transcribe-api-ev3'. Use 'json' or 'text' instead.
 *
 * So `segments`, and with them no_speech_prob and avg_logprob, exist only on
 * the fallback path. That is only acceptable because gpt-transcribe returns
 * "" on silence rather than inventing a sentence — see the model note above.
 * `hasNoSpeech(undefined)` is already false ("no data — never reject"), so
 * the guard goes quiet on its own for the primary model.
 *
 * 🔑 The new format carries `languages: [{code}]` instead — `[]` when it
 * heard no speech. A plausible replacement signal, deliberately NOT acted on
 * yet: rejecting on it is unmeasured, and a wrong rejection means someone
 * spoke and the app ignored them.
 */
export function responseFormatFor(model: SttModel): "json" | "verbose_json" {
    return model === STT_FALLBACK ? "verbose_json" : "json";
}

/**
 * A few words in the target script, used to bias Whisper's output when we
 * cannot name the language.
 *
 * ⚠️ Deliberately ORDINARY, and deliberately about FEELINGS. Whisper's prompt
 * conditions the decoder's vocabulary, not just the script, so the words it
 * contains are the words it becomes readier to produce. These are the common
 * pronouns, verbs and emotional phrases this product actually hears — "I am
 * well", "my mind is not good today", "how are you", "I feel very tired".
 *
 * 🔴 Reported 2026-10-10: "the words which are getting typed in bengali,
 * those words does not exists in bengali dictionary." A single short sentence
 * biased the SCRIPT but gave the decoder almost nothing to anchor spelling
 * on. This is the cheapest lever that targets the words themselves.
 *
 * ⚖️ It is a lever, not a cure. The underlying limit is whisper-1's accuracy
 * on these languages, which needs a model evaluation to move properly.
 *
 * ⚠️ The prompt is echoed back verbatim when Whisper hears nothing, and
 * isPromptEcho has to be able to recognise it — so it is passed to that guard
 * as part of the same string it was sent as. Longer prompts make that MORE
 * important, not less.
 */
export const SCRIPT_PROMPTS: Record<string, string> = {
    bn: "আমি ভালো আছি। আজ আমার মন ভালো নেই। তুমি কেমন আছো? আমার খুব ক্লান্ত লাগছে।",
    gu: "હું ઠીક છું. આજે મારું મન સારું નથી. તમે કેમ છો? મને ખૂબ થાક લાગે છે.",
    te: "నేను బాగున్నాను. ఈ రోజు నాకు మనసు బాగాలేదు. మీరు ఎలా ఉన్నారు? నాకు చాలా అలసటగా ఉంది.",
    ml: "എനിക്ക് സുഖമാണ്. ഇന്ന് എനിക്ക് മനസ്സ് സുഖമില്ല. നിങ്ങൾക്ക് സുഖമാണോ? എനിക്ക് വളരെ ക്ഷീണം തോന്നുന്നു.",
    pa: "ਮੈਂ ਠੀਕ ਹਾਂ। ਅੱਜ ਮੇਰਾ ਮਨ ਚੰਗਾ ਨਹੀਂ ਹੈ। ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ? ਮੈਨੂੰ ਬਹੁਤ ਥਕਾਵਟ ਲੱਗ ਰਹੀ ਹੈ।",
    or: "ମୁଁ ଭଲ ଅଛି। ଆଜି ମୋର ମନ ଭଲ ନାହିଁ। ଆପଣ କେମିତି ଅଛନ୍ତି? ମୋତେ ବହୁତ ଥକ୍କା ଲାଗୁଛି।",
};

/**
 * The script hint to attach when no `language` code could be sent.
 *
 * 🔑 KEYED ON THE CODE ACTUALLY SENT, not on a model's table. The first
 * version of this took the model and re-derived the answer from
 * `langsFor(model)` — which is right on the happy path and WRONG on the one
 * that matters: when the API rejects a code the table claimed it accepts, the
 * hint is gone and the crutch is needed, but the table still says otherwise.
 * Passing the real decision in makes the two impossible to disagree.
 *
 * Sending both a `language` and a script prompt is noise — the real hint is
 * the stronger signal — so a sent code yields "".
 */
export function scriptPromptFor(lang: unknown, sentLanguage: string | null): string {
    if (sentLanguage) return "";                 // the real hint is available
    if (!lang || typeof lang !== "string") return "";
    return SCRIPT_PROMPTS[lang.split("-")[0].toLowerCase()] ?? "";
}

/**
 * Which `language` to send Whisper, or null to let it detect.
 *
 * 🔴 Extracted 2026-10-10 from inside POST. Reported that day: a user spoke
 * Bengali on a physical iPhone and got ENGLISH text. The client had sent
 * `lang=en` (it derived the value with a helper that maps "auto" and unset to
 * "en"), and this decision forwarded it, so Whisper was TOLD the audio was
 * English and obeyed.
 *
 * 🔑 The client now sends "auto" when the person has stated no preference,
 * which lands in the null branch below. That only works because an
 * unrecognised code is OMITTED rather than defaulted, so this function is the
 * contract the app depends on — which is why it is exported and tested
 * directly instead of being re-implemented in a test.
 *
 * ⛔ Never default to "en" here. That is the reported bug.
 */
export function whisperLanguageFor(lang: unknown, model: SttModel = STT_PRIMARY): string | null {
    if (!lang || typeof lang !== "string") return null;
    const code = lang.split("-")[0];   // the API wants ISO-639-1, not BCP-47
    return langsFor(model).has(code) ? code : null;
}

export async function POST(req: NextRequest) {
    const ip = getClientIp(req);
    if (!(await checkPersistentIpRateLimit("voice-transcribe", ip, RATE_LIMIT_PER_MIN, 60))) {
        return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "STT not configured" }, { status: 503 });
    }

    // This route had NO auth check at all — any anonymous caller could POST
    // audio and have it transcribed on the app's own OpenAI key, with no
    // rate limiting either. Same pattern as /api/tts's fix.
    let user = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const anon = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { data: { user: bearerUser } } = await anon.auth.getUser(token);
        user = bearerUser;
    }
    if (!user) {
        const supabase = await supabaseUserServer();
        const { data: { user: cookieUser } } = await supabase.auth.getUser();
        user = cookieUser;
    }
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (user.is_anonymous) {
        const quotaAdmin = getSupabaseAdmin();
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        const { count } = await quotaAdmin
            .from("usage_events")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("event_type", "voice_transcribe")
            .gte("created_at", todayStart.toISOString());

        if ((count ?? 0) >= ANONYMOUS_TRANSCRIBE_DAILY_LIMIT) {
            // Same { error: "quota_exceeded" } / 503 shape the client already
            // handles for Whisper's own quota exhaustion below — reuses the
            // existing "Voice unavailable" alert rather than needing a new one.
            return NextResponse.json({ error: "quota_exceeded" }, { status: 503 });
        }
    }

    let formData: FormData;
    try {
        formData = await req.formData();
    } catch {
        return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
    }

    const file = formData.get("file") as Blob | null;
    if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
    }

    // Optional language hint (BCP-47 or ISO-639-1) — helps Whisper accuracy
    const lang = formData.get("lang");
    // The companion's chosen name, so the spelling hint matches what the
    // person will actually say. Optional; defaults to the product name.
    const whisperPrompt = whisperPromptFor(formData.get("companionName"));

    /**
     * Everything the request body depends on the MODEL for, in one place.
     *
     * 🔑 Built per attempt rather than mutated, because falling back to
     * whisper-1 changes three things at once — the accepted language codes,
     * the response format, and therefore whether a script prompt is needed
     * instead of a hint. Mutating one field and forgetting another is how the
     * bn failure survived its first fix.
     */
    function buildForm(model: SttModel, withLanguageHint = true) {
        const form = new FormData();
        // All mobile recordings are MPEG_4/AAC (.m4a) — Android LOW_QUALITY is
        // overridden at record time to avoid THREE_GPP, which is not accepted.
        form.append("file", file!, "voice.m4a");
        form.append("model", model);
        form.append("response_format", responseFormatFor(model));

        // null = say nothing and let the model auto-detect. See
        // whisperLanguageFor for why that is the right answer for "auto".
        const code = withLanguageHint ? whisperLanguageFor(lang, model) : null;
        if (code) form.append("language", code);

        // Spelling hint — see WHISPER_PROMPT. Guarded by isPromptEcho, because
        // these models can echo their prompt back when they hear no speech.
        //
        // 🔑 When `language` is unavailable for this tongue, bias the SCRIPT
        // through the prompt instead — otherwise the model free-runs and
        // returns Devanagari for Bengali speech, which is what was reported.
        // ⚠️ Keyed off the code ACTUALLY sent, so a runtime rejection gets the
        // crutch too.
        const scriptHint = scriptPromptFor(lang, code);
        const prompt = scriptHint ? `${whisperPrompt}. ${scriptHint}` : whisperPrompt;
        form.append("prompt", prompt);

        return { form, prompt };
    }

    /**
     * One attempt. Factored out so an unsupported language code can be retried
     * WITHOUT the hint instead of costing the user their recording.
     */
    async function callStt(form: FormData): Promise<Response> {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 55_000); // 55s — Vercel limit is 60s
        try {
            return await fetch("https://api.openai.com/v1/audio/transcriptions", {
                method: "POST",
                headers: { Authorization: `Bearer ${apiKey}` },
                body: form,
                signal: ctrl.signal,
            });
        } finally {
            clearTimeout(timer);
        }
    }

    let model: SttModel = STT_PRIMARY;
    let built = buildForm(model);
    let whisperForm = built.form;
    let effectivePrompt = built.prompt;

    let whisperRes: Response;
    try {
        whisperRes = await callStt(whisperForm);
    } catch (err) {
        console.error(`[voice/transcribe] ${model} fetch failed:`, err);
        whisperRes = new Response(null, { status: 599 });  // fall through to the fallback
    }

    if (!whisperRes.ok) {
        const errText = await whisperRes.text().catch(() => "");
        console.error(`[voice/transcribe] ${model} ${whisperRes.status}:`, errText);

        /**
         * 🔴 THE MODEL REJECTED OUR LANGUAGE HINT — RETRY WITHOUT IT.
         *
         * Production, 2026-10-08T18:48:39Z, on `cb0ee7c`:
         *   Whisper 400: {"error":{"message":"Language 'bn' is not supported.",
         *   "code":"unsupported_language","param":"language"}}
         *
         * 🔑 The whitelist being wrong was the SMALL half of this. The big half
         * is what happened next: the route returned 502 and the user's
         * recording was DISCARDED. Someone spoke Bengali into a companion that
         * advertises 22 languages and got nothing back.
         *
         * So the durable fix is not to edit a list — it drifts every time
         * OpenAI changes a model. It is to make an unsupported hint NON-FATAL:
         * drop the hint, add the script prompt in its place, auto-detect.
         *
         * ⚠️ The two models word the refusal DIFFERENTLY, measured 2026-10-10:
         *   whisper-1       code "unsupported_language", param "language"
         *   gpt-transcribe  code "invalid_value",        param "language"
         * Matching on `param` is what keeps this live across both — a check on
         * `code` alone would have gone inert at the model switch and taken
         * Punjabi down with it.
         *
         * The console line below is deliberate: it is how we learn which codes
         * are actually refused, instead of encoding another guess.
         */
        if (whisperRes.status === 400 && whisperForm.has("language")) {
            let unsupportedLang = false;
            try {
                const errJson = JSON.parse(errText);
                unsupportedLang =
                    errJson?.error?.code === "unsupported_language" ||
                    errJson?.error?.param === "language";
            } catch { /* not JSON — fall through */ }

            if (unsupportedLang) {
                const rejected = String(whisperForm.get("language") ?? "");
                console.warn(
                    `[voice/transcribe] ${model} rejected language "${rejected}" — ` +
                    `retrying with auto-detect. Remove it from ${langsNameFor(model)}.`,
                );
                built = buildForm(model, false);
                whisperForm = built.form;
                effectivePrompt = built.prompt;
                try {
                    whisperRes = await callStt(whisperForm);
                } catch (err) {
                    console.error(`[voice/transcribe] ${model} retry failed:`, err);
                    whisperRes = new Response(null, { status: 599 });
                }
            }
        }

        /**
         * 🔑 STILL FAILING — FALL BACK TO THE OLDER MODEL.
         *
         * gpt-transcribe transcribes Bengali correctly where whisper-1 does
         * not, so it is the primary. But a new model having a bad hour must
         * not cost someone the thing they just said out loud. whisper-1 is
         * three years old and boringly available, and its accuracy — however
         * poor on Indic scripts — beats "Transcription failed".
         *
         * ⚠️ Rebuilt, never mutated: the fallback needs verbose_json, a
         * different language table, and a script prompt for bn/te/gu/ml that
         * the primary did not need.
         */
        if (!whisperRes.ok && model === STT_PRIMARY) {
            console.warn(
                `[voice/transcribe] ${STT_PRIMARY} unavailable (${whisperRes.status}) — ` +
                `falling back to ${STT_FALLBACK}.`,
            );
            model = STT_FALLBACK;
            built = buildForm(model);
            whisperForm = built.form;
            effectivePrompt = built.prompt;
            try {
                whisperRes = await callStt(whisperForm);
            } catch (err) {
                console.error(`[voice/transcribe] ${model} fetch failed:`, err);
                return NextResponse.json({ error: "STT service unavailable" }, { status: 502 });
            }
        }
    }

    if (!whisperRes.ok) {
        const errText = await whisperRes.text().catch(() => "");
        console.error(`[voice/transcribe] ${model} ${whisperRes.status} (final):`, errText);
        // Detect quota exhaustion so the client can show a clearer message
        if (whisperRes.status === 429) {
            try {
                const errJson = JSON.parse(errText);
                if (errJson?.error?.code === "insufficient_quota") {
                    return NextResponse.json({ error: "quota_exceeded" }, { status: 503 });
                }
            } catch { /* not JSON — fall through */ }
        }
        return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
    }

    const json = await whisperRes.json().catch(() => null);

    if (user.is_anonymous) {
        void Promise.resolve(
            getSupabaseAdmin().from("usage_events").insert({
                user_id:    user.id,
                event_type: "voice_transcribe",
                platform:   resolvePlatform(req),
            })
        ).catch(() => {});
    }

    const rawText = (json?.text ?? "").trim();

    // Returning "" routes the client to its existing "didn't catch that" path
    // (useVoiceInput's onNoSpeech), so nothing new has to be handled on mobile.
    if (rawText && (hasNoSpeech(json?.segments) || isLikelyHallucination(rawText, effectivePrompt))) {
        console.warn("[voice/transcribe] discarded likely hallucination:", rawText.slice(0, 120));
        return NextResponse.json({ text: "", discarded: "no_speech" });
    }

    return NextResponse.json({ text: rawText });
}
