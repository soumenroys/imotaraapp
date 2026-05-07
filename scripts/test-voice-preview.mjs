/**
 * Pure logic test — no browser needed.
 * Traces the speakPreview routing for every lang × gender × name combination
 * and checks that the right MP3 file or TTS text would be used.
 */
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MP3_DIR   = join(__dirname, "../public/tts-preview");

// ── Mirror the exact logic from src/app/settings/page.tsx ────────────────────

const PREVIEW_TEXT_BY_LANG = {
  en: "Hi, I'm Imotara. I'm here with you.",
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

function previewGenderFile(gender) {
  return gender === "male" ? "male" : "female";
}

function simulateSpeakPreview(lang, gender, name) {
  const effectiveName = name?.trim() || "Imotara";
  const hasCustomName = effectiveName !== "Imotara";

  if (lang !== "en") {
    const genderFile = previewGenderFile(gender);
    const mp3Path    = `/tts-preview/${lang}-${genderFile}.mp3`;
    const mp3Local   = join(MP3_DIR, `${lang}-${genderFile}.mp3`);
    const mp3Exists  = existsSync(mp3Local);

    const nameAfter = hasCustomName
      ? { text: `I'm ${effectiveName}.`, lang: "en-US" }
      : null;

    return { path: "azure-mp3", mp3Path, mp3Exists, genderFile, nameAfter };
  }

  // English
  const previewText = hasCustomName
    ? `Hi, I'm ${effectiveName}. I'm here with you.`
    : PREVIEW_TEXT_BY_LANG["en"];

  return { path: "native-tts", text: previewText, ttsLang: "en-US" };
}

// ── Test matrix ───────────────────────────────────────────────────────────────

const LANGS   = Object.keys(PREVIEW_TEXT_BY_LANG);
const GENDERS = ["male", "female", "nonbinary", "prefer_not"]; // real values from settings
const NAMES   = [
  { label: "no name",     value: "" },
  { label: 'name="Elina"', value: "Elina" },
];

let pass = 0, fail = 0;
const failures = [];

console.log("\n═══════════════════════════════════════════════════════════════════");
console.log("  Voice Preview Logic Test");
console.log("═══════════════════════════════════════════════════════════════════");

for (const { label, value: name } of NAMES) {
  console.log(`\n── ${label} ─────────────────────────────────────────────────`);
  console.log(`  ${"LANG".padEnd(4)} ${"GENDER".padEnd(12)} ${"ROUTE".padEnd(12)} DETAIL`);
  console.log(`  ${"─".repeat(68)}`);

  for (const lang of LANGS) {
    for (const gender of GENDERS) {
      const r = simulateSpeakPreview(lang, gender, name);
      const errors = [];

      if (r.path === "azure-mp3") {
        if (!r.mp3Exists) errors.push(`MP3 missing: ${r.mp3Path}`);
        // Gender check: nonbinary/prefer_not → maps to "female" file
        const expectedFile = gender === "male" ? "male" : "female";
        if (r.genderFile !== expectedFile) errors.push(`wrong gender file: ${r.genderFile}`);
        // Custom name → English name TTS must fire after
        if (name && !r.nameAfter) errors.push("nameAfter missing for custom name");
        if (r.nameAfter && r.nameAfter.lang !== "en-US") errors.push(`name TTS lang wrong: ${r.nameAfter.lang}`);
        if (r.nameAfter && !r.nameAfter.text.includes(name)) errors.push(`name not in TTS text`);
      } else {
        // native-tts
        if (!r.text) errors.push("no text to speak");
        if (r.ttsLang !== "en-US") errors.push(`wrong TTS lang: ${r.ttsLang}`);
        if (name && !r.text.includes(name)) errors.push(`custom name not in text: "${r.text}"`);
        if (!name && !r.text.includes("Imotara")) errors.push(`"Imotara" missing from default text`);
      }

      const ok     = errors.length === 0;
      const icon   = ok ? "✅" : "❌";
      const detail = r.path === "azure-mp3"
        ? `${r.mp3Path}${r.nameAfter ? ` → "${r.nameAfter.text}" [en-US]` : ""}`
        : `"${r.text}" [${r.ttsLang}]`;

      console.log(`  ${icon} ${lang.padEnd(4)} ${gender.padEnd(12)} ${r.path.padEnd(12)} ${detail}`);

      if (ok) pass++; else { fail++; failures.push({ lang, gender, name, errors, detail }); }
    }
  }
}

console.log("\n═══════════════════════════════════════════════════════════════════");
console.log(`  Total: ${pass + fail}   ✅ Passed: ${pass}   ❌ Failed: ${fail}`);

if (failures.length) {
  console.log("\n  Failures:");
  for (const f of failures) {
    console.log(`  ❌ [${f.lang}][${f.gender}][name="${f.name}"]: ${f.errors.join(", ")}`);
  }
}
console.log("═══════════════════════════════════════════════════════════════════\n");

process.exit(fail > 0 ? 1 : 0);
