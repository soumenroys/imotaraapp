// src/lib/azure-tts/voices.ts
// Azure Neural TTS voice names for all 22 Imotara languages.
// Nonbinary / other / prefer_not fall back to the neutral (female) voice.

export type AzureGender = "male" | "female" | "neutral";

export interface AzureVoiceSet {
    male:    string;
    female:  string;
    neutral: string; // used for nonbinary / other / prefer_not
}

// 2026-08-14: 8 languages upgraded to Azure's "MAI-Voice-2" NeuralHD
// generation (verified live against the voices-list endpoint, all 4 Azure
// regions Imotara routes to) — same locale/accent as before for every
// language except Spanish (es-ES → es-MX, see EMOTION_STYLE_MAP comment),
// but a genuinely different voice identity: these voices carry a real
// 10-18-item named-emotion StyleList, replacing voices that had 0-3 styles
// (or none at all). NeuralHD is priced higher than standard Neural — an
// accepted tradeoff for real emotion coverage across most-used languages.
// The other 14 languages are unchanged; see PROSODY_FALLBACK_LANGS below for
// why 13 of them can't get named styles at all (Azure has none for any
// regional variant of those languages, checked exhaustively).
export const AZURE_VOICES: Record<string, AzureVoiceSet> = {
    en: { male: "en-US-Ethan:MAI-Voice-2",  female: "en-US-Olivia:MAI-Voice-2",  neutral: "en-US-Olivia:MAI-Voice-2"  },
    hi: { male: "hi-IN-Dhruv:MAI-Voice-2",  female: "hi-IN-Kavya:MAI-Voice-2",   neutral: "hi-IN-Kavya:MAI-Voice-2"   },
    mr: { male: "mr-IN-ManoharNeural",  female: "mr-IN-AarohiNeural",      neutral: "mr-IN-AarohiNeural"      },
    bn: { male: "bn-IN-BashkarNeural",  female: "bn-IN-TanishaaNeural",    neutral: "bn-IN-TanishaaNeural"    },
    ta: { male: "ta-IN-ValluvarNeural", female: "ta-IN-PallaviNeural",     neutral: "ta-IN-PallaviNeural"     },
    te: { male: "te-IN-MohanNeural",    female: "te-IN-ShrutiNeural",      neutral: "te-IN-ShrutiNeural"      },
    gu: { male: "gu-IN-NiranjanNeural", female: "gu-IN-DhwaniNeural",      neutral: "gu-IN-DhwaniNeural"      },
    pa: { male: "pa-IN-OjasNeural",     female: "pa-IN-VaaniNeural",       neutral: "pa-IN-VaaniNeural"       },
    kn: { male: "kn-IN-GaganNeural",    female: "kn-IN-SapnaNeural",       neutral: "kn-IN-SapnaNeural"       },
    ml: { male: "ml-IN-MidhunNeural",   female: "ml-IN-SobhanaNeural",     neutral: "ml-IN-SobhanaNeural"     },
    or: { male: "or-IN-SukantNeural",   female: "or-IN-SubhasiniNeural",   neutral: "or-IN-SubhasiniNeural"   },
    ur: { male: "ur-PK-AsadNeural",     female: "ur-PK-UzmaNeural",        neutral: "ur-PK-UzmaNeural"        },
    zh: { male: "zh-CN-Bo:MAI-Voice-2",     female: "zh-CN-Mei:MAI-Voice-2",     neutral: "zh-CN-Mei:MAI-Voice-2"     },
    es: { male: "es-MX-Alejo:MAI-Voice-2",  female: "es-MX-Valeria:MAI-Voice-2", neutral: "es-MX-Valeria:MAI-Voice-2" },
    ar: { male: "ar-SA-HamedNeural",    female: "ar-SA-ZariyahNeural",     neutral: "ar-SA-ZariyahNeural"     },
    fr: { male: "fr-FR-Marc:MAI-Voice-2",   female: "fr-FR-Soleil:MAI-Voice-2",  neutral: "fr-FR-Soleil:MAI-Voice-2"  },
    pt: { male: "pt-BR-Caio:MAI-Voice-2",   female: "pt-BR-Luana:MAI-Voice-2",   neutral: "pt-BR-Luana:MAI-Voice-2"   },
    ru: { male: "ru-RU-Lev:MAI-Voice-2",    female: "ru-RU-Masha:MAI-Voice-2",   neutral: "ru-RU-Masha:MAI-Voice-2"   },
    id: { male: "id-ID-ArdiNeural",     female: "id-ID-GadisNeural",       neutral: "id-ID-GadisNeural"       },
    he: { male: "he-IL-AvriNeural",     female: "he-IL-HilaNeural",        neutral: "he-IL-HilaNeural"        },
    de: { male: "de-DE-Klaus:MAI-Voice-2",  female: "de-DE-Mia:MAI-Voice-2",     neutral: "de-DE-Mia:MAI-Voice-2"     },
    ja: { male: "ja-JP-KeitaNeural",    female: "ja-JP-NanamiNeural",      neutral: "ja-JP-NanamiNeural"      },
};

/** Resolve a user gender preference to an Azure voice name for a given language. */
export function resolveVoice(lang: string, gender: string | undefined): string {
    const voices = AZURE_VOICES[lang] ?? AZURE_VOICES["en"];
    if (gender === "male")   return voices.male;
    if (gender === "female") return voices.female;
    return voices.neutral;
}

// ── Expressive speaking styles ────────────────────────────────────────────────
// Two mechanisms, chosen per language by what Azure actually offers — checked
// exhaustively 2026-08-14 against the live voices-list endpoint (StyleList
// field), across every regional sub-locale Azure has for each language, not
// just the one Imotara assigns:
//
//   1. Named <mstts:express-as> styles, for the 9 languages below whose
//      assigned voice has a real StyleList — en/hi/zh/fr/pt/de/es via the
//      MAI-Voice-2 upgrade (AZURE_VOICES above), ru likewise, ja on its
//      existing (unupgraded — no MAI-Voice-2 exists for Japanese) voice.
//   2. A conservative <prosody> rate/pitch fallback (resolveProsody below),
//      for the 13 languages where NO Azure voice — in any regional variant —
//      supports named styles at all: mr, bn, ta, te, gu, pa, kn, ml, or, ur,
//      ar, id, he. This isn't a style substitute, just a small, deliberately
//      subtle emotional inflection where a real style genuinely doesn't exist.
//
// `emotion` is the USER's detected emotional state (the canonical 8-value
// vocabulary from src/types/history.ts, passed as a plain string over the
// wire — this module stays platform/type-agnostic so mobile can send the
// same values without sharing that type), not a style for Imotara's own
// reply — deliberately not 1:1: a user's anger/fear/disgust should make
// Imotara sound calm and steady, not angry or afraid back at them. Both
// mechanisms below follow that same rule.
//
// No emotion signal (manual "read aloud" taps don't pass one) → no style,
// no prosody wrapper, plain default delivery. Earlier versions of this file
// glued a fixed default style onto every message in a styled language
// regardless of content (e.g. Jenny's "friendly" always-on) — retired here:
// a style that never varies isn't actually emotion-aware, it's just voice
// character, and forcing one onto messages with no detected emotion was
// never validated as sounding better than the voice's own plain delivery.
export type CanonicalEmotion =
    | "joy" | "sadness" | "anger" | "fear" | "disgust" | "surprise" | "gratitude" | "neutral";

// Shared by every MAI-Voice-2-upgraded language except Russian — all of
// en/hi/zh/fr/pt/de/es were deliberately paired to identical male/female
// 18-style StyleLists (picking the specific MAI-Voice-2 voice names in
// AZURE_VOICES above with that in mind), so one shared map covers all 7:
// angry/confused/determined/disgusted/embarrassed/excited/fearful/happy/
// hopeful/jealous/joyful/regretful/relieved/sad/shouting/softvoice/
// surprised/whispering. "softvoice" is used for anger/fear/disgust — a
// calm, gentle register, not a mirrored negative one; "relieved" for
// gratitude reads as warm appreciation without overclaiming "excited".
const RICH18_EMOTION_STYLE: Partial<Record<CanonicalEmotion, string>> = {
    joy: "happy", sadness: "sad", anger: "softvoice", fear: "softvoice",
    disgust: "softvoice", surprise: "surprised", gratitude: "relieved",
};

// Russian's MAI-Voice-2 pair (Lev/Masha) has a different, smaller StyleList:
// adventurous/caringempathy/curious/encouraging/excited/friendlycheerful/
// nostalgic/reflective/saddisappointed/serious. "caringempathy" covers
// anger/fear/disgust — arguably an even better calming match than the
// 18-style set's "softvoice".
const RU_EMOTION_STYLE: Partial<Record<CanonicalEmotion, string>> = {
    joy: "friendlycheerful", sadness: "saddisappointed", anger: "caringempathy",
    fear: "caringempathy", disgust: "caringempathy", surprise: "excited",
    gratitude: "encouraging",
};

// Japanese keeps its existing (unupgraded) voice — Nanami's only genuinely
// emotional style is "cheerful"; the other two ("chat"/"customerservice")
// are conversational modes, not emotions, so they're not mapped here.
// Negative emotions get no style override (no matching option exists) and
// fall through to plain delivery, which is more honest than forcing a
// mismatched style.
const JA_EMOTION_STYLE: Partial<Record<CanonicalEmotion, string>> = {
    joy: "cheerful", gratitude: "cheerful", surprise: "cheerful",
};

const EMOTION_STYLE_MAP: Record<string, Partial<Record<CanonicalEmotion, string>>> = {
    en: RICH18_EMOTION_STYLE, hi: RICH18_EMOTION_STYLE, zh: RICH18_EMOTION_STYLE,
    fr: RICH18_EMOTION_STYLE, pt: RICH18_EMOTION_STYLE, de: RICH18_EMOTION_STYLE,
    es: RICH18_EMOTION_STYLE, ru: RU_EMOTION_STYLE, ja: JA_EMOTION_STYLE,
};

/** Return the named emotional style for a voice, or undefined if this language
 *  has no real Azure style support (use resolveProsody instead) or no emotion
 *  was detected. `gender` isn't consulted — every EMOTION_STYLE_MAP language's
 *  male/female voice pair was deliberately chosen to share the same StyleList. */
export function resolveStyle(lang: string, gender: string | undefined, emotion?: string): string | undefined {
    void gender;
    if (!emotion) return undefined;
    const map = EMOTION_STYLE_MAP[lang];
    if (!map) return undefined;
    return map[emotion.toLowerCase() as CanonicalEmotion];
}

// Languages with zero named-style voices anywhere in Azure's catalog for
// that language (checked exhaustively across every regional sub-locale, not
// just Imotara's assigned voice) — these get the <prosody> fallback below
// instead of a named style, since no real style option exists to reach for.
const PROSODY_FALLBACK_LANGS = new Set([
    "mr", "bn", "ta", "te", "gu", "pa", "kn", "ml", "or", "ur", "ar", "id", "he",
]);

/**
 * Small, deliberately conservative rate/pitch adjustment for languages with
 * no named-style voice available at all. Azure's neural voices already
 * sound natural at their default prosody; large swings read as artificial,
 * which is exactly what went wrong with this file's earlier blanket
 * -8%/+1% wrapper (removed 2026-08-13, see route.ts's history) — these
 * values are far smaller and, unlike that wrapper, only ever apply when a
 * real emotion was actually detected, never unconditionally. Same
 * calm-not-mirrored philosophy as resolveStyle: sadness/anger/fear/disgust
 * all get the same gentle slow-down, not a distinct "sound angry" register.
 */
export function resolveProsody(lang: string, emotion?: string): { rate: string; pitch: string } | undefined {
    if (!emotion || !PROSODY_FALLBACK_LANGS.has(lang)) return undefined;
    const e = emotion.toLowerCase();
    if (e === "sadness" || e === "anger" || e === "fear" || e === "disgust") {
        return { rate: "-6%", pitch: "-2%" };
    }
    if (e === "joy" || e === "gratitude" || e === "surprise") {
        return { rate: "+5%", pitch: "+3%" };
    }
    return undefined; // neutral or unrecognized — plain delivery
}

/** BCP-47 locale for each language — used in SSML xml:lang attribute. */
export const AZURE_LOCALE: Record<string, string> = {
    en: "en-US", hi: "hi-IN", mr: "mr-IN", bn: "bn-IN",
    ta: "ta-IN", te: "te-IN", gu: "gu-IN", pa: "pa-IN",
    kn: "kn-IN", ml: "ml-IN", or: "or-IN", ur: "ur-PK",
    zh: "zh-CN", es: "es-MX", ar: "ar-SA", fr: "fr-FR",
    pt: "pt-BR", ru: "ru-RU", id: "id-ID", he: "he-IL",
    de: "de-DE", ja: "ja-JP",
};
