// src/lib/imotara/voiceFirstStrings.ts
// #185 "Voice first" (owner, 28 Nov 2026): the message box opens in VOICE mode — a big
// "Tap to talk" mic, a "Type instead" switch and a speaker on/off — and the person can
// switch to typing at any time. Their choice is remembered.
//
// ⛔ Nothing records until they TAP (the browser asks for the microphone only then).
// ⛔ Replies are read aloud only in voice mode, and the speaker switch turns that off.
// ⛔ Typing stays the default where voice is weak: Punjabi and Odia (speech recognition
//    is unreliable for them — trap_whisper_api_rejects_several_indic_languages) and
//    browsers with no speech recognition at all.
// ⛔ It never touches a reply's words — only how the person sends theirs.
//
// Formality follows checkInInviteStrings (Hindi आप, Bengali আপনি, French vous …).

export type InputMode = "voice" | "type";

export type VoiceFirstStrings = {
    tap: string;        // big mic label
    listening: string;  // while the mic is open
    typeInstead: string;
    useVoice: string;   // switch back from typing
    speakerOn: string;  // replies will be read aloud
    speakerOff: string; // replies will not be read aloud
};

export const VOICE_FIRST: Record<string, VoiceFirstStrings> = {
    en: { tap: "Tap to talk", listening: "Listening… tap to stop", typeInstead: "Type instead", useVoice: "Talk instead", speakerOn: "Replies read aloud", speakerOff: "Replies not read aloud" },
    hi: { tap: "बोलने के लिए टैप करें", listening: "सुन रही हूँ… रोकने के लिए टैप करें", typeInstead: "टाइप करें", useVoice: "बोलकर बात करें", speakerOn: "जवाब सुनाए जाएँगे", speakerOff: "जवाब नहीं सुनाए जाएँगे" },
    bn: { tap: "কথা বলতে ট্যাপ করুন", listening: "শুনছি… থামাতে ট্যাপ করুন", typeInstead: "টাইপ করুন", useVoice: "কথা বলে জানান", speakerOn: "উত্তর পড়ে শোনানো হবে", speakerOff: "উত্তর পড়ে শোনানো হবে না" },
    mr: { tap: "बोलण्यासाठी टॅप करा", listening: "ऐकत आहे… थांबवण्यासाठी टॅप करा", typeInstead: "टाइप करा", useVoice: "बोलून सांगा", speakerOn: "उत्तरे वाचून दाखवली जातील", speakerOff: "उत्तरे वाचून दाखवली जाणार नाहीत" },
    ta: { tap: "பேச தட்டவும்", listening: "கேட்கிறேன்… நிறுத்த தட்டவும்", typeInstead: "தட்டச்சு செய்யவும்", useVoice: "பேசி சொல்லவும்", speakerOn: "பதில்கள் வாசித்துக் காட்டப்படும்", speakerOff: "பதில்கள் வாசிக்கப்படாது" },
    te: { tap: "మాట్లాడటానికి నొక్కండి", listening: "వింటున్నాను… ఆపడానికి నొక్కండి", typeInstead: "టైప్ చేయండి", useVoice: "మాట్లాడి చెప్పండి", speakerOn: "సమాధానాలు చదివి వినిపిస్తాయి", speakerOff: "సమాధానాలు చదివి వినిపించవు" },
    gu: { tap: "બોલવા માટે ટેપ કરો", listening: "સાંભળું છું… રોકવા માટે ટેપ કરો", typeInstead: "ટાઇપ કરો", useVoice: "બોલીને કહો", speakerOn: "જવાબ વાંચીને સંભળાવાશે", speakerOff: "જવાબ વાંચીને નહીં સંભળાવાય" },
    kn: { tap: "ಮಾತನಾಡಲು ಟ್ಯಾಪ್ ಮಾಡಿ", listening: "ಕೇಳುತ್ತಿದ್ದೇನೆ… ನಿಲ್ಲಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ", typeInstead: "ಟೈಪ್ ಮಾಡಿ", useVoice: "ಮಾತನಾಡಿ ಹೇಳಿ", speakerOn: "ಉತ್ತರಗಳನ್ನು ಓದಿ ಕೇಳಿಸಲಾಗುತ್ತದೆ", speakerOff: "ಉತ್ತರಗಳನ್ನು ಓದಿ ಕೇಳಿಸುವುದಿಲ್ಲ" },
    ml: { tap: "സംസാരിക്കാൻ ടാപ്പ് ചെയ്യുക", listening: "കേൾക്കുന്നു… നിർത്താൻ ടാപ്പ് ചെയ്യുക", typeInstead: "ടൈപ്പ് ചെയ്യുക", useVoice: "സംസാരിച്ച് പറയുക", speakerOn: "മറുപടികൾ വായിച്ചു കേൾപ്പിക്കും", speakerOff: "മറുപടികൾ വായിച്ചു കേൾപ്പിക്കില്ല" },
    pa: { tap: "ਬੋਲਣ ਲਈ ਟੈਪ ਕਰੋ", listening: "ਸੁਣ ਰਹੀ ਹਾਂ… ਰੋਕਣ ਲਈ ਟੈਪ ਕਰੋ", typeInstead: "ਟਾਈਪ ਕਰੋ", useVoice: "ਬੋਲ ਕੇ ਦੱਸੋ", speakerOn: "ਜਵਾਬ ਪੜ੍ਹ ਕੇ ਸੁਣਾਏ ਜਾਣਗੇ", speakerOff: "ਜਵਾਬ ਪੜ੍ਹ ਕੇ ਨਹੀਂ ਸੁਣਾਏ ਜਾਣਗੇ" },
    or: { tap: "କଥା କହିବାକୁ ଟ୍ୟାପ୍ କରନ୍ତୁ", listening: "ଶୁଣୁଛି… ବନ୍ଦ କରିବାକୁ ଟ୍ୟାପ୍ କରନ୍ତୁ", typeInstead: "ଟାଇପ୍ କରନ୍ତୁ", useVoice: "କଥା କହି ଜଣାନ୍ତୁ", speakerOn: "ଉତ୍ତର ପଢ଼ି ଶୁଣାଯିବ", speakerOff: "ଉତ୍ତର ପଢ଼ି ଶୁଣାଯିବ ନାହିଁ" },
    ur: { tap: "بولنے کے لیے ٹیپ کریں", listening: "سن رہی ہوں… روکنے کے لیے ٹیپ کریں", typeInstead: "ٹائپ کریں", useVoice: "بول کر بتائیں", speakerOn: "جواب پڑھ کر سنائے جائیں گے", speakerOff: "جواب پڑھ کر نہیں سنائے جائیں گے" },
    ar: { tap: "انقر للتحدث", listening: "أستمع… انقر للإيقاف", typeInstead: "اكتب بدلًا من ذلك", useVoice: "تحدّث بدلًا من ذلك", speakerOn: "ستُقرأ الردود بصوت عالٍ", speakerOff: "لن تُقرأ الردود بصوت عالٍ" },
    ru: { tap: "Нажмите, чтобы говорить", listening: "Слушаю… нажмите, чтобы остановить", typeInstead: "Напечатать", useVoice: "Сказать голосом", speakerOn: "Ответы читаются вслух", speakerOff: "Ответы не читаются вслух" },
    zh: { tap: "点击说话", listening: "正在聆听…点击停止", typeInstead: "改为打字", useVoice: "改为语音", speakerOn: "回复会朗读出来", speakerOff: "回复不会朗读" },
    ja: { tap: "タップして話す", listening: "聞いています… タップで停止", typeInstead: "入力にする", useVoice: "音声にする", speakerOn: "返事を読み上げます", speakerOff: "返事を読み上げません" },
    es: { tap: "Toca para hablar", listening: "Escuchando… toca para parar", typeInstead: "Escribir", useVoice: "Hablar", speakerOn: "Respuestas en voz alta", speakerOff: "Respuestas sin voz" },
    fr: { tap: "Touchez pour parler", listening: "J'écoute… touchez pour arrêter", typeInstead: "Écrire plutôt", useVoice: "Parler plutôt", speakerOn: "Réponses lues à voix haute", speakerOff: "Réponses non lues à voix haute" },
    de: { tap: "Tippen zum Sprechen", listening: "Ich höre zu… tippen zum Stoppen", typeInstead: "Lieber tippen", useVoice: "Lieber sprechen", speakerOn: "Antworten werden vorgelesen", speakerOff: "Antworten werden nicht vorgelesen" },
    pt: { tap: "Toque para falar", listening: "Ouvindo… toque para parar", typeInstead: "Digitar", useVoice: "Falar", speakerOn: "Respostas lidas em voz alta", speakerOff: "Respostas sem leitura em voz alta" },
    id: { tap: "Ketuk untuk bicara", listening: "Mendengarkan… ketuk untuk berhenti", typeInstead: "Ketik saja", useVoice: "Bicara saja", speakerOn: "Balasan dibacakan", speakerOff: "Balasan tidak dibacakan" },
    he: { tap: "הקישו כדי לדבר", listening: "מקשיבה… הקישו כדי לעצור", typeInstead: "להקליד במקום", useVoice: "לדבר במקום", speakerOn: "התשובות יוקראו בקול", speakerOff: "התשובות לא יוקראו בקול" },
};

export function getVoiceFirstStrings(lang?: string | null): VoiceFirstStrings {
    const base = (lang ?? "").split(/[-_]/)[0].toLowerCase();
    return VOICE_FIRST[base] ?? VOICE_FIRST.en;
}

/** Languages where typing stays the default (speech recognition unreliable). */
export const TYPE_FIRST_LANGS = new Set(["pa", "or"]);

export const INPUT_MODE_KEY = "imotara.inputMode.v1";
export const VOICE_READ_ALOUD_KEY = "imotara.voiceMode.readAloud.v1";

/**
 * The mode the message box opens in. A saved choice always wins. With none:
 * voice where it can work, typing otherwise.
 */
export function initialInputMode(args: { saved: string | null; speechSupported: boolean; lang?: string | null }): InputMode {
    if (args.saved === "voice" || args.saved === "type") return args.saved;
    const base = (args.lang ?? "").split(/[-_]/)[0].toLowerCase();
    if (!args.speechSupported || TYPE_FIRST_LANGS.has(base)) return "type";
    return "voice";
}

/** Read aloud in voice mode unless the person switched the speaker off. */
export function voiceReadAloudOn(saved: string | null): boolean {
    return saved !== "0";
}
