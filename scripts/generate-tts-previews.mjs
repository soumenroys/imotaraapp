#!/usr/bin/env node
// scripts/generate-tts-previews.mjs
// One-time script — generates 42 static preview MP3 files using Azure Neural TTS.
// Output: public/tts-preview/{lang}-{gender}.mp3  (22 langs × 2 genders, including English)
//
// Usage:
//   node scripts/generate-tts-previews.mjs
//
// Requires AZURE_SPEECH_KEY_IN and AZURE_SPEECH_REGION_IN in .env.local
// (uses the India region since these files are generated once and served via CDN globally)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local manually (no dotenv dependency needed)
function loadEnv() {
    const envPath = path.join(__dirname, "..", ".env.local");
    if (!fs.existsSync(envPath)) throw new Error(".env.local not found");
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx < 0) continue;
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (val) process.env[key] = val;
    }
}
loadEnv();

const AZURE_KEY    = process.env.AZURE_SPEECH_KEY_IN;
const AZURE_REGION = process.env.AZURE_SPEECH_REGION_IN ?? "centralindia";

if (!AZURE_KEY) {
    console.error("❌ AZURE_SPEECH_KEY_IN not set in .env.local");
    process.exit(1);
}

// ── Voice map ────────────────────────────────────────────────────────────────

const VOICES = {
    en: { male: "en-IN-PrabhatNeural",   female: "en-IN-NeerjaNeural"      },
    hi: { male: "hi-IN-MadhurNeural",   female: "hi-IN-SwaraNeural"       },
    mr: { male: "mr-IN-ManoharNeural",  female: "mr-IN-AarohiNeural"      },
    bn: { male: "bn-IN-BashkarNeural",  female: "bn-IN-TanishaaNeural"    },
    ta: { male: "ta-IN-ValluvarNeural", female: "ta-IN-PallaviNeural"     },
    te: { male: "te-IN-MohanNeural",    female: "te-IN-ShrutiNeural"      },
    gu: { male: "gu-IN-NiranjanNeural", female: "gu-IN-DhwaniNeural"      },
    pa: { male: "pa-IN-OjasNeural",     female: "pa-IN-VaaniNeural"       },
    kn: { male: "kn-IN-GaganNeural",    female: "kn-IN-SapnaNeural"       },
    ml: { male: "ml-IN-MidhunNeural",   female: "ml-IN-SobhanaNeural"     },
    or: { male: "or-IN-SukantNeural",   female: "or-IN-SubhasiniNeural"   },
    ur: { male: "ur-PK-AsadNeural",     female: "ur-PK-UzmaNeural"        },
    zh: { male: "zh-CN-YunxiNeural",    female: "zh-CN-XiaoxiaoNeural"    },
    es: { male: "es-ES-AlvaroNeural",   female: "es-ES-ElviraNeural"      },
    ar: { male: "ar-SA-HamedNeural",    female: "ar-SA-ZariyahNeural"     },
    fr: { male: "fr-FR-HenriNeural",    female: "fr-FR-DeniseNeural"      },
    pt: { male: "pt-BR-AntonioNeural",  female: "pt-BR-FranciscaNeural"   },
    ru: { male: "ru-RU-DmitryNeural",   female: "ru-RU-SvetlanaNeural"    },
    id: { male: "id-ID-ArdiNeural",     female: "id-ID-GadisNeural"       },
    he: { male: "he-IL-AvriNeural",     female: "he-IL-HilaNeural"        },
    de: { male: "de-DE-ConradNeural",   female: "de-DE-KatjaNeural"       },
    ja: { male: "ja-JP-KeitaNeural",    female: "ja-JP-NanamiNeural"      },
};

const LOCALE = {
    en:"en-IN",
    hi:"hi-IN", mr:"mr-IN", bn:"bn-IN", ta:"ta-IN", te:"te-IN",
    gu:"gu-IN", pa:"pa-IN", kn:"kn-IN", ml:"ml-IN", or:"or-IN",
    ur:"ur-PK", zh:"zh-CN", es:"es-ES", ar:"ar-SA", fr:"fr-FR",
    pt:"pt-BR", ru:"ru-RU", id:"id-ID", he:"he-IL", de:"de-DE", ja:"ja-JP",
};

const PREVIEW_TEXT = {
    en: "Hello, I'm Imotara. I'm here with you.",
    hi: "नमस्ते, मैं इमोतारा हूँ. मैं आपके साथ हूँ।",
    mr: "नमस्कार, मी इमोतारा आहे. मी तुमच्यासोबत आहे।",
    bn: "হ্যালো, আমি ইমোতারা. আমি তোমার সাথে আছি।",
    ta: "வணக்கம், நான் இமோதாரா. நான் உங்களுடன் இருக்கிறேன்.",
    te: "నమస్కారం, నేను ఇమోతారా. నేను మీతో ఉన్నాను.",
    gu: "નમસ્તે, હું ઇમોતારા છું. હું તમારી સાથે છું.",
    pa: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ, ਮੈਂ ਇਮੋਤਾਰਾ ਹਾਂ. ਮੈਂ ਤੁਹਾਡੇ ਨਾਲ ਹਾਂ।",
    kn: "ನಮಸ್ಕಾರ, ನಾನು ಇಮೋತಾರ. ನಾನು ನಿಮ್ಮೊಂದಿಗೆ ಇದ್ದೇನೆ.",
    ml: "ഹലോ, ഞാൻ ഇമോതാര. ഞാൻ നിങ്ങളോടൊപ്പം ഉണ്ട്.",
    or: "ନମସ୍କାର, ମୁଁ ଇମୋତାରା. ମୁଁ ଆପଣଙ୍କ ସହ ଅଛି।",
    ur: "ہیلو، میں امتارا ہوں. میں آپ کے ساتھ ہوں۔",
    zh: "你好，我是 Imotara。我在你身边。",
    es: "Hola, soy Imotara. Estoy aqui contigo.",
    ar: "مرحباً، أنا إيموتارا. أنا هنا معك.",
    fr: "Bonjour, je suis Imotara. Je suis la pour vous.",
    pt: "Ola, sou o Imotara. Estou aqui com voce.",
    ru: "Привет, я Имотара. Я здесь рядом с тобой.",
    id: "Halo, saya Imotara. Saya di sini bersamamu.",
    he: "שלום, אני אימוטרה. אני כאן איתך.",
    de: "Hallo, ich bin Imotara. Ich bin fuer dich da.",
    ja: "こんにちは、私はイモタラです。ここにいますよ。",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeXml(str) {
    return str
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

async function synthesize(voice, locale, text) {
    const ssml = `<speak version="1.0" xml:lang="${locale}" xmlns="http://www.w3.org/2001/10/synthesis">
  <voice name="${voice}">${escapeXml(text)}</voice>
</speak>`;

    const res = await fetch(
        `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
            method: "POST",
            headers: {
                "Ocp-Apim-Subscription-Key": AZURE_KEY,
                "Content-Type": "application/ssml+xml",
                "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
                "User-Agent": "ImotaraPreviewGen/1.0",
            },
            body: ssml,
        },
    );

    if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Azure ${res.status}: ${err}`);
    }

    return Buffer.from(await res.arrayBuffer());
}

// ── Main ─────────────────────────────────────────────────────────────────────

const outDir = path.join(__dirname, "..", "public", "tts-preview");
fs.mkdirSync(outDir, { recursive: true });

const langs = Object.keys(VOICES);
const total = langs.length * 2;
let done = 0;
let failed = 0;

console.log(`\nGenerating ${total} preview MP3s → public/tts-preview/\n`);

for (const lang of langs) {
    for (const gender of ["male", "female"]) {
        const fileName = `${lang}-${gender}.mp3`;
        const outPath  = path.join(outDir, fileName);

        // Skip if already generated (re-run safe)
        if (fs.existsSync(outPath)) {
            console.log(`  ⏭  ${fileName} (already exists)`);
            done++;
            continue;
        }

        const voice  = VOICES[lang][gender];
        const locale = LOCALE[lang];
        const text   = PREVIEW_TEXT[lang];

        process.stdout.write(`  ⏳  ${fileName} (${voice}) ... `);
        try {
            const audio = await synthesize(voice, locale, text);
            fs.writeFileSync(outPath, audio);
            console.log(`✅  ${(audio.length / 1024).toFixed(1)} KB`);
            done++;
        } catch (err) {
            console.log(`❌  ${err.message}`);
            failed++;
        }

        // Small delay to avoid Azure rate limiting
        await new Promise(r => setTimeout(r, 200));
    }
}

console.log(`\n${done} generated, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
