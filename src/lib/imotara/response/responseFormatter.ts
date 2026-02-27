// src/lib/imotara/response/responseFormatter.ts
//
// Core, reusable formatter that forces every reply into the
// "Three-Part Humanized Communication" framework.
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
  | "mentor";

export type FormatReplyInput = {
  // model-generated reply text (unformatted)
  raw: string;

  // raw user message (needed for continuity + suggestion requests)
  userMessage?: string;

  lang?: string;
  tone?: ImotaraPersonaTone;
  seed?: string;
  intent?: "emotional" | "practical";
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
  const l = (lang ?? "en").toLowerCase().trim();
  // accept common variants like en-IN, hi-IN etc.
  return l.split("-")[0] || "en";
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
  return s
    .replace(
      /^(wow|oh|hmm|huh|really|hey|okay|ok|ah|aww|whoa|mm)\b[!,. ]+/i,
      "",
    )
    .trim();
}

function reactionBank(lang: string): string[] {
  switch (lang) {
    case "hi":
      return ["अरे…", "ओह!", "हम्म…", "सच?", "अच्छा…", "वाह!"];
    case "bn":
      return ["আরে…", "ওহ!", "হুঁ…", "সত্যি?", "বাহ!", "আচ্ছা…"];
    case "ta":
      return ["அடே…", "ஓஹ்!", "ஹ்ம்…", "உண்மையா?", "வாவ்!", "சரி…"];
    case "te":
      return ["అరే…", "ఓహ్!", "హ్మ్…", "నిజమా?", "వావ్!", "సరే…"];
    case "mr":
      return ["अरे…", "ओह!", "हम्म…", "खरंच?", "वा!", "बरं…"];
    case "gu":
      return ["અરે…", "ઓહ!", "હમ્મ…", "સાચે?", "વાહ!", "બરાબર…"];
    case "kn":
      return ["ಅಯ್ಯೋ…", "ಓಹ್!", "ಹ್ಮ್…", "ನಿಜವಾ?", "ವಾವ್!", "ಸರಿ…"];
    case "ml":
      return ["അയ്യോ…", "ഓ!", "ഹ്മ്…", "ശരിക്കോ?", "വാവ്!", "ശരി…"];
    case "pa":
      return ["ਅਰੇ…", "ਓਹ!", "ਹੰਮ…", "ਸੱਚ?", "ਵਾਹ!", "ਠੀਕ ਹੈ…"];
    case "ur":
      return ["ارے…", "اوہ!", "ہمم…", "سچ؟", "واہ!", "اچھا…"];
    default:
      return ["Oh, I see…", "Hmm…", "Whoa.", "Aww…", "Oh!", "Okay…"];
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
  } as const;

  const calmCompanion = {
    en: [
      "Do you want to stay with this feeling for a moment, or gently take one small step?",
      "What would feel most supportive right now—clarity, comfort, or a next step?",
      "Where do you want to begin from here?",
    ],
    hi: [
      "क्या तुम इस भावना के साथ थोड़ी देर रहना चाहोगे, या धीरे-से एक छोटा कदम लें?",
      "अभी तुम्हारे लिए सबसे मददगार क्या होगा—clarity, comfort, या next step?",
      "यहाँ से तुम कहाँ से शुरू करना चाहोगे?",
    ],
  } as const;

  const bank = tone === "calm_companion" ? calmCompanion : closeFriend;

  // fall back to English if lang not present in the bank
  const key = normalizeLang(lang) as "en" | "hi";
  return bank[key] ?? bank.en;
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
      "I’m right here with you — we’ll keep it simple.",
      "No rush. One small move at a time.",
      "We can handle this gently, together.",
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
  } as const;

  const calmCompanion = {
    en: [
      "We can go gently. I’m here with you.",
      "Let’s keep this soft and simple.",
      "We’ll take one calm step at a time.",
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
  } as const;

  const bank = tone === "calm_companion" ? calmCompanion : closeFriend;
  const key = normalizeLang(lang) as keyof typeof closeFriend;
  return (bank as any)[key] ?? bank.en;
}

function practicalBridgeBank(
  lang: string,
  tone: ImotaraPersonaTone,
): readonly string[] {
  const closeFriend = {
    en: [
      "What’s the next tiny step—should we start with the file name or the exact error log?",
      "Tell me what you want to achieve in one line, and we’ll pick the smallest next action.",
      "Share the current output + expected output, and I’ll guide the next step.",
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
  } as const;

  const calmCompanion = {
    en: [
      "Let’s do this gently: what’s the one concrete thing you want done next?",
      "What’s your smallest acceptable outcome for the next 10 minutes?",
      "Share the file path + the failing line, and we’ll fix it step by step.",
    ],
    hi: [
      "धीरे-धीरे करेंगे: अभी अगला एक concrete काम क्या करना है?",
      "अगले 10 मिनट के लिए आपका smallest acceptable outcome क्या है?",
      "File path और failing line भेजो—फिर step by step ठीक करते हैं।",
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

function userMentionsHunger(s: string): boolean {
  const t = (s ?? "").toLowerCase();
  return /\b(hungry|hunger|bhook|bhookh|khana|khabo|khabo|khabar)\b/.test(t);
}

function suggestionBridgeBank(lang: string): readonly string[] {
  const l = normalizeLang(lang);

  // Keep these as "helpful suggestions + 1 tiny clarifying question" (human flow)
  if (l === "hi") {
    return [
      "अगर जल्दी है: केला/फल + दही, या ब्रेड/अंडा। अगर भरपेट चाहिए: दाल-चावल/रोटी-सब्ज़ी। आप veg हो या non-veg, और घर में क्या available है?",
      "हल्का चाहिए तो फल/दही; भरपेट चाहिए तो दाल-चावल/पराठा/अंडा। अभी तुम घर पर हो या बाहर?",
    ] as const;
  }

  if (l === "bn") {
    return [
      "দ্রুত হলে: ফল/কলা + দই, বা ব্রেড/ডিম। পেটভরে চাইলে: ডাল-ভাত/রুটি-সবজি। আপনি veg না non-veg, আর বাসায় কী আছে?",
      "হালকা হলে ফল/দই; ভরপেট হলে ডাল-ভাত/রুটি-সবজি/ডিম। আপনি এখন বাসায় নাকি বাইরে?",
    ] as const;
  }

  // default EN
  return [
    "If you want something quick: fruit/banana + curd, or bread + eggs. If you want filling: rice+dal or roti+sabzi. Are you veg or non-veg, and what do you have at home?",
    "Light option: fruit/curd/tea. Filling option: rice+dal/roti+eggs. Are you at home or ordering?",
  ] as const;
}

export function formatImotaraReply(input: FormatReplyInput): string {
  const lang = normalizeLang(input.lang);
  const tone: ImotaraPersonaTone = input.tone ?? "close_friend";

  const seed = (input.seed ?? "").trim() || "imotara";
  const h = hash32(`${lang}|${tone}|${seed}`);
  const reactions = reactionBank(lang);

  const reaction = reactions[h % reactions.length];

  // ✅ If insight already asks a question, Phase 3 becomes a non-question bridge line
  // to avoid two consecutive questions.
  const useStatementBridge = insightAlreadyHasQuestion(
    lang,
    stripRoboticMarkers(input.raw),
  );
  let bridges: readonly string[];

  console.log("[imotara] intent detected =", input.intent);

  const userMsg = input.userMessage ?? "";

  console.log("[imotara] formatter userMsg =", userMsg);

  if (input.intent === "practical") {
    // Practical intent → action-oriented bridge (still human, but not comfort-framing)
    bridges = practicalBridgeBank(lang, tone);
  } else if (userAsksForSuggestion(userMsg) || userMentionsHunger(userMsg)) {
    // Emotional intent + explicit request for suggestion (or hunger) → give concrete suggestions
    bridges = suggestionBridgeBank(lang);
  } else {
    bridges = useStatementBridge
      ? bridgeStatementBank(lang, tone)
      : bridgeBank(lang, tone);
  }

  const bridge = bridges[h % bridges.length];

  let insight = stripRoboticMarkers(input.raw);
  insight = removeLeadingInterjection(insight);

  // If the model returned nothing meaningful, keep it empty (caller already has fallback logic)
  if (!insight) return "";

  // Ensure clean formatting
  // Phase 1: reaction
  // Phase 2: insight/value (already generated by model)
  // Phase 3: optional bridge (skip in suggestion mode to avoid "template stacking")

  const isSuggestionMode =
    input.intent !== "practical" &&
    (userAsksForSuggestion(userMsg) || userMentionsHunger(userMsg));

  console.log("[imotara] isSuggestionMode =", isSuggestionMode);

  if (isSuggestionMode) {
    // Insight already contains the helpful suggestion + usually a clarifying question.
    // Adding another bridge makes the conversation feel robotic/looping.
    return `${reaction} ${insight}`.trim();
  }

  return `${reaction} ${insight}\n\n${bridge}`.trim();
}
