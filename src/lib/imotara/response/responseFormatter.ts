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

  // ✅ Coach: still soft + permission-based, but more directional + “we” tone
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
  } as const;

  // ✅ Mentor: softer clarity + gentle framing (not “coach-y”)
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
  } as const;

  const bank =
    tone === "calm_companion"
      ? calmCompanion
      : tone === "coach"
        ? coach
        : tone === "mentor"
          ? mentor
          : closeFriend;

  // fall back to English if lang not present in the bank
  const key = normalizeLang(lang) as "en" | "hi";
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

function isLowSignalUserTurn(msg: string): boolean {
  const raw = String(msg ?? "").trim();
  if (!raw) return true;

  const t = raw.toLowerCase();

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

function greetingInsightBank(
  lang: string,
  tone: ImotaraPersonaTone,
): readonly string[] {
  const closeFriend = {
    en: [
      "Hi 🙂 I’m here with you.",
      "Hey 👋 I’m right here.",
      "Hi. I’m with you — no rush.",
    ],
    hi: [
      "हाय 🙂 मैं तुम्हारे साथ हूँ।",
      "हेy 👋 मैं यहीं हूँ।",
      "हाय। मैं तुम्हारे साथ हूँ — कोई जल्दी नहीं।",
    ],
  } as const;

  const coach = {
    en: [
      "Hey 👋 I’m here with you — gently, at your pace.",
      "Hi. I’m with you. We can take this one small step at a time.",
      "Hey 🙂 I’m right here — we’ll keep it simple and soft.",
    ],
    hi: [
      "हेy 👋 मैं तुम्हारे साथ हूँ — धीरे-धीरे, तुम्हारी गति से।",
      "हाय। मैं तुम्हारे साथ हूँ। हम इसे छोटे-छोटे कदमों में ले सकते हैं।",
      "हेy 🙂 मैं यहीं हूँ — इसे सरल और नरम रखेंगे।",
    ],
  } as const;

  const calm = {
    en: [
      "Hello. I’m here with you.",
      "Hi. We can stay gentle and take it slowly.",
      "Hello 🙂 I’m with you — calm and steady.",
    ],
    hi: [
      "नमस्ते। मैं तुम्हारे साथ हूँ।",
      "हाय। हम इसे धीरे-धीरे और सहजता से ले सकते हैं।",
      "नमस्ते 🙂 मैं तुम्हारे साथ हूँ — शांत और स्थिर।",
    ],
  } as const;

  const bank =
    tone === "coach" ? coach : tone === "calm_companion" ? calm : closeFriend;

  const key = normalizeLang(lang) as "en" | "hi";
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
  } as const;

  const coach = {
    en: [
      "Want us to gently pick one small thing to focus on?",
      "Would it help to choose one tiny next step together?",
      "Where would you like us to begin — softly and simply?",
    ],
    hi: [
      "क्या हम धीरे-से एक छोटी-सी चीज़ चुनें जिस पर ध्यान दें?",
      "क्या एक tiny next step साथ में तय करना मदद करेगा?",
      "तुम चाहो तो हम कहाँ से शुरू करें — नरमी से, सरलता से?",
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
  } as const;

  const bank =
    tone === "coach" ? coach : tone === "calm_companion" ? calm : closeFriend;

  const key = normalizeLang(lang) as "en" | "hi";
  return (bank as any)[key] ?? bank.en;
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

  // --- Greeting mode: make “hi” feel human ---
  const greeting = isGreetingOnly(userMsg);

  if (greeting) {
    // Phase 2 becomes a friendly presence line, Phase 3 becomes the only question
    bridges = greetingBridgeBank(lang, tone);
  } else if (input.intent === "practical") {
    bridges = practicalBridgeBank(lang, tone);
  } else if (userAsksForSuggestion(userMsg)) {
    bridges = suggestionBridgeBank(lang);
  } else {
    bridges = useStatementBridge
      ? bridgeStatementBank(lang, tone)
      : bridgeBank(lang, tone);
  }

  const bridge = bridges[h % bridges.length];

  let insight = greeting
    ? greetingInsightBank(lang, tone)[
        h % greetingInsightBank(lang, tone).length
      ]
    : stripRoboticMarkers(input.raw);

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

  // Build the three parts explicitly.
  const phase1 = ensureEndsLikeSentence(reaction);

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

  let phase2Raw = (insight ?? "").trim();
  let phase3 = ensureEndsLikeSentence(bridge);

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

  let out = `${phase1} ${phase2}\n\n${phase3}`.trim();

  // Global clamp: max 1 question mark in the final output.
  // NOTE: We now soften the contract for low-signal turns (so it feels less template-y),
  // while preserving the greeting-only special behavior you already added.
  out = limitToOneQuestion(out);

  // Soft contract: keep 3-phase as a guideline, allow natural variation for low-signal turns.
  // Excludes practical + suggestion flows where structure is more useful.
  const softContract =
    !greeting &&
    input.intent !== "practical" &&
    !isSuggestionMode &&
    isLowSignalUserTurn(userMsg);

  const sentenceCount = (out.match(sentenceEndRe) ?? []).length;

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
      const safePresence =
        tone === "coach"
          ? "We can keep it simple and soft."
          : tone === "calm_companion"
            ? "We can take it gently."
            : "I’m right here with you.";
      out = `${out}\n${ensureEndsLikeSentence(safePresence)}`.trim();
      out = limitToOneQuestion(out);
    }

    return out;
  }

  // For low-signal turns, prefer reflection + presence and usually avoid questions.
  if (softContract) {
    const userAskedQ = /[?？]/.test(userMsg);

    // If Phase 2 contains a question (common), soften it into a statement for low-signal turns.
    const phase2Presence = ensureEndsLikeSentence(
      String(phase2).replace(questionRe, endPunct).replace(/\s+/g, " ").trim(),
    );

    // Bias: ~60% presence-only, ~30% presence+handoff statement, ~10% normal 3-phase.
    // Deterministic (stable for testing).
    const roll =
      Math.abs(hash32(`soft:${lang}:${tone}:${seed}:${userMsg}`)) % 10;

    if (roll < 6) {
      // Presence-only (2 phases)
      out = `${phase1} ${phase2Presence}`.trim();
    } else if (roll < 9) {
      // Presence + gentle statement handoff (no question)
      const extraStatement = bridgeStatementBank(lang, tone)[
        (h + 3) % bridgeStatementBank(lang, tone).length
      ];
      out = `${phase1} ${phase2Presence}\n\n${ensureEndsLikeSentence(
        extraStatement,
      )}`.trim();
    } else {
      // Normal 3-phase (rare)
      out = `${phase1} ${phase2}\n\n${phase3}`.trim();
    }

    // If the user didn't ask a question, we usually shouldn't ask one here.
    if (!userAskedQ) {
      out = out.replace(questionRe, endPunct);
    }

    out = limitToOneQuestion(out);

    // Ensure minimum 2 sentences (don’t force 3)
    const sc = (out.match(sentenceEndRe) ?? []).length;
    if (sc < 2) {
      const extra = bridgeStatementBank(lang, tone)[
        (h + 7) % bridgeStatementBank(lang, tone).length
      ];
      out = `${out}\n${ensureEndsLikeSentence(extra)}`.trim();
      out = limitToOneQuestion(out);
    }

    return out;
  }

  // Default (strict-ish): keep minimum 3 sentences
  if (sentenceCount < 3) {
    const extra = bridgeStatementBank(lang, tone)[
      (h + 7) % bridgeStatementBank(lang, tone).length
    ];
    out = `${out}\n${ensureEndsLikeSentence(extra)}`;
    out = limitToOneQuestion(out);
  }

  return out;
}
