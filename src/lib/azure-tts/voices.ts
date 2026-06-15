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
// Indian-language and Arabic/Russian voices use standard neural (no style).
//
// Style choices for Imotara (companion app):
//   empathetic — warm, emotionally resonant (JennyNeural)
//   chat       — conversational, natural pacing (AndrewNeural, YunxiNeural, NanamiNeural, KeitaNeural)
//   gentle     — soft and calm (XiaoxiaoNeural)
//   cheerful   — warm and upbeat (DeniseNeural, HenriNeural, KatjaNeural, ElviraNeural, FranciscaNeural)

export interface AzureStyleSet {
    female?: string;
    male?:   string;
}

export const AZURE_VOICE_STYLES: Record<string, AzureStyleSet> = {
    en: { female: "empathetic", male: "chat"      },
    zh: { female: "gentle",     male: "friendly"  },
    ja: { female: "chat",       male: "chat"       },
    fr: { female: "cheerful",   male: "cheerful"   },
    de: { female: "cheerful",   male: undefined    },
    pt: { female: "calm",       male: undefined    },
    es: { female: "cheerful",   male: undefined    },
};

/** Return the emotional speaking style for a voice, or undefined if not supported. */
export function resolveStyle(lang: string, gender: string | undefined): string | undefined {
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
