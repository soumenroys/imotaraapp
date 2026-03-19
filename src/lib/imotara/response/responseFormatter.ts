// src/lib/imotara/response/responseFormatter.ts
//
// Core, reusable formatter that forces every reply into the
// "Three-Part Humanized Communication" framework.

import { EN_LANG_HINT_REGEX } from "../../emotion/keywordMaps";
//
// Phase 1: Spontaneous Reaction
// Phase 2: Actual Insight/Value
// Phase 3: Conversational Bridge
//
// Notes:
// - Deterministic variability: reaction is chosen via a stable hash seed
// - Multilingual: uses per-language reaction/bridge banks (idiomatic-ish, not literal)
// - Removes robotic markers like "As an AI"
// - Keeps reply object shape unchanged (caller returns { text, meta })

export type ImotaraPersonaTone =
  | "close_friend"
  | "calm_companion"
  | "coach"
  | "mentor"
  | "partner_like";

export type FormatReplyInput = {
  // model-generated reply text (unformatted)
  raw: string;

  // raw user message (needed for continuity + suggestion requests)
  userMessage?: string;

  /**
   * Optional: last assistant message (for de-dup across turns).
   * Safe to omit; formatter will behave as before.
   */
  prevAssistantText?: string;

  /**
   * Optional: a model-generated bridge/handoff line (e.g., followUp).
   * If provided, formatter will use this as Phase 3 instead of selecting
   * from internal bridge banks (avoids hardcoded closers).
   */
  externalBridge?: string;

  /**
   * If true, formatter must NOT append Phase 3 (no conversational bridge).
   * Used for "closure / pause" states like: "I'll talk later", "going for a walk".
   */
  disableBridge?: boolean;

  lang?: string;
  tone?: ImotaraPersonaTone;
  seed?: string;
  intent?: "emotional" | "practical";
  mode?: "return";
};

function hash32(s: string): number {
  // small, fast deterministic hash
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normalizeLang(lang?: string): string {
  const l = (lang ?? "").trim().toLowerCase();
  if (!l) return "en";

  if (l.startsWith("hi")) return "hi";
  if (l.startsWith("bn")) return "bn";
  if (l.startsWith("ta")) return "ta";
  if (l.startsWith("te")) return "te";
  if (l.startsWith("mr")) return "mr";
  if (l.startsWith("gu")) return "gu";
  if (l.startsWith("kn")) return "kn";
  if (l.startsWith("ml")) return "ml";
  if (l.startsWith("pa")) return "pa";
  if (l.startsWith("ur")) return "ur";
  if (l.startsWith("or")) return "or";

  if (l.startsWith("es")) return "es";
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("pt")) return "pt";
  if (l.startsWith("ru")) return "ru";
  if (l.startsWith("ar")) return "ar";
  if (l.startsWith("id")) return "id";
  if (l.startsWith("zh")) return "zh";
  if (l.startsWith("he")) return "he";
  if (l.startsWith("de")) return "de";
  if (l.startsWith("ja")) return "ja";

  return l;
}

// -----------------------------
// Soft mirroring (Option B)
// If user mixes native script + clear English, keep native language
// but allow a couple short English "tags".
// -----------------------------
const SOFT_MIX_EN_TAGS = [
  "Okay.",
  "That makes sense.",
  "Thanks for telling me.",
] as const;

function wantsSoftMix(userMsg: string, lang: string): boolean {
  const msg = String(userMsg ?? "");
  if (!msg) return false;

  const hasLatin = /[A-Za-z]/.test(msg);
  if (!hasLatin) return false;

  // "Clear English" hint: prevents random Latin names from triggering soft-mix
  const hasEnglishHint = EN_LANG_HINT_REGEX.test(msg);
  if (!hasEnglishHint) return false;

  if (lang === "bn") return /[\u0980-\u09FF]/.test(msg); // Bengali script present
  if (lang === "hi") return /[\u0904-\u0939\u0958-\u0963\u0971-\u097F]/.test(msg); // Devanagari present

  return false;
}

function statementBridgeBankWithSoftMix(
  lang: string,
  tone: ImotaraPersonaTone,
  userMsg: string,
): readonly string[] {
  const base = bridgeStatementBank(lang, tone);
  return wantsSoftMix(userMsg, lang) ? [...base, ...SOFT_MIX_EN_TAGS] : base;
}

function stripRoboticMarkers(s: string): string {
  let out = (s ?? "").trim();

  // Remove common "robotic markers"
  out = out.replace(/\bAs an AI\b[:,]?\s*/gi, "");
  out = out.replace(/\bAs a language model\b[:,]?\s*/gi, "");
  out = out.replace(/\bI(?:\s+am|'m)\s+an\s+AI\b[:,]?\s*/gi, "");

  // clean repeated whitespace
  out = out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return out;
}

function removeLeadingInterjection(s: string): string {
  // If model already starts with "Wow!/Hmm!/Oh," etc. we’ll strip it so we can control Phase 1.
  // Also handle "Right... Hmm..." and double interjections like "Hmm... Hmm..."
  let out = (s ?? "").trim();

  const rx =
    /^(wow|oh|hmm|huh|really|hey|okay|ok|ah|aww|whoa|mm|right|alright|well)\b[!,.…—\- ]+/i;

  // Strip up to 2 leading interjections (covers "Right... Hmm..." and "Hmm... Hmm...")
  for (let i = 0; i < 2; i++) {
    const next = out.replace(rx, "").trim();
    if (next === out) break;
    out = next;
  }

  return out;
}

function reactionBank(lang: string, tone: ImotaraPersonaTone): string[] {
  switch (lang) {
    case "hi":
      return [
        "अरे…",
        "ओह!",
        "हम्म…",
        "सच?",
        "अच्छा…",
        "वाह!",
        // Added variety (still short, human, not therapy-ish)
        "हूँ… समझ गया।",
        "ओके…",
        "ठीक है…",
        "हम्म… ये भारी लग रहा है।",
        "अरे यार…",
        "चलो…",
      ];

    case "bn":
      return [
        "আরে…",
        "ওহ!",
        "হুঁ…",
        "সত্যি?",
        "বাহ!",
        "আচ্ছা…",
        // Added variety (short, friendly, less templated)
        "ওকে…",
        "হুঁ… বুঝলাম।",
        "আচ্ছা—শুনছি।",
        "উফ… এটা ভারী লাগছে।",
        "আরে রে…",
        "ঠিক আছে…",
      ];

    case "ta":
      return [
        "அடே…",
        "ஓஹ்!",
        "ஹ்ம்…",
        "உண்மையா?",
        "வாவ்!",
        "சரி…",
        "சரி… கேட்கிறேன்.",
        "ஹ்ம்… புரிகிறது.",
        "ஓகே…",
        "உஃ… இது கனமாக இருக்கு.",
      ];

    case "te":
      return [
        "అరే…",
        "ఓహ్!",
        "హ్మ్…",
        "నిజమా?",
        "వావ్!",
        "సరే…",
        "సరే… చెప్తూ ఉండు.",
        "హ్మ్… అర్థమైంది.",
        "ఓకే…",
        "అయ్యో… ఇది కష్టం గా ఉంది.",
      ];

    case "mr":
      return [
        "अरे…",
        "ओह!",
        "हम्म…",
        "खरंच?",
        "वा!",
        "बरं…",
        "ठीक आहे…",
        "हम्म… समजलं.",
        "ओके…",
        "अरे यार…",
      ];

    case "gu":
      return [
        "અરે…",
        "ઓહ!",
        "હમ્મ…",
        "સાચે?",
        "વાહ!",
        "બરાબર…",
        "ઓકે…",
        "હમ્મ… સમજાયું.",
        "બરાબર છે…",
        "અરે યાર…",
      ];

    case "kn":
      return [
        "ಅಯ್ಯೋ…",
        "ಓಹ್!",
        "ಹ್ಮ್…",
        "ನಿಜವಾ?",
        "ವಾವ್!",
        "ಸರಿ…",
        "ಓಕೆ…",
        "ಹ್ಮ್… ಅರ್ಥ ಆಯ್ತು.",
        "ಸರಿ—ನಾನು ಕೇಳ್ತಿದ್ದೇನೆ.",
        "ಅಯ್ಯೋ… ಇದು ಕಷ್ಟ ಆಗ್ತಿದೆ ಅಲ್ವಾ.",
      ];

    case "ml":
      return [
        "അയ്യോ…",
        "ഓ!",
        "ഹ്മ്…",
        "ശരിക്കോ?",
        "വാവ്!",
        "ശരി…",
        "ഓക്കേ…",
        "ഹ്മ്… മനസ്സിലായി.",
        "ശരി… പറയൂ, കേൾക്കുന്നു.",
        "അയ്യോ… ഇത് ബുദ്ധിമുട്ടാണ്.",
      ];

    case "pa":
      return [
        "ਅਰੇ…",
        "ਓਹ!",
        "ਹੰਮ…",
        "ਸੱਚ?",
        "ਵਾਹ!",
        "ਠੀਕ ਹੈ…",
        "ਓਕੇ…",
        "ਹੰਮ… ਸਮਝ ਆਇਆ।",
        "ਚੱਲ…",
        "ਅਰੇ ਯਾਰ…",
      ];

    case "ur":
      return [
        "ارے…",
        "اوہ!",
        "ہمم…",
        "سچ؟",
        "واہ!",
        "اچھا…",
        "ٹھیک ہے…",
        "اوکے…",
        "ہمم… سمجھ گیا۔",
        "ارے یار…",
      ];

    case "or":
      return [
        "ଆରେ…",
        "ଓହ୍!",
        "ହୁଁ…",
        "ସତିକି?",
        "ବାହ୍!",
        "ଠିକ ଅଛି…",
        "ଓକେ…",
        "ହୁଁ… ବୁଝିଲି।",
        "ଆରେ ୟାର…",
        "ହାଁ…",
      ];

    case "ar":
      return [
        "آه…",
        "أوه!",
        "حسناً…",
        "حقاً؟",
        "رائع!",
        "أوكي…",
        "أفهم…",
        "آه… هذا ثقيل.",
        "حسناً — أنا أسمعك.",
        "أوف…",
      ];

    case "zh":
      return [
        "哎…",
        "哦！",
        "嗯…",
        "真的吗？",
        "哇！",
        "好吧…",
        "嗯……我明白了。",
        "哎，这很沉重。",
        "好——我在听。",
        "唔…",
      ];

    case "es":
      return [
        "Vaya…",
        "¡Oh!",
        "Hmm…",
        "¿En serio?",
        "¡Qué bueno!",
        "Oye…",
        "Entendido…",
        "Hmm… eso es mucho.",
        "Oye — te escucho.",
        "Uf…",
      ];

    case "fr":
      return [
        "Oh là…",
        "Oh !",
        "Hmm…",
        "Vraiment ?",
        "Super !",
        "Ok…",
        "Je vois…",
        "Hmm… c'est lourd.",
        "Ok — je t'écoute.",
        "Ouf…",
      ];

    case "pt":
      return [
        "Uau…",
        "Oh!",
        "Hmm…",
        "Sério?",
        "Que bom!",
        "Ok…",
        "Entendi…",
        "Hmm… isso é muito.",
        "Ok — estou ouvindo.",
        "Uf…",
      ];

    case "ru":
      return [
        "Ой…",
        "О!",
        "Хм…",
        "Правда?",
        "Здорово!",
        "Окей…",
        "Понятно…",
        "Хм… это тяжело.",
        "Окей — я слушаю.",
        "Уф…",
      ];

    case "id":
      return [
        "Eh…",
        "Oh!",
        "Hmm…",
        "Benarkah?",
        "Keren!",
        "Oke…",
        "Mengerti…",
        "Hmm… itu berat.",
        "Oke — aku dengar.",
        "Aduh…",
      ];

    case "he":
      return [
        "אוי…",
        "אוה!",
        "הממ…",
        "ממש?",
        "וואו!",
        "אוקיי…",
        "הממ… הבנתי.",
        "אה, זה כבד.",
        "בסדר — אני שומע/ת.",
        "אוף…",
      ];

    case "de":
      return [
        "Ach…",
        "Oh!",
        "Hmm…",
        "Wirklich?",
        "Wow!",
        "Ok…",
        "Hmm… ich verstehe.",
        "Ohje…",
        "Ok — ich höre zu.",
        "Uff…",
      ];

    case "ja":
      return [
        "あ…",
        "ええ!",
        "うーん…",
        "本当に?",
        "わあ!",
        "そっか…",
        "うーん…なるほど。",
        "あ、それはつらいね。",
        "うん — 聞いてるよ。",
        "ふぅ…",
      ];

    default: {
      if (tone === "coach") {
        return [
          "Alright…",
          "Okay…",
          "Got it…",
          "Right…",
          "Hmm…",
          "Alright—let’s look at it.",
          "Okay… I’m with you.",
          "Got it… let’s steady this.",
        ];
      }

      if (tone === "mentor") {
        return [
          "Hmm…",
          "I see…",
          "Alright…",
          "Okay…",
          "Right…",
          "Hmm… let’s slow it down.",
          "I see… let’s make sense of it.",
          "Alright… we can unpack this.",
        ];
      }

      if (tone === "calm_companion") {
        return [
          "Hmm…",
          "Oh…",
          "I see…",
          "Okay…",
          "Alright…",
          "Hmm… I’m here.",
          "Okay… take your time.",
          "I see… we can go gently.",
        ];
      }

      if (tone === "partner_like") {
        return [
          "Hey…",
          "Hmm…",
          "I’m here…",
          "Okay…",
          "Oh…",
          "Hey… I’m with you.",
          "Okay… we’ll take it gently.",
          "Hmm… I’m right here.",
        ];
      }

      return [
        "Oh, I see…",
        "Hmm…",
        "Whoa.",
        "Aww…",
        "Oh!",
        "Okay…",
        "Got it…",
        "Right…",
        "Hmm… that’s a lot.",
        "Okay—tell me.",
        "Oh man…",
        "Alright… I’m here.",
      ];
    }
  }
}

function bridgeBank(lang: string, tone: ImotaraPersonaTone): readonly string[] {
  const closeFriend = {
    en: [
      "Want to try a tiny step right now, or tell me what part feels hardest?",
      "Do you want comfort first, or should we map a next step together?",
      "What feels like the next move for you — even a small one?",
    ],
    hi: [
      "चाहो तो अभी एक छोटा-सा कदम ट्राय करें—या बताओ सबसे मुश्किल हिस्सा कौन-सा लग रहा है?",
      "पहले थोड़ा हल्का करना है, या एक next step साथ में तय करें?",
      "तुम्हें अभी अगला छोटा कदम क्या सही लगता है?",
    ],
    bn: [
      "চাইলে এখন একটা ছোট্ট পদক্ষেপ নিতে পারি—না হলে বলো, কোন অংশটা সবচেয়ে কঠিন লাগছে?",
      "আগে একটু হালকা হওয়া দরকার, নাকি আমরা একসাথে পরের ছোট ধাপটা ঠিক করি?",
      "এখন তোমার কাছে সবচেয়ে ঠিক পরের ছোট পদক্ষেপটা কী মনে হচ্ছে?",
    ],
    ta: [
      "வேண்டும்னா இப்போ ஒரு சின்ன step எடுத்துக்கலாம்—அல்லது எந்த பகுதி அதிகமா கஷ்டமா இருக்கு என்று சொல்லலாம்?",
      "முதல்ல கொஞ்சம் லேசா ஆகணுமா, இல்ல next small step-ஐ சேர்ந்து பார்க்கலாமா?",
      "இப்போ உனக்கு சரியாக இருக்கும் அடுத்த சின்ன படி என்ன மாதிரி தோணுது?",
    ],
    te: [
      "ఇప్పుడే ఒక చిన్న అడుగు వేయాలనుకుంటున్నావా—లేక ఎక్కువగా కష్టంగా అనిపిస్తున్న భాగం ఏమిటో చెప్పాలనుకుంటున్నావా?",
      "ముందు కొంచెం తేలికగా అనిపించాలా, లేక next small step ని కలిసి చూసేద్దామా?",
      "ఇప్పుడే నీకు సరైన చిన్న తర్వాతి అడుగు ఏది అనిపిస్తోంది?",
    ],
    mr: [
      "आत्ता एक छोटंसं पाऊल घेऊन पाहूया का—किंवा सगळ्यात कठीण भाग कोणता वाटतो ते सांगशील?",
      "आधी थोडं हलकं व्हायचं आहे का, की पुढचा छोटा step आपण सोबत ठरवू?",
      "आत्ता तुला योग्य वाटणारा पुढचा छोटा पाऊल कोणता?",
    ],
    gu: [
      "હમણાં એક નાનું પગલું લઈએ કે પહેલાં કહેશો કે કયો ભાગ સૌથી ભારે લાગે છે?",
      "પહેલા થોડું હળવું થવું છે, કે પછીનો નાનો step સાથે નક્કી કરીએ?",
      "હમણાં તને યોગ્ય લાગતું આગળનું નાનું પગલું શું છે?",
    ],
    kn: [
      "ಈಗ ಒಂದು ಚಿಕ್ಕ ಹೆಜ್ಜೆ ಇಡೋಣವಾ—ಅಥವಾ ಯಾವ ಭಾಗ ಹೆಚ್ಚು ಕಷ್ಟವಾಗುತ್ತಿದೆ ಎಂದು ಹೇಳುವೆಯಾ?",
      "ಮೊದಲು ಸ್ವಲ್ಪ ಹಗುರವಾಗಬೇಕೆ, ಇಲ್ಲ next small step ಅನ್ನು ಜೊತೆಗೂಡಿ ನೋಡೋಣವಾ?",
      "ಈಗ ನಿನಗೆ ಸರಿಯೆನಿಸುವ ಮುಂದಿನ ಸಣ್ಣ ಹೆಜ್ಜೆ ಯಾವುದು?",
    ],
    ml: [
      "ഇപ്പോൾ ഒരു ചെറിയ പടി എടുക്കാമോ—അല്ലെങ്കിൽ ഏത് ഭാഗമാണ് ഏറ്റവും ബുദ്ധിമുട്ടായി തോന്നുന്നത് എന്ന് പറയും?",
      "ആദ്യം കുറച്ച് ലഘുവാകണമോ, അല്ലെങ്കിൽ next small step നമുക്ക് ഒരുമിച്ച് നോക്കാമോ?",
      "ഇപ്പോൾ നിനക്കു ശരിയായതായി തോന്നുന്ന അടുത്ത ചെറിയ പടി എന്താണ്?",
    ],
    pa: [
      "ਹੁਣ ਇੱਕ ਛੋਟਾ ਕਦਮ ਲੈ ਲਈਏ—ਜਾਂ ਦੱਸੇਂ ਕਿ ਸਭ ਤੋਂ ਔਖਾ ਹਿੱਸਾ ਕਿਹੜਾ ਲੱਗ ਰਿਹਾ ਹੈ?",
      "ਪਹਿਲਾਂ ਥੋੜ੍ਹਾ ਹਲਕਾ ਹੋਣਾ ਚਾਹੁੰਦਾ/ਚਾਹੁੰਦੀ ਹੈਂ, ਜਾਂ ਅਗਲਾ ਛੋਟਾ step ਇਕੱਠੇ ਤੈਅ ਕਰੀਏ?",
      "ਇਸ ਵੇਲੇ ਤੈਨੂੰ ਸਭ ਤੋਂ ਠੀਕ ਅਗਲਾ ਛੋਟਾ ਕਦਮ ਕੀ ਲੱਗਦਾ ਹੈ?",
    ],
    ur: [
      "چاہو تو ابھی ایک چھوٹا قدم لے سکتے ہیں—یا بتاؤ سب سے مشکل حصہ کون سا لگ رہا ہے؟",
      "پہلے تھوڑا ہلکا ہونا چاہتے ہو، یا اگلا چھوٹا step ساتھ میں طے کریں؟",
      "اس وقت تمہیں درست لگنے والا اگلا چھوٹا قدم کیا محسوس ہوتا ہے؟",
    ],
    or: [
      "ଚାହିଲେ ଏବେ ଗୋଟେ ଛୋଟ ପଦକ୍ଷେପ ନେଇପାରିବା—ନହେଲେ କହ, ସବୁଠାରୁ କଷ୍ଟକର ଅଂଶ କଣ ଲାଗୁଛି?",
      "ପ୍ରଥମେ ଥୋଡ଼ା ହଳକା ହେବାକୁ ଚାହୁଁଛ, ନା ଆମେ ପରବର୍ତ୍ତୀ ଛୋଟ step ଟା ସଙ୍ଗେ ସଙ୍ଗେ ଧରିବା?",
      "ଏବେ ତୁମକୁ ଠିକ ଲାଗୁଥିବା ପରବର୍ତ୍ତୀ ଛୋଟ ପଦକ୍ଷେପ କଣ ମନେ ହେଉଛି?",
    ],
    ar: [
      "هل تريد تجربة خطوة صغيرة الآن، أم تخبرني أي جزء يبدو الأصعب؟",
      "هل تحتاج أولاً إلى الشعور بتخفيف، أم نحدد الخطوة التالية معاً؟",
      "ما الخطوة الصغيرة التالية التي تبدو صحيحة لك الآن؟",
    ],
    zh: [
      "你想现在试一个小步骤，还是告诉我哪个部分感觉最难？",
      "先需要轻松一下，还是我们一起找出下一个小步骤？",
      "对你来说，现在最合适的下一个小步骤是什么？",
    ],
    es: [
      "¿Quieres intentar un pequeño paso ahora, o me dices qué parte se siente más difícil?",
      "¿Primero necesitas un poco de alivio, o trazamos juntos el siguiente paso?",
      "¿Qué pequeño paso siguiente sientes que es correcto para ti ahora mismo?",
    ],
    fr: [
      "Tu veux essayer un petit pas maintenant, ou me dire quelle partie te semble la plus dure ?",
      "Tu as besoin d'abord de te sentir soulagé, ou on cherche ensemble la prochaine étape ?",
      "Quel serait le prochain petit pas qui te semble juste maintenant ?",
    ],
    pt: [
      "Quer tentar um pequeno passo agora, ou me contar qual parte parece mais difícil?",
      "Precisa primeiro de um pouco de alívio, ou traçamos juntos o próximo passo?",
      "Qual o próximo pequeno passo que parece certo para você agora?",
    ],
    ru: [
      "Хочешь попробовать маленький шаг прямо сейчас или расскажешь, какая часть кажется самой тяжёлой?",
      "Тебе сначала нужно немного отдышаться, или вместе наметим следующий шаг?",
      "Какой следующий маленький шаг кажется тебе правильным прямо сейчас?",
    ],
    id: [
      "Mau coba satu langkah kecil sekarang, atau ceritakan bagian mana yang terasa paling sulit?",
      "Butuh sedikit kelegaan dulu, atau kita tentukan langkah kecil berikutnya bersama?",
      "Langkah kecil apa yang terasa tepat untukmu sekarang?",
    ],
    he: [
      "רוצה לנסות צעד קטן עכשיו, או לספר לי איזה חלק הכי קשה?",
      "קודם צריך/ה קצת הקלה, או שנקבע את הצעד הבא ביחד?",
      "מה מרגיש לך כצעד קטן נכון הבא כרגע?",
    ],
    de: [
      "Willst du jetzt einen kleinen Schritt versuchen, oder sag mir, was sich am schwersten anfühlt?",
      "Brauchst du erst etwas Erleichterung, oder planen wir den nächsten kleinen Schritt zusammen?",
      "Was fühlt sich für dich gerade als richtiger nächster kleiner Schritt an?",
    ],
    ja: [
      "小さな一歩、今試してみる？それとも、一番難しいところを教えて？",
      "まず少し楽になりたい？それとも、一緒に次の小さなステップを考える？",
      "今、自分に合う次の小さな一歩って何だと思う？",
    ],
  } as const;

  const calmCompanion = {
    en: [
      "If you want, we can slow this down and just stay with the most important part.",
      "We can take this gently — what feels most important to hold onto right now?",
      "Would it help to name the one piece that feels heaviest first?",
    ],
    hi: [
      "अगर चाहो, हम इसे थोड़ा धीमा कर सकते हैं और सबसे ज़रूरी हिस्से पर रह सकते हैं।",
      "हम इसे धीरे से ले सकते हैं — अभी किस हिस्से को थामे रखना सबसे ज़रूरी लग रहा है?",
      "क्या पहले उस एक हिस्से का नाम लेना मदद करेगा जो सबसे भारी लग रहा है?",
    ],
    bn: [
      "চাইলে আমরা এটাকে একটু ধীরে নিতে পারি, আর শুধু সবচেয়ে জরুরি অংশটার সঙ্গেই থাকতে পারি।",
      "আমরা খুব ধীরে যেতে পারি — এখন কোন অংশটাকে ধরে রাখা সবচেয়ে জরুরি মনে হচ্ছে?",
      "সবচেয়ে ভারী যে অংশটা লাগছে, আগে শুধু সেটার নাম বললে কি একটু সহজ হবে?",
    ],
    ta: [
      "வேண்டும்னா இதை கொஞ்சம் மெதுவாக எடுத்துக்கலாம், முக்கியமான பகுதியில்தான் இப்போ இருக்கலாம்.",
      "நிதானமா போகலாம் — இப்போ எந்த பகுதியை தாங்கிக்கொள்வது முக்கியமா தோணுது?",
      "அதிகமா கனமாகத் தோன்றும் அந்த ஒரு பகுதியைப் பெயர் சொல்லிப் பார்ப்பது உதவுமா?",
    ],
    te: [
      "కావాలంటే దీనిని కొంచెం నెమ్మదిగా తీసుకుందాం, ఇప్పటికి ముఖ్యమైన భాగం దగ్గరే ఉండొచ్చు.",
      "మనము నెమ్మదిగా వెళ్లొచ్చు — ఇప్పుడు ఏ భాగాన్ని పట్టుకుని ఉండటం ముఖ్యంగా అనిపిస్తోంది?",
      "అత్యంత భారంగా అనిపిస్తున్న ఆ ఒక భాగాన్ని ముందుగా పేరుపెడితే సహాయం అవుతుందా?",
    ],
    mr: [
      "हवं असेल तर आपण हे थोडं हळूहळू घेऊया आणि फक्त सगळ्यात महत्त्वाच्या भागासोबत राहूया.",
      "आपण हे शांतपणे घेऊ शकतो — आत्ता कोणता भाग धरून ठेवणं सर्वात महत्त्वाचं वाटतंय?",
      "सगळ्यात जड वाटणाऱ्या त्या एका भागाचं नाव आधी घेतलं तर थोडी मदत होईल का?",
    ],
    gu: [
      "ઇચ્છા હોય તો આપણે આને થોડું ધીમે લઈ શકીએ અને ફક્ત સૌથી મહત્વના ભાગ સાથે રહી શકીએ.",
      "આપણે ધીમે જઈ શકીએ — અત્યારે કયા ભાગને પકડી રાખવો સૌથી મહત્વનો લાગે છે?",
      "સૌથી ભારે લાગતા એ એક ભાગનું નામ પહેલા લઈએ તો થોડું સહેલું પડશે?",
    ],
    kn: [
      "ಬೇಕೆಂದರೆ ಇದನ್ನು ಸ್ವಲ್ಪ ನಿಧಾನವಾಗಿ ತೆಗೆದುಕೊಳ್ಳಬಹುದು, ಈಗಿಗೆ ಅತ್ಯಂತ ಮುಖ್ಯವಾದ ಭಾಗದ ಜೊತೆಯಲ್ಲೇ ಇರಬಹುದು.",
      "ನಾವಿದನ್ನು ಸೌಮ್ಯವಾಗಿ ತೆಗೆದುಕೊಳ್ಳಬಹುದು — ಈಗ ಯಾವ ಭಾಗವನ್ನು ಹಿಡಿದುಕೊಳ್ಳುವುದು ಮುಖ್ಯವಾಗಿ ಅನಿಸುತ್ತಿದೆ?",
      "ಅತ್ಯಂತ ಭಾರವಾಗಿರುವ ಆ ಒಂದು ಭಾಗವನ್ನು ಮೊದಲು ಹೆಸರಿಸಿದರೆ ಸಹಾಯವಾಗಬಹುದೇ?",
    ],
    ml: [
      "ഇഷ്ടമുണ്ടെങ്കിൽ ഇത് നമുക്ക് അല്പം പതുക്കെ എടുത്തോളാം, ഏറ്റവും പ്രധാനപ്പെട്ട ഭാഗത്തോടൊപ്പം മാത്രം ഇപ്പോൾ നിൽക്കാം.",
      "ഇത് നമുക്ക് നിസ്സാരമായി കൈകാര്യം ചെയ്യാം — ഇപ്പോൾ ഏത് ഭാഗത്തെയാണ് പിടിച്ചു നിൽക്കേണ്ടത് എന്ന് തോന്നുന്നു?",
      "ഏറ്റവും ഭാരമായി തോന്നുന്ന ആ ഒരു ഭാഗത്തിന് ആദ്യം പേര് കൊടുത്താൽ കുറച്ച് സഹായമാവുമോ?",
    ],
    pa: [
      "ਜੇ ਚਾਹੁੰਦਾ/ਚਾਹੁੰਦੀ ਹੈਂ ਤਾਂ ਅਸੀਂ ਇਸਨੂੰ ਹੌਲੇ ਹੌਲੇ ਲੈ ਸਕਦੇ ਹਾਂ ਅਤੇ ਸਿਰਫ਼ ਸਭ ਤੋਂ ਜ਼ਰੂਰੀ ਹਿੱਸੇ ਨਾਲ ਰਹਿ ਸਕਦੇ ਹਾਂ।",
      "ਅਸੀਂ ਇਹਨੂੰ ਨਰਮੀ ਨਾਲ ਲੈ ਸਕਦੇ ਹਾਂ — ਇਸ ਵੇਲੇ ਕਿਹੜਾ ਹਿੱਸਾ ਫੜੀ ਰੱਖਣਾ ਸਭ ਤੋਂ ਜ਼ਰੂਰੀ ਲੱਗ ਰਿਹਾ ਹੈ?",
      "ਜੋ ਇੱਕ ਹਿੱਸਾ ਸਭ ਤੋਂ ਭਾਰੀ ਲੱਗ ਰਿਹਾ ਹੈ, ਕੀ ਪਹਿਲਾਂ ਉਸਦਾ ਨਾਮ ਲੈਣਾ ਮਦਦ ਕਰੇਗਾ?",
    ],
    ur: [
      "اگر چاہو تو ہم اسے تھوڑا آہستہ لے سکتے ہیں اور ابھی صرف سب سے اہم حصے کے ساتھ رہ سکتے ہیں۔",
      "ہم اسے نرمی سے لے سکتے ہیں — ابھی کون سا حصہ سنبھال کر رکھنا سب سے زیادہ ضروری لگ رہا ہے؟",
      "جو ایک حصہ سب سے زیادہ بھاری لگ رہا ہے، کیا پہلے صرف اس کا نام لینا مدد کرے گا؟",
    ],
    ar: [
      "إذا أردت، يمكننا إبطاء الأمر والبقاء مع الجزء الأهم فقط.",
      "يمكننا التعامل مع هذا بهدوء — ما الجزء الذي تشعر أنه الأهم الآن؟",
      "هل سيساعد أن نسمي الجزء الأثقل أولاً؟",
    ],
    zh: [
      "如果你愿意，我们可以放慢节奏，只关注最重要的部分。",
      "我们可以慢慢来——现在哪个部分感觉最需要先处理？",
      "先说出感觉最沉重的那一个部分，会有帮助吗？",
    ],
    es: [
      "Si quieres, podemos ir despacio y quedarnos con la parte más importante.",
      "Podemos tomarlo con calma — ¿qué parte sientes que es más importante mantener ahora mismo?",
      "¿Ayudaría nombrar primero la parte que se siente más pesada?",
    ],
    fr: [
      "Si tu veux, on peut ralentir et rester sur la partie la plus importante.",
      "On peut y aller doucement — quelle partie te semble la plus importante à retenir maintenant ?",
      "Ça aiderait de nommer d'abord la partie qui pèse le plus ?",
    ],
    pt: [
      "Se quiser, podemos ir devagar e ficar com a parte mais importante.",
      "Podemos ir com calma — qual parte parece mais importante manter agora?",
      "Ajudaria nomear primeiro a parte que parece mais pesada?",
    ],
    ru: [
      "Если хочешь, можем притормозить и сосредоточиться только на самом важном.",
      "Можем идти мягко — что сейчас кажется самым важным?",
      "Помогло бы назвать сначала ту часть, которая кажется самой тяжёлой?",
    ],
    id: [
      "Kalau mau, kita bisa pelankan dan fokus pada bagian yang paling penting dulu.",
      "Kita bisa lakukan ini perlahan — bagian mana yang terasa paling penting untuk ditahan sekarang?",
      "Apakah membantu jika kita sebut dulu bagian yang terasa paling berat?",
    ],
    he: [
      "אם תרצה/י, נוכל להאט ולהישאר עם החלק הכי חשוב.",
      "נוכל לגשת לזה בעדינות — מה מרגיש הכי חשוב לאחוז בו עכשיו?",
      "האם יעזור לתת שם קודם לחלק הכי כבד?",
    ],
    de: [
      "Wenn du möchtest, können wir es etwas langsamer angehen und beim Wichtigsten bleiben.",
      "Wir können es sanft angehen — was fühlt sich gerade am wichtigsten an?",
      "Würde es helfen, zuerst den schwersten Teil zu benennen?",
    ],
    ja: [
      "もし良ければ、少しゆっくり進んで、一番大切な部分だけに寄り添おう。",
      "優しく進んでいいよ — 今、一番大切に感じる部分はどこ？",
      "一番重く感じる部分を、まず言葉にしてみると楽になるかな？",
    ],
  } as const;

  // ✅ Coach: still soft + permission-based, but more directional + "we" tone
  const coach = {
    en: [
      "I’m right here with you. If you’d like, we can pick one small thing to move forward on—gently.",
      "We can go at your pace. Want us to choose one tiny next step together?",
      "No pressure—just one small direction. What would you like us to make a little easier first?",
    ],
    hi: [
      "मैं यहीं हूँ। अगर तुम चाहो, तो हम धीरे-धीरे एक छोटा-सा कदम साथ में चुन सकते हैं।",
      "हम तुम्हारी गति से चलेंगे। चाहो तो एक tiny next step साथ में तय करें?",
      "कोई दबाव नहीं—बस एक छोटी दिशा। सबसे पहले क्या थोड़ा आसान करें?",
    ],
    bn: [
      "আমি আছি। চাইলে আমরা খুব ধীরে একটা ছোট্ট পরের ধাপ একসাথে বেছে নিতে পারি।",
      "তোমার গতিতেই এগোবো। চাইলে একটা ছোট next step একসাথে ঠিক করি?",
      "কোনো চাপ নেই—শুধু ছোট্ট একটা দিক। প্রথমে কোন জিনিসটা একটু সহজ করতে চাও?",
    ],
    ta: [
      "நான் இங்க இருக்கேன். வேண்டும்னா நாம மெதுவா ஒரு சின்ன next step-ஐ சேர்ந்து தேர்வு செய்யலாம்.",
      "உன் pace-லே போகலாம். ஒரு tiny next step-ஐ சேர்ந்து பார்க்கலாமா?",
      "எந்த அழுத்தமும் இல்லை — ஒரு சின்ன direction மட்டும். முதலில் எதை கொஞ்சம் easy ஆக்கலாம்?",
    ],
    te: [
      "నేను ఇక్కడే ఉన్నాను. కావాలంటే మనం నెమ్మదిగా ఒక చిన్న next step ని కలిసి ఎంచుకోవచ్చు.",
      "నీ pace లోనే వెళ్దాం. ఒక tiny next step ని కలిసి నిర్ణయించాలా?",
      "ఏ ఒత్తిడి లేదు — ఒక చిన్న దిశ చాలు. ముందుగా ఏది కొంచెం సులభం చేయాలి?",
    ],
    mr: [
      "मी इथेच आहे. हवं असेल तर आपण हळूहळू एक छोटा next step एकत्र निवडू शकतो.",
      "आपण तुझ्या गतीने जाऊ. हवं तर एक tiny next step सोबत ठरवूया?",
      "कुठलाही दबाव नाही — फक्त एक छोटी दिशा. आधी काय थोडं सोपं करूया?",
    ],
    gu: [
      "હું અહીં જ છું. ઇચ્છા હોય તો આપણે ધીમે ધીમે એક નાનું next step સાથે પસંદ કરી શકીએ.",
      "આપણે તારી pace પ્રમાણે જઈએ. ઇચ્છા હોય તો એક tiny next step સાથે નક્કી કરીએ?",
      "કોઈ દબાણ નથી — માત્ર એક નાની દિશા. સૌથી પહેલા શું થોડું સહેલું કરીએ?",
    ],
    kn: [
      "ನಾನು ಇಲ್ಲೇ ಇದ್ದೇನೆ. ಬೇಕೆಂದರೆ ನಾವು ನಿಧಾನವಾಗಿ ಒಂದು ಸಣ್ಣ next step ಅನ್ನು ಜೊತೆಯಾಗಿ ಆಯ್ಕೆ ಮಾಡಬಹುದು.",
      "ನಿನ್ನ pace ನಲ್ಲೇ ಹೋಗೋಣ. ಒಂದು tiny next step ಅನ್ನು ಜೊತೆಗೂಡಿ ತೀರ್ಮಾನಿಸೋಣವಾ?",
      "ಯಾವ ಒತ್ತಡವೂ ಇಲ್ಲ — ಒಂದು ಸಣ್ಣ ದಿಕ್ಕು ಸಾಕು. ಮೊದಲು ಯಾವುದನ್ನು ಸ್ವಲ್ಪ ಸುಲಭ ಮಾಡೋಣ?",
    ],
    ml: [
      "ഞാൻ ഇവിടെയുണ്ട്. വേണമെങ്കിൽ നമുക്ക് പതുക്കെ ഒരു ചെറിയ next step ഒരുമിച്ച് തിരഞ്ഞെടുക്കാം.",
      "നിന്റെ pace അനുസരിച്ച് പോകാം. ഒരു tiny next step നമുക്ക് ഒരുമിച്ച് തീരുമാനിക്കാമോ?",
      "ഒന്നും സമ്മർദ്ദമില്ല — ഒരു ചെറിയ ദിശ മതി. ആദ്യം എന്ത് കുറച്ച് എളുപ്പമാക്കാം?",
    ],
    pa: [
      "ਮੈਂ ਇੱਥੇ ਹਾਂ। ਚਾਹੇਂ ਤਾਂ ਅਸੀਂ ਹੌਲੇ ਹੌਲੇ ਇਕ ਛੋਟਾ next step ਇਕੱਠੇ ਚੁਣ ਸਕਦੇ ਹਾਂ।",
      "ਅਸੀਂ ਤੇਰੇ pace ਨਾਲ ਚੱਲਾਂਗੇ। ਚਾਹੇਂ ਤਾਂ ਇਕ tiny next step ਇਕੱਠੇ ਤੈਅ ਕਰੀਏ?",
      "ਕੋਈ ਦਬਾਅ ਨਹੀਂ — ਸਿਰਫ਼ ਇਕ ਛੋਟੀ ਦਿਸ਼ਾ। ਪਹਿਲਾਂ ਕੀ ਕੁਝ ਆਸਾਨ ਕਰੀਏ?",
    ],
    ur: [
      "میں یہیں ہوں۔ چاہو تو ہم آہستہ آہستہ ایک چھوٹا next step ساتھ میں چن سکتے ہیں۔",
      "ہم تمہاری pace کے مطابق چلیں گے۔ چاہو تو ایک tiny next step ساتھ میں طے کریں؟",
      "کوئی دباؤ نہیں — بس ایک چھوٹی سمت۔ پہلے کس چیز کو تھوڑا آسان کریں؟",
    ],
    ar: [
      "أنا هنا معك. إذا أردت، يمكننا اختيار خطوة صغيرة واحدة معاً — بهدوء.",
      "نسير بوتيرتك. هل تريد أن نحدد خطوة صغيرة تالية معاً؟",
      "لا ضغط — مجرد اتجاه صغير. ما الذي تريد أن نجعله أسهل قليلاً أولاً؟",
    ],
    zh: [
      "我就在这里。如果你愿意，我们可以一起慢慢选一个小小的下一步。",
      "我们按你的节奏走。想一起定个小小的下一步吗？",
      "没有压力——只是一个小方向。你想先让哪件事变得容易一点？",
    ],
    es: [
      "Estoy aquí contigo. Si quieres, podemos elegir juntos un pequeño paso — con calma.",
      "Vamos a tu ritmo. ¿Quieres que elijamos juntos un pequeño próximo paso?",
      "Sin presión — solo una pequeña dirección. ¿Qué quieres que hagamos más fácil primero?",
    ],
    fr: [
      "Je suis là avec toi. Si tu veux, on peut choisir ensemble un tout petit pas — doucement.",
      "On va à ton rythme. Tu veux qu'on choisisse ensemble un tout petit prochain pas ?",
      "Pas de pression — juste une petite direction. Qu'est-ce que tu voudrais rendre un peu plus facile d'abord ?",
    ],
    pt: [
      "Estou aqui com você. Se quiser, podemos escolher juntos um pequeno passo — com calma.",
      "Vamos no seu ritmo. Quer que escolhamos juntos um pequeno próximo passo?",
      "Sem pressão — só uma pequena direção. O que você quer que tornemos um pouco mais fácil primeiro?",
    ],
    ru: [
      "Я здесь с тобой. Если хочешь, можем вместе выбрать один маленький шаг — не торопясь.",
      "Идём в твоём темпе. Хочешь вместе наметить один маленький следующий шаг?",
      "Без давления — просто одно небольшое направление. Что сначала хочешь сделать немного легче?",
    ],
    id: [
      "Aku di sini bersamamu. Kalau mau, kita bisa pilih satu langkah kecil bersama — pelan-pelan.",
      "Kita jalan sesuai ritasmu. Mau kita tentukan satu langkah kecil berikutnya bersama?",
      "Tidak ada tekanan — hanya satu arah kecil. Apa yang ingin kita permudah sedikit dulu?",
    ],
    he: [
      "אני כאן איתך. אם תרצה/י, נוכל לבחור יחד צעד קטן — בעדינות.",
      "נלך בקצב שלך. רוצה שנחליט יחד על צעד קטן אחד?",
      "אין לחץ — רק כיוון קטן. מה הכי קודם כדאי להקל קצת?",
    ],
    de: [
      "Ich bin bei dir. Wenn du möchtest, können wir gemeinsam einen kleinen Schritt wählen — sanft.",
      "Wir gehen in deinem Tempo. Sollen wir zusammen einen kleinen nächsten Schritt festlegen?",
      "Kein Druck — nur eine kleine Richtung. Was soll zuerst ein bisschen leichter werden?",
    ],
    ja: [
      "ここにいるよ。よかったら、一緒にそっと小さな一歩を選ぼう。",
      "あなたのペースで進もう。小さな次の一歩を一緒に決めてみる？",
      "プレッシャーはないよ — ただ一つの小さな方向だけ。まず何を少し楽にしたい？",
    ],
  } as const;

  // ✅ Mentor: softer clarity + gentle framing (not "coach-y")
  const mentor = {
    en: [
      "If you want, we can slow it down and make sense of it—one piece at a time.",
      "Would it help if we name what matters most here, before choosing a next step?",
      "We can keep it simple—what part feels most important to understand first?",
    ],
    hi: [
      "अगर तुम चाहो, तो हम इसे धीरे-धीरे समझ सकते हैं—एक-एक हिस्से में।",
      "क्या पहले ये समझना मदद करेगा कि यहाँ सबसे ज़्यादा क्या मायने रखता है—फिर next step लें?",
      "चलो इसे सरल रखते हैं—सबसे पहले क्या समझना सबसे ज़रूरी लगेगा?",
    ],
    bn: [
      "চাইলে আমরা এটাকে ধীরে ধীরে বুঝতে পারি—একটা একটা অংশ ধরে।",
      "আগে যদি বুঝে নিই এখানে সবচেয়ে গুরুত্বপূর্ণ কী, তাহলে কি একটু সহজ হবে?",
      "চলো সহজ রাখি—কোন অংশটা আগে বুঝে নেওয়া সবচেয়ে দরকারি মনে হচ্ছে?",
    ],
    ta: [
      "வேண்டும்னா இதை மெதுவாக புரிந்துகொள்ளலாம்—ஒரு ஒரு பகுதியா.",
      "முதல்ல இங்கே அதிகம் முக்கியமா இருப்பது என்ன என்று பார்த்தால் உதவுமா?",
      "சிம்பிளா வைப்போம் — முதலில் எந்த பகுதியை புரிந்துகொள்வது முக்கியமா தோணுது?",
    ],
    te: [
      "కావాలంటే దీనిని నెమ్మదిగా అర్థం చేసుకుందాం—ఒక్కో భాగంగా.",
      "ముందుగా ఇక్కడ ఎక్కువగా ముఖ్యం ఏమిటో తెలుసుకుంటే కొంచెం సులభమవుతుందా?",
      "దీనిని సింపుల్‌గా ఉంచుదాం — ముందుగా ఏ భాగాన్ని అర్థం చేసుకోవడం ముఖ్యం అనిపిస్తోంది?",
    ],
    mr: [
      "हवं असेल तर आपण हे हळूहळू समजून घेऊया—एकेक भागाने.",
      "आधी इथे सर्वात महत्त्वाचं काय आहे हे समजून घेतलं तर थोडं सोपं होईल का?",
      "हे सोपं ठेवूया — आधी कोणता भाग समजून घेणं सर्वात महत्त्वाचं वाटतंय?",
    ],
    gu: [
      "ઇચ્છા હોય તો આપણે આને ધીમે ધીમે સમજીએ — એક એક ભાગ લઈને.",
      "પહેલા અહીં સૌથી મહત્વનું શું છે એ સમજીએ તો થોડું સહેલું પડશે?",
      "આને સરળ રાખીએ — પહેલાં કયો ભાગ સમજવો સૌથી મહત્વનો લાગે છે?",
    ],
    kn: [
      "ಬೇಕೆಂದರೆ ಇದನ್ನು ನಿಧಾನವಾಗಿ ಅರ್ಥಮಾಡಿಕೊಳ್ಳಬಹುದು — ಒಂದು ಒಂದು ಭಾಗವಾಗಿ.",
      "ಮೊದಲು ಇಲ್ಲಿ ಅತ್ಯಂತ ಮುಖ್ಯವಾದುದು ಏನು ಎಂದು ತಿಳಿದುಕೊಂಡರೆ ಸ್ವಲ್ಪ ಸುಲಭವಾಗಬಹುದೇ?",
      "ಇದನ್ನು ಸರಳವಾಗಿರಿಸೋಣ — ಮೊದಲು ಯಾವ ಭಾಗವನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳುವುದು ಮುಖ್ಯವಾಗಿ ಅನಿಸುತ್ತದೆ?",
    ],
    ml: [
      "വേണമെങ്കിൽ ഇത് നമുക്ക് പതുക്കെ മനസ്സിലാക്കാം — ഓരോ ഭാഗമായ്.",
      "ആദ്യം ഇവിടെ ഏറ്റവും പ്രധാനപ്പെട്ടത് എന്താണെന്ന് മനസ്സിലാക്കിയാൽ കുറച്ച് എളുപ്പമാവുമോ?",
      "ഇത് ലളിതമാക്കി വെക്കാം — ആദ്യം ഏത് ഭാഗം മനസ്സിലാക്കുന്നതാണ് പ്രധാനമെന്ന് തോന്നുന്നു?",
    ],
    pa: [
      "ਜੇ ਚਾਹੁੰਦਾ/ਚਾਹੁੰਦੀ ਹੈਂ ਤਾਂ ਅਸੀਂ ਇਸਨੂੰ ਹੌਲੇ ਹੌਲੇ ਸਮਝ ਸਕਦੇ ਹਾਂ — ਇਕ ਇਕ ਹਿੱਸੇ ਨਾਲ।",
      "ਜੇ ਪਹਿਲਾਂ ਇਹ ਸਮਝ ਲਈਏ ਕਿ ਇੱਥੇ ਸਭ ਤੋਂ ਜ਼ਰੂਰੀ ਕੀ ਹੈ, ਤਾਂ ਕੀ ਥੋੜ੍ਹਾ ਆਸਾਨ ਲੱਗੇਗਾ?",
      "ਆਓ ਇਸਨੂੰ ਸਧਾਰਨ ਰੱਖੀਏ — ਸਭ ਤੋਂ ਪਹਿਲਾਂ ਕਿਹੜਾ ਹਿੱਸਾ ਸਮਝਣਾ ਸਭ ਤੋਂ ਜ਼ਰੂਰੀ ਲੱਗਦਾ ਹੈ?",
    ],
    ur: [
      "اگر چاہو تو ہم اسے آہستہ آہستہ سمجھ سکتے ہیں — ایک ایک حصے کے ساتھ۔",
      "اگر پہلے یہ سمجھ لیں کہ یہاں سب سے زیادہ اہم کیا ہے، تو کیا کچھ آسان محسوس ہوگا؟",
      "اسے سادہ رکھتے ہیں — سب سے پہلے کون سا حصہ سمجھنا زیادہ ضروری لگ رہا ہے؟",
    ],
    ar: [
      "إذا أردت، يمكننا فهمه ببطء — جزءاً جزءاً.",
      "هل سيساعد أن نفهم أولاً ما هو الأهم هنا، قبل اختيار خطوة تالية؟",
      "لنبقيه بسيطاً — ما الجزء الأهم لفهمه أولاً؟",
    ],
    zh: [
      "如果你愿意，我们可以慢慢理解——一部分一部分来。",
      "先弄清楚这里最重要的是什么，会有帮助吗？",
      "让我们保持简单——你觉得最需要先理解哪个部分？",
    ],
    es: [
      "Si quieres, podemos entenderlo poco a poco — una parte a la vez.",
      "¿Ayudaría entender primero qué es lo más importante aquí, antes de elegir un próximo paso?",
      "Mantengámoslo simple — ¿qué parte sientes que es más importante entender primero?",
    ],
    fr: [
      "Si tu veux, on peut comprendre ça doucement — une partie à la fois.",
      "Ça aiderait de comprendre d'abord ce qui est le plus important ici, avant de choisir une prochaine étape ?",
      "Gardons ça simple — quelle partie te semble la plus importante à comprendre en premier ?",
    ],
    pt: [
      "Se quiser, podemos entender isso aos poucos — uma parte de cada vez.",
      "Ajudaria entender primeiro o que é mais importante aqui, antes de escolher um próximo passo?",
      "Vamos manter simples — qual parte você acha mais importante entender primeiro?",
    ],
    ru: [
      "Если хочешь, можем разобраться в этом медленно — по одной части.",
      "Помогло бы сначала понять, что здесь самое важное, прежде чем выбирать следующий шаг?",
      "Оставим это простым — какую часть ты считаешь важнее всего понять сначала?",
    ],
    id: [
      "Kalau mau, kita bisa pahami ini perlahan — satu bagian demi satu bagian.",
      "Apakah akan membantu jika kita pahami dulu apa yang paling penting di sini, sebelum memilih langkah berikutnya?",
      "Mari kita jaga tetap sederhana — bagian mana yang kamu rasa paling penting dipahami dulu?",
    ],
    he: [
      "אם תרצה/י, נוכל להבין את זה לאט — חלק אחד בכל פעם.",
      "האם יעזור קודם לציין מה הכי חשוב כאן, לפני שנבחר צעד הבא?",
      "נשאיר את זה פשוט — איזה חלק הכי חשוב להבין ראשון?",
    ],
    de: [
      "Wenn du möchtest, können wir das langsam verstehen — ein Teil nach dem anderen.",
      "Würde es helfen, zuerst zu benennen, was hier am wichtigsten ist, bevor wir einen nächsten Schritt wählen?",
      "Lass es uns einfach halten — welchen Teil ist es am wichtigsten, zuerst zu verstehen?",
    ],
    ja: [
      "よかったら、ゆっくり理解していこう — 一部分ずつ。",
      "次の一歩を選ぶ前に、ここで一番大切なことを確認すると助けになるかな？",
      "シンプルにしよう — 最初に一番理解しておきたい部分はどこ？",
    ],
  } as const;

  const partnerLike = {
    en: [
      "Do you want to take this one gentle step at a time together?",
      "What feels heaviest right now—so we can start there softly?",
      "Where would feel kindest to begin from here?",
    ],
    hi: [
      "क्या हम इसे धीरे-धीरे, एक नरम कदम से साथ में शुरू करें?",
      "अभी सबसे भारी क्या लग रहा है—ताकि वहीं से आराम से शुरू करें?",
      "यहाँ से सबसे सहज शुरुआत कहाँ से लगेगी?",
    ],
    bn: [
      "আমরা কি এটা ধীরে ধীরে, একদম ছোট্ট একটা পদক্ষেপ দিয়ে একসাথে শুরু করব?",
      "এখন সবচেয়ে ভারী কী লাগছে—যেন সেখান থেকেই নরমভাবে শুরু করতে পারি?",
      "এখান থেকে সবচেয়ে কোমলভাবে কোথা থেকে শুরু করা ভালো হবে?",
    ],
    ta: [
      "இதை நிதானமாக, ஒரு சின்ன step-ஆ சேர்ந்து தொடங்கலாமா?",
      "இப்போ என்ன தான் அதிகமா கனமாக feel ஆகுது—அங்கிருந்து மெதுவா தொடங்கலாமே?",
      "இங்கிருந்து எந்த இடத்திலிருந்து தொடங்கினா மனசுக்கு கொஞ்சம் லேசா இருக்கும்?",
    ],
    te: [
      "ఇదిని నెమ్మదిగా, ఒక్క చిన్న అడుగుతో కలిసి మొదలుపెడదామా?",
      "ఇప్పుడే ఎక్కువగా భారంగా అనిపిస్తున్నది ఏమిటి—అక్కడ్నుంచే మృదువుగా మొదలుపెడదాం?",
      "ఇక్కడ్నుంచి ఎక్కడి నుండి మొదలెడితే కొంచెం సాంత్వనగా అనిపిస్తుంది?",
    ],
    mr: [
      "हे आपण हळूहळू, एका छोट्या पावलापासून एकत्र सुरू करूया का?",
      "आत्ता सगळ्यात जड काय वाटतंय—जेणेकरून तिथूनच हलकेपणाने सुरुवात करता येईल?",
      "इथून पुढे कुठून सुरू केलं तर जरा सौम्य वाटेल?",
    ],
    gu: [
      "આપણે આને ધીમે ધીમે, એક નાનકડા પગથીયા સાથે મળીને શરૂ કરીએ?",
      "હમણાં સૌથી ભારે શું લાગી રહ્યું છે—એજથી થોડું નરમાઈથી શરૂ કરી શકીએ?",
      "અહીંથી કઈ જગ્યાએથી શરૂઆત કરીએ તો વધુ સહેજ લાગશે?",
    ],
    kn: [
      "ಇದನ್ನು ನಿಧಾನವಾಗಿ, ಒಂದು ಸಣ್ಣ ಹೆಜ್ಜೆಯಿಂದ ಜೊತೆಗೂಡಿ ಆರಂಭಿಸೋಣವಾ?",
      "ಈಗ ಹೆಚ್ಚು ಭಾರವಾಗಿರುವುದು ಏನು—ಅಲ್ಲಿಂದಲೇ ಮೃದುವಾಗಿ ಆರಂಭಿಸಬಹುದು?",
      "ಇಲ್ಲಿಂದ ಯಾವ ಜಾಗದಿಂದ ಶುರು ಮಾಡಿದರೆ ಮನಸ್ಸಿಗೆ ಸ್ವಲ್ಪ ಹಗುರವಾಗುತ್ತದೆ?",
    ],
    ml: [
      "ഇത് മെതുവായി, ഒരു ചെറിയ പടിയിലൂടെ ഒരുമിച്ച് തുടങ്ങാമോ?",
      "ഇപ്പോൾ ഏറ്റവും ഭാരമായി തോന്നുന്നത് എന്താണ്—അവിടെ നിന്നുതന്നെ സാവധാനം തുടങ്ങാം?",
      "ഇവിടെ നിന്ന് എവിടെ നിന്നാണ് തുടങ്ങിയത് ഏറ്റവും സുഖകരമാവുക?",
    ],
    pa: [
      "ਕੀ ਅਸੀਂ ਇਹਨੂੰ ਹੌਲੀ-ਹੌਲੀ, ਇਕ ਛੋਟੇ ਕਦਮ ਨਾਲ ਇਕੱਠੇ ਸ਼ੁਰੂ ਕਰੀਏ?",
      "ਇਸ ਵੇਲੇ ਸਭ ਤੋਂ ਵੱਧ ਭਾਰਾ ਕੀ ਲੱਗ ਰਿਹਾ ਹੈ—ਤਾਂ ਜੋ ਓਥੋਂ ਨਰਮੀ ਨਾਲ ਸ਼ੁਰੂ ਕਰੀਏ?",
      "ਇੱਥੋਂ ਕਿੱਥੋਂ ਸ਼ੁਰੂ ਕਰੀਏ ਤਾਂ ਸਭ ਤੋਂ ਸੁਖਾਵਾਂ ਲੱਗੇ?",
    ],
    ur: [
      "کیا ہم اسے آہستہ آہستہ، ایک چھوٹے قدم سے ساتھ شروع کریں؟",
      "ابھی سب سے زیادہ بھاری کیا لگ رہا ہے—تاکہ ہم وہیں سے نرمی سے شروع کریں؟",
      "یہاں سے کہاں سے آغاز کرنا سب سے نرم محسوس ہوگا؟",
    ],
    ar: [
      "هل نبدأ معاً بهدوء، بخطوة صغيرة واحدة؟",
      "ما الأثقل شعوراً الآن — حتى نبدأ من هناك بلطف؟",
      "من أين ستكون البداية الأكثر لطفاً من هنا؟",
    ],
    zh: [
      "我们一起慢慢来，从一个小步开始好吗？",
      "现在什么感觉最重——我们从那里轻轻开始吧？",
      "从哪里开始会感觉最温柔一些？",
    ],
    es: [
      "¿Empezamos juntos poco a poco, con un pequeño paso?",
      "¿Qué se siente más pesado ahora — para poder empezar desde ahí suavemente?",
      "¿Por dónde empezar se sentiría más amable desde aquí?",
    ],
    fr: [
      "On commence ensemble doucement, avec un tout petit pas ?",
      "Qu'est-ce qui pèse le plus en ce moment — pour qu'on puisse commencer là doucement ?",
      "Par où commencer te semblerait le plus doux depuis ici ?",
    ],
    pt: [
      "Começamos juntos devagar, com um pequeno passo?",
      "O que parece mais pesado agora — para que possamos começar por aí com suavidade?",
      "Por onde começar se sentiria mais gentil daqui?",
    ],
    ru: [
      "Начнём вместе тихонько, с маленького шага?",
      "Что сейчас давит сильнее всего — чтобы начать именно оттуда, мягко?",
      "С чего начать отсюда было бы добрее всего?",
    ],
    id: [
      "Mulai bersama-sama perlahan, dengan satu langkah kecil?",
      "Apa yang paling terasa berat sekarang — agar kita bisa mulai dari sana dengan lembut?",
      "Dari mana memulai akan terasa paling lembut dari sini?",
    ],
    he: [
      "נתחיל יחד לאט, בצעד קטן?",
      "מה מרגיש הכי כבד עכשיו — כדי שנתחיל משם בעדינות?",
      "מאיפה הכי נוח להתחיל מכאן?",
    ],
    de: [
      "Sollen wir gemeinsam langsam beginnen, mit einem kleinen Schritt?",
      "Was fühlt sich gerade am schwersten an — damit wir dort sanft anfangen können?",
      "Von wo aus würde es sich hier am sanftesten anfühlen zu beginnen?",
    ],
    ja: [
      "一緒にそっと、小さな一歩から始めようか？",
      "今、一番重く感じることは何 — そこから優しく始めよう。",
      "ここからどこを出発点にすると、一番優しく感じるかな？",
    ],
  } as const;

  const bank =
    tone === "calm_companion"
      ? calmCompanion
      : tone === "coach"
        ? coach
        : tone === "mentor"
          ? mentor
          : tone === "partner_like"
            ? partnerLike
            : closeFriend;

  // fall back to English if lang not present in the bank
  const key = normalizeLang(lang);
  return (bank as any)[key] ?? bank.en;
}

function bridgeStatementBank(
  lang: string,
  tone: ImotaraPersonaTone,
): readonly string[] {
  // IMPORTANT:
  // This bank must be STATEMENTS (no questions).
  // It's used when the insight already contains a question,
  // so we avoid ending with two consecutive questions.

  const closeFriend = {
    en: [
      "Okay, let’s keep this clear.",
      "No rush — we can take it one part at a time.",
      "That makes sense.",
      "Thanks for saying that plainly.",
      "Let’s keep our footing and work through it.",
      "We can slow it down and look at one piece first.",
      "Let’s stay practical and kind with this.",
      "Alright, we can sort this step by step.",
    ],
    hi: [
      "मैं यहीं हूँ — इसे सरल रखते हैं।",
      "कोई जल्दी नहीं। एक छोटा कदम, फिर अगला।",
      "हम इसे आराम से, साथ मिलकर संभाल लेंगे।",
    ],
    bn: [
      "আমি আছি — সহজ করে এগোই।",
      "তাড়া নেই। এক ছোট পদক্ষেপ, তারপর আরেকটা।",
      "আমরা ধীরে ধীরে, একসাথে সামলাব।",
    ],
    ta: [
      "நான் இங்க இருக்கேன் — இதை சிம்பிளா எடுத்துக்கலாம்.",
      "அவசரம் வேண்டாம். ஒரு சின்ன step-ஆ ஒரு நேரம்.",
      "நம்ம இருவரும் சேர்ந்து மெதுவா சரி பண்ணலாம்.",
    ],
    te: [
      "నేను ఇక్కడే ఉన్నాను — దీన్ని సింపుల్‌గా తీసుకుందాం.",
      "తొందర లేదు. ఒక్క చిన్న అడుగు, తర్వాత ఇంకొకటి.",
      "మనము నెమ్మదిగా కలిసి సర్దుకుందాం.",
    ],
    mr: [
      "मी इथेच आहे — हे आपण सोपं ठेवूया.",
      "घाई नाही. एक छोटं पाऊल, मग पुढचं.",
      "आपण हे शांतपणे, एकत्र हाताळू.",
    ],
    gu: [
      "હું અહીં છું — આપણે આને સરળ રાખીએ.",
      "કોઈ ઉતાવળ નહીં. એક નાનો પગલું, પછી બીજું.",
      "ધીમે ધીમે, આપણે સાથે સંભાળી લઈશું.",
    ],
    kn: [
      "ನಾನು ಇಲ್ಲೇ ಇದ್ದೇನೆ — ಇದನ್ನು ಸರಳವಾಗಿಯೇ ಇಟ್ಟುಕೊಳ್ಳೋಣ.",
      "ಆತುರ ಬೇಡ. ಒಂದು ಸಣ್ಣ ಹೆಜ್ಜೆ, ನಂತರ ಮತ್ತೊಂದು.",
      "ನಾವು ನಿಧಾನವಾಗಿ, ಜೊತೆಗೂಡಿ ಇದನ್ನು ನಿಭಾಯಿಸೋಣ.",
    ],
    ml: [
      "ഞാൻ ഇവിടെയുണ്ട് — ഇത് സിമ്പിളായി പോകാം.",
      "അവസരം വേണ്ട. ഒരു ചെറിയ പടി, പിന്നെ അടുത്തത്.",
      "നമുക്ക് മെതുവായി, ഒരുമിച്ച് ഇത് കൈകാര്യം ചെയ്യാം.",
    ],
    pa: [
      "ਮੈਂ ਇੱਥੇ ਹਾਂ — ਅਸੀਂ ਇਹਨੂੰ ਸਧਾਰਨ ਰੱਖਾਂਗੇ।",
      "ਕੋਈ ਘਬਰਾਹਟ ਨਹੀਂ। ਇਕ ਛੋਟਾ ਕਦਮ, ਫਿਰ ਅਗਲਾ।",
      "ਅਸੀਂ ਹੌਲੀ-ਹੌਲੀ, ਇਕੱਠੇ ਇਹ ਸੰਭਾਲ ਲਵਾਂਗੇ।",
    ],
    ur: [
      "میں یہیں ہوں — ہم اسے سادہ رکھیں گے۔",
      "کوئی جلدی نہیں۔ ایک چھوٹا قدم، پھر اگلا۔",
      "ہم آہستہ آہستہ، ساتھ مل کر سنبھال لیں گے۔",
    ],
    he: [
      "אני כאן — נשמור על זה פשוט.",
      "אין מהרה. צעד קטן אחד, אחר כך הבא.",
      "נסתדר עם זה לאט, יחד.",
    ],
    de: [
      "Ich bin da — lass es uns einfach halten.",
      "Kein Druck. Ein kleiner Schritt, dann der nächste.",
      "Wir werden das ruhig und gemeinsam angehen.",
    ],
    ja: [
      "ここにいるよ — シンプルに進もう。",
      "急がなくていい。小さな一歩、それから次の一歩。",
      "ゆっくり、一緒に乗り越えよう。",
    ],
  } as const;

  const calmCompanion = {
    en: [
      "We can take this gently without losing clarity.",
      "Let’s keep this soft, but still real.",
      "One calm step is enough for now.",
      "We can slow the pace and stay grounded.",
      "There’s no need to force this.",
      "We can make a little room for what’s sitting with you.",
      "It’s alright to pause for a moment.",
      "Let’s keep this steady and unhurried.",
    ],
    hi: [
      "धीरे-धीरे चलते हैं। मैं तुम्हारे साथ हूँ।",
      "इसे नरम और सरल रखते हैं।",
      "एक-एक शांत कदम लेते हैं।",
    ],
    bn: [
      "ধীরে ধীরে চলি। আমি আপনার পাশে আছি।",
      "নরমভাবে, সহজ করে এগোই।",
      "একটা করে শান্ত পদক্ষেপ নেই।",
    ],
    ta: [
      "மெதுவா போலாம். நான் உங்களோட இருக்கேன்.",
      "இதை மென்மையா, சிம்பிளா வைக்கலாம்.",
      "ஒரு அமைதியான step-ஆ ஒரு நேரம் போதும்.",
    ],
    te: [
      "నెమ్మదిగా వెళ్దాం. నేను మీతోనే ఉన్నాను.",
      "ఇది సాఫ్ట్‌గా, సింపుల్‌గా ఉంచుదాం.",
      "ఒక్కో ప్రశాంతమైన అడుగు చాలు.",
    ],
    mr: [
      "हळूच जाऊया. मी तुमच्यासोबत आहे.",
      "हे शांत आणि सोपं ठेवूया.",
      "एकेक शांत पाऊल घेऊया.",
    ],
    gu: [
      "ધીમે ધીમે જઈએ. હું તમારી સાથે છું.",
      "આને નરમ અને સરળ રાખીએ.",
      "એકેક શાંત પગલું પૂરતું છે.",
    ],
    kn: [
      "ನಿಧಾನವಾಗಿ ಹೋಗೋಣ. ನಾನು ನಿಮ್ಮ ಜೊತೆ ಇದ್ದೇನೆ.",
      "ಇದನ್ನು ಮೃದುವಾಗಿ, ಸರಳವಾಗಿಯೇ ಇಟ್ಟುಕೊಳ್ಳೋಣ.",
      "ಒಂದು ಒಂದಾಗಿ ಶಾಂತ ಹೆಜ್ಜೆ ಇಡೋಣ.",
    ],
    ml: [
      "മെതുവായി പോകാം. ഞാൻ നിങ്ങളോടൊപ്പമുണ്ട്.",
      "ഇത് മൃദുവായി, ലളിതമായി വയ്ക്കാം.",
      "ഒരു ഒരു ശാന്ത പടി മതി.",
    ],
    pa: [
      "ਹੌਲੀ-ਹੌਲੀ ਚੱਲੀਏ। ਮੈਂ ਤੁਹਾਡੇ ਨਾਲ ਹਾਂ।",
      "ਇਹਨੂੰ ਨਰਮ ਅਤੇ ਸਧਾਰਨ ਰੱਖੀਏ।",
      "ਇੱਕ-ਇੱਕ ਸ਼ਾਂਤ ਕਦਮ ਲੈਂਦੇ ਹਾਂ।",
    ],
    ur: [
      "آہستہ آہستہ چلتے ہیں۔ میں آپ کے ساتھ ہوں۔",
      "اسے نرم اور سادہ رکھیں۔",
      "ایک ایک پُرسکون قدم کافی ہے۔",
    ],
    he: [
      "ניגש לזה בעדינות, מבלי לאבד בהירות.",
      "נשאיר את זה עדין ופשוט.",
      "צעד שקט אחד מספיק לעכשיו.",
    ],
    de: [
      "Wir gehen das sanft an, ohne die Klarheit zu verlieren.",
      "Einfach und sanft — so bleiben wir.",
      "Ein ruhiger Schritt ist genug für jetzt.",
    ],
    ja: [
      "穏やかに、でも誠実に向き合おう。",
      "優しく、シンプルに進もう。",
      "今は静かな一歩で十分。",
    ],
  } as const;

  const partnerLike = {
    en: [
      "I’m staying with this with you.",
      "We can take this a little at a time together.",
      "No pressure — we can move softly.",
      "We can sit with this for a moment.",
      "You don’t have to sort all of it at once.",
      "We can hold this gently and still be honest about it.",
    ],
    hi: [
      "मैं यहीं हूँ, तुम्हारे साथ।",
      "हम इसे धीरे-धीरे साथ में संभाल सकते हैं।",
      "कोई दबाव नहीं। आराम से चलेंगे।",
      "तुम्हें सब कुछ एक साथ उठाने की ज़रूरत नहीं है।",
      "हम एक पल यहीं ठहर सकते हैं।",
    ],
    bn: [
      "আমি আছি, তোমার পাশে।",
      "আমরা এটা ধীরে ধীরে একসাথে সামলাতে পারি।",
      "কোনো চাপ নেই। আস্তে এগোই।",
      "সবটা একসাথে তোমাকে বয়ে নিতে হবে না।",
      "চাইলে আমরা একটু থেমেও থাকতে পারি।",
    ],
    ta: [
      "நான் உன்னோடு இங்க இருக்கேன்.",
      "இதை நாம மெதுவா சேர்ந்து எடுத்துக்கலாம்.",
      "அவசரம் எதுவும் இல்லை. நிதானமா போலாம்.",
      "இத்தனையையும் நீ ஒரே நேரத்தில் சுமக்க வேண்டியதில்லை.",
      "வேண்டும்னா இங்கே கொஞ்சம் நின்று சுவாசிக்கலாம்.",
    ],
    te: [
      "నేను నీతోనే ఇక్కడ ఉన్నాను.",
      "ఇదిని మనం నెమ్మదిగా కలిసి తీసుకుందాం.",
      "ఏ ఒత్తిడి లేదు. మెల్లగా వెళ్దాం.",
      "ఇది అంతా నువ్వు ఒక్కసారిగా మోసుకోవాల్సిన అవసరం లేదు.",
      "కావాలంటే మనం కాసేపు ఇక్కడే ఆగొచ్చు.",
    ],
    mr: [
      "मी इथेच आहे, तुझ्यासोबत.",
      "हे आपण हळूहळू एकत्र हाताळू शकतो.",
      "कसलाही दबाव नाही. शांतपणे जाऊया.",
      "सगळं एकाच वेळी उचलायची गरज नाही.",
      "हवं तर आपण इथे थोडं थांबू शकतो.",
    ],
    gu: [
      "હું અહીં છું, તારી સાથે.",
      "આપણે આને ધીમે ધીમે સાથે સંભાળી શકીએ.",
      "કોઈ દબાણ નથી. શાંતિથી આગળ જઈએ.",
      "આ બધું તારે એકસાથે વહન કરવાની જરૂર નથી.",
      "ઇચ્છા હોય તો થોડું અહીં જ થંભી શકીએ.",
    ],
    kn: [
      "ನಾನು ಇಲ್ಲೇ ಇದ್ದೇನೆ, ನಿನ್ನ ಜೊತೆ.",
      "ಇದನ್ನು ನಾವು ನಿಧಾನವಾಗಿ ಜೊತೆಗೂಡಿ ನಿಭಾಯಿಸಬಹುದು.",
      "ಯಾವ ಒತ್ತಡವೂ ಬೇಡ. ಮೃದುವಾಗಿ ಹೋಗೋಣ.",
      "ಇದನ್ನೆಲ್ಲಾ ಒಮ್ಮೆಯೇ ನೀನು ಹೊರುವ ಅಗತ್ಯವಿಲ್ಲ.",
      "ಬೇಕೆಂದರೆ ನಾವು ಇಲ್ಲಿ ಸ್ವಲ್ಪ ತಂಗಬಹುದು.",
    ],
    ml: [
      "ഞാൻ ഇവിടെ തന്നെയുണ്ട്, നിന്നോടൊപ്പം.",
      "ഇത് നമുക്ക് മെതുവായി ഒരുമിച്ച് കൈകാര്യം ചെയ്യാം.",
      "ഒന്നും സമ്മർദ്ദമില്ല. പതുക്കെ പോകാം.",
      "ഇതെല്ലാം നീ ഒരുമിച്ച് ചുമക്കേണ്ടതില്ല.",
      "വേണമെങ്കിൽ നമുക്ക് ഇവിടെ കുറച്ച് നിൽക്കാം.",
    ],
    pa: [
      "ਮੈਂ ਇੱਥੇ ਹਾਂ, ਤੇਰੇ ਨਾਲ।",
      "ਅਸੀਂ ਇਹਨੂੰ ਹੌਲੀ-ਹੌਲੀ ਇਕੱਠੇ ਸੰਭਾਲ ਸਕਦੇ ਹਾਂ।",
      "ਕੋਈ ਦਬਾਅ ਨਹੀਂ। ਅਰਾਮ ਨਾਲ ਚੱਲੀਏ।",
      "ਇਹ ਸਭ ਕੁਝ ਤੈਨੂੰ ਇੱਕੋ ਵਾਰ ਨਹੀਂ ਝੱਲਣਾ ਪੈਣਾ।",
      "ਚਾਹੇਂ ਤਾਂ ਅਸੀਂ ਥੋੜ੍ਹਾ ਇੱਥੇ ਹੀ ਰੁਕ ਸਕਦੇ ਹਾਂ।",
    ],
    ur: [
      "میں یہیں ہوں، تمہارے ساتھ۔",
      "ہم اسے آہستہ آہستہ ساتھ سنبھال سکتے ہیں۔",
      "کوئی دباؤ نہیں۔ نرمی سے چلتے ہیں۔",
      "تمہیں سب کچھ ایک ساتھ اٹھانے کی ضرورت نہیں ہے۔",
      "چاہو تو ہم یہاں تھوڑی دیر ٹھہر سکتے ہیں۔",
    ],
    he: [
      "אני נשאר/ת כאן איתך עם זה.",
      "נוכל להתמודד עם זה לאט, יחד.",
      "אין לחץ — נלך בעדינות.",
      "אתה/את לא צריך/ה לשאת את הכל בבת אחת.",
      "אם תרצה/י, נוכל פשוט לשבת רגע כאן.",
    ],
    de: [
      "Ich bleibe hier mit dir dabei.",
      "Wir können das Schritt für Schritt zusammen angehen.",
      "Kein Druck — wir bewegen uns behutsam.",
      "Du musst nicht alles auf einmal tragen.",
      "Wenn du möchtest, können wir einfach kurz innehalten.",
    ],
    ja: [
      "ここで一緒にいるよ。",
      "一緒に少しずつ進んでいこう。",
      "プレッシャーはない — そっと動こう。",
      "全部を一気に抱えなくていい。",
      "よかったら、ここでちょっと止まってもいいよ。",
    ],
  } as const;

  const bank =
    tone === "calm_companion"
      ? calmCompanion
      : tone === "partner_like"
        ? partnerLike
        : closeFriend;
  const key = normalizeLang(lang) as keyof typeof closeFriend;
  return (bank as any)[key] ?? bank.en;
}

function practicalBridgeBank(
  lang: string,
  tone: ImotaraPersonaTone,
): readonly string[] {
  const closeFriend = {
    en: [
      "What’s the next tiny step—what have you tried so far?",
      "Tell me what you want to achieve in one line, and we’ll pick the smallest next action.",
      "If you share a bit of context, I’ll help you choose the next small move.",
    ],
    hi: [
      "अगला छोटा कदम क्या हो — file name से शुरू करें या exact error log से?",
      "एक लाइन में बताओ goal क्या है—फिर हम सबसे छोटा next action चुन लेंगे।",
      "Current output और expected output भेज दो—फिर अगला step तय करते हैं।",
    ],
    bn: [
      "পরের ছোট্ট step কী হবে—ফাইলের নাম থেকে শুরু করবো, নাকি exact error log?",
      "এক লাইনে আপনার goal বলুন—তারপর আমরা সবচেয়ে ছোট next action ঠিক করি।",
      "Current output + expected output দিন—আমি পরের step বলে দিচ্ছি।",
    ],
    ta: [
      "அடுத்த சின்ன step என்ன—file name-ஆ, இல்ல exact error log-ஆ எதிலிருந்து தொடங்கலாம்?",
      "ஒரே வரியில goal சொல்லுங்க—அப்புறம் smallest next action எடுக்கலாம்.",
      "Current output + expected output அனுப்புங்க—நான் next step சொல்லி தர்றேன்.",
    ],
    te: [
      "తర్వాతి చిన్న step ఏమిటి—file name తో మొదలెట్టాలా, లేక exact error log తోనా?",
      "ఒక లైన్లో goal చెప్పండి—తర్వాత smallest next action ఎంచుకుందాం.",
      "Current output + expected output పంపండి—నేను next step చెబుతాను.",
    ],
    mr: [
      "पुढचा छोटा step काय — file name पासून सुरू करू का exact error log पासून?",
      "एक ओळीत goal सांगा—मग आपण सर्वात छोटा next action निवडू.",
      "Current output + expected output पाठवा—मी पुढचा step सांगतो.",
    ],
    gu: [
      "આગલો નાનો step શું — file name થી શરૂ કરીએ કે exact error log થી?",
      "એક લાઇનમાં goal કહો—પછી સૌથી નાનો next action નક્કી કરીએ.",
      "Current output + expected output મોકલો—હું next step કહું.",
    ],
    kn: [
      "ಮುಂದಿನ ಸಣ್ಣ step ಏನು—file name ನಿಂದ ಪ್ರಾರಂಭಿಸೋಣಾ, ಅಥವಾ exact error log ನಿಂದಾ?",
      "ಒಂದು ಸಾಲಿನಲ್ಲಿ goal ಹೇಳಿ—ನಂತರ smallest next action ಆಯ್ಕೆ ಮಾಡೋಣ.",
      "Current output + expected output ಕಳುಹಿಸಿ—ನಾನು next step ಹೇಳುತ್ತೇನೆ.",
    ],
    ml: [
      "അടുത്ത ചെറിയ step എന്ത്—file name-ൽ നിന്ന് തുടങ്ങണോ, അല്ല exact error log-ൽ നിന്നോ?",
      "ഒരു ലൈനിൽ goal പറയൂ—പിന്നെ smallest next action തിരഞ്ഞെടുക്കാം.",
      "Current output + expected output അയയ്ക്കൂ—ഞാൻ next step പറയും.",
    ],
    pa: [
      "ਅਗਲਾ ਛੋਟਾ step ਕੀ — file name ਤੋਂ ਸ਼ੁਰੂ ਕਰੀਏ ਜਾਂ exact error log ਤੋਂ?",
      "ਇੱਕ ਲਾਈਨ ਵਿੱਚ goal ਦੱਸੋ—ਫਿਰ ਅਸੀਂ ਸਭ ਤੋਂ ਛੋਟਾ next action ਚੁਣਾਂਗੇ।",
      "Current output + expected output ਭੇਜੋ—ਮੈਂ next step ਦੱਸ ਦਿਆਂਗਾ।",
    ],
    ur: [
      "اگلا چھوٹا step کیا ہو—file name سے شروع کریں یا exact error log سے؟",
      "ایک لائن میں goal بتائیں—پھر ہم سب سے چھوٹا next action چن لیں گے۔",
      "Current output + expected output بھیجیں—میں next step بتا دوں گا۔",
    ],
    he: [
      "מה הצעד הקטן הבא — נתחיל עם שם הקובץ או לוג השגיאה המדויק?",
      "אמור/י לי את המטרה בשורה אחת — ואז נבחר את הפעולה הקטנה הבאה.",
      "שלח/י output נוכחי + output צפוי — ואז נקבע את הצעד הבא.",
    ],
    de: [
      "Was ist der nächste kleine Schritt — fangen wir mit dem Dateinamen an oder dem genauen Fehlerlog?",
      "Sag mir dein Ziel in einem Satz — dann wählen wir die kleinste nächste Aktion.",
      "Schick mir aktuellen Output + erwarteten Output — dann legen wir den nächsten Schritt fest.",
    ],
    ja: [
      "次の小さなステップは何 — ファイル名から始める？それとも正確なエラーログから？",
      "目標を一言で教えて — 一番小さな次の行動を選ぼう。",
      "現在のoutputと期待するoutputを送って — 次のステップを決めよう。",
    ],
  } as const;

  const calmCompanion = {
    en: [
      "Let’s do this gently: what’s the one concrete thing you want done next?",
      "What’s your smallest acceptable outcome for the next 10 minutes?",
      "If you tell me where you feel stuck, we’ll take one steady step together.",
    ],
    hi: [
      "धीरे-धीरे करेंगे: अभी अगला एक concrete काम क्या करना है?",
      "अगले 10 मिनट के लिए आपका smallest acceptable outcome क्या है?",
      "File path और failing line भेजो—फिर step by step ठीक करते हैं।",
    ],
    bn: [
      "ধীরে করি—এখন ঠিক কোন ছোট কাজটা আগে করতে চাও?",
      "আগামী ১০ মিনিটে তোমার জন্য সবচেয়ে ছোট গ্রহণযোগ্য ফল কী হবে?",
      "কোথায় আটকে আছো বলো—আমরা সেখান থেকেই ধীরে এগোবো।",
    ],
    ta: [
      "மெதுவாக போகலாம் — இப்போ அடுத்த சின்ன concrete வேலை என்ன?",
      "அடுத்த 10 நிமிடத்துக்கு உனக்கு போதுமான சிறிய முடிவு என்ன இருக்கும்?",
      "எங்கே சிக்கி இருக்கிறது என்று சொல் — அங்கிருந்து நிதானமாக போகலாம்.",
    ],
    te: [
      "నెమ్మదిగా చేద్దాం — ఇప్పుడే చేయాల్సిన చిన్న concrete పని ఏమిటి?",
      "తదుపరి 10 నిమిషాలకు సరిపడే చిన్న acceptable outcome ఏమిటి?",
      "ఎక్కడ ఆగిపోయావో చెపు — అక్కడినుంచే మెల్లగా ముందుకు వెళ్దాం.",
    ],
    mr: [
      "हळूहळू करूया — आत्ता पुढचा एक छोटा concrete काम कोणता?",
      "पुढच्या 10 मिनिटांसाठी तुझ्यासाठी पुरेसा छोटा outcome कोणता असेल?",
      "कुठे अडकलास/अडकलीस ते सांग — तिथून आपण शांतपणे पुढे जाऊ.",
    ],
    gu: [
      "આપણે ધીમે જઈએ — હમણાં આગળનું એક નાનું concrete કામ શું છે?",
      "આગલા 10 મિનિટ માટે તારું સૌથી નાનું acceptable outcome શું રહેશે?",
      "ક્યાં અટક્યો/અટકી છે તે કહેજે — આપણે એમાંથી ધીમે આગળ વધીએ.",
    ],
    kn: [
      "ನಿಧಾನವಾಗಿ ಮಾಡೋಣ — ಈಗ ಮುಂದಿನ ಒಂದು ಚಿಕ್ಕ concrete ಕೆಲಸ ಏನು?",
      "ಮುಂದಿನ 10 ನಿಮಿಷಗಳಿಗೆ ನಿನಗೆ ಸಾಕಾಗುವ ಚಿಕ್ಕ acceptable outcome ಏನು?",
      "ಎಲ್ಲಿ ಅಟಕಿದ್ದೀಯೋ ಹೇಳು — ಅಲ್ಲಿಂದ ನಿಧಾನವಾಗಿ ಮುಂದೆ ಹೋಗೋಣ.",
    ],
    ml: [
      "പതുക്കെ പോകാം — ഇനി ചെയ്യേണ്ട ഒരു ചെറിയ concrete കാര്യം എന്താണ്?",
      "അടുത്ത 10 മിനിറ്റിനുള്ളിൽ നിനക്ക് മതിയാകുന്ന ചെറിയ outcome എന്തായിരിക്കും?",
      "എവിടെയാണ് നീ കുടുങ്ങിയിരിക്കുന്നത് എന്ന് പറയൂ — അവിടുന്ന് നമുക്ക് ശാന്തമായി തുടങ്ങാം.",
    ],
    pa: [
      "ਹੌਲੇ-ਹੌਲੇ ਕਰੀਏ — ਹੁਣ ਅਗਲਾ ਇੱਕ ਛੋਟਾ concrete ਕੰਮ ਕੀ ਹੈ?",
      "ਅਗਲੇ 10 ਮਿੰਟਾਂ ਲਈ ਤੇਰਾ ਸਭ ਤੋਂ ਛੋਟਾ acceptable outcome ਕੀ ਹੋਵੇਗਾ?",
      "ਜਿੱਥੇ ਅਟਕਿਆ/ਅਟਕੀ ਹੈਂ ਦੱਸ — ਅਸੀਂ ਓਥੋਂ ਹੌਲੇ ਹੌਲੇ ਅੱਗੇ ਵਧਾਂਗੇ।",
    ],
    ur: [
      "آہستہ آہستہ کرتے ہیں — ابھی اگلا ایک چھوٹا concrete کام کیا ہے؟",
      "اگلے 10 منٹ کے لیے تمہارا سب سے چھوٹا acceptable outcome کیا ہوگا؟",
      "جہاں اٹکے ہو وہ بتاؤ — ہم وہیں سے آہستگی سے آگے بڑھیں گے۔",
    ],
    he: [
      "נעשה את זה בעדינות: מה הדבר הקונקרטי האחד שאתה/את רוצה שייגמר?",
      "מה התוצאה הקטנה ביותר שתרצה/י להשיג ב-10 דקות הבאות?",
      "אמור/י לי היכן אתה/את תקוע/ה — נעשה יחד צעד שקט.",
    ],
    de: [
      "Machen wir es sanft: Was ist das eine konkrete Ding, das du als nächstes erledigt haben willst?",
      "Was ist dein kleinstes akzeptables Ergebnis für die nächsten 10 Minuten?",
      "Sag mir, wo du feststeckst — wir machen dann einen ruhigen Schritt zusammen.",
    ],
    ja: [
      "優しく進もう — 次に達成したい一つの具体的なことは何？",
      "次の10分間で、あなたにとって十分な最小限の成果は何？",
      "どこで詰まっているか教えて — 一緒に静かな一歩を踏み出そう。",
    ],
    or: [
      "ଧୀରେ ଧୀରେ କରିବା — ଏବେ ପରବର୍ତ୍ତୀ ଗୋଟେ ଛୋଟ concrete କାମ କଣ?",
      "ଆଗାମୀ 10 ମିନିଟ୍ ପାଇଁ ତୁମର ସବୁଠାରୁ ଛୋଟ acceptable outcome କଣ ହେବ?",
      "କେଉଁଠି ଅଟକିଛ କହ — ଆମେ ସେଠାରୁ ଧୀରେ ଧୀରେ ଆଗକୁ ବଢ଼ିବା।",
    ],
  } as const;

  const bank = tone === "calm_companion" ? calmCompanion : closeFriend;

  const key = normalizeLang(lang) as keyof typeof closeFriend;
  return (bank as any)[key] ?? bank.en;
}

function insightAlreadyHasQuestion(lang: string, insight: string): boolean {
  const s = (insight ?? "").trim();
  if (!s) return false;

  // Direct question marks across scripts
  if (/[?؟？]/.test(s)) return true;

  const l = normalizeLang(lang);

  // Light heuristic: if it contains common question words, treat it as already asking
  const lower = s.toLowerCase();

  if (l === "hi") return /(^|\s)(क्या|क्यों|कैसे|कब|कहाँ|कौन)\b/.test(s);
  if (l === "bn") return /(^|\s)(কি|কেন|কিভাবে|কখন|কোথায়|কে)\b/.test(s);

  return (
    /\b(what|why|how|when|where|who)\b/.test(lower) ||
    /\b(do you|can you|would you|should we|want to)\b/.test(lower)
  );
}

function userAsksForSuggestion(s: string): boolean {
  const t = (s ?? "").toLowerCase();
  return (
    /\b(what do you suggest|suggest|recommend|what should i do|what should i eat|tell me what to do)\b/.test(
      t,
    ) ||
    /\b(kya\s+karu|kya\s+khau|suggest\s+karo|recommend\s+karo)\b/.test(t) || // Hindi-ish roman
    /\b(ki\s+korbo|ki\s+khabo)\b/.test(t) // Bengali-ish roman
  );
}

function isLowSignalUserTurn(msg: string): boolean {
  const raw = String(msg ?? "").trim();
  if (!raw) return true;

  const t = raw.toLowerCase();

  // Clear direct questions should not be treated as low-signal,
  // even if they are short.
  if (
    /\?$/.test(raw) ||
    /^(what|why|how|when|where|who|whom|whose|which|can|could|would|will|do|does|did|are|is|am|was|were|have|has|had)\b/i.test(
      t,
    )
  ) {
    return false;
  }

  // Common ultra-short / low-context turns
  if (/^(hi|hello|hey|yo|hii+|hiii+|ok|okay|hmm+|help|life)$/i.test(t))
    return true;

  // Short length / few words → low signal
  const words = t.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (raw.length <= 12) return true;
  if (words.length <= 2) return true;
  if (words.length <= 4 && raw.length <= 22) return true;

  // Emoji/punctuation-only or almost-no-text
  const alphaNumCount = (t.match(/[\p{L}\p{N}]/gu) ?? []).length;
  if (alphaNumCount === 0) return true;

  return false;
}

function suggestionBridgeBank(lang: string): readonly string[] {
  const l = normalizeLang(lang);

  // Suggestion bridges are now emotion-first and generic.
  // Still "1 tiny step + 1 gentle handoff question" to keep the conversation human.

  if (l === "hi") {
    return [
      "अगर चाहो तो अभी एक छोटा कदम: थोड़ा पानी, 3 धीमी साँसें, या 60 सेकंड स्ट्रेच। अभी तुम्हें क्या सबसे ज़्यादा चाहिए—आराम या clarity?",
      "हम इसे बहुत छोटा रख सकते हैं: 5 मिनट टहलना, चेहरा धोना, या बस आँखें बंद करके साँस गिनना। अभी तुम्हारे लिए सबसे आसान क्या होगा?",
    ] as const;
  }

  if (l === "bn") {
    return [
      "চাইলে এখন একটা ছোট্ট পদক্ষেপ: একটু পানি, ৩টা ধীরে শ্বাস, বা ৬০ সেকেন্ড স্ট্রেচ। এই মুহূর্তে সবচেয়ে দরকার কী—আরাম নাকি পরিষ্কারভাবে ভাবা?",
      "আমরা একেবারে ছোট করে শুরু করতে পারি: ৫ মিনিট হাঁটা, মুখ ধোয়া, বা শুধু শ্বাস গোনা। এখন তোমার জন্য সবচেয়ে সহজটা কী হবে?",
    ] as const;
  }

  if (l === "or") {
    return [
      "ଚାହିଲେ ଏବେ ଗୋଟେ ଛୋଟ ପଦକ୍ଷେପ ନେଇପାରିବା: ଥୋଡ଼ା ପାଣି, ୩ଟି ଧୀରେ ଶ୍ୱାସ, କିମ୍ବା ୬୦ ସେକେଣ୍ଡ ଷ୍ଟ୍ରେଚ୍। ଏହି ମୁହୂର୍ତ୍ତରେ ସବୁଠାରୁ ଦରକାର କଣ—ଆରାମ ନା ସ୍ପଷ୍ଟତା?",
      "ଆମେ ଏକେବାରେ ଛୋଟରୁ ଆରମ୍ଭ କରିପାରିବା: ୫ ମିନିଟ୍ ହାଟିବା, ମୁହଁ ଧୋଇବା, କିମ୍ବା କେବଳ ଶ୍ୱାସ ଗଣିବା। ଏବେ ତୁମ ପାଇଁ ସବୁଠାରୁ ସହଜ କଣ ହେବ?",
    ] as const;
  }

  if (l === "ta") {
    return [
      "வேண்டும்னா இப்போ ஒரு சின்ன step எடுக்கலாம்: கொஞ்சம் தண்ணீர், 3 மெதுவான மூச்சு, அல்லது 60-second stretch. இந்த நேரத்தில் அதிகம் தேவைப்படுவது என்ன—சற்று அமைதியா, இல்ல தெளிவா?",
      "நாம ரொம்ப சின்னதா தொடங்கலாம்: 5 நிமிடம் நடக்கலாம், முகம் கழுவலாம், இல்ல சும்மா மூச்சை எண்ணலாம். இப்போ உனக்கு எது easiest ஆக இருக்கும்?",
    ] as const;
  }

  if (l === "te") {
    return [
      "కావాలంటే ఇప్పుడే ఒక చిన్న step తీసుకుందాం: కొంచెం నీళ్లు, 3 నెమ్మదైన శ్వాసలు, లేదా 60-second stretch. ఈ క్షణంలో ఎక్కువగా ఏది కావాలి—కొంచెం సాంత్వననా, లేక స్పష్టతా?",
      "మనము చాలా చిన్నదిగా మొదలుపెట్టవచ్చు: 5 నిమిషాలు నడవడం, ముఖం కడుక్కోవడం, లేదా కేవలం శ్వాస లెక్కించడం. ఇప్పుడే నీకు ఏది easiest గా ఉంటుంది?",
    ] as const;
  }

  if (l === "gu") {
    return [
      "ઇચ્છા હોય તો અત્યારે એક નાનો step લઈએ: થોડું પાણી, 3 ધીમા શ્વાસ, અથવા 60-second stretch. આ ક્ષણે સૌથી વધારે શું જોઈએ છે—થોડું શાંત થવું કે થોડું સ્પષ્ટ થવું?",
      "અમે બહુ નાનાથી શરૂ કરી શકીએ: 5 મિનિટ ચાલવું, મોઢું ધોવું, અથવા ફક્ત શ્વાસ ગણવું. અત્યારે તારાં માટે સૌથી easiest શું રહેશે?",
    ] as const;
  }

  if (l === "kn") {
    return [
      "ಬೇಕೆಂದರೆ ಈಗ ಒಂದು ಚಿಕ್ಕ step ತೆಗೆದುಕೊಳ್ಳೋಣ: ಸ್ವಲ್ಪ ನೀರು, 3 ನಿಧಾನವಾದ ಉಸಿರಾಟಗಳು, ಅಥವಾ 60-second stretch. ಈ ಕ್ಷಣದಲ್ಲಿ ಹೆಚ್ಚು ಬೇಕಾಗಿರುವುದು ಏನು—ಸ್ವಲ್ಪ ನೆಮ್ಮದಿಯಾ, ಅಥವಾ ಸ್ವಲ್ಪ ಸ್ಪಷ್ಟತೆಯಾ?",
      "ನಾವು ತುಂಬಾ ಚಿಕ್ಕದರಿಂದ ಶುರು ಮಾಡಬಹುದು: 5 ನಿಮಿಷ ನಡೆಯುವುದು, ಮುಖ ತೊಳೆಯುವುದು, ಅಥವಾ ಕೇವಲ ಉಸಿರನ್ನು ಎಣಿಸುವುದು. ಈಗ ನಿನಗೆ ಯಾವುದು easiest ಆಗಿರುತ್ತದೆ?",
    ] as const;
  }

  if (l === "ml") {
    return [
      "വേണമെങ്കിൽ ഇപ്പോൾ ഒരു ചെറിയ step എടുക്കാം: കുറച്ച് വെള്ളം, 3 മന്ദഗതിയിലുള്ള ശ്വാസങ്ങൾ, അല്ലെങ്കിൽ 60-second stretch. ഈ നിമിഷത്തിൽ ഏറ്റവും കൂടുതൽ വേണ്ടത് എന്താണ്—കുറച്ച് ആശ്വാസമോ, അല്ലെങ്കിൽ വ്യക്തതയോ?",
      "നമുക്ക് വളരെ ചെറിയതിൽ നിന്ന് തുടങ്ങാം: 5 മിനിറ്റ് നടക്കുക, മുഖം കഴുകുക, അല്ലെങ്കിൽ ശ്വാസം മാത്രം എണ്ണുക. ഇപ്പോൾ നിനക്കു ഏതാണ് ഏറ്റവും എളുപ്പമെന്ന് തോന്നുന്നത്?",
    ] as const;
  }

  if (l === "mr") {
    return [
      "हवं असेल तर आत्ता एक छोटा step घेऊया: थोडंसं पाणी, 3 हळू श्वास, किंवा 60-second stretch. या क्षणी सगळ्यात जास्त काय हवं आहे—थोडा आराम, की थोडी स्पष्टता?",
      "आपण अगदी छोट्यापासून सुरू करू शकतो: 5 मिनिटं चालणं, तोंड धुणं, किंवा फक्त श्वास मोजणं. आत्ता तुला सगळ्यात सोपं काय वाटतंय?",
    ] as const;
  }

  if (l === "pa") {
    return [
      "ਜੇ ਚਾਹੋ ਤਾਂ ਅਸੀਂ ਹੁਣ ਇੱਕ ਛੋਟਾ step ਲੈ ਸਕਦੇ ਹਾਂ: ਥੋੜ੍ਹਾ ਪਾਣੀ, 3 ਹੌਲੇ ਸਾਹ, ਜਾਂ 60-second stretch. ਇਸ ਵੇਲੇ ਸਭ ਤੋਂ ਵੱਧ ਕੀ ਚਾਹੀਦਾ ਹੈ—ਥੋੜ੍ਹਾ ਆਰਾਮ ਜਾਂ ਥੋੜ੍ਹੀ ਸਪਸ਼ਟਤਾ?",
      "ਅਸੀਂ ਬਹੁਤ ਛੋਟੇ ਤੋਂ ਸ਼ੁਰੂ ਕਰ ਸਕਦੇ ਹਾਂ: 5 ਮਿੰਟ ਤੁਰਨਾ, ਮੂੰਹ ਧੋਣਾ, ਜਾਂ ਸਿਰਫ਼ ਸਾਹ ਗਿਣਣਾ. ਇਸ ਵੇਲੇ ਤੇਰੇ ਲਈ ਸਭ ਤੋਂ ਆਸਾਨ ਕੀ ਹੋਵੇਗਾ?",
    ] as const;
  }

  if (l === "ur") {
    return [
      "چاہو تو ابھی ایک چھوٹا step لے سکتے ہیں: تھوڑا پانی، 3 آہستہ سانسیں، یا 60-second stretch۔ اس لمحے سب سے زیادہ کس چیز کی ضرورت ہے—تھوڑا سکون یا تھوڑی وضاحت؟",
      "ہم بہت چھوٹے سے شروع کر سکتے ہیں: 5 منٹ چلنا، منہ دھونا، یا صرف سانسیں گننا۔ ابھی تمہارے لیے سب سے آسان کیا ہوگا؟",
    ] as const;
  }

  if (l === "he") {
    return [
      "אם תרצה/י, צעד קטן עכשיו: קצת מים, 3 נשימות איטיות, או 60 שניות מתיחה. מה יעזור עכשיו — הרפיה או בהירות?",
      "נוכל להתחיל מאד בקטן: 5 דקות הליכה, לשטוף את הפנים, או פשוט לספור נשימות. מה הכי קל לך כרגע?",
    ] as const;
  }

  if (l === "de") {
    return [
      "Wenn du möchtest, ein kleiner Schritt: etwas Wasser, 3 langsame Atemzüge oder 60 Sekunden Dehnen. Was hilft jetzt am meisten — Erleichterung oder Klarheit?",
      "Wir können es sehr klein halten: 5 Minuten Spaziergang, Gesicht waschen oder einfach Atemzüge zählen. Womit fällt es dir am leichtesten anzufangen?",
    ] as const;
  }

  if (l === "ja") {
    return [
      "もし良ければ、小さな一歩：少し水を飲む、ゆっくり3回深呼吸、60秒ストレッチ。今一番助けになるのは — 安らぎ？それとも明確さ？",
      "とても小さく始めることもできるよ：5分散歩、顔を洗う、ただ息を数える。今あなたにとって一番やりやすいのはどれ？",
    ] as const;
  }

  // default EN
  return [
    "If you want a tiny step: sip water, take 3 slow breaths, or stretch for 60 seconds. What would help most right now—comfort or clarity?",
    "We can keep it very small: a 5-minute walk, a quick reset (wash face), or jot one feeling down. Which feels easiest to start with?",
  ] as const;
}

function isGreetingOnly(msg: string): boolean {
  const t = (msg ?? "").trim().toLowerCase();
  if (!t) return false;

  // Strip common punctuation/emojis
  const cleaned = t.replace(/[!.,?？۔।🙏🙂😊👋]+/g, "").trim();

  // Very short greeting-only inputs
  const greetings = new Set([
    "hi",
    "hello",
    "hey",
    "yo",
    "hii",
    "hiii",
    "hola",
    "namaste",
    "namaskar",
    "bonjour",
    "good morning",
    "good afternoon",
    "good evening",
  ]);

  return greetings.has(cleaned);
}

function isReturnOnly(msg: string): boolean {
  const t = (msg ?? "").trim().toLowerCase();
  if (!t) return false;

  const cleaned = t.replace(/[!.,?？۔۔🙏🙂😊👋]+/g, "").trim();

  return (
    /\b(i\s*(?:am|’m|'m)\s+back|im\s+back|back\s+now|i\s*(?:am|’m|'m)\s+here\s+again|here\s+again|i\s+returned)\b/.test(
      cleaned,
    ) || cleaned === "im back"
  );
}

function greetingInsightBank(
  lang: string,
  tone: ImotaraPersonaTone,
): readonly string[] {
  const closeFriend = {
    en: [
      "Hi 🙂 Good to see you here.",
      "Hey 👋 I’m glad you dropped in.",
      "Hi. Tell me what kind of day this is.",
    ],
    hi: [
      "हाय 🙂 तुम्हें यहाँ देखकर अच्छा लगा।",
      "हेy 👋 अच्छा लगा कि तुम आए।",
      "हाय। बताओ, आज का दिन कैसा जा रहा है?",
    ],
    bn: [
      "হাই 🙂 তোমাকে এখানে দেখে ভালো লাগছে।",
      "হেই 👋 তুমি এসেছো, ভালো লাগলো।",
      "হাই। বলো, আজ কেমন কাটছে?",
    ],
    ta: [
      "ஹாய் 🙂 நீ இங்கே வந்தது நல்லா இருக்கு.",
      "ஹே 👋 நீ வந்தது சந்தோஷம்.",
      "ஹாய். இன்று நாள் எப்படி போகுது?",
    ],
    te: [
      "హాయ్ 🙂 నువ్వు ఇక్కడికి రావడం బాగుంది.",
      "హే 👋 నువ్వు వచ్చినందుకు సంతోషం.",
      "హాయ్. ఈ రోజు ఎలా సాగుతోంది?",
    ],
    mr: [
      "हाय 🙂 तुला इथे पाहून बरं वाटलं.",
      "हेy 👋 तू आलास/आलीस, छान वाटलं.",
      "हाय. आजचा दिवस कसा चाललाय?",
    ],
    gu: [
      "હાય 🙂 તને અહીં જોઈને સારું લાગ્યું.",
      "હે 👋 તું આવ્યો/આવી એ સારું લાગ્યું.",
      "હાય. આજે દિવસ કેવો ચાલી રહ્યો છે?",
    ],
    kn: [
      "ಹಾಯ್ 🙂 ನೀನು ಇಲ್ಲಿ ಬಂದಿದ್ದು ಚೆನ್ನಾಗಿದೆ.",
      "ಹೇ 👋 ನೀನು ಬಂದಿದ್ದು ಸಂತೋಷವಾಗಿದೆ.",
      "ಹಾಯ್. ಇಂದು ದಿನ ಹೇಗೆ ಹೋಗುತ್ತಿದೆ?",
    ],
    ml: [
      "ഹായ് 🙂 നീ ഇവിടെ വന്നത് സന്തോഷമായി.",
      "ഹേ 👋 നീ വന്നത് നല്ലായി തോന്നി.",
      "ഹായ്. ഇന്ന് ദിവസം എങ്ങനെയാണ് പോകുന്നത്?",
    ],
    pa: [
      "ਹਾਇ 🙂 ਤੈਨੂੰ ਇੱਥੇ ਵੇਖ ਕੇ ਚੰਗਾ ਲੱਗਿਆ।",
      "ਹੇ 👋 ਤੂੰ ਆਇਆ/ਆਈ, ਚੰਗਾ ਲੱਗਿਆ।",
      "ਹਾਇ। ਅੱਜ ਦਿਨ ਕਿਵੇਂ ਲੰਘ ਰਿਹਾ ਹੈ?",
    ],
    ur: [
      "ہائی 🙂 تمہیں یہاں دیکھ کر اچھا لگا۔",
      "ارے 👋 تم آئے، اچھا لگا۔",
      "ہائی۔ آج دن کیسا گزر رہا ہے؟",
    ],
    or: [
      "ହାଇ 🙂 ତୁମକୁ ଏଠାରେ ଦେଖି ଭଲ ଲାଗିଲା।",
      "ଆରେ 👋 ତୁମେ ଆସିଛ, ଭଲ ଲାଗିଲା।",
      "ହାଇ। ଆଜି ଦିନ କେମିତି କଟୁଛି?",
    ],
    he: [
      "היי 🙂 שמח/ה לראות אותך כאן.",
      "היי 👋 טוב שבאת/באת.",
      "היי. ספר/י לי, איך נראה היום.",
    ],
    de: [
      "Hey 🙂 Schön, dich hier zu sehen.",
      "Hallo 👋 Gut, dass du vorbeigekommen bist.",
      "Hi. Erzähl mir, was das heute für ein Tag ist.",
    ],
    ja: [
      "こんにちは 🙂 ここで会えてよかった。",
      "やあ 👋 来てくれてよかった。",
      "こんにちは。今日はどんな日？教えて。",
    ],
  } as const;

  const coach = {
    en: [
      "Hey 👋 Glad you’re here. Let’s get our bearings.",
      "Hi. We can start simple and figure this out together.",
      "Hey 🙂 We’ll take this one clear step at a time.",
    ],
    hi: [
      "हेy 👋 अच्छा लगा कि तुम आए। चलो पहले स्थिति समझते हैं।",
      "हाय। हम सरल तरीके से शुरू करेंगे और साथ में समझेंगे।",
      "हेy 🙂 हम इसे एक-एक साफ़ कदम में लेंगे।",
    ],
  } as const;

  const calm = {
    en: [
      "Hello. I’m glad you’re here.",
      "Hi. We can begin quietly and take it from there.",
      "Hello 🙂 Let’s ease into this gently.",
    ],
    hi: [
      "नमस्ते। अच्छा लगा कि तुम यहाँ हो।",
      "हाय। हम शांति से शुरू कर सकते हैं और फिर आगे बढ़ेंगे।",
      "नमस्ते 🙂 चलो इसे धीरे से शुरू करते हैं।",
    ],
  } as const;

  const bank =
    tone === "coach" ? coach : tone === "calm_companion" ? calm : closeFriend;

  const key = normalizeLang(lang);
  return (bank as any)[key] ?? bank.en;
}

function greetingBridgeBank(
  lang: string,
  tone: ImotaraPersonaTone,
): readonly string[] {
  const closeFriend = {
    en: [
      "How are you doing right now?",
      "What’s on your mind today?",
      "What would you like from me right now?",
    ],
    hi: [
      "अभी तुम कैसे हो?",
      "आज तुम्हारे मन में क्या चल रहा है?",
      "अभी तुम्हें मुझसे क्या चाहिए?",
    ],
    bn: [
      "এখন কেমন আছো?",
      "আজ তোমার মনে কী চলছে?",
      "এখন তুমি আমার থেকে কী চাইছো?",
    ],
    ta: [
      "இப்போ எப்படி இருக்கே?",
      "இன்று உன் மனசுல என்ன இருக்கு?",
      "இப்போ என்கிட்ட என்ன வேண்டும்?",
    ],
    te: [
      "ఇప్పుడెలా ఉన్నావు?",
      "ఈ రోజు నీ మనసులో ఏముంది?",
      "ఇప్పుడే నన్నుంచి నీకు ఏమి కావాలి?",
    ],
    mr: [
      "आत्ता कसा/कशी आहेस?",
      "आज तुझ्या मनात काय चाललंय?",
      "आत्ता तुला माझ्याकडून काय हवं आहे?",
    ],
    gu: [
      "હમણાં કેમ છે?",
      "આજે તારાં મનમાં શું ચાલી રહ્યું છે?",
      "હમણાં તને મારી પાસેથી શું જોઈએ છે?",
    ],
    kn: [
      "ಈಗ ಹೇಗಿದ್ದೀಯ?",
      "ಇಂದು ನಿನ್ನ ಮನಸ್ಸಿನಲ್ಲಿ ಏನು ನಡೆಯುತ್ತಿದೆ?",
      "ಈಗ ನಿನಗೆ ನನ್ನಿಂದ ಏನು ಬೇಕು?",
    ],
    ml: [
      "ഇപ്പോൾ എങ്ങനെയുണ്ട്?",
      "ഇന്ന് നിന്റെ മനസ്സിൽ എന്താണ് നടക്കുന്നത്?",
      "ഇപ്പോൾ നിന്നെനിക്ക് എന്താണ് വേണ്ടത്?",
    ],
    pa: [
      "ਹੁਣ ਕਿਵੇਂ ਹੋ?",
      "ਅੱਜ ਤੇਰੇ ਮਨ ਵਿੱਚ ਕੀ ਚੱਲ ਰਿਹਾ ਹੈ?",
      "ਇਸ ਵੇਲੇ ਤੈਨੂੰ ਮੇਰੇ ਤੋਂ ਕੀ ਚਾਹੀਦਾ ਹੈ?",
    ],
    ur: [
      "اب کیسا محسوس کر رہے ہو؟",
      "آج تمہارے دل میں کیا چل رہا ہے؟",
      "اس وقت تمہیں مجھ سے کیا چاہیے؟",
    ],
    or: [
      "ଏବେ କେମିତି ଅଛ?",
      "ଆଜି ତୁମ ମନରେ କଣ ଚାଲୁଛି?",
      "ଏହି ମୁହୂର୍ତ୍ତରେ ତୁମକୁ ମୋ ପାଖରୁ କଣ ଦରକାର?",
    ],
    he: [
      "איך אתה/את עכשיו?",
      "מה עובר לך בראש היום?",
      "מה תרצה/י ממני עכשיו?",
    ],
    de: [
      "Wie geht es dir gerade?",
      "Was beschäftigt dich heute?",
      "Was möchtest du gerade von mir?",
    ],
    ja: [
      "今、どんな感じ？",
      "今日、何が頭にある？",
      "今、私に何を求めてる？",
    ],
  } as const;

  const coach = {
    en: [
      "Want us to gently pick one small thing to focus on?",
      "Would it help to choose one tiny next step together?",
      "Where would you like us to begin — softly and simply?",
    ],
    hi: [
      "क्या हम धीरे-से एक छोटी-सी चीज़ चुनें जिस पर ध्यान दें?",
      "क्या एक छोटा अगला कदम साथ में तय करना मदद करेगा?",
      "तुम चाहो तो हम कहाँ से शुरू करें — नरमी से, सरलता से?",
    ],
    bn: [
      "চলো কি একটা ছোট জিনিস বেছে নিই, যেটা দিয়ে শুরু করা যায়?",
      "একটা ছোট পরের ধাপ ঠিক করলে কি সাহায্য হবে?",
      "তুমি কোথা থেকে শুরু করতে চাও — ধীরে, সহজভাবে?",
    ],
    ta: [
      "ஒரு சிறிய விஷயத்திலிருந்து ஆரம்பிக்கலாமா?",
      "ஒரு சிறிய அடுத்த படி தேர்வு செய்தால் உதவுமா?",
      "நாம் எங்கிருந்து மெதுவாக தொடங்கலாம்?",
    ],
    te: [
      "ఒక చిన్న విషయంతో మొదలుపెట్టామా?",
      "ఒక చిన్న తదుపరి అడుగు ఎంచుకుంటే సహాయపడుతుందా?",
      "మనము ఎక్కడినుంచి నెమ్మదిగా మొదలుపెట్టాలి?",
    ],
  } as const;

  const calm = {
    en: [
      "Would you like to share what brought you here today?",
      "Do you want comfort first, or just a quiet check-in?",
      "Where would you like to begin?",
    ],
    hi: [
      "क्या तुम बताना चाहोगे कि आज यहाँ आने की वजह क्या है?",
      "पहले थोड़ा सुकून चाहिए, या बस एक शांत check-in?",
      "तुम कहाँ से शुरू करना चाहोगे?",
    ],
    bn: [
      "আজ এখানে আসার কারণটা বলতে ইচ্ছে করছে?",
      "আগে একটু সান্ত্বনা চাই, নাকি শুধু শান্তভাবে কথা বলতে চাও?",
      "তুমি কোথা থেকে শুরু করতে চাও?",
    ],
    ta: [
      "இன்று இங்கே வர காரணம் என்ன என்று சொல்லணுமா?",
      "முதலில் கொஞ்சம் ஆறுதல் வேண்டுமா, இல்லை அமைதியாக பேசணுமா?",
      "நீ எங்கிருந்து தொடங்க விரும்புகிறாய்?",
    ],
    te: [
      "ఈ రోజు ఇక్కడికి రావడానికి కారణం చెప్పాలనుకుంటున్నావా?",
      "ముందు కొంచెం ఓదార్పు కావాలా, లేక నెమ్మదిగా మాట్లాడాలనుకుంటున్నావా?",
      "ఎక్కడినుంచి మొదలుపెట్టాలని అనుకుంటున్నావు?",
    ],
  } as const;

  const bank =
    tone === "coach" ? coach : tone === "calm_companion" ? calm : closeFriend;

  const key = normalizeLang(lang);
  return (bank as any)[key] ?? bank.en;
}

export function formatImotaraReply(input: FormatReplyInput): string {
  const lang = normalizeLang(input.lang);
  const tone: ImotaraPersonaTone = input.tone ?? "close_friend";

  // ✅ RETURN MODE (user came back after pause)
  // Prefer the model's natural wording if it already produced a real return reply.
  // Fall back only if raw is empty/useless.
  if (input.mode === "return") {
    const returnRaw = stripRoboticMarkers(input.raw ?? "").trim();

    if (returnRaw.length >= 12) {
      return returnRaw;
    }

    const fallback =
      lang === "hi"
        ? "अच्छा, तुम वापस आ गए। अब यहीं से धीरे-धीरे आगे बढ़ते हैं।"
        : lang === "bn"
          ? "আচ্ছা, তুমি ফিরে এসেছো। এখন এখান থেকেই ধীরে ধীরে এগোই।"
          : lang === "ta"
            ? "சரி, நீ திரும்ப வந்துட்டே. இங்கிருந்தே மெதுவாக தொடரலாம்."
            : lang === "te"
              ? "సరే, నువ్వు తిరిగి వచ్చావు. ఇక్కడినుంచే నెమ్మదిగా కొనసాగుదాం."
              : lang === "mr"
                ? "बरं, तू परत आलास/आलीस. इथूनच हळूहळू पुढे जाऊया."
                : lang === "gu"
                  ? "બરાબર, તું પાછો/પાછી આવ્યો. અહીથી ધીમે ધીમે આગળ વધીએ."
                  : lang === "kn"
                    ? "ಸರಿ, ನೀನು ಮತ್ತೆ ಬಂದಿದ್ದೀಯ. ಇಲ್ಲಿಂದಲೇ ನಿಧಾನವಾಗಿ ಮುಂದುವರಿಯೋಣ."
                    : lang === "ml"
                      ? "ശരി, നീ തിരിച്ചു വന്നല്ലോ. ഇവിടെ നിന്നുതന്നെ പതുക്കെ തുടരാം."
                      : lang === "pa"
                        ? "ਠੀਕ ਹੈ, ਤੂੰ ਵਾਪਸ ਆ ਗਿਆ/ਆ ਗਈ। ਅਸੀਂ ਇੱਥੋਂ ਹੀ ਹੌਲੇ-ਹੌਲੇ ਅੱਗੇ ਵੱਧਦੇ ਹਾਂ।"
                        : lang === "ur"
                          ? "اچھا، تم واپس آ گئے ہو۔ ہم یہیں سے آہستہ آہستہ آگے بڑھتے ہیں۔"
                          : lang === "or"
                            ? "ଠିକ ଅଛି, ତୁମେ ଫେରି ଆସିଛ। ଏଠାରୁ ଧୀରେ ଧୀରେ ଆଗକୁ ବଢ଼ିବା।"
                            : lang === "he"
                              ? "טוב שחזרת/חזרת. נוכל להמשיך מכאן בעדינות."
                              : lang === "de"
                                ? "Schön, dass du zurück bist. Wir können hier sanft weitermachen."
                                : lang === "ja"
                                  ? "戻ってきたね。ここからゆっくり続けよう。"
                                  : "Alright, you’re back. We can continue gently from here.";

    return fallback;
  }

  const seed = (input.seed ?? "").trim() || "imotara";

  const userMsg = input.userMessage ?? "";
  const userMsgOneLine = userMsg.trim().replace(/\s+/g, " ");
  const rawOneLine = stripRoboticMarkers(input.raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 160);

  // ✅ Important: include user message + raw snippet in the hash so bridge lines
  // don't get stuck repeating the same Bengali closer every turn.
  // (still deterministic, just not constant across turns)
  const h = hash32(`${lang}|${tone}|${seed}|${userMsgOneLine}|${rawOneLine}`);

  // ✅ If insight already asks a question, Phase 3 becomes a non-question bridge line
  // to avoid two consecutive questions.
  const useStatementBridge = insightAlreadyHasQuestion(lang, input.raw ?? "");
  let bridges: readonly string[];

  const isReturn = isReturnOnly(userMsg);

  const greeting = isGreetingOnly(userMsg);

  // --- Return mode: user came back; keep it "what now?" and stop extra probing ---
  if (isReturn) {
    bridges = [
      "What do you want to do right now?",
      "What should we pick up first?",
      "What’s the first thing you want from me right now?",
    ] as const;
  } else {
    // --- Greeting mode: make "hi" feel human ---

    if (greeting) {
      bridges = greetingBridgeBank(lang, tone);
    } else if (input.intent === "practical") {
      bridges = practicalBridgeBank(lang, tone);
    } else if (userAsksForSuggestion(userMsg)) {
      bridges = suggestionBridgeBank(lang);
    } else {
      bridges = useStatementBridge
        ? statementBridgeBankWithSoftMix(lang, tone, userMsg)
        : bridgeBank(lang, tone);
    }
  }

  const external = (input.externalBridge ?? "").trim();

  // deterministic base pick
  let bIdx = h % bridges.length;

  // ✅ No immediate repeat: if previous assistant ended with the same bridge, rotate once.
  // Works only when caller provides prevAssistantText; otherwise behaves like before.
  if (!external && bridges.length > 1) {
    const prev = (input.prevAssistantText ?? "").trim();
    const candidate = bridges[bIdx];

    if (prev && prev.endsWith(candidate)) {
      bIdx = (bIdx + 1) % bridges.length;
    }
  }

  const bridgeRaw = external || bridges[bIdx];

  let insight = greeting
    ? greetingInsightBank(lang, tone)[
    h % greetingInsightBank(lang, tone).length
    ]
    : stripRoboticMarkers(input.raw);

  // If the model already produced a natural conversational reply,
  // let it pass through for emotional / conversational turns.
  // Keep formatter structure for greeting / return / practical flows,
  // where deterministic shaping is still useful.
  const rawSentenceCount = (insight.match(/[.!?؟؟।۔]/g) ?? []).length;

  const modelReplyLooksComplete =
    insight &&
    insight.length > 15 &&
    /[.!?؟؟।۔]$/.test(insight.trim());

  const modelReplyLooksNaturallyConversational =
    insight &&
    insight.length > 24 &&
    rawSentenceCount >= 2;

  const userSoundsWarmOrNostalgic =
    /\b(smiling|smile|remembering|memories|memory|old days|good days|miss those days|nostalgic|grateful|warm|happy)\b/i.test(
      userMsg,
    ) ||
    /\b(mon[e]? pore|mone pore|valo lagche|bhalo lagche|purono diner kotha|yaad aa rahi|yaad aa raha|purane din|accha lag raha|acha lag raha)\b/i.test(
      userMsg,
    );

  const shouldPreferNaturalModelReply =
    (modelReplyLooksComplete ||
      modelReplyLooksNaturallyConversational ||
      (userSoundsWarmOrNostalgic && insight && insight.trim().length >= 10)) &&
    !greeting &&
    !isReturn &&
    input.intent !== "practical" &&
    !userAsksForSuggestion(userMsg);

  if (shouldPreferNaturalModelReply) {
    return insight.trim();
  }

  insight = removeLeadingInterjection(insight);

  // If the model returned nothing meaningful, keep it empty (caller already has fallback logic)
  if (!insight) return "";

  // Ensure clean formatting
  // Phase 1: reaction
  // Phase 2: insight/value (already generated by model)
  // Phase 3: optional bridge (skip in suggestion mode to avoid "template stacking")

  const isSuggestionMode =
    input.intent !== "practical" && userAsksForSuggestion(userMsg);

  // --- Hard guarantees (the "architecture gate") ---
  // 1) Always 3 phases (reaction + insight + bridge)
  // 2) At least 3 sentences total (min 3 sentence-ending punctuations)
  // 3) Max 1 question across the whole message

  const endPunct =
    lang === "ur"
      ? "۔"
      : ["hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa"].includes(lang)
        ? "।"
        : ".";

  const sentenceEndRe = /[.!?؟？।۔]/g;
  const questionRe = /[?؟？]/g;

  const ensureEndsLikeSentence = (s: string): string => {
    const t = (s ?? "").trim();
    if (!t) return "";
    if (/[.!?…؟？।۔]$/.test(t)) return t;
    return `${t}${endPunct}`;
  };

  const limitToOneQuestion = (s: string): string => {
    let seen = 0;
    return (s ?? "").replace(questionRe, (m) => {
      seen += 1;
      return seen <= 1 ? m : endPunct;
    });
  };

  // --- NEW: use model-written "bridge-like" closing sentence when available ---
  // Goal: keep 3 phases but avoid repetitive template bridges when the model already
  // ends with a natural engagement / next-step sentence.
  const splitIntoSentences = (s: string): string[] => {
    const t = (s ?? "").trim();
    if (!t) return [];
    // Split on common sentence endings (including Indic/Urdu punctuations).
    // Keep it simple and robust; we re-add punctuation via ensureEndsLikeSentence.
    return t
      .split(/[.!?؟？।۔]+/g)
      .map((x) => x.trim())
      .filter(Boolean);
  };

  // ✅ Phase 1 (Reaction) — restore missing variable (required for output assembly)
  // Deterministic pick using the same hash "h" so replies are stable for QA.
  const reactions = reactionBank(lang, tone);
  const reaction = reactions[h % reactions.length] ?? reactions[0] ?? "";
  const phase1 = ensureEndsLikeSentence(reaction);

  // ✅ Closure mode: no Phase 3, no forced reaction, keep it short and natural.
  if (input.disableBridge) {
    // Use the already-prepared insight (greeting-safe, robotic markers stripped above).
    let phase2Raw = String(insight ?? "").trim();

    // Remove any questions entirely in closure mode.
    phase2Raw = phase2Raw.replace(questionRe, endPunct);

    // Keep it short: at most 2 sentences for the insight.
    const sents = splitIntoSentences(phase2Raw);
    const shortInsight =
      sents.length > 0 ? sents.slice(0, 2).join(`${endPunct} `) : phase2Raw;

    const phase2 = ensureEndsLikeSentence(shortInsight);

    return phase2.trim();
  }

  const looksLikeBridgeLine = (s: string): boolean => {
    const t = (s ?? "").trim().toLowerCase();
    if (!t) return false;

    // Engagement / continuation cues (English-heavy; safe fallbacks for other langs)
    // We only use this as a "prefer model tail" hint, not as a hard requirement.
    const cues = [
      "do you want",
      "would you like",
      "can we",
      "we can",
      "let’s",
      "let's",
      "tell me",
      "share",
      "what feels",
      "what would help",
      "want most",
      "next step",
      "right now",
      "with you",
      "i’m with you",
      "i am with you",
      "if you want",
      "whenever you’re ready",
      "whenever you're ready",
    ];

    // If it’s short but clearly an invitation, still count it
    const hasCue = cues.some((c) => t.includes(c));

    // Also treat a trailing question-like sentence as a bridge candidate
    // (even without cue words), because it naturally hands the convo back.
    const hasQuestionToken = /[?؟？]/.test(s);

    // Avoid treating pure lists as bridge
    const looksListy =
      t.includes("•") ||
      t.includes("- ") ||
      (t.includes(",") && t.split(",").length >= 4);

    return (hasCue || hasQuestionToken) && !looksListy;
  };

  // --- NEW: anchor phrase suppression (anti-template) ---
  // If the model already used an empathy anchor, avoid repeating it via our fallback banks.
  // This is intentionally English-focused; other languages keep existing phrasing.
  const containsEmpathyAnchor = (s: string): boolean => {
    const t = String(s ?? "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[’]/g, "'") // normalize curly apostrophe
      .trim();

    if (!t) return false;

    // Keep this list short + high-signal to avoid false positives.
    const anchors = [
      "i'm with you",
      "im with you",
      "i'm right here with you",
      "im right here with you",
      "i'm with you in this",
      "im with you in this",
      "i hear you",
      "got you",
    ];

    return anchors.some((a) => t.includes(a));
  };

  const pickStatementAvoidingAnchor = (
    bank: readonly string[],
    startIndex: number,
    context: string,
  ): string => {
    if (!Array.isArray(bank) || bank.length === 0) return "";

    const ctxHasAnchor = containsEmpathyAnchor(context);

    // If context has no anchor, return the default deterministic pick.
    if (!ctxHasAnchor) return bank[startIndex % bank.length] ?? "";

    // Otherwise, try a few alternatives that *don’t* include the anchor phrase.
    for (let k = 0; k < Math.min(6, bank.length); k++) {
      const candidate = bank[(startIndex + k) % bank.length] ?? "";
      if (!containsEmpathyAnchor(candidate)) return candidate;
    }

    // Worst case: return original (never fail hard)
    return bank[startIndex % bank.length] ?? "";
  };

  let phase2Raw = (insight ?? "").trim();
  // Remove duplicate sentences inside Phase 2
  {
    const sents = splitIntoSentences(phase2Raw);

    if (sents.length > 1) {
      const seen = new Set<string>();
      const uniq = sents.filter((s) => {
        const key = s.trim().toLowerCase();
        if (!key) return false;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (uniq.length !== sents.length) {
        phase2Raw = uniq.join(" ");
      }
    }
  }
  let phase3 = ensureEndsLikeSentence(bridgeRaw);
  const sentences = splitIntoSentences(phase2Raw);
  if (sentences.length >= 2) {
    const tail = sentences[sentences.length - 1].trim();
    const head = sentences.slice(0, -1).join(`${endPunct} `).trim();

    // Only steal the model tail if:
    // - it looks like a bridge/hand-off
    // - AND we still have meaningful insight left in Phase 2 after removing it
    if (looksLikeBridgeLine(tail) && head.length >= 12) {
      phase2Raw = head;
      phase3 = ensureEndsLikeSentence(tail);
    }
  }

  // ✅ De-dupe repeated sentences inside Phase 2
  // (common when the model repeats "আমি বুঝতে পারছি…" 2–3 times)
  {
    const normSent = (s: string): string =>
      String(s ?? "")
        .replace(/\.\.\./g, "…")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
        .replace(/[\s\.!?؟？""…]+$/g, "");

    const sents = splitIntoSentences(phase2Raw);
    if (sents.length >= 2) {
      const seen = new Set<string>();
      const uniq = sents.filter((s) => {
        const k = normSent(s);
        if (!k) return false;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      if (uniq.length > 0 && uniq.length !== sents.length) {
        phase2Raw = uniq.join(`${endPunct} `).trim();
      }
    }
  }

  const phase2 = ensureEndsLikeSentence(phase2Raw);

  // If we're in suggestion mode and the insight already contains a question,
  // keep the suggestions but turn the extra question(s) into statements.
  if (isSuggestionMode && insightAlreadyHasQuestion(lang, phase2Raw)) {
    phase3 = limitToOneQuestion(phase3);
    // If insight already had the 1 allowed question, we must remove all questions from phase3.
    if ((phase2Raw.match(questionRe) ?? []).length > 0) {
      phase3 = (phase3 ?? "").replace(questionRe, endPunct);
    }
  }

  // ✅ Dedupe: if Phase 2 already ends with the same bridge line, don't append it again.
  const normForDedupe = (s: string): string =>
    String(s ?? "")
      .replace(/\.\.\./g, "…")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      // ignore trailing punctuation differences
      .replace(/[\s\.!?؟؟…]+$/g, "");

  const phase3Norm = normForDedupe(phase3);
  const lastPhase2SentenceNorm = normForDedupe(
    splitIntoSentences(phase2Raw).slice(-1)[0] ?? "",
  );

  const includePhase3 =
    phase3Norm.length > 0 && lastPhase2SentenceNorm !== phase3Norm;

  let out = includePhase3
    ? `${phase1} ${phase2}\n\n${phase3}`.trim()
    : `${phase1} ${phase2}`.trim();

  // ✅ De-dupe: collapse consecutive duplicate lines (works for model repeats + bridge repeats)
  const normLine = (s: string): string =>
    String(s ?? "")
      .replace(/\.\.\./g, "…")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .replace(/[\s\.!?؟؟…]+$/g, "");

  out = out
    .split("\n")
    .reduce<string[]>((acc, line) => {
      const cur = line ?? "";
      if (acc.length === 0) return [cur];

      const prev = acc[acc.length - 1] ?? "";
      if (normLine(prev) === normLine(cur) && normLine(cur).length > 0) {
        return acc; // skip duplicate
      }
      return [...acc, cur];
    }, [])
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Global clamp: max 1 question mark in the final output.
  // NOTE: We now soften the contract for low-signal turns (so it feels less template-y),
  // while preserving the greeting-only special behavior you already added.
  out = limitToOneQuestion(out);

  const isShortConversationalQuestion = (() => {
    const rawUser = String(userMsg ?? "").trim();
    if (!rawUser) return false;

    const words = rawUser.match(/[\p{L}\p{N}]+/gu) ?? [];
    const hasQuestionMark = /[?？؟]/.test(rawUser);

    return (
      !greeting &&
      input.intent !== "practical" &&
      !isSuggestionMode &&
      hasQuestionMark &&
      words.length > 0 &&
      words.length <= 8
    );
  })();

  // Soft contract: keep 3-phase as a guideline, allow natural variation for low-signal turns.
  // Excludes practical + suggestion flows where structure is more useful.
  // Also exclude short conversational questions, so the formatter does not
  // overwrite a natural model answer with emotional fallback phrasing.
  const softContract =
    !isShortConversationalQuestion &&
    !greeting &&
    input.intent !== "practical" &&
    !isSuggestionMode &&
    isLowSignalUserTurn(userMsg);

  const sentenceCount = (out.match(sentenceEndRe) ?? []).length;

  if (isShortConversationalQuestion) {
    return out.trim();
  }

  if (greeting) {
    // Greeting mode: sometimes end with presence only (no question).
    const shouldEndWithPresenceOnly = h % 2 === 0;

    if (shouldEndWithPresenceOnly) {
      out = `${phase1} ${phase2}`.trim();
      out = limitToOneQuestion(out);
    }

    // If still too short (rare), add a greeting-safe presence statement.
    const sc2 = (out.match(sentenceEndRe) ?? []).length;
    if (sc2 < 2) {
      const safePresence = (() => {
        const context = `${phase1} ${phase2}`.trim();
        if (tone === "coach") return "We can keep it simple and soft.";
        if (tone === "calm_companion") return "We can take it gently.";

        // Avoid repeating an anchor if model already used it.
        return containsEmpathyAnchor(context)
          ? "No rush. One small step at a time."
          : "I’m right here with you.";
      })();
      out = `${out}\n${ensureEndsLikeSentence(safePresence)}`.trim();
      out = limitToOneQuestion(out);
    }

    return out;
  }

  // For low-signal turns, prefer reflection + presence, but STILL keep 3 phases.
  // Keep determinism/variety, but only among valid 3-phase outputs.
  if (softContract) {
    const userAskedQ = /[?？]/.test(userMsg);

    // Phase 2: soften any questions into statements for low-signal turns
    const phase2Presence = ensureEndsLikeSentence(
      String(phase2).replace(questionRe, endPunct).replace(/\s+/g, " ").trim()
    );

    const bank = statementBridgeBankWithSoftMix(lang, tone, userMsg);

    // Deterministic (stable for testing), but no 2-phase outputs.
    // 0-5: presence + 1 bridge statement
    // 6-8: presence + 2 bridge statements (more "friend chatter")
    // 9: normal 3-phase (phase3 as-is)
    const roll = Math.abs(hash32(`soft:${lang}:${tone}:${seed}:${userMsg}`)) % 10;

    if (roll === 9) {
      out = `${phase1} ${phase2}\n\n${phase3}`.trim();
    } else {
      const s1 = pickStatementAvoidingAnchor(
        bank,
        (h + 3) % bank.length,
        `${phase1} ${phase2Presence} ${insight}`.trim()
      );

      out = `${phase1} ${phase2Presence}\n\n${ensureEndsLikeSentence(s1)}`.trim();

      if (roll >= 6) {
        const s2 = pickStatementAvoidingAnchor(
          bank,
          (h + 7) % bank.length,
          out
        );
        out = `${out}\n${ensureEndsLikeSentence(s2)}`.trim();
      }
    }

    // If the user didn't ask a question, we should not introduce one here.
    if (!userAskedQ) {
      out = out.replace(questionRe, endPunct);
    }

    // Global clamp: max 1 question
    out = limitToOneQuestion(out);

    // Hard requirement: ensure minimum 3 sentences
    const sc = (out.match(sentenceEndRe) ?? []).length;
    if (sc < 3) {
      const extra = pickStatementAvoidingAnchor(
        bank,
        (h + 11) % bank.length,
        out
      );
      out = `${out}\n${ensureEndsLikeSentence(extra)}`.trim();
      out = limitToOneQuestion(out);
    }

    return out;
  }

  // Default (strict-ish): keep minimum 3 sentences
  if (sentenceCount < 3) {
    const bank3 = statementBridgeBankWithSoftMix(lang, tone, userMsg);
    const extra = pickStatementAvoidingAnchor(
      bank3,
      (h + 7) % bank3.length,
      out,
    );
    out = `${out}\n${ensureEndsLikeSentence(extra)}`;
    out = limitToOneQuestion(out);
  }

  return out;
}
