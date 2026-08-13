// src/lib/azure-tts/voices.ts
// Azure Neural TTS voice names for all 22 Imotara languages.
// Nonbinary / other / prefer_not fall back to the neutral (female) voice.

export type AzureGender = "male" | "female" | "neutral";

export interface AzureVoiceSet {
    male:    string;
    female:  string;
    neutral: string; // used for nonbinary / other / prefer_not
}

export const AZURE_VOICES: Record<string, AzureVoiceSet> = {
    en: { male: "en-US-AndrewNeural",   female: "en-US-JennyNeural",       neutral: "en-US-JennyNeural"       },
    hi: { male: "hi-IN-MadhurNeural",   female: "hi-IN-SwaraNeural",       neutral: "hi-IN-SwaraNeural"       },
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
    zh: { male: "zh-CN-YunxiNeural",    female: "zh-CN-XiaoxiaoNeural",    neutral: "zh-CN-XiaoxiaoNeural"    },
    es: { male: "es-ES-AlvaroNeural",   female: "es-ES-ElviraNeural",      neutral: "es-ES-ElviraNeural"      },
    ar: { male: "ar-SA-HamedNeural",    female: "ar-SA-ZariyahNeural",     neutral: "ar-SA-ZariyahNeural"     },
    fr: { male: "fr-FR-HenriNeural",    female: "fr-FR-DeniseNeural",      neutral: "fr-FR-DeniseNeural"      },
    pt: { male: "pt-BR-AntonioNeural",  female: "pt-BR-FranciscaNeural",   neutral: "pt-BR-FranciscaNeural"   },
    ru: { male: "ru-RU-DmitryNeural",   female: "ru-RU-SvetlanaNeural",    neutral: "ru-RU-SvetlanaNeural"    },
    id: { male: "id-ID-ArdiNeural",     female: "id-ID-GadisNeural",       neutral: "id-ID-GadisNeural"       },
    he: { male: "he-IL-AvriNeural",     female: "he-IL-HilaNeural",        neutral: "he-IL-HilaNeural"        },
    de: { male: "de-DE-ConradNeural",   female: "de-DE-KatjaNeural",       neutral: "de-DE-KatjaNeural"       },
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
// Azure Neural voices that support <mstts:express-as> style tags.
// Only voices with confirmed style support are listed here.
// Indian-language and Arabic/Russian voices use standard neural (no style),
// except hi-IN-SwaraNeural, which does have confirmed style support — not yet
// wired in below (see the Hindi note further down), a scoped-out follow-up.
//
// Verified 2026-08-13 directly against Azure's live voices-list endpoint
// (StyleList field) — several entries below were previously guessed and were
// silently wrong: Azure ignores an unsupported style rather than erroring, so
// en-US-AndrewNeural (zero style support), ja-JP-KeitaNeural (zero style
// support), de-DE-KatjaNeural (zero style support), and es-ES-ElviraNeural
// (zero style support) have never actually applied the style we were sending
// them — they've always spoken in default/plain delivery. en-US-JennyNeural
// and zh-CN-YunxiNeural were also requesting styles ("empathetic"/"friendly")
// neither voice actually supports. All corrected below to values confirmed
// present in each voice's real StyleList, or to `undefined` where the voice
// has no style support at all (honest, and functionally unchanged from
// before, since the old unsupported value was already a silent no-op).
export interface AzureStyleSet {
    female?: string;
    male?:   string;
}

export const AZURE_VOICE_STYLES: Record<string, AzureStyleSet> = {
    en: { female: "friendly",   male: undefined    }, // Jenny: confirmed; Andrew: no styles at all
    zh: { female: "gentle",     male: "chat"       }, // Xiaoxiao: confirmed; Yunxi: "friendly" unsupported, "chat" is
    ja: { female: "chat",       male: undefined    }, // Nanami: confirmed; Keita: no styles at all
    fr: { female: "cheerful",   male: "cheerful"   }, // both confirmed
    de: { female: undefined,    male: undefined    }, // Katja: no styles at all
    pt: { female: "calm",       male: undefined    }, // Francisca: confirmed
    es: { female: undefined,    male: undefined    }, // Elvira: no styles at all
};

// Emotion-driven style override, layered on top of the fixed per-language
// default above. `emotion` here is the USER's detected emotional state (the
// canonical 8-value vocabulary from src/types/history.ts, passed as a plain
// string over the wire — this module stays platform/type-agnostic so mobile
// can send the same values without sharing that type), not a style for
// Imotara's own reply — the mapping is deliberately not 1:1: a user's anger
// or fear should make Imotara sound *empathetic*, not angry or fearful back
// at them.
//
// Implemented for English only for now. Values below verified 2026-08-13
// directly against en-US-JennyNeural's real StyleList (Andrew has zero style
// support, so this override only has an audible effect on the female voice
// today — see the AZURE_VOICE_STYLES comment above). Jenny does NOT support
// "empathetic" (an earlier version of this table assumed she did, silently
// no-op'd) — "sad" is both confirmed-supported and a closer semantic match
// for sadness anyway; "friendly" is the closest confirmed-supported option
// for a calm, non-escalating reaction to fear/anger/disgust (Jenny has no
// literal "calm"/"empathetic"/"reassuring" style). The other styled
// languages (zh/ja/fr/de/pt/es) keep their fixed default style — extending
// emotion-awareness to them is a follow-up, not required now.
const EN_EMOTION_STYLE: Record<string, string> = {
    sadness: "sad", fear: "friendly", anger: "friendly", disgust: "friendly",
    joy: "cheerful", gratitude: "cheerful", surprise: "excited",
    // neutral (or any unrecognized value) falls through to the per-gender default below.
};

/** Return the emotional speaking style for a voice, or undefined if not supported.
 *  `emotion` (optional) is the user's detected emotion — see EN_EMOTION_STYLE above. */
export function resolveStyle(lang: string, gender: string | undefined, emotion?: string): string | undefined {
    if (lang === "en" && emotion) {
        const override = EN_EMOTION_STYLE[emotion.toLowerCase()];
        if (override) return override;
    }
    const styles = AZURE_VOICE_STYLES[lang];
    if (!styles) return undefined;
    return gender === "male" ? styles.male : styles.female;
}

/** BCP-47 locale for each language — used in SSML xml:lang attribute. */
export const AZURE_LOCALE: Record<string, string> = {
    en: "en-US", hi: "hi-IN", mr: "mr-IN", bn: "bn-IN",
    ta: "ta-IN", te: "te-IN", gu: "gu-IN", pa: "pa-IN",
    kn: "kn-IN", ml: "ml-IN", or: "or-IN", ur: "ur-PK",
    zh: "zh-CN", es: "es-ES", ar: "ar-SA", fr: "fr-FR",
    pt: "pt-BR", ru: "ru-RU", id: "id-ID", he: "he-IL",
    de: "de-DE", ja: "ja-JP",
};
