import {
    BN_SAD_REGEX,
    EN_LANG_HINT_REGEX,
    HI_STRESS_REGEX,
    ROMAN_BN_LANG_HINT_REGEX,
    ROMAN_HI_LANG_HINT_REGEX,
    ROMAN_TA_LANG_HINT_REGEX,
    ROMAN_TE_LANG_HINT_REGEX,
    TA_SAD_REGEX,
    TA_STRESS_REGEX,
} from "@/lib/emotion/keywordMaps";
import { detectAdultContent, buildAdultSafetyRefusal } from "@/lib/safety/adultContentGuard";

type LocalResponseTone =
    | "calm"
    | "supportive"
    | "practical"
    | "coach"
    | "gentle-humor"
    | "direct";

type LocalLanguage =
    | "en"
    | "hi"
    | "mr"
    | "bn"
    | "ta"
    | "te"
    | "gu"
    | "pa"
    | "kn"
    | "ml"
    | "or"
    | "ur"
    | "zh"
    | "es"
    | "ar"
    | "fr"
    | "pt"
    | "ru"
    | "id";

type LocalReplyBankLanguage = "en" | "hi" | "mr" | "bn" | "ta" | "te" | "gu" | "pa" | "kn" | "ml" | "or" | "ur" | "zh" | "es" | "ar" | "fr" | "pt" | "ru" | "id";

type ToneContext = {
    companion?: {
        name?: string;
        relationship?: string;
        tone?: LocalResponseTone;
        gender?: string;   // "female" | "male" | "nonbinary" | "prefer_not" | "other"
        ageRange?: string; // "under_13" | "13_17" | ... | "65_plus" | "prefer_not"
    };
    userName?: string;  // user's display name for occasional personal address
    userAge?: string;   // e.g. "under_13", "13_17", "65_plus"
    userGender?: string; // "female" | "male" | "nonbinary" | "prefer_not" | "other"
    sessionTurn?: number;            // #9: per-turn seed offset for variety
    preferredResponseStyle?: string; // #16: "comfort"|"reflect"|"motivate"|"advise"
};

type LocalRecentContext = {
    recentUserTexts?: string[];
    recentAssistantTexts?: string[]; // #7: for follow-up reference
    lastDetectedLanguage?: string;   // #12: language smoothing hint
    emotionMemory?: string;          // #2: compact emotion history summary for empathy calibration
};

export type LocalReplyResult = {
    message: string;
    reflectionSeed?: {
        intent: "reflect" | "clarify" | "reframe";
        title?: string;
        prompt: string;
    };
};

function hash32(input: string): number {
    // FNV-1a 32-bit
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = (h * 0x01000193) >>> 0;
    }
    return h >>> 0;
}

function pick<T>(arr: T[], seed: number) {
    return arr[seed % arr.length];
}

function dedupeAdjacentSentences(text: string): string {
    const parts = text
        .split(/(?<=[.!?।])\s+/)
        .map((part) => part.trim())
        .filter(Boolean);

    const deduped: string[] = [];
    for (const part of parts) {
        const normalized = part.toLowerCase();
        const prev = deduped[deduped.length - 1]?.toLowerCase();
        if (normalized !== prev) {
            deduped.push(part);
        }
    }

    return deduped.join(" ").trim();
}

function toReplyBankLanguage(language: LocalLanguage): LocalReplyBankLanguage {
    return language; // All 19 languages now have dedicated template banks
}

function countMatches(text: string, regex: RegExp): number {
    const matches = text.match(regex);
    return matches ? matches.length : 0;
}

function buildRecentSignature(recentContext?: LocalRecentContext): string {
    const recent = (recentContext?.recentUserTexts ?? [])
        .map((t) => String(t || "").trim().toLowerCase())
        .filter(Boolean)
        .slice(-2);

    return recent.join(" || ");
}

function hasRecentEmotionalSignal(recentContext?: LocalRecentContext): boolean {
    const recent = (recentContext?.recentUserTexts ?? [])
        .map((t) => String(t || "").trim())
        .filter(Boolean)
        .slice(-3);

    if (recent.length === 0) return false;

    return recent.some((text) => {
        const lang = detectLanguage(text, recentContext);
        return detectSignal(text, lang) !== "okay";
    });
}

function detectLanguage(text: string, recentContext?: LocalRecentContext): LocalLanguage {
    const raw = text || "";
    const t = raw.toLowerCase();

    if (/[\u0980-\u09ff]/.test(raw)) return "bn";
    // #11: Marathi uses Devanagari — check for Marathi-unique romanized keywords first
    const mrScore = countMatches(t, /\b(mala|majhya|aahe|naahi|karu|kasa|kiti|aaj|khup|baru|nahi ka|kay karu|kay zala|kaay zhala|ho ka|ahes ka|baru nahi|majha|mazha|tuzha|tyacha|ticha|aahet|nasto|naste|aamhi|apan|bara|thaklo|dukh zala|mann jad)\b/g);
    if (mrScore >= 2) return "mr";
    if (/[\u0900-\u097f]/.test(raw)) return "hi";
    if (/[\u0B80-\u0BFF]/.test(raw)) return "ta";
    if (/[\u0C00-\u0C7F]/.test(raw)) return "te";
    if (/[\u0A80-\u0AFF]/.test(raw)) return "gu";
    if (/[\u0A00-\u0A7F]/.test(raw)) return "pa";
    if (/[\u0C80-\u0CFF]/.test(raw)) return "kn";
    if (/[\u0D00-\u0D7F]/.test(raw)) return "ml";
    if (/[\u0B00-\u0B7F]/.test(raw)) return "or";
    // Urdu-specific chars (ں پ چ ڈ ٹ گ ک ے ۓ) before generic Arabic block to avoid misclassification
    if (/[\u067E\u0686\u0688\u0691\u0679\u06AF\u06A9\u06BA\u06D2\u06D3]/.test(raw)) return "ur";
    if (/[\u0600-\u06FF]/.test(raw)) return "ar";            // Arabic script
    if (/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/.test(raw)) return "zh"; // CJK / Chinese
    if (/[\u0400-\u04FF]/.test(raw)) return "ru";            // Cyrillic / Russian

    const sharedBn = ROMAN_BN_LANG_HINT_REGEX.test(t) ? 2 : 0;
    const sharedHi = ROMAN_HI_LANG_HINT_REGEX.test(t) ? 2 : 0;
    const sharedTa = ROMAN_TA_LANG_HINT_REGEX.test(t) ? 2 : 0;
    const sharedTe = ROMAN_TE_LANG_HINT_REGEX.test(t) ? 2 : 0;
    const sharedEn = EN_LANG_HINT_REGEX.test(t) ? 1 : 0;

    const bnScore =
        sharedBn +
        countMatches(
            t,
            /\b(ami|amar|amake|tumi|tomar|amaro|mon|khub|bhalo|valo|kharap|onek|lagche|lagchhe|korbo|korchi|korcho|korchho|ki|ki korbo|ki khabo|ki korcho|ki korchho|ekhon|ekhono|achhi|achi|nao|nei|valo na|bhalo na|mon ta)\b/g
        ) +
        countMatches(
            t,
            /\b(ki korcho ekhon|ki korchho ekhon|amar mon kharap|mon kharap lagche|valo nei|bhalo nei)\b/g
        );

    const hiScore =
        sharedHi +
        countMatches(
            t,
            /\b(mera|meri|mujhe|mujhse|main|mai|hum|tum|kya|kyu|kyon|nahi|nahin|acha|accha|thik|theek|bahut|zyada|yar|yaar|karu|karoon|kaise|dimag|dil|mera dil|mujhe lag raha|ho raha hai)\b/g
        ) +
        countMatches(
            t,
            /\b(kya karu|kya karoon|mujhe tension|bahut tension|kaise karu|kaise karoon)\b/g
        );

    const taScore = sharedTa;
    const teScore = sharedTe;

    if (bnScore >= 2 && bnScore > hiScore && bnScore > taScore && bnScore > teScore) return "bn";
    if (hiScore >= 2 && hiScore > bnScore && hiScore > taScore && hiScore > teScore) return "hi";
    if (taScore >= 2 && taScore > bnScore && taScore > hiScore && taScore >= teScore) return "ta";
    if (teScore >= 2 && teScore > bnScore && teScore > hiScore && teScore >= taScore) return "te";

    if (bnScore >= 2) return "bn";
    if (hiScore >= 2) return "hi";
    if (taScore >= 2) return "ta";
    if (teScore >= 2) return "te";
    if (sharedEn > 0) return "en";

    const recentTexts = recentContext?.recentUserTexts ?? [];
    for (let i = recentTexts.length - 1; i >= 0; i -= 1) {
        const prev = (recentTexts[i] || "").trim();
        if (!prev) continue;

        const prevLower = prev.toLowerCase();

        if (/[\u0980-\u09ff]/.test(prev) || ROMAN_BN_LANG_HINT_REGEX.test(prevLower)) {
            return "bn";
        }
        if (/[\u0900-\u097f]/.test(prev) || ROMAN_HI_LANG_HINT_REGEX.test(prevLower)) {
            return "hi";
        }
        if (ROMAN_TA_LANG_HINT_REGEX.test(prevLower)) {
            return "ta";
        }
        if (ROMAN_TE_LANG_HINT_REGEX.test(prevLower)) {
            return "te";
        }
    }

    // #12: Use the explicit last-detected language hint as final fallback before defaulting to English.
    // This prevents jarring language switches when the user sends a short/ambiguous message mid-session.
    const hintLang = recentContext?.lastDetectedLanguage;
    if (hintLang && hintLang !== "en") {
        return hintLang as LocalLanguage;
    }

    return "en";
}

// #5: Detect indirect / hedging / deflection expressions that mask emotional distress.
// Returns the underlying signal when the surface text looks "fine" but isn't.
function detectIndirectSignal(text: string): "sad" | "anxious" | "angry" | "tired" | null {
    const t = (text || "").toLowerCase().trim();

    // English — Deflection & minimization → likely sad/suppressed
    if (/\b(i'?m fine|it'?s fine|i'?m okay|i'?m ok|whatever|doesn'?t matter|never mind|forget it|it is what it is|it'?s nothing|not a big deal|i don'?t know|don'?t even know|can'?t explain|hard to explain)\b/.test(t)) return "sad";
    // English — Resignation / hopelessness
    if (/\b(i give up|can'?t anymore|can't do this|too much|i'?m done|so over it|sick of (this|everything)|nothing (matters|helps|works))\b/.test(t)) return "sad";
    // English — Overwhelm → anxious
    if (/\b(i don'?t know what to do|don'?t know where to start|all at once|can'?t keep up|spinning|head (is|feels) full|too many (things|thoughts))\b/.test(t)) return "anxious";
    // English — Suppressed anger
    if (/\b(so annoying|why (does|do|is) (this|everything|everyone|he|she|they)|seriously\?|unbelievable|i can'?t believe|ridiculous)\b/.test(t)) return "angry";
    // English — Physical exhaustion
    if (/\b(just tired|so tired|exhausted (of|by)|drained|running on empty|no energy|wiped)\b/.test(t)) return "tired";

    // Hindi / Roman Indic — deflection
    if (/\b(theek hoon|sab theek|kuch nahi|chhodo|chod do|bas yahi|jo bhi ho|kya farak|koi baat nahi|nahi pata|samajh nahi)\b/.test(t)) return "sad";
    // Hindi — resignation
    if (/\b(haar gaya|haar gayi|thak gaya|thak gayi|chalta hai|kuch nahi hoga|sab bekaar)\b/.test(t)) return "sad";
    // Marathi — exhaustion/deflection
    if (/\b(thaklo|thakle|khup thaklo|kaay karau|nako vatato|aaik nahi|mann nahi|sod de|soDun de)\b/.test(t)) return "tired";

    // Bengali Roman — deflection
    if (/\b(ami thik achi|kichhu na|chharo|jaak|thak gechhi|ki hobe|ki dorkaar|bujhte parchi na)\b/.test(t)) return "sad";

    // Spanish — deflection
    if (/\b(estoy bien|no es nada|da igual|no importa|qué más da|no sé|imposible explicar|me rindo|ya fue)\b/.test(t)) return "sad";
    if (/\b(no sé qué hacer|demasiado|estoy harto|estoy harta)\b/.test(t)) return "anxious";

    // French — deflection
    if (/\b(je vais bien|c'?est rien|peu importe|laisse tomber|tant pis|j'?en sais rien|je m'?en fous|à quoi bon)\b/.test(t)) return "sad";
    if (/\b(j'?abandonne|c'?est trop|je suis épuisé)\b/.test(t)) return "tired";

    // Portuguese — deflection
    if (/\b(tô bem|estou bem|não é nada|tanto faz|deixa pra lá|não sei|desisti|é demais)\b/.test(t)) return "sad";

    // Russian — deflection
    if (/\b(я в порядке|всё нормально|ладно|неважно|забудь|не знаю|сдался|сдалась|слишком много)\b/.test(t)) return "sad";
    if (/\b(я устал|я устала|нет сил|больше не могу)\b/.test(t)) return "tired";

    // Indonesian — deflection
    if (/\b(aku baik|gak apa-apa|gak papa|biarin|terserah|nggak tau|udah menyerah|terlalu banyak)\b/.test(t)) return "sad";
    if (/\b(aku lelah|capek banget|udah gak kuat)\b/.test(t)) return "tired";

    // Arabic / Urdu — native script deflection
    if (/(أنا بخير|لا شيء|مهما|لا يهم|اتركني|لا أعرف|استسلمت)/.test(text)) return "sad";
    if (/(أنا متعب|أنا متعبة|لا طاقة لي)/.test(text)) return "tired";
    // Urdu Nastaliq
    if (/(میں ٹھیک ہوں|کچھ نہیں|جانے دو|پتہ نہیں|ہار گیا|ہار گئی)/.test(text)) return "sad";

    // Chinese — deflection
    if (/(我很好|没什么|算了|无所谓|不知道|随便|放弃了|太多了)/.test(text)) return "sad";
    if (/(太累了|没劲|撑不住了|不想动)/.test(text)) return "tired";

    return null;
}

// #6: Detect whether the user is venting vs. actively seeking advice.
function detectIntent(text: string): "venting" | "advice-seeking" | "neutral" {
    const t = (text || "").toLowerCase().trim();

    // Explicit advice signals (language-agnostic: ends with ?)
    if (/\?$/.test(t)) return "advice-seeking";
    // English advice keywords
    if (/\b(what should (i|we)|how (do|can|should) i|can you help|any advice|any tips|what do i do|what would you|suggest|recommend|what'?s the best|how to deal|tell me (what|how))\b/.test(t)) return "advice-seeking";
    // Hindi / Roman advice
    if (/\b(kya karna chahiye|kya karun|kaise karun|koi advice|koi tips|mujhe batao|kya sahi rahega|kaise deal karoon)\b/.test(t)) return "advice-seeking";
    // Spanish advice
    if (/\b(qué debo hacer|qué hago|cómo puedo|me ayudas|algún consejo|qué recomiendas)\b/.test(t)) return "advice-seeking";
    // French advice
    if (/\b(que dois-je faire|comment puis-je|tu peux m'aider|des conseils|qu'est-ce que tu recommandes)\b/.test(t)) return "advice-seeking";
    // Portuguese advice
    if (/\b(o que devo fazer|como posso|pode me ajudar|algum conselho|o que você recomenda)\b/.test(t)) return "advice-seeking";
    // Indonesian advice
    if (/\b(apa yang harus aku lakukan|bagaimana caranya|bisa bantu|ada saran|apa yang kamu sarankan)\b/.test(t)) return "advice-seeking";

    // English venting
    if (/\b(just (want to|wanted to|needed to) (say|vent|share|talk)|not looking for advice|just (listen|listening)|feel like telling|had to tell someone|couldn'?t hold it|ugh|argh|so frustrated|so upset|so sad|i hate this|i hate (it|when)|can'?t (take|stand|handle) (this|it|anymore))\b/.test(t)) return "venting";
    // Hindi / Roman venting
    if (/\b(bas suno|sirf suno|sunna tha|vent karna tha|kisi ko batana tha|advice nahi chahiye|dil halka karna|baat karni thi)\b/.test(t)) return "venting";
    // Bengali Roman venting
    if (/\b(shudhu shono|kothaa boltey cheyechhi|mon halka kortey cheyechhi|upodesh dorkar na|keno je)\b/.test(t)) return "venting";
    // Spanish venting
    if (/\b(solo quiero hablar|solo escúchame|necesitaba decirlo|no busco consejos|tenía que contárselo a alguien|qué asco|odio esto|no aguanto más)\b/.test(t)) return "venting";
    // French venting
    if (/\b(j'?avais juste besoin de parler|je voulais juste dire|écoute-moi|pas de conseils|j'?en pouvais plus|je déteste ça|trop c'?est trop)\b/.test(t)) return "venting";
    // Portuguese venting
    if (/\b(só quero falar|só me ouve|precisava contar|não quero conselhos|tava guardando isso|odeio isso|não aguento mais)\b/.test(t)) return "venting";
    // Russian venting
    if (/\b(просто хочу поговорить|просто послушай|мне нужно было сказать|не ищу советов|держал внутри|ненавижу это|больше не могу)\b/.test(t)) return "venting";
    // Indonesian venting
    if (/\b(mau cerita aja|cuma mau ngomong|gak butuh saran|pendam sendiri|benci ini|udah gak tahan)\b/.test(t)) return "venting";
    // Arabic / Urdu / Chinese native-script venting
    if (/(أريد فقط أن أتحدث|فقط اسمعني|لا أريد نصيحة|كنت أحتفظ بهذا)/.test(text)) return "venting";
    if (/(صرف سننا ہے|بس دل کا بوجھ اتارنا تھا|کوئی مشورہ نہیں چاہیے)/.test(text)) return "venting";
    if (/(只想说说|只是想倾诉|你就听着|不需要建议|忍了很久了|烦死了|受不了了)/.test(text)) return "venting";

    return "neutral";
}

// #10: Detect the broad topic context of the message for contextual replies.
function detectTopic(text: string, recentTexts: string[] = []): "work" | "relationship" | "health" | "existential" | "general" {
    const combined = ([text, ...recentTexts].join(" ") || "").toLowerCase();

    // Work — English + multilingual keywords
    if (/\b(work|job|boss|office|deadline|project|meeting|colleague|team|interview|career|study|exam|college|school|client|manager|promotion|salary|assignment)\b/.test(combined)) return "work";
    // Hindi/Marathi/Bengali romanized work
    if (/\b(kaam|naukri|boss|daftar|deadline|interview|padhai|exam|school|college|salary|office|promotion)\b/.test(combined)) return "work";
    // Spanish work
    if (/\b(trabajo|jefe|oficina|reunión|entrevista|carrera|estudio|examen|colegio|salario|proyecto|cliente)\b/.test(combined)) return "work";
    // French work
    if (/\b(travail|patron|bureau|réunion|entretien|carrière|études|examen|école|salaire|projet|client)\b/.test(combined)) return "work";
    // Portuguese work
    if (/\b(trabalho|chefe|escritório|reunião|entrevista|carreira|estudo|exame|escola|salário|projeto|cliente)\b/.test(combined)) return "work";
    // Russian work
    if (/\b(работа|начальник|офис|дедлайн|собеседование|карьера|учёба|экзамен|школа|зарплата|проект)\b/.test(combined)) return "work";
    // Indonesian work
    if (/\b(kerja|bos|kantor|deadline|wawancara|karir|belajar|ujian|sekolah|gaji|proyek|klien)\b/.test(combined)) return "work";
    // Chinese/Japanese work native script
    if (/(工作|老板|公司|截止|面试|职业|学习|考试|学校|工资|项目|客户|上班|同事)/.test(combined)) return "work";
    if (/(仕事|上司|会社|締め切り|面接|キャリア|勉強|試験|学校|給料|プロジェクト)/.test(combined)) return "work";
    // Arabic work
    if (/(عمل|رئيس|مكتب|موعد نهائي|مقابلة عمل|مسيرة مهنية|دراسة|امتحان|مدرسة|راتب)/.test(combined)) return "work";

    // Relationship — English
    if (/\b(friend|family|mom|dad|mother|father|partner|boyfriend|girlfriend|relationship|love|marriage|divorce|breakup|fight|argument|toxic|miss (you|him|her|them)|alone|lonely)\b/.test(combined)) return "relationship";
    // Hindi/Roman Indic relationship
    if (/\b(dost|yaar|maa|papa|boyfriend|girlfriend|rishta|pyaar|shaadi|talaak|breakup|jhagda|akela|yaad aa raha)\b/.test(combined)) return "relationship";
    // Spanish relationship
    if (/\b(amigo|familia|mamá|papá|novio|novia|relación|amor|matrimonio|divorcio|ruptura|pelea|soledad)\b/.test(combined)) return "relationship";
    // French relationship
    if (/\b(ami|famille|maman|papa|petit ami|petite amie|relation|amour|mariage|divorce|rupture|dispute|solitude)\b/.test(combined)) return "relationship";
    // Portuguese relationship
    if (/\b(amigo|família|mãe|pai|namorado|namorada|relacionamento|amor|casamento|divórcio|término|briga|solidão)\b/.test(combined)) return "relationship";
    // Russian relationship
    if (/\b(друг|семья|мама|папа|парень|девушка|отношения|любовь|брак|развод|расставание|ссора|одинокий)\b/.test(combined)) return "relationship";
    // Indonesian relationship
    if (/\b(teman|keluarga|ibu|ayah|pacar|hubungan|cinta|pernikahan|cerai|putus|pertengkaran|kesepian)\b/.test(combined)) return "relationship";
    // Chinese/Japanese relationship native
    if (/(朋友|家人|妈妈|爸爸|男友|女友|关系|爱情|婚姻|离婚|分手|争吵|孤独|想念)/.test(combined)) return "relationship";
    if (/(友達|家族|お母さん|お父さん|彼氏|彼女|関係|愛情|結婚|離婚|別れ|喧嘩|孤独)/.test(combined)) return "relationship";
    // Arabic relationship
    if (/(صديق|عائلة|أم|أب|حبيب|حبيبة|علاقة|حب|زواج|طلاق|انفصال|خلاف|وحيد)/.test(combined)) return "relationship";

    // Health — English
    if (/\b(sick|pain|health|doctor|medicine|hospital|sleep|insomnia|eat|appetite|headache|migraine|tired|body|anxiety|depression|mental health|therapy|therapist|panic attack)\b/.test(combined)) return "health";
    // Hindi/Roman health
    if (/\b(bimaar|dard|doctor|dawai|hospital|neend|bhookh|sir dard|mental health|therapy|panic)\b/.test(combined)) return "health";
    // Spanish health
    if (/\b(enfermo|dolor|salud|médico|medicina|hospital|sueño|insomnio|apetito|depresión|ansiedad|terapia)\b/.test(combined)) return "health";
    // French health
    if (/\b(malade|douleur|santé|médecin|médicament|hôpital|sommeil|insomnie|appétit|dépression|anxiété|thérapie)\b/.test(combined)) return "health";
    // Portuguese health
    if (/\b(doente|dor|saúde|médico|remédio|hospital|sono|insônia|apetite|depressão|ansiedade|terapia)\b/.test(combined)) return "health";
    // Russian health
    if (/\b(болен|больна|боль|здоровье|врач|лекарство|больница|сон|аппетит|депрессия|тревога|терапия)\b/.test(combined)) return "health";
    // Indonesian health
    if (/\b(sakit|nyeri|kesehatan|dokter|obat|rumah sakit|tidur|insomnia|nafsu makan|depresi|kecemasan|terapi)\b/.test(combined)) return "health";
    // Chinese/Japanese health native
    if (/(生病|疼痛|健康|医生|药|医院|睡眠|失眠|食欲|抑郁|焦虑|治疗|身体)/.test(combined)) return "health";
    if (/(病気|痛み|健康|医者|薬|病院|睡眠|不眠|食欲|うつ|不安|療法)/.test(combined)) return "health";
    // Arabic health
    if (/(مريض|مريضة|ألم|صحة|طبيب|دواء|مستشفى|نوم|أرق|شهية|اكتئاب|قلق|علاج)/.test(combined)) return "health";

    // Existential — English
    if (/\b(life|meaning|purpose|why (am i|do i|does it)|exist|worth it|future|hope|everything|nothing matters|pointless|empty|lost|who am i|identity|direction)\b/.test(combined)) return "existential";
    // Hindi/Roman existential
    if (/\b(zindagi|matlab|purpose|kyun hoon|exist|future|umeed|kuch nahi|bekaar|khoya|kaun hoon|direction)\b/.test(combined)) return "existential";
    // Spanish existential
    if (/\b(vida|sentido|propósito|por qué existo|futuro|esperanza|nada importa|sin sentido|vacío|perdido|quién soy)\b/.test(combined)) return "existential";
    // French existential
    if (/\b(vie|sens|but|pourquoi j'existe|avenir|espoir|rien n'a de sens|vide|perdu|qui suis-je|identité)\b/.test(combined)) return "existential";
    // Portuguese existential
    if (/\b(vida|sentido|propósito|por que existo|futuro|esperança|nada importa|vazio|perdido|quem sou)\b/.test(combined)) return "existential";
    // Russian existential
    if (/\b(жизнь|смысл|цель|зачем живу|будущее|надежда|ничего не важно|пустота|потерян|кто я)\b/.test(combined)) return "existential";
    // Indonesian existential
    if (/\b(hidup|makna|tujuan|kenapa aku ada|masa depan|harapan|tidak ada artinya|hampa|tersesat|siapa aku)\b/.test(combined)) return "existential";
    // Chinese/Japanese existential native
    if (/(人生|意义|目的|为什么活着|未来|希望|什么都没意义|空虚|迷失|我是谁|身份)/.test(combined)) return "existential";
    if (/(人生|意味|目的|なぜ生きる|未来|希望|何も意味がない|虚ろ|迷子|自分が誰)/.test(combined)) return "existential";
    // Arabic existential
    if (/(الحياة|المعنى|الهدف|لماذا أوجد|المستقبل|الأمل|لا شيء يهم|فراغ|ضائع|من أنا)/.test(combined)) return "existential";

    return "general";
}

// #8: Detect when the user is correcting a previous misread.
function detectCorrection(text: string): boolean {
    const t = (text || "").toLowerCase();
    return /\b(no[,.]?\s+(that|you|i|not|it)|you misunderstood|i didn'?t mean|not what i meant|that'?s not (it|what|right)|wrong|actually|i meant|what i (said|meant) was|let me rephrase|to clarify)\b/.test(t);
}

// #7: Extract a salient named topic from recent messages for follow-up reference.
function extractKeyTopic(recentTexts: string[]): string | null {
    const joined = (recentTexts || []).join(" ").toLowerCase();
    // English + multilingual keywords — relationship/work/health anchors
    const match = joined.match(/\b(mom|dad|mother|father|partner|boyfriend|girlfriend|friend|brother|sister|wife|husband|work|boss|job|exam|interview|school|college|health|sleep|breakup|divorce|maa|papa|bhai|behen|dost|yaar|naukri|kaam|pariksha|school|shaadi|talaak|rishta|amigo|jefe|trabajo|novio|novia|examen|mama|ami|tumi|baba|kakima|bondhu|kaaj|pariksha|travail|patron|ami|examen|trabalho|chefe|namorado|namorada|saúde|sono|работа|начальник|друг|здоровье|сон|друзья|kerja|bos|teman|kesehatan|tidur|pacar)\b/);
    if (match) return match[0];
    // Non-Latin script anchors — relationship terms
    const nativeMatch = joined.match(/(妈妈|爸爸|朋友|男友|女友|工作|老板|考试|健康|睡眠|мама|папа|друг|работа|健康|お母さん|お父さん|友達|仕事|試験|أم|أب|صديق|حبيب|عمل|امتحان|ما|با|دوست|کام)/);
    return nativeMatch?.[0] ?? null;
}

function detectSignal(text: string, lang: LocalLanguage): "sad" | "anxious" | "angry" | "tired" | "okay" {
    const raw = text || "";
    const t = raw.toLowerCase();

    if (BN_SAD_REGEX.test(raw) || TA_SAD_REGEX.test(raw)) return "sad";
    if (
        HI_STRESS_REGEX.test(raw) ||
        TA_STRESS_REGEX.test(raw) ||
        /\b(tension|stress|stressed|overwhelm|overwhelmed|pressure)\b/i.test(raw)
    ) {
        return "anxious";
    }

    // #11: Marathi signals
    if (lang === "mr") {
        if (/(sad|down|depressed|hopeless|cry|dukh|udaas|radu|mann jad|baru nahi|nako vatata)/.test(t)) return "sad";
        if (/(anxious|worried|panic|overwhelm|stress|tension|chinta|ghabra|bhiti|dara|pressure)/.test(t)) return "anxious";
        if (/(angry|mad|furious|irritated|annoyed|rag|chidchid|kopavla|ras)/.test(t)) return "angry";
        if (/(tired|exhausted|drained|thaklo|thakle|shakti nahi|kami pado)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "hi") {
        if (/(sad|down|depressed|hopeless|cry|udaas|udas|dukhi|bura lag|rona|ro raha|ro rahi)/.test(t)) return "sad";
        if (/(anxious|worried|panic|overwhelm|stress|tension|ghabra|pareshan|pressure|bojh)/.test(t)) return "anxious";
        if (/(angry|mad|furious|irritated|annoyed|gussa|gussa aa raha|chidh|chidha)/.test(t)) return "angry";
        if (/(tired|exhausted|drained|sleepy|burnt|thak|thaka|thaki|thak gaya|thak gayi)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "bn") {
        if (/(sad|down|depressed|hopeless|cry|mon kharap|kharap lagche|dukho|dukkho|kosto|koshto|kanna|valo nei|bhalo nei)/.test(t)) return "sad";
        if (/(anxious|worried|panic|overwhelm|stress|chinta|tension|chap|pressure|bhoy|voy|ghabra)/.test(t)) return "anxious";
        if (/(angry|mad|furious|irritated|annoyed|rag|rosh|khub rag|raeg)/.test(t)) return "angry";
        if (/(tired|exhausted|drained|sleepy|burnt|klanto|ghum pachche|shokti nei)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "ta") {
        if (TA_SAD_REGEX.test(raw) || /(sogama|kashtama|kastama|manasu sari illa|manasu seriya illa)/.test(t)) return "sad";
        if (TA_STRESS_REGEX.test(raw) || /(pressure|stress|tension|bayama|manasu romba odudhu)/.test(t)) return "anxious";
        if (/(kovam|erichal|frustrating|annoyed|irritated)/.test(t)) return "angry";
        if (/(tired|drained|burnt|sorvu|saerndhu tiredness|romba tired)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "te") {
        if (/(kashtam|baadha|bharam|chaala bhaaranga|edustunna|baadha ga undi)/.test(t)) return "sad";
        if (/(pressure|stress|tension|bayam|bhayam|chaala pressure|manasu veganga)/.test(t)) return "anxious";
        if (/(kopam|frustrating|annoyed|irritated|mad)/.test(t)) return "angry";
        if (/(tired|drained|burnt|alasata|chaala tired|aayasam)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "gu") {
        if (/(sad|down|depressed|hopeless|cry|dukh|udaas|man kharap|rovu|dard|haar|dukhi)/.test(t)) return "sad";
        if (/(anxious|worried|panic|overwhelm|stress|tension|dara|ghabra|chinta|anxiety)/.test(t)) return "anxious";
        if (/(angry|mad|furious|irritated|annoyed|gusse|krodh|chidha)/.test(t)) return "angry";
        if (/(tired|exhausted|drained|burnt|thakelo|thak|shakti nathi)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "pa") {
        if (/(sad|down|depressed|hopeless|cry|dukhi|udaas|man kharap|rona|bura lagg|toot)/.test(t)) return "sad";
        if (/(anxious|worried|panic|overwhelm|stress|tension|chinta|ghabra|pareshaan|dara lagg)/.test(t)) return "anxious";
        if (/(angry|mad|furious|irritated|annoyed|gussa|krodh|chidha)/.test(t)) return "angry";
        if (/(tired|exhausted|drained|burnt|thakka|thakke|shakti nahi)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "kn") {
        if (/(sad|down|depressed|hopeless|cry|dukha|badha|novu|alavotti|kanniru)/.test(t)) return "sad";
        if (/(anxious|worried|panic|overwhelm|stress|tension|bayabhiti|chinta|ghabra)/.test(t)) return "anxious";
        if (/(angry|mad|furious|irritated|annoyed|kopa|frustrating)/.test(t)) return "angry";
        if (/(tired|exhausted|drained|burnt|dakkavase|shakti illa|alasata)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "ml") {
        if (/(sad|down|depressed|hopeless|cry|dukham|vishamam|kashtam|kanneer)/.test(t)) return "sad";
        if (/(anxious|worried|panic|overwhelm|stress|tension|bhayam|verupu|anxiety)/.test(t)) return "anxious";
        if (/(angry|mad|furious|irritated|annoyed|kopam|frustrated)/.test(t)) return "angry";
        if (/(tired|exhausted|drained|burnt|thurannu|shakti illa)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "or") {
        if (/(sad|down|depressed|hopeless|cry|dukha|manakhana|kanna|udaas|dukhit)/.test(t)) return "sad";
        if (/(anxious|worried|panic|overwhelm|stress|tension|chinta|ghabara|bhaya)/.test(t)) return "anxious";
        if (/(angry|mad|furious|irritated|annoyed|raga|kopita|frustrated)/.test(t)) return "angry";
        if (/(tired|exhausted|drained|burnt|thaka|shakti nahi)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "zh") {
        if (/(难过|伤心|哭|悲伤|难受|心疼|失落|绝望|sad|cry|hopeless)/.test(t)) return "sad";
        if (/(焦虑|紧张|害怕|担心|恐惧|慌|anxious|worried|panic|stress)/.test(t)) return "anxious";
        if (/(愤怒|生气|烦|愤|恼|气死|mad|angry|frustrated)/.test(t)) return "angry";
        if (/(疲惫|累|没劲|精疲力|倦|sleepy|tired|exhausted|drained)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "ar") {
        // Native Arabic + Roman fallback
        if (/(حزين|حزينة|بكاء|أبكي|حزن|مؤلم|sad|cry|hazeen|mota'alam)/.test(t)) return "sad";
        if (/(قلق|قلقة|خائف|خائفة|يأس|اكتئاب|توتر|anxious|panic|qalaq|tawatar)/.test(t)) return "anxious";
        if (/(غاضب|غاضبة|غضب|متضايق|مستاء|mad|angry|frustrated|ghadib)/.test(t)) return "angry";
        if (/(متعب|متعبة|مرهق|مرهقة|إرهاق|tired|exhausted|drained|mut'ab)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "es") {
        if (/(triste|tristeza|llorar|llorando|deprimido|deprimida|desesperado|desesperada|sad|cry)/.test(t)) return "sad";
        if (/(ansioso|ansiosa|ansiedad|nervioso|nerviosa|angustia|pánico|panico|estresado|anxious|stressed)/.test(t)) return "anxious";
        if (/(enojado|enojada|enojo|furioso|furiosa|irritado|frustrado|frustrada|mad|angry)/.test(t)) return "angry";
        if (/(cansado|cansada|agotado|agotada|sin energía|exhausto|tired|drained)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "fr") {
        if (/(triste|tristesse|pleurer|pleurs|déprimé|déprimée|désespéré|désespérée|sad|cry)/.test(t)) return "sad";
        if (/(anxieux|anxieuse|angoissé|angoissée|stressé|stressée|panique|anxious|stressed)/.test(t)) return "anxious";
        if (/(en colère|énervé|énervée|frustré|frustrée|furieux|furieuse|mad|angry)/.test(t)) return "angry";
        if (/(fatigué|fatiguée|épuisé|épuisée|crevé|crevée|tired|exhausted)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "pt") {
        if (/(triste|tristeza|chorar|chorando|deprimido|deprimida|desesperado|desesperada|sad|cry)/.test(t)) return "sad";
        if (/(ansioso|ansiosa|ansiedade|nervoso|nervosa|angustiado|pânico|panico|estressado|anxious|stressed)/.test(t)) return "anxious";
        if (/(com raiva|irritado|irritada|furioso|furiosa|frustrado|frustrada|mad|angry)/.test(t)) return "angry";
        if (/(cansado|cansada|exausto|exausta|esgotado|esgotada|tired|exhausted)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "ru") {
        if (/(грустно|грустный|грустная|плачу|плакать|депрессия|безнадёжно|sad|cry|hopeless)/.test(t)) return "sad";
        if (/(тревога|тревожно|боюсь|страх|паника|стресс|anxious|panic|stressed)/.test(t)) return "anxious";
        if (/(злой|злая|злюсь|гнев|бесит|раздражён|раздражена|frustrated|angry|mad)/.test(t)) return "angry";
        if (/(устал|устала|уставший|измотан|измотана|нет сил|tired|exhausted|drained)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "id") {
        if (/(sedih|kesedihan|menangis|depresi|putus asa|sad|cry|hopeless)/.test(t)) return "sad";
        if (/(cemas|gelisah|takut|khawatir|panik|stres|anxious|panic|stressed)/.test(t)) return "anxious";
        if (/(marah|kesal|frustrasi|kecewa|jengkel|angry|frustrated|mad)/.test(t)) return "angry";
        if (/(lelah|capek|kelelahan|kecapean|kehabisan tenaga|tired|exhausted|drained)/.test(t)) return "tired";
        return "okay";
    }

    if (lang === "ur") {
        // Roman Urdu + Nastaliq (Arabic-script Urdu)
        if (/(udaas|dukhi|rona|ro raha|roti|toot|اداس|دکھ|رونا|ٹوٹ|غم|sad|hopeless|cry)/.test(t)) return "sad";
        if (/(pareshan|ghabrana|dara|khauf|tension|پریشان|گھبراہٹ|ڈر|خوف|anxious|panic)/.test(t)) return "anxious";
        if (/(gussa|naraaz|jhunj|chidh|غصہ|ناراض|برہم|angry|mad|frustrated)/.test(t)) return "angry";
        if (/(thaka|thake|thaki|thakaan|تھکا|تھکی|تھکاوٹ|tired|exhausted|drained)/.test(t)) return "tired";
        return "okay";
    }

    if (/(sad|down|depressed|hopeless|cry)/.test(t)) return "sad";
    if (/(anxious|worried|panic|overwhelm|stress|pressure)/.test(t)) return "anxious";
    if (/(angry|mad|furious|irritated|annoyed)/.test(t)) return "angry";
    if (/(tired|exhausted|drained|sleepy|burnt)/.test(t)) return "tired";
    return "okay";
}

// ── Gender-aware post-processing ─────────────────────────────────────────────
// These are applied AFTER template selection so the core banks stay simple.

/**
 * Adjust companion voice verb forms in Hindi for a female companion.
 * Only modifies clearly gendered first-person verb endings; neutral phrases are left intact.
 */
function applyHindiCompanionGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        // "Main sun raha hoon" → "Main sun rahi hoon"
        .replace(/\bsun raha hoon\b/gi, "sun rahi hoon")
        // "Samajh gaya" → "Samajh gayi" (standalone or mid-sentence)
        .replace(/\bSamajh gaya\b/g, "Samajh gayi")
        .replace(/\bsamajh gaya\b/g, "samajh gayi")
        // "Hmm, sun raha hoon" → "Hmm, sun rahi hoon"
        .replace(/\bsun raha hoon\b/g, "sun rahi hoon");
}

/**
 * Adjust second-person verb agreement in Hindi when the user is female.
 * Covers the age-closer for teens and select validation lines.
 */
function applyHindiUserGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        // "sambhal loge" → "sambhal logi" (you will manage — teen age closer)
        .replace(/\bsambhal loge\b/g, "sambhal logi")
        // "utha rahe ho" → "utha rahi ho"
        .replace(/\butha rahe ho\b/g, "utha rahi ho")
        // "kar rahe ho" → "kar rahi ho"
        .replace(/\bkar rahe ho\b/g, "kar rahi ho");
}

/**
 * Adjust companion voice verb forms in Gujarati for a female companion.
 * "Samajh gayo" (I understood, masc) → "Samajh gai" (fem).
 */
function applyGujaratiCompanionGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        .replace(/\bSamajh gayo\b/g, "Samajh gai")
        .replace(/\bsamajh gayo\b/g, "samajh gai");
}

/**
 * Adjust second-person verb agreement in Gujarati when the user is female.
 * "uthi rahyo chhe" (was carrying, masc) → "uthi rahi chhe" (fem).
 */
function applyGujaratiUserGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        .replace(/\buthi rahyo chhe\b/g, "uthi rahi chhe")
        .replace(/\bsahu uthi rahyo chhe\b/g, "sahu uthi rahi chhe");
}

/**
 * Adjust companion voice verb forms in Punjabi for a female companion.
 * Similar to Hindi: "sun raha haan" → "sun rahi haan", "Samajh gaya" → "Samajh gayi".
 */
function applyPunjabiCompanionGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        .replace(/\bsun raha haan\b/gi, "sun rahi haan")
        .replace(/\bSamajh gaya\b/g, "Samajh gayi")
        .replace(/\bsamajh gaya\b/g, "samajh gayi");
}

/**
 * Adjust second-person verb agreement in Punjabi when the user is female.
 * "chuk raha aa" (was carrying, masc) → "chuk rahi aa" (fem).
 */
function applyPunjabiUserGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        .replace(/\bchuk raha aa\b/g, "chuk rahi aa")
        .replace(/\bsambhal lavega\b/g, "sambhal lavegi");
}

function applyBengaliCompanionGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        .replace(/\bshunchhi\b/g, "shunchhi")   // already neutral in Bengali
        .replace(/\bbujhechhi\b/g, "bujhechi")
        .replace(/\bthakbo\b/g, "thakbo");       // gender-neutral in Bengali
}

function applyMarathiCompanionGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        .replace(/\baiktoyo\b/gi, "aikteyo")
        .replace(/\bgheto\b/gi, "ghete")
        .replace(/\bsamjun gheto\b/gi, "samjun ghete");
}

function applyMarathiUserGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        .replace(/\bkarsheel\b/g, "karashil")
        .replace(/\bsambhalishe\b/g, "sambhalishes");
}

// Tamil, Telugu, Kannada, Malayalam, Odia: 1st/2nd-person verbs are largely
// gender-neutral in these templates. Functions are wired in for consistency
// and can be extended if future templates introduce gendered forms.

function applyTamilCompanionGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        .replace(/\bpurinjutten\b/gi, "purinjutten")   // neutral in standard Tamil
        .replace(/\bkettirukken\b/gi, "kettirukken");   // neutral
}

function applyTeluguCompanionGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        .replace(/\bayyaadu\b/g, "ayyindi")
        .replace(/\bcesaadu\b/g, "cesindi");
}

function applyKannadaCompanionGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        .replace(/\bbandhanu\b/gi, "bandhalu")
        .replace(/\bidhanu\b/gi, "idhalu");
}

function applyMalayalamCompanionGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        .replace(/\bvannirunnu\b/gi, "vannirunnu")  // neutral in Malayalam
        .replace(/\bsahaayichchu\b/gi, "sahaayichchu");
}

function applyOdiaCompanionGender(text: string, gender?: string): string {
    if (gender !== "female") return text;
    return text
        .replace(/\bkaricha\b/gi, "karichi")
        .replace(/\bashichi\b/gi, "ashichi");
}

export function buildLocalReply(
    message: string,
    toneContext?: ToneContext,
    recentContext?: LocalRecentContext
): LocalReplyResult {
    // ── Adult content safety gate ─────────────────────────────────────────
    if (detectAdultContent(message)) {
        const lang = toneContext?.userAge
            ? (recentContext?.lastDetectedLanguage ?? "en")
            : (recentContext?.lastDetectedLanguage ?? "en");
        return {
            message: buildAdultSafetyRefusal(lang, toneContext?.userAge),
        };
    }
    // ─────────────────────────────────────────────────────────────────────

    const companionName = toneContext?.companion?.name ?? "Imotara";
    const language = detectLanguage(message, recentContext);
    const recentSignature = buildRecentSignature(recentContext);

    // #9: Include sessionTurn in seed so repeated messages produce different replies
    const seed = hash32(
        `${message}::${language}::${recentSignature}::${toneContext?.companion?.relationship ?? ""}::${toneContext?.companion?.tone ?? ""}::${toneContext?.sessionTurn ?? 0}`
    );

    // #5: Catch indirect/hedging signals that bypass keyword detection
    let signal = detectSignal(message, language);
    if (signal === "okay") {
        const indirect = detectIndirectSignal(message);
        if (indirect) signal = indirect;
    }

    // #6: Detect intent — push toward supportive tone for pure venting
    const userIntent = detectIntent(message);

    // #8: Detect correction cues — use a repair opener
    const isCorrection = detectCorrection(message);

    // #10: Detect broad topic for contextual replies
    const topic = detectTopic(message, recentContext?.recentUserTexts ?? []);

    // #7: Extract key topic from recent messages for follow-up reference
    const keyTopic = extractKeyTopic(recentContext?.recentUserTexts ?? []);
    const isVagueReply = /^(yes|yeah|yep|no|nope|same|still|exactly|right|kind of|i guess|maybe|sure|ok|okay|mm|hmm|idk|dunno)\.?$/i.test(message.trim());

    // Resolve tone: venting always gets supportive; advice-seeking prefers practical/coach
    let companionTone: LocalResponseTone = toneContext?.companion?.tone ?? "supportive";
    const prefStyle = toneContext?.preferredResponseStyle;
    if (prefStyle === "motivate") companionTone = "coach";
    else if (prefStyle === "advise") companionTone = "practical";
    else if (prefStyle === "comfort") companionTone = "supportive";
    else if (prefStyle === "reflect") companionTone = "calm";
    // Intent override: pure venting → supportive regardless of companion setting
    if (userIntent === "venting" && companionTone !== "supportive" && companionTone !== "calm") {
        companionTone = "supportive";
    }

    // Suppress extras for advice-seeking so we don't drown action signals in presence language
    const suppressExtras = userIntent === "advice-seeking";

    // #2: Read emotionMemory to decide whether to deepen empathy
    // If history summary mentions "high" intensity or repeated heavy emotions, boost toward supportive
    const emotionMemory = recentContext?.emotionMemory ?? "";
    const memoryShowsHighIntensity = /high|intensity.*high|overall intensity.*high/i.test(emotionMemory);
    const memoryHeavyEmotions = /(sad|anxious|stress|fear|anger|lonely).*×[2-9]|×[2-9].*(sad|anxious|stress|fear|anger|lonely)/i.test(emotionMemory);
    if ((memoryShowsHighIntensity || memoryHeavyEmotions) && companionTone === "calm") {
        // Nudge calm → supportive when history shows sustained heavy emotions
        companionTone = "supportive";
    }

    const openersByToneEn: Record<LocalResponseTone, string[]> = {
        calm: [
            `That sounds like a lot to hold.`,
            `Let's slow this down together.`,
            `Okay. We can take this gently.`,
            `I'm with you. Let's take one piece at a time.`,
            `That makes sense to feel that way.`,
            `Take your time. I'm not going anywhere.`,
        ],
        supportive: [
            `I hear you.`,
            `Thank you for telling me that.`,
            `That took courage to say.`,
            `I'm glad you reached out.`,
            `I'm listening, fully.`,
            `That sounds really difficult.`,
        ],
        practical: [
            `Okay. Let's look at this clearly.`,
            `Got it. Let's take this one piece at a time.`,
            `Alright — let's figure out what matters most right now.`,
            `Let's think through this together.`,
            `That's a real situation. Let's work through it.`,
        ],
        coach: [
            `Okay — let's work through this together.`,
            `Got it. We can take this step by step.`,
            `That's real. Let's get our footing and start from here.`,
            `I hear you. Let's figure out where to begin.`,
            `You've got more in you than you think right now.`,
        ],
        "gentle-humor": [
            `Okay, I'm with you.`,
            `Noted — and I mean that genuinely.`,
            `That's a lot. You don't have to carry it alone.`,
            `Fair enough. Let's make this a little more manageable.`,
        ],
        direct: [
            `Got it. Let's be honest with each other.`,
            `Okay. Let's look at this straight.`,
            `Understood. Let's keep this clear and real.`,
            `I hear you. Let's get to the heart of it.`,
        ],
    };

    const openersByToneHi: Record<LocalResponseTone, string[]> = {
        calm: [
            `Main yahin hoon.`,
            `Chalo ise dheere se dekhte hain.`,
            `Theek hai. Hum ise aaraam se lete hain.`,
            `Main tumhare saath hoon. Ek ek hissa dekhte hain.`,
            `Koi jaldi nahi — main sun raha hoon.`,
            `Ruko, ek dum se nahi — saath mein chalte hain.`,
            `Tumhare saath hoon, har qadam par.`,
            `Sab kuch ek saath nahi — pehle thoda saans lete hain.`,
        ],
        supportive: [
            `Main tumhare saath hoon.`,
            `Main sun raha hoon.`,
            `Theek hai — main yahin hoon.`,
            `Achha hua tumne bataya.`,
            `Samajh gaya. Main sun raha hoon.`,
            `Yeh baat tumne share ki, yeh zaroori tha.`,
            `Dil se sun raha hoon.`,
            `Tumne sahi kiya baat karte hue.`,
            `Main yahaan hoon — aur kahi nahi.`,
        ],
        practical: [
            `Theek hai. Chalo ise saaf nazar se dekhte hain.`,
            `Samajh gaya. Isse ek ek step mein lete hain.`,
            `Chalo ise sambhalte hain aur dekhte hain kya sabse zaroori hai.`,
            `Main saath hoon. Ise simple rakhte hain.`,
        ],
        coach: [
            `Theek hai — main saath hoon. Pehle isse sambhalte hain.`,
            `Samajh gaya. Hum ise step by step nikalenge.`,
            `Chalo thoda dheere hote hain aur footing pakadte hain.`,
            `Main sun raha hoon. Ise ek ek hissa dekhte hain.`,
        ],
        "gentle-humor": [
            `Theek hai — main yahin hoon.`,
            `Hmm, sun raha hoon.`,
            `Samajh gaya. Main saath hoon.`,
            `Chalo, ise thoda halka banate hain — ek chhota step karke.`,
        ],
        direct: [
            `Theek hai. Main saath hoon.`,
            `Chalo isse seedhe dekhte hain.`,
            `Samajh gaya. Ise stable rakhte hain.`,
            `Main sun raha hoon. Seedha mudde par aate hain.`,
        ],
    };

    const openersByToneBn: Record<LocalResponseTone, string[]> = {
        calm: [
            `Ami achhi tomar sathe.`,
            `Cholo eta aste aste dekhi.`,
            `Thik ache. Eta narm bhabe nei.`,
            `Ami tomar sathe achhi. Ek ek kore dekhi.`,
            `Kono taratari nei — ami shunchi.`,
            `Dhire dhire — ekta ekta kore.`,
            `Tumi bolte thako, ami shunchi.`,
            `Amar kachhe thako, kono rush nei.`,
        ],
        supportive: [
            `Ami tomar sathe achhi.`,
            `Ami shunchi.`,
            `Thik ache — ami ekhanei achhi.`,
            `Bhalo korecho je bolechho.`,
            `Bujhte parchi.`,
            `Ei kotha ta share korar jonno shukriya.`,
            `Moner kothata bolle bhaloi hoy.`,
            `Ami ekhanei achi — kothao jachhi na.`,
            `Tumi thik e korechho bolte ese.`,
        ],
        practical: [
            `Thik ache. Cholo eta porishkar bhabe dekhi.`,
            `Bujhlam. Eta ek ek step e nebo.`,
            `Cholo eta sambhalai aar dekhi ki beshi joruri.`,
            `Ami achhi. Eta simple rakhi.`,
        ],
        coach: [
            `Thik ache — ami achhi. Age eta steady kori.`,
            `Bujhlam. Eta step by step niye jabo.`,
            `Cholo ektu aste hoye footing ta dhori.`,
            `Ami shunchi. Eta ek ek kore dekhi.`,
        ],
        "gentle-humor": [
            `Thik ache — ami achhi.`,
            `Hmm, ami shunchi.`,
            `Bujhlam. Ami ekhanei achhi.`,
            `Cholo eta ektu halka kore nei — ekta chhoto step diye.`,
        ],
        direct: [
            `Thik ache. Ami achhi.`,
            `Cholo eta sojha bhabe dekhi.`,
            `Bujhlam. Eta steady rakhi.`,
            `Ami shunchi. Sojha kothay asi.`,
        ],
    };

    const openersByToneTa: Record<LocalResponseTone, string[]> = {
        calm: [
            `Naan un kooda irukken.`,
            `Idha konjam nidhana ma paakalam.`,
            `Sari. Idha mellaga eduthukalam.`,
            `Naan un kooda irukken. Oru oru paguthiya paakalam.`,
        ],
        supportive: [
            `Naan un kooda irukken.`,
            `Naan ketkaren.`,
            `Sari — naan inga irukken.`,
            `Nee sonnadhu nalladhu.`,
            `Purinjidhu.`,
        ],
        practical: [
            `Sari. Idha clear aa paakalam.`,
            `Purinjidhu. Idha step by step eduthukalam.`,
            `Idha konjam steady pannitu mukkiyama irukkaradhu paakalam.`,
            `Naan kooda irukken. Idha simple aa vaikkalam.`,
        ],
        coach: [
            `Sari — naan kooda irukken. Mothalla idha steady pannalam.`,
            `Purinjidhu. Idha step by step paathukalam.`,
            `Konjam nidhana ma poi footing pidikkalam.`,
            `Naan ketkaren. Oru oru paguthiya paakalam.`,
        ],
        "gentle-humor": [
            `Sari — naan inga irukken.`,
            `Hmm, naan ketkaren.`,
            `Purinjidhu. Naan kooda irukken.`,
            `Idha konjam light aa eduthukalam — oru chinna step la.`,
        ],
        direct: [
            `Sari. Naan kooda irukken.`,
            `Idha straight aa paakalam.`,
            `Purinjidhu. Idha steady aa vaikkalam.`,
            `Naan ketkaren. Neraya sutti podaama point ku varalam.`,
        ],
    };

    const openersByToneTe: Record<LocalResponseTone, string[]> = {
        calm: [
            `Nenu nee tho unnaanu.`,
            `Idi konchem mellaga chuddam.`,
            `Sare. Idi mellaga teesukundam.`,
            `Nenu nee tho unnaanu. Oka oka bhaagam ga chuddam.`,
        ],
        supportive: [
            `Nenu nee tho unnaanu.`,
            `Nenu vintunnaanu.`,
            `Sare — nenu ikkade unnaanu.`,
            `Nuvvu cheppadam manchidi.`,
            `Ardham ayyindi.`,
        ],
        practical: [
            `Sare. Idi clear ga chuddam.`,
            `Ardham ayyindi. Idi step by step teesukundam.`,
            `Idi konchem steady chesi mukhyamaina vishayam chuddam.`,
            `Nenu nee tho unnaanu. Idi simple ga unchukundam.`,
        ],
        coach: [
            `Sare — nenu nee tho unnaanu. Mundu idi steady cheddam.`,
            `Ardham ayyindi. Idi step by step chuddam.`,
            `Konchem nidhana ga veldaam, footing pattukundam.`,
            `Nenu vintunnaanu. Oka oka bhaagam ga chuddam.`,
        ],
        "gentle-humor": [
            `Sare — nenu ikkade unnaanu.`,
            `Hmm, nenu vintunnaanu.`,
            `Ardham ayyindi. Nenu nee tho unnaanu.`,
            `Idi konchem light ga teesukundam — oka chinna step tho.`,
        ],
        direct: [
            `Sare. Nenu nee tho unnaanu.`,
            `Idi direct ga chuddam.`,
            `Ardham ayyindi. Idi steady ga unchukundam.`,
            `Nenu vintunnaanu. Sutralu lekunda point ki veddam.`,
        ],
    };

    const validationsEn: Record<typeof signal, string[]> = {
        sad: [
            `That sounds really painful.`,
            `That kind of hurt doesn't just go away on its own.`,
            `I'm sorry you're going through this.`,
            `That's genuinely hard — not just a little hard.`,
            `What you're feeling makes complete sense.`,
            `You didn't deserve that.`,
        ],
        anxious: [
            `That sounds like your mind is running at full speed.`,
            `That kind of pressure is exhausting to live inside.`,
            `It makes complete sense you'd feel on edge with that.`,
            `That's a lot of uncertainty to hold at once.`,
            `Anxiety about this is a very human response.`,
            `Your nervous system is reacting to something real.`,
        ],
        angry: [
            `That anger makes a lot of sense.`,
            `Something real happened here — that frustration is valid.`,
            `I'd feel that way too.`,
            `Yeah — that's genuinely unfair.`,
            `That kind of thing gets under anyone's skin.`,
            `It's okay to be angry about this.`,
        ],
        tired: [
            `That kind of exhaustion goes deeper than sleep can fix.`,
            `You've been holding a lot for a long time.`,
            `No wonder your energy is low — this is a lot.`,
            `That kind of tired builds up quietly and then hits all at once.`,
            `You're allowed to be worn out by this.`,
            `That's a real kind of depletion, not just tiredness.`,
        ],
        okay: [
            `Tell me a little more.`,
            `I'm with you — what's going on?`,
            `What's been on your mind?`,
            `Okay. What's the main thing you're sitting with right now?`,
            `I'm here — take whatever direction feels right.`,
        ],
    };

    const carryValidationsEn = [
        `This is still with you — I can feel that.`,
        `It sounds like this hasn't settled yet, and that makes sense.`,
        `You're still in the middle of this, aren't you.`,
        `This hasn't left you. Let's stay with it a little longer.`,
        `Something about this keeps coming back up for you.`,
    ];

    const validationsHi: Record<typeof signal, string[]> = {
        sad: [
            `Yeh sach mein bahut dard deta hai.`,
            `Yeh aisa dard nahi hota jo apne aap theek ho jaaye.`,
            `Mujhe afsos hai ki tum isse guzar rahe ho.`,
            `Yeh sach mein mushkil hai — sirf thodi nahi, bahut zyada.`,
            `Jo tum feel kar rahe ho, woh bilkul samajh mein aata hai.`,
            `Tum iske haqdar nahi the.`,
        ],
        anxious: [
            `Lagta hai dimaag poori speed mein chal raha hai.`,
            `Is tarah ka pressure andar se bahut thaka deta hai.`,
            `Yeh sab hote hue edge par rehna bilkul samajh mein aata hai.`,
            `Ek saath itni saari uncertainty sambhalna bahut bhaari hota hai.`,
            `Is par anxious rehna ek bilkul insaani response hai.`,
            `Tumhara nervous system kisi asli cheez par react kar raha hai.`,
        ],
        angry: [
            `Yeh gussa bilkul samajh mein aata hai.`,
            `Kuch asal mein hua hai — yeh frustration bilkul sahi hai.`,
            `Main bhi aisa hi feel karta.`,
            `Haan — yeh sach mein ghalat hai.`,
            `Iss tarah ki baat kisi ko bhi andar tak jalati hai.`,
            `Is par gussa hona bilkul theek hai.`,
        ],
        tired: [
            `Yeh thakan sirf neend se theek nahi hoti.`,
            `Tum bahut lamba waqt se bahut kuch sambhal rahe ho.`,
            `Is sab mein energy kam hona toh banta hi hai.`,
            `Yeh thakan dheere dheere jama hoti hai, phir ek saath hit karti hai.`,
            `Tumhe isse thake rehne ka poora haq hai.`,
            `Yeh sach mein khatam ho jaane ki feeling hai, sirf thakaan nahi.`,
        ],
        okay: [
            `Thoda aur batao.`,
            `Main saath hoon — kya chal raha hai?`,
            `Main sun raha hoon. Abhi tumhare andar sabse zyada kya baitha hai?`,
            `Theek hai. Abhi dimaag mein sabse badi baat kya hai?`,
        ],
    };

    const carryValidationsHi = [
        `Yeh abhi bhi tumhare saath hai — yeh main mehsoos kar sakta hoon.`,
        `Lagta hai yeh baat abhi bhi settle nahi hui hai, aur yeh samajh mein aata hai.`,
        `Tum abhi bhi iske beech mein ho, nahi?`,
        `Yeh tumhe chhoodne nahi de raha. Thodi der aur iske saath rehte hain.`,
        `Kuch is baarein baar baar saamne aa jaata hai tumhare liye.`,
    ];

    const validationsBn: Record<typeof signal, string[]> = {
        sad: [
            `Eta shotti khub betha dicche.`,
            `Ei rokhom koshto nijey nijey thik hoe jae na.`,
            `Kharap lagche je tumi eta diye jachho.`,
            `Eta shotti kashtakar — ektu noy, onek beshi.`,
            `Tumi je feel korcho sheta khub sadharon.`,
            `Tumi eta paawar jog chile na.`,
        ],
        anxious: [
            `Mone hocche mathata khub jaag chale.`,
            `Ei tarah pressure andar theke khub klanto kore.`,
            `Eta niye edge feel kora mote khub sadharon.`,
            `Ek sathe eto uncertainty sambhalna khub kashtaker.`,
            `Eta niey anxious thaka ekta manobik protikriya.`,
            `Tomar nervous system kono asol bishoy theke react korche.`,
        ],
        angry: [
            `Ei raag ta mote khub bujha jaay.`,
            `Asol kichu ghotechhe — eta frustration ta mathik.`,
            `Ami o oi rokhom feel kortam.`,
            `Haan — eta shotti onjay.`,
            `Ei rokhom byapaar konar na konar ga jhaliye diite pare.`,
            `Eta niey ragee howa bilkul thik.`,
        ],
        tired: [
            `Ei klanti shudhu ghum theke thik hoy na.`,
            `Tumi onek dhin dhore onek kichu sambhalacho.`,
            `Eto shab niey energy kom hobe eita to bujhaa jaay.`,
            `Ei rokhom thakaa aaste aaste joma hoy, tarpor ekdine laage.`,
            `Tumi eta niey thaka thakte paro — seta thik.`,
            `Eta asol rkhom nik hoe jaoa, shudhu thakaan noy.`,
        ],
        okay: [
            `Aro ektu bolo.`,
            `Ki hochhe ektu bolbe?`,
            `Ekhon tomar modhye shobcheye beshi ki bose ache?`,
            `Ekhon mathay shobcheye boro kotha ta ki?`,
        ],
    };

    const carryValidationsBn = [
        `Eta ekhono tomar shathe ache — ami sheta anubhob korte parchi.`,
        `Mone hocche eta ekhono settle hoyeni, ar sheta bujhaa jaay.`,
        `Tumi ekhono eta r maazhkhane aacho, tai na?`,
        `Eta tomar chorhte diche na. Aro ektu ei shathe thaki.`,
        `Eta niey kichhu baar baar phire aase tomar kachhe.`,
    ];

    const validationsTa: Record<typeof signal, string[]> = {
        sad: [
            `Idhu romba vedanayaa irukku.`,
            `Indha maadhiri vali thane thane thedhi kidaikkaadhu.`,
            `Nee idha vedutthukittu irukkaayaa, enna dukham.`,
            `Idhu nijamaa kashtam — konjam illai, romba.`,
            `Nee feel panradhu romba natural.`,
            `Nee idha deserve panna maattai.`,
        ],
        anxious: [
            `Un manas romba vegama paravikalamma irukku.`,
            `Indha maadhiri pressure orey kashtam.`,
            `Ippadi irundha edge aa feel panna romba saadharanam.`,
            `Orey nerathula indha uncertainty teesukovadam kashtam.`,
            `Idhai pathi anxious aa irukka romba manidhana prathikiriyai.`,
            `Un nervous system ondhira nijama nadhakkara visayathai pathi react pannudhu.`,
        ],
        angry: [
            `Indha koabam romba puriyudhu.`,
            `Idhu nija visayam — indha frustration theveeyam.`,
            `Naanum adhey maari feel pannirupen.`,
            `Aama — idhu nijamaa anjaabu.`,
            `Indha maadhiri vishayam yaarkum kovam varum.`,
            `Idhai pathi kovam padadhu okay.`,
        ],
        tired: [
            `Indha thezippu thookkathaal maatrum sari aagaadhu.`,
            `Nee nalla kaalam dhara edhayum vaithu vandhai.`,
            `Itho daiyaa energy kumayudhe — enna panna poruvai.`,
            `Indha maadhiri thalivam mella jama aagi oru saariley varudhu.`,
            `Indha visayatthal thezittu irukkam okay.`,
            `Idhu asala reethi thadaipattadhu, vaazhkaiyil thezippu maatrum illai.`,
        ],
        okay: [
            `Konjam innum sollu.`,
            `Enna nadakkudhu konjam solluva?`,
            `Ippo unakku ullae romba weight aa irukkiradhu enna?`,
            `Ippo un manasula mukkiyama irukkira vishayam enna?`,
        ],
    };

    const carryValidationsTa = [
        `Idhu ekhanum unnoduye irukku — enakku theriyudhu.`,
        `Idhu innam settle aagala pola theriyudhu, adhu saradhaan.`,
        `Nee innam indha nduile irukke, illaiya.`,
        `Idhu unnai vidalai. Konjam nera idhuoduve irundiduvom.`,
        `Indha vishayathal oru vidam baar baar thirumbi varudhu.`,
    ];

    const validationsTe: Record<typeof signal, string[]> = {
        sad: [
            `Idi nijamga chaala noppiga undi.`,
            `Ee rakamaina noppi tananukune thaggadu.`,
            `Nuvvu idi vedutunnanduku naaku dukkhanga undi.`,
            `Idi nijamga kashtam — konjam kaadu, chaala.`,
            `Nuvvu feel avutunnattu nijamgane artham avutondi.`,
            `Nuvvu dee deserve cheyyadhu.`,
        ],
        anxious: [
            `Manas chaala veganga parigettunnattu anipistundi.`,
            `Ee rakamaina tension inside nundi chaala ashaantiga untundi.`,
            `Ee saaye edge ga feel aavadaniki reason undi.`,
            `Okasaari inta uncertainty teesukovadam chaala kashtam.`,
            `Deenikosam anxious ga undadam chaala manavadam.`,
            `Nee nervous system nijamayna vishayaaniki respond avutundi.`,
        ],
        angry: [
            `Ee kopam nijamga artham avutondi.`,
            `Ikkade nijamayna vishayam jarigindi — ee frustration valid.`,
            `Nenu kuda ala feel ayye vaadini.`,
            `Avunu — idi nijamga anyaayam.`,
            `Ee rakamaina vishayam evarikaina kashtam ga anipistundi.`,
            `Deekosam kopanga undadam okay.`,
        ],
        tired: [
            `Ee ayaasam nidra tho maatrame poledhu.`,
            `Nuvvu chaala kaalam nundi chaala meeru moshteesaaredi.`,
            `Inta load undaga energy thaggadanikee artham undi.`,
            `Ee tiredness mellaga perugutundi, apudu okkaasaari gelustundi.`,
            `Idani vaalla ayyipoyindu — adhi okay.`,
            `Idi nijamaina depletion, kevaalam nidra raakapovadam kaadu.`,
        ],
        okay: [
            `Konchem inka cheppu.`,
            `Em jarugutundo konchem chepthava?`,
            `Ippudu nee lo ekkuvaga bharam ga anipistondi enti?`,
            `Ippudu nee manasulo mukhyamaina vishayam enti?`,
        ],
    };

    const carryValidationsTe = [
        `Idi ippudu kuda nee tho undi — naaku ardham avutondi.`,
        `Idi ippudu settle kaaledu ani anipistundi, adhi sahajanme.`,
        `Nuvvu ippudu kuda idhi madhyalo unnav, kaadu aa?`,
        `Idi nee vaadalaadaa. Inkaa konjam sepu deenitho uundama.`,
        `Oka vidhanga idi nee daggara marchikochheenu.`,
    ];

    const reflectLinesEn = [
        keyTopic ? `You mentioned ${keyTopic} — what part of that feels the most pressing right now?` : `What part of this is sitting with you most right now?`,
        `What's the piece of this that feels hardest to let go of?`,
        `If you had to pick just one thing that's bothering you most — what would it be?`,
        `What do you wish felt different about this situation?`,
        `What's the part of this that's been hardest to say out loud?`,
    ];

    const reflectLinesHi = [
        keyTopic ? `Tumne ${keyTopic} ki baat ki — abhi us mein sabse zyada kya daba raha hai?` : `Is mein abhi sabse zyada kya mehsoos ho raha hai?`,
        `Isme sabse zyada uncomfortable kya lag raha hai?`,
        `Agar ek hi cheez chunni ho jo sabse zyada pareshaan kar rahi ho — woh kya hogi?`,
        `Tum chahte ho is situation mein kya alag hota?`,
    ];

    const reflectLinesBn = [
        keyTopic ? `Tumi ${keyTopic} er kotha bollecho — seta r modhye ekhon shobcheye ta ki lagchhe?` : `Ei bishoy ta r modhye ekhon shobcheye beshi ki mone hochhe?`,
        `Eitar modhye shobcheye beshi uncomfortable ki lagchhe?`,
        `Jodi ekta jinish cholte hoy je shobcheye beshi bhasachhe — seta ki?`,
        `Tumi chaite e obostha ta kivabe alada hoto?`,
    ];

    const nextStepLinesEn = [
        `We can keep talking through this, or find one small thing to try — whichever feels right.`,
        `Some people need to say it all out loud first. Others want a plan. Where are you at?`,
        `We can keep unpacking this, or find one small move. What feels more useful right now?`,
        `I'm with you on this — whether that's talking it through or finding something concrete to do next.`,
    ];

    // Listening-only extras — used when the user is venting.
    // Statements only, no questions, no binary choices.
    const listeningOnlyExtrasEn = [
        `You don't have to figure this out right now.`,
        `I'm not going anywhere. Say as much or as little as you need.`,
        `You're allowed to feel all of this.`,
        `There's no right way to process this — just keep going.`,
        `You don't have to wrap this up neatly.`,
    ];

    const listeningOnlyExtrasHi = [
        `Abhi ise figure out karne ki zaroorat nahi.`,
        `Main yahin hoon. Jitna chahte ho, utna bolo — zyada ya kam.`,
        `Tum yeh sab feel kar sakte ho — koi baat nahi.`,
        `Ise neatly wrap up karne ki koi zaroorat nahi.`,
    ];

    const listeningOnlyExtrasBn = [
        `Ekhon eta figure out korte hobe na.`,
        `Ami ekhane achi. Jotota ichha hoy bolo — beshi na kama.`,
        `Tumi shob kichu feel korte paro — kono problem nei.`,
        `Eta neat kore wrap up korte hobe na.`,
    ];

    const listeningOnlyExtrasTa = [
        `Ippovum idha figure out panna vendam.`,
        `Naan engum poga matten. Venum pothu bol — zyada illai kammiya.`,
        `Nee feel panra yellam feel pannalam — paravaillai.`,
        `Idha neatly wrap up panna vendam illai.`,
    ];

    const listeningOnlyExtrasTe = [
        `Ippudu dhinni figure out cheyaalsina avasaram ledu.`,
        `Nenu ikkade unnaanu. Yekkuva alleda kammu alleda cheppukundu.`,
        `Nuvvu anni feel avvadam okay — tappu ledu.`,
        `Idi neat ga wrap up cheyyaalsina avasaram ledu.`,
    ];

    const nextStepLinesHi = [
        `Tumhe abhi comfort chahiye, clarity, ya next step?`,
        `Tum isse baat karke halka karna chahte ho, ya kuch practical next karna hai?`,
        `Kya isse khol kar dekhna madad karega, ya ek chhota action chunna?`,
        `Hum tumhari feeling par dhyan dein, ya agla kya kar sakte ho us par?`,
    ];

    const nextStepLinesBn = [
        `Ekhon tomar comfort dorkar, clarity, na ekta next step?`,
        `Tumi eta bole halka korte chao, na porer practical kichhu korte chao?`,
        `Eta ektu khule dekhle bhalo hobe, na ekta chhoto action neowa bhalo?`,
        `Amra tomar feeling e focus korbo, na porer ki korte paro setay?`,
    ];

    const extrasByToneEn: Record<LocalResponseTone, string[]> = {
        calm: [
            ``,
            `We can stay with one part for now.`,
            `No need to rush the whole thing.`,
            `We can keep this steady without forcing it.`,
        ],
        supportive: [
            ``,
            `You do not have to carry the whole weight at once.`,
            `We can stay with what feels heaviest first.`,
            `It is okay if this still feels messy.`,
        ],
        practical: [
            ``,
            `Let's only look at what matters first.`,
            `We can keep this workable.`,
            `One useful piece is enough for now.`,
        ],
        coach: [
            ``,
            `Let's find the most workable part first.`,
            `We only need one steady move right now.`,
            `You do not need to untangle everything at once.`,
        ],
        "gentle-humor": [
            ``,
            `We can keep this a little lighter without ignoring it.`,
            `One small shift is enough for now.`,
            `I'm still right here with you.`,
        ],
        direct: [
            ``,
            `Let's keep this clear.`,
            `We can deal with one real part at a time.`,
            `Only the next useful piece matters right now.`,
        ],
    };

    const carryExtrasEn: Record<LocalResponseTone, string[]> = {
        calm: [`We do not have to force this anywhere yet.`, `We can just stay with it for a moment.`],
        supportive: [`You do not have to explain it perfectly right now.`, `I'm still here with you in it.`],
        practical: [`We can keep this simple for now.`, `We only need the next clear piece, not the whole answer.`],
        coach: [`We can steady this before doing anything else.`, `One grounded step later is enough.`],
        "gentle-humor": [`We can keep this soft without making it heavy-er.`, `No need to wrestle the whole thing right now.`],
        direct: [`Let's not overcomplicate it right now.`, `We can stay with the real part first.`],
    };

    const extrasByToneHi: Record<LocalResponseTone, string[]> = {
        calm: [
            ``,
            `Abhi sirf ek hissa pakad kar chal sakte hain.`,
            `Puri baat ko ek saath sambhalne ki jaldi nahi hai.`,
            `Ise bina force kiye steady rakha ja sakta hai.`,
        ],
        supportive: [
            ``,
            `Tumhe sab kuch ek saath uthana nahi hai.`,
            `Jo sabse bhaari lag raha hai, pehle usi ke saath reh sakte hain.`,
            `Agar sab kuch abhi bhi uljha lag raha hai, tab bhi theek hai.`,
        ],
        practical: [
            ``,
            `Chalo pehle wahi dekhte hain jo sabse zaroori hai.`,
            `Ise manageable rakh sakte hain.`,
            `Abhi ek kaam ki cheez dekhna kaafi hai.`,
        ],
        coach: [
            ``,
            `Chalo pehle sabse workable hissa dhoondte hain.`,
            `Abhi sirf ek steady move kaafi hai.`,
            `Tumhe sab kuch ek saath suljhana nahi hai.`,
        ],
        "gentle-humor": [
            ``,
            `Ise halka rakh sakte hain bina ignore kiye.`,
            `Abhi ek chhota shift kaafi hai.`,
            `Main yahin hoon tumhare saath.`,
        ],
        direct: [
            ``,
            `Chalo ise saaf rakhte hain.`,
            `Hum ek real hissa ek baar mein dekh sakte hain.`,
            `Abhi bas agla useful hissa kaafi hai.`,
        ],
    };

    const carryExtrasHi: Record<LocalResponseTone, string[]> = {
        calm: [`Abhi ise kahin dhakelne ki zarurat nahi hai.`, `Hum bas thodi der iske saath reh sakte hain.`],
        supportive: [`Tumhe ise perfectly samjhana abhi zaruri nahi hai.`, `Main abhi bhi tumhare saath hoon isme.`],
        practical: [`Abhi ise simple rakhte hain.`, `Humein poora jawab nahi, bas agla saaf hissa dekhna hai.`],
        coach: [`Kuch karne se pehle ise steady kar lete hain.`, `Baad mein ek grounded step kaafi hoga.`],
        "gentle-humor": [`Ise halka rakh sakte hain bina uljhaaye.`, `Abhi poori kushti ladne ki zarurat nahi hai.`],
        direct: [`Abhi ise overcomplicate nahi karte.`, `Pehle real hissa pakadte hain.`],
    };

    const extrasByToneBn: Record<LocalResponseTone, string[]> = {
        calm: [
            ``,
            `এখন শুধু একটা অংশ ধরে থাকলেই হবে।`,
            `সবকিছু একসাথে সামলানোর তাড়া নেই।`,
            `এটাকে জোর না করে steady রাখা যায়।`,
        ],
        supportive: [
            ``,
            `তোমাকে সবটা একসাথে বয়ে নিতে হবে না।`,
            `যেটা সবচেয়ে ভারী লাগছে, আগে সেটার সঙ্গেই থাকি।`,
            `সবকিছু এখনও এলোমেলো লাগলে তাতেও সমস্যা নেই।`,
        ],
        practical: [
            ``,
            `চলো আগে সবচেয়ে দরকারি অংশটাই দেখি।`,
            `এটাকে manageable রাখা যাবে।`,
            `এখন একটা কাজের জিনিস ধরলেই যথেষ্ট।`,
        ],
        coach: [
            ``,
            `চলো আগে সবচেয়ে workable অংশটা খুঁজি।`,
            `এখন শুধু একটা steady move হলেই হবে।`,
            `সবটা একসাথে মেলাতে হবে না।`,
        ],
        "gentle-humor": [
            ``,
            `এটাকে হালকা রাখা যায়, তবু সিরিয়াস থাকাও যাবে।`,
            `এখন একটা ছোট shift হলেই যথেষ্ট।`,
            `আমি এখানেই আছি তোমার সাথে।`,
        ],
        direct: [
            ``,
            `চলো এটাকে পরিষ্কার রাখি।`,
            `একবারে একটা বাস্তব অংশ ধরা যায়।`,
            `এখন শুধু পরের useful অংশটাই যথেষ্ট।`,
        ],
    };

    const carryExtrasBn: Record<LocalResponseTone, string[]> = {
        calm: [`এটাকে এখনই কোথাও ঠেলে নিতে হবে না।`, `আমরা একটু সময় শুধু এটার সাথেই থাকতে পারি।`],
        supportive: [`এখনই একদম ঠিক করে বোঝাতে হবে না।`, `আমি এখনও তোমার সাথেই আছি এতে।`],
        practical: [`এখন এটাকে simple রাখি।`, `পুরো উত্তর না, শুধু পরের পরিষ্কার অংশটাই যথেষ্ট।`],
        coach: [`কিছু করার আগে এটাকে steady করি।`, `পরে একটা grounded step হলেই চলবে।`],
        "gentle-humor": [`এটাকে হালকা রাখা যায়, বেশি জট না বাড়িয়ে।`, `এখন পুরো কুস্তি লড়ার দরকার নেই।`],
        direct: [`এখন এটাকে overcomplicate না করি।`, `আগে বাস্তব অংশটাই ধরি।`],
    };

    const extrasByToneTa: Record<LocalResponseTone, string[]> = {
        calm: [
            ``,
            `Idha mellaga eduthukalam.`,
            `Avasaara padama polaam.`,
            `Idha soft aa steady aa vaikkalam.`,
        ],
        supportive: [
            ``,
            `Nee idhula thaniya illa.`,
            `Naan pakkathula irukken.`,
            `Idha mellaga eduthukalam.`,
        ],
        practical: [
            ``,
            `Idha step by step paathukalam.`,
            `Idha manageable aa vaikkalam.`,
            `Next chinna piece mattum paathaa pothum.`,
        ],
        coach: [
            ``,
            `Idha step by step paathukalam.`,
            `Next steady move ah kandupidikkalam.`,
            `Nee ellathayum ore nerathula solve panna vendiyadhu illa.`,
        ],
        "gentle-humor": [
            ``,
            `Idha konjam light aa gentle aa vechukkalam.`,
            `Avasaara illai — oru chinna step pothum.`,
            `Naan inge un kooda irukken.`,
        ],
        direct: [
            ``,
            `Idha simple aa vaikkalam.`,
            `Oru oru part aa handle pannalam.`,
            `Next clear step dhan ippo thevai.`,
        ],
    };

    const extrasByToneTe: Record<LocalResponseTone, string[]> = {
        calm: [
            ``,
            `Idi mellaga teesukovachu.`,
            `Avasaara padakunda veldaam.`,
            `Idi soft ga steady ga unchukundam.`,
        ],
        supportive: [
            ``,
            `Nuvvu indulo okkadive kaadu.`,
            `Nenu pakkane unnaanu.`,
            `Idi mellaga teesukovachu.`,
        ],
        practical: [
            ``,
            `Idi step by step chuddam.`,
            `Idi manageable ga unchukundam.`,
            `Next chinna piece meeda matrame chuddam.`,
        ],
        coach: [
            ``,
            `Idi step by step chuddam.`,
            `Next steady move kanukundam.`,
            `Nuvvu anni okesari solve cheyalsina avasaram ledu.`,
        ],
        "gentle-humor": [
            ``,
            `Idi konchem light ga gentle ga teesukovachu.`,
            `Avasaara ledu — oka chinna step chaalu.`,
            `Nenu ikkade nee tho unnaanu.`,
        ],
        direct: [
            ``,
            `Idi simple ga unchukundam.`,
            `Oka oka part ni handle cheddam.`,
            `Ippudu next clear step chaalu.`,
        ],
    };

    // ─── Gujarati (gu) ─────────────────────────────────────────────────────────
    const openersByToneGu: Record<LocalResponseTone, string[]> = {
        calm: [
            `Hu tara sathe chhu.`,
            `Chalo ane aaramthi joi aiye.`,
            `Saru chhe. Hum ek sathe laishu.`,
            `Hu tara sathe chhu. Ek ek vastu joi aiye.`,
        ],
        supportive: [
            `Hu tara sathe chhu.`,
            `Hu sanju chhu.`,
            `Saru — hu ahiya chhu.`,
            `Saru thayun ke tune kahu.`,
            `Samajh gayo.`,
        ],
        practical: [
            `Saru chhe. Chalo saf nazar e joi aiye.`,
            `Samajh gayo. Ek ek step e laiye.`,
            `Chalo joi aiye shu shu important chhe.`,
            `Hu sathe chhu. Sadu rakhi aiye.`,
        ],
        coach: [
            `Saru — hu sathe chhu. Pehla ane steady kariye.`,
            `Samajh gayo. Ase ek ek step e karshu.`,
            `Chalo thoda dhima thai ane footing pakdi aiye.`,
            `Hu sanju chhu. Ek ek bhag joi aiye.`,
        ],
        "gentle-humor": [
            `Saru — hu ahiya chhu.`,
            `Hmm, hu sanju chhu.`,
            `Samajh gayo. Hu sathe chhu.`,
            `Chalo, ane thoda halku banavi aiye — ek chhoto step karine.`,
        ],
        direct: [
            `Saru. Hu sathe chhu.`,
            `Chalo seedhu joi aiye.`,
            `Samajh gayo. Stable rakhi aiye.`,
            `Hu sanju chhu. Mudda par aaviye.`,
        ],
    };

    const validationsGu: Record<typeof signal, string[]> = {
        sad: [
            `Aa sach mein khub dard aape chhe.`,
            `Aa tarah no dard pote pote thik nathi thaato.`,
            `Mane dukh chhe ke tu aana maanthi passo thay chhe.`,
            `Aa sach mein kashthu chhe — thodu nahi, bahut.`,
            `Tu je feel kare chhe, tenu pooru karan chhe.`,
            `Tu aa deserve nahi karato.`,
        ],
        anxious: [
            `Lage chhe dimaag puri speed mae chale chhe.`,
            `Aa tarah nu pressure andarathi khub thakavnaru chhe.`,
            `Aa sab mae edge feel karavun bilkul samjhay chhe.`,
            `Ek saate etni badhi uncertainty sambhalvun khub aakhrun chhe.`,
            `Aa baraama anxious rehvun mananviy pratikriya chhe.`,
            `Taro nervous system koi asali baat prati react kare chhe.`,
        ],
        angry: [
            `Aa gusse bilkul samjhay chhe.`,
            `Koi asali cheez thai chhe — aa frustration yogya chhe.`,
            `Hoon pann evi feel kart.`,
            `Haa — aa sach mein anyaay chhe.`,
            `Aa tarah ni vaat koneyne bhi andar tak lagti chhe.`,
            `Aa maTe gusse thavun bilkul theek chhe.`,
        ],
        tired: [
            `Aa thakan sirf nindathi thik nathi thavati.`,
            `Tu onek samay thi ghanu badhu sambhali rahyo chhe.`,
            `Aa badha sathe energy ghatti hoy tenu karan samjhay chhe.`,
            `Aa thakan aaste aaste jami jaay chhe, pachhi ek saath laage chhe.`,
            `Tu athi thaki jaay tenu pooru haq chhe.`,
            `Aa sach mein ni shaktinu khaali thavun chhe, sirf thakan nahi.`,
        ],
        okay: [
            `Vadhare keh.`,
            `Shu thayi rahyun chhe?`,
            `Abhi tamne andar shu vadhu vaagtu chhe?`,
            `Abhi dimag ma moti vaat shu chhe?`,
        ],
    };

    const carryValidationsGu = [
        `Aa hua tara sathe chhe — hoon mahesus kari shakun chhu.`,
        `Lage chhe aa hun ye settle nathi thayun, ane aa samjhay chhe.`,
        `Tu hun pann aa ni vaach mein chhe, nahi?`,
        `Aa tane chhodte nathi. Thodi var ane sathe rahiye.`,
        `Aam kaik aa tara mate baar baar pachi aave chhe.`,
    ];

    const extrasByToneGu: Record<LocalResponseTone, string[]> = {
        calm: [
            ``,
            `Haji sirf ek bhag pakadhine chal shakiye.`,
            `Badhi vat ek sathe sambhalvani jaldi nathi.`,
            `Ane bina force karya steady rakhay chhe.`,
        ],
        supportive: [
            ``,
            `Tumari bhari vaatne thodi vaar baaju rakhi shakay.`,
            `Jo shu kaafi bhari laage chhe, pehla tenaa sathe rehiye.`,
            `Je abhi pann uljhelu laage, toh pann saru chhe.`,
        ],
        practical: [
            ``,
            `Pehla jo shu zaroori chhe te joi aiye.`,
            `Ane manageable rakhay chhe.`,
            `Abhi ek kaam ni vaat jo puri chhe.`,
        ],
        coach: [
            ``,
            `Chalo pehla shu workable chhe te dhundhi aiye.`,
            `Abhi faqt ek steady move kaafi chhe.`,
            `Bhadhu ek sathe suljhavanu nathi.`,
        ],
        "gentle-humor": [
            ``,
            `Ane halku rakhi aiye ignore karyaa vina.`,
            `Abhi ek chhoto shift kaafi chhe.`,
            `Hu hun ahiya j chhu tara sathe.`,
        ],
        direct: [
            ``,
            `Chalo saafu rakhi aiye.`,
            `Ek vaaste ek real bhag joi shakiye.`,
            `Abhi faqt aglu useful bhag kaafi chhe.`,
        ],
    };

    const carryExtrasGu: Record<LocalResponseTone, string[]> = {
        calm: [`Abhi ise kahin dhakelne ni zarur nathi.`, `Hum bas thodi var eni sathe rahi shakiye.`],
        supportive: [`Tune ine perfectly samjhavanu abhi zaruri nathi.`, `Hu hun abhi pann tara sathe chhu.`],
        practical: [`Abhi ine simple rakhiye.`, `Pooru jawab nahi, bas aglu saafu bhag joie.`],
        coach: [`Kuch karva thi pehla ine steady kariye.`, `Baad ma ek grounded step kaafi thashe.`],
        "gentle-humor": [`Ine halka rakhi shakiye bina uljhavyaa.`, `Abhi bhadhi kushti ladva ni zarur nathi.`],
        direct: [`Abhi ine overcomplicate nathi karva.`, `Pehla real bhag pakadiye.`],
    };

    const reflectLinesGu = [
        keyTopic ? `Tumne ${keyTopic} ni vaat ki — aa maa shu sabse zyada tadke chhe?` : `Aa maa shu shu sabse zyada bhari laage chhe abhi?`,
        `Aamath shu sabse zyada uncomfortable chhe?`,
        `Jau toh ek j vastu chunni hoy jo tujhe vadhu pareshaani kare — shu hase?`,
        `Tu shun chaahe chhe aa situation ma alag hotu?`,
    ];

    const nextStepLinesGu = [
        `Aage vaatoo karti rehiye, ke ek chhoti vastu try kariye — jo tane sahi laage te.`,
        `Koi pehla badhu bol de chhe, koi plan joie chhe. Tu kyaa chhe abhi?`,
        `Ane kholta rehiye, ke ek chhoto kadam. Shu vadhu useful laage abhi?`,
        `Hu tara sathe chhu — bolti rehiye ke kainchuk concrete kariye.`,
    ];

    const listeningOnlyExtrasGu = [
        `Aa figure out karvani abhi koi jaldhi nathi.`,
        `Tu badhu j feel kari shake chhe — koi vaa nathi.`,
        `Hu ithey chhu. Je joiye te bol — vadhu ke ochhun.`,
        `Tene neatly wrap up karvani zaroor nathi.`,
    ];

    // ─── Punjabi (pa) ─────────────────────────────────────────────────────────
    const openersByTonePa: Record<LocalResponseTone, string[]> = {
        calm: [
            `Main tere naal haan.`,
            `Chalo ise dheeray naal vekhiye.`,
            `Theek aa. Ise araam naal laiye.`,
            `Main tere naal haan. Ik ik hissa vekhiye.`,
        ],
        supportive: [
            `Main tere naal haan.`,
            `Main sun raha haan.`,
            `Theek aa — main ithey haan.`,
            `Changa kita ke dassia.`,
            `Samajh gaya.`,
        ],
        practical: [
            `Theek aa. Chalo ise saaf nazar naal vekhiye.`,
            `Samajh gaya. Ise ik ik step wich laiye.`,
            `Chalo sambhaalie te vekhiye ki sabton zaruri aa.`,
            `Main saath haan. Ise simple rakhiye.`,
        ],
        coach: [
            `Theek aa — main saath haan. Pehlan ise steady kariye.`,
            `Samajh gaya. Ase ise step by step kaddhange.`,
            `Chalo thoda dhimi ho ke footing pakdiye.`,
            `Main sun raha haan. Ik ik hissa vekhiye.`,
        ],
        "gentle-humor": [
            `Theek aa — main ithey haan.`,
            `Hmm, main sun raha haan.`,
            `Samajh gaya. Main saath haan.`,
            `Chalo, ise thoda halka karie — ik chhoti step karke.`,
        ],
        direct: [
            `Theek aa. Main saath haan.`,
            `Chalo ise seedha vekhiye.`,
            `Samajh gaya. Ise stable rakhiye.`,
            `Main sun raha haan. Seedha mudde te aaiye.`,
        ],
    };

    const validationsPa: Record<typeof signal, string[]> = {
        sad: [
            `Eh sach mein bahut takleef denda aa.`,
            `Iss tarah di takleef apne aap theek nahi hundi.`,
            `Afsos aa ke tu iss chon lann raha aa.`,
            `Eh sach mein kaafar kadd hai — thoda nahi, bahut zyada.`,
            `Jo tu feel kar raha aa, oh bilkul samajh aunda aa.`,
            `Tu ee deserve nahi karda si.`,
        ],
        anxious: [
            `Laggda aa dimaag poori speed wich chal raha aa.`,
            `Iss tarah da pressure andarun khub thaka denda aa.`,
            `Iss sab wich edge feel karna bilkul sadharan aa.`,
            `Ikko saath itni uncertainty sambhalna bahut aakhda aa.`,
            `Is baaray anxious rehna manikhee pratikriya aa.`,
            `Tera nervous system kisi asli cheez nu respond kar raha aa.`,
        ],
        angry: [
            `Eh gussa bilkul samajh aunda aa.`,
            `Koi asli gall hoi aa — eh frustration sahih aa.`,
            `Mainu vi ohi feel hunda.`,
            `Haan — eh sach mein nainsaafi aa.`,
            `Iss tarah di gall kisi di vi skin de neeche jaa sakdi aa.`,
            `Is te gusse hona bilkul theek aa.`,
        ],
        tired: [
            `Eh thakaan sirf neend naal theek nahi hundi.`,
            `Tu kaafi chirsay ton bahut kuch sambhaal raha aa.`,
            `Ete sab nachche energy ghatt hona samajh aunda aa.`,
            `Eh thakan dhirey dhirey jama hundi aa, phir ik saath laggdi aa.`,
            `Tenu isse thakeyan da haq aa.`,
            `Eh sach mein ni shakti khatam hona aa, sirf thakaan nahi.`,
        ],
        okay: [
            `Thoda hor dass.`,
            `Ki ho raha aa?`,
            `Abhi tere andar sabton bhari ki gall aa?`,
            `Abhi dimag wich sabton vaddi gall ki aa?`,
        ],
    };

    const carryValidationsPa = [
        `Eh hali vi tere naal aa — main mehsoos kar sakda haan.`,
        `Laggda aa eh hali settle nahi hoi, te eh samajh aunda aa.`,
        `Tu hali vi iss de vich hain, nahi?`,
        `Eh tenu chhadde nahi. Thodi der hor ede naal rahiye.`,
        `Iss baaray kuch baar baar piche aaunda aa tere layi.`,
    ];

    const extrasByTonePa: Record<LocalResponseTone, string[]> = {
        calm: [
            ``,
            `Abhi sirf ik hissa pakad ke chal sakde haan.`,
            `Sab kuch ik saath sambhalan di jaldi nahi.`,
            `Ise bina force kite steady rakhaya ja sakda aa.`,
        ],
        supportive: [
            ``,
            `Tenu sab kuch ik saath chukna nahi.`,
            `Jo sabton bhaari lagda aa, pehlan usi naal rehiye.`,
            `Je sab kuch abhi vi uljhya lagda aa, tenu vi theek aa.`,
        ],
        practical: [
            ``,
            `Chalo pehlan jo sabton zaruri aa uh vekhiye.`,
            `Ise manageable rakhya ja sakda aa.`,
            `Abhi ik kaam di gall kaafi aa.`,
        ],
        coach: [
            ``,
            `Chalo pehlan sabton workable hissa dhundhiye.`,
            `Abhi sirf ik steady move kaafi aa.`,
            `Tenu sab kuch ik saath suljhana nahi.`,
        ],
        "gentle-humor": [
            ``,
            `Ise halka rakh sakde haan bina ignore kite.`,
            `Abhi ik chhoti shift kaafi aa.`,
            `Main ithey haan tere naal.`,
        ],
        direct: [
            ``,
            `Chalo ise saaf rakhiye.`,
            `Hum ik real hissa ik vaar dekh sakde haan.`,
            `Abhi sirf agla useful hissa kaafi aa.`,
        ],
    };

    const carryExtrasPa: Record<LocalResponseTone, string[]> = {
        calm: [`Abhi ise kahin dhakelne di lodd nahi.`, `Assi bas thodi der edi naal reh sakde haan.`],
        supportive: [`Tenu ise perfectly samjhana abhi zaruri nahi.`, `Main abhi vi tere naal haan eis wich.`,],
        practical: [`Abhi ise simple rakhiye.`, `Poora jawab nahi, bas agla saaf hissa vekhna aa.`],
        coach: [`Kuch karan ton pehlan ise steady kar laiye.`, `Baad wich ik grounded step kaafi hoga.`],
        "gentle-humor": [`Ise halka rakh sakde haan bina uljhaye.`, `Abhi poori kushti ladne di lodd nahi.`],
        direct: [`Abhi ise overcomplicate nahi kariye.`, `Pehlan real hissa pakdiye.`],
    };

    const reflectLinesPa = [
        keyTopic ? `Tune ${keyTopic} di gall kiti — us wich sab ton zyada ki dab raha aa?` : `Eis wich sab ton zyada ki mehsoos ho raha aa abhi?`,
        `Eis wich sabton beshi uncomfortable ki lagda aa?`,
        `Jou ik hi cheez chunnde jo sabton zyada pareshaan kare — oh ki hundi?`,
        `Tu chaahunda aa is situation wich ki different hunda?`,
    ];

    const nextStepLinesPa = [
        `Aage gall kardi rehiye, ya ik chhoti cheez try kariye — jo tenu sahi laage.`,
        `Koi pehlan sab bol denda aa, koi nu plan chahida. Tu kidhe aa abhi?`,
        `Ise kholta rehiye, ya ik chhota kadam. Shu vadhu useful laage abhi?`,
        `Main tere naal haan — bolda reh ya kuch concrete karie.`,
    ];

    const listeningOnlyExtrasPa = [
        `Hune ise figure out karne di koi zaroorat nahi.`,
        `Tu sab kuch feel kar sakda aa — koi galat nahi.`,
        `Main ithey haan. Je marzi bol — zyada ya thoda.`,
        `Ise neatly wrap up karne di koi gall nahi.`,
    ];

    // ─── Kannada (kn) ─────────────────────────────────────────────────────────
    const openersByToneKn: Record<LocalResponseTone, string[]> = {
        calm: [
            `Naanu ninna jote iddene.`,
            `Idannu mellage nodona.`,
            `Sari. Idannu aaramaagi teedukonona.`,
            `Naanu ninna jote iddene. Ondondu bhagavagi nodona.`,
        ],
        supportive: [
            `Naanu ninna jote iddene.`,
            `Naanu kelutiddene.`,
            `Sari — naanu illi iddene.`,
            `Neevu heltiru, adhu olledhu.`,
            `Artha aagide.`,
        ],
        practical: [
            `Sari. Idannu sparshtavaagi nodona.`,
            `Artha aagide. Idannu step by step teedukonona.`,
            `Idannu steady maadi mukhyavaada vishaya nodona.`,
            `Naanu ninna jote iddene. Idannu sarala maadona.`,
        ],
        coach: [
            `Sari — naanu ninna jote iddene. Munche idannu steady maadona.`,
            `Artha aagide. Idannu step by step nodona.`,
            `Konjam mellage hogi footing hidukona.`,
            `Naanu kelutiddene. Ondondu bhagavagi nodona.`,
        ],
        "gentle-humor": [
            `Sari — naanu illi iddene.`,
            `Hmm, naanu kelutiddene.`,
            `Artha aagide. Naanu ninna jote iddene.`,
            `Idannu konjam light aagi teedukonona — ondu chikka step allige.`,
        ],
        direct: [
            `Sari. Naanu ninna jote iddene.`,
            `Idannu nera nodona.`,
            `Artha aagide. Idannu steady aagi irisi.`,
            `Naanu kelutiddene. Suttamuttinu hogade point ge barona.`,
        ],
    };

    const validationsKn: Record<typeof signal, string[]> = {
        sad: [
            `Idu nijavaagiyoo novu kodutte.`,
            `Ee tarahad novu thanage thanage hogi hoguvadiilla.`,
            `Neevu iddannu hegediruvudakku naakku dukha aagide.`,
            `Idu nijavaadanu kashta — swalee alla, tumba.`,
            `Neevu feel aagattiruvadudu sahajavendra.`,
            `Neevu iddannu deserve maadiraliilla.`,
        ],
        anxious: [
            `Manas tumba vegaadi parigeduttide anisutte.`,
            `Ee tarahad pressure olagininda tumba ashaantiga maaduttade.`,
            `Ella nodu edde meele feel aaguvadudu tumba sahajavendra.`,
            `Ondu saarigu ivvali uncertainty hididiruvadudu kashtavaagide.`,
            `Iddakkaagi anxious aaguvadudu manujara pratikriye.`,
            `Nina nervous system yaavude nijavaada vishayakke respond aaguttide.`,
        ],
        angry: [
            `Ee kopa nijavaagi arthagoopatte.`,
            `Illi nijavaada vishaya nadittu — ee frustration sari.`,
            `Naanuoo haagehii feel aaguttiidde.`,
            `Haudu — idu nijavaagi anyaaya.`,
            `Ee tarahad vishaya yaarigaadaru maidina keliyannu jaggutte.`,
            `Iddakkaagi kopagouvudadu okay.`,
        ],
        tired: [
            `Ee doni kevalavagiu nidreynda saraaguvudilla.`,
            `Neevu kaafi kaaladinda tumba yeladannu hidididhiri.`,
            `Iddella iruvaaga energy kumiduvadudu sahajavendra.`,
            `Ee thara doni melliga serkutte, naantara ondu saarigu adiresite.`,
            `Iddannu dhakkaagi iruvudakku nimage hakkide.`,
            `Idu nijavaagi bala kumiduvadudu, keval omme barada novu alla.`,
        ],
        okay: [
            `Konjam innu heli.`,
            `Enu aaguttide konjam helutteeraa?`,
            `Ippudu ninna olage tumba bhaaraagi iruvudu yenu?`,
            `Ippudu ninna manassalliruva mukhya vishaya yenu?`,
        ],
    };

    const carryValidationsKn = [
        `Idu ippudu ninna jote ide — naanu adu mahisuttiddene.`,
        `Idu ippudu settle aagillavaada eniste, aduu sahajavendre.`,
        `Neevu ippudu kuda iddara madhyeyalli idiraa.`,
        `Idu ninnanu bidaladilla. Konjam ine yella idara jote irona.`,
        `Iddara bagge yaavudo ondu baraabar baruttiruttade.`,
    ];

    const extrasByToneKn: Record<LocalResponseTone, string[]> = {
        calm: [
            ``,
            `Ippudu ondu bhagavannu maatrana hididi irona.`,
            `Ellavaannu ondu saarigu sambalisuvudakke avasaravilla.`,
            `Idannu olage thosikolaade steady aagi irisi.`,
        ],
        supportive: [
            ``,
            `Neevu iddannu ellava ondu saarigu hotti hoguva avasaravilla.`,
            `Tumba bharavaagide anta anisuvudannu munche nodona.`,
            `Ippudu ella ella ulalaadittu hogi iddare, adu sari.`,
        ],
        practical: [
            ``,
            `Munche yenu mukhya adu nodona.`,
            `Idannu manageable aagi irisi.`,
            `Ippudu ondu useful bhaga saalade.`,
        ],
        coach: [
            ``,
            `Munche yenu kelsaadade ide adu kudukona.`,
            `Ippudu ondu steady move maatrana saalade.`,
            `Neevu ellava ondu saarigu helabeku anta illa.`,
        ],
        "gentle-humor": [
            ``,
            `Idannu ignore maadade konjam light aagi teedukonona.`,
            `Ippudu ondu chikka shift saalade.`,
            `Naanu illi ninna jote iddene.`,
        ],
        direct: [
            ``,
            `Idannu sparshta aagi irisi.`,
            `Ondu ondu real bhagavannu nodabahudu.`,
            `Ippudu munde useful bhaga maatrana beku.`,
        ],
    };

    const carryExtrasKn: Record<LocalResponseTone, string[]> = {
        calm: [`Ippudu idannu yaarigoo thosikolaada aasaravilla.`, `Naavuu koney koney idara jote irati irona.`],
        supportive: [`Neevu idannu perfectly samjhisabeku anta illa ippudu.`, `Naanu abhi ninna jote iddene.`],
        practical: [`Ippudu idannu simple aagi irisi.`, `Sampoorna uttara beda, munde sparshtavaada bhagavannu nodona.`],
        coach: [`Enu maaduvudakku munche idannu steady maadona.`, `Naantara ondu grounded step saalade.`],
        "gentle-humor": [`Idannu halka aagi irisi, tumba uljhi maadade.`, `Ippudu ellavannu oru saarigu helabeku anta illa.`],
        direct: [`Ippudu idannu overcomplicate maadabedi.`, `Munche real bhagavannu hidukona.`],
    };

    const reflectLinesKn = [
        keyTopic ? `Neevu ${keyTopic} bagge heldiru — adharalli ippudu yarenu koodu odaayittu?` : `Idrallu ippudu yarenu koodu bhaara aagi anisuttide?`,
        `Idrallu yaarvannu tumba uncomfortable aagi anisuttide?`,
        `Ondu maatrannu aayike maadidare yarenu koodu kashtapadisuttide — adhu yenu?`,
        `Ee sthithiyalli yarenu bere aagirali anta neevu baayalattu?`,
    ];

    const nextStepLinesKn = [
        `Maatanaadutta iru, illa ondu chikka kaelasa try maadona — yaarenu sariyaagide adannu.`,
        `Kelevarige modalige heli mugisabekaaguttade, kelevarige plan beku. Neevu elli iddira ippudu?`,
        `Idu belesi noduvudu, illa ondu chikka kadam. Yaarenu koodu upayogavaaguttade ippudu?`,
        `Naanu ninna jote iddene — helutta iru illava kainchuk concrete maadona.`,
    ];

    const listeningOnlyExtrasKn = [
        `Idu ippudu figure out maadabekaagilla.`,
        `Neevu ellavaanu feel aagabahudu — adhu sari.`,
        `Naanu illi iddene. Yaarenu heli — koodu illa kammi.`,
        `Idannu neat aagi wrap up maadabekaagilla.`,
    ];

    // ─── Malayalam (ml) ─────────────────────────────────────────────────────────
    const openersByToneMl: Record<LocalResponseTone, string[]> = {
        calm: [
            `Njaan ninnooppam undu.`,
            `Idi mellage nokkaam.`,
            `Sari. Idi mellage eettukol.`,
            `Njaan ninnooppam undu. Ore ore bhagamayi nokkaam.`,
        ],
        supportive: [
            `Njaan ninnooppam undu.`,
            `Njaan kekkunnundu.`,
            `Sari — njaan ippol unda.`,
            `Nee paranjathu nallathayi.`,
            `Manahsilaayi.`,
        ],
        practical: [
            `Sari. Idi vyakthamayi nokkaam.`,
            `Manahsilaayi. Idi step by step eettukol.`,
            `Idi steady aakki muhyamaya vishayam nokkaam.`,
            `Njaan koode undu. Idi saralamaakkaam.`,
        ],
        coach: [
            `Sari — njaan ninnooppam undu. Munpe idi steady aakkaam.`,
            `Manahsilaayi. Idi step by step nokkaam.`,
            `Konjam mellage poyittu footing kittaam.`,
            `Njaan kekkunnundu. Ore ore bhagamayi nokkaam.`,
        ],
        "gentle-humor": [
            `Sari — njaan ippol unda.`,
            `Hmm, njaan kekkunnundu.`,
            `Manahsilaayi. Njaan ninnooppam undu.`,
            `Idi konjam light aakki eettukol — oru chinna step aayi.`,
        ],
        direct: [
            `Sari. Njaan ninnooppam undu.`,
            `Idi nerey nokkaam.`,
            `Manahsilaayi. Idi steady aakki vekkunna.`,
            `Njaan kekkunnundu. Neri karyathilekku varaam.`,
        ],
    };

    const validationsMl: Record<typeof signal, string[]> = {
        sad: [
            `Idi nijamaayi valare veedhanadaaniyaanu.`,
            `Ee maadhiri novu thanaaye thane maaru milla.`,
            `Nee idi vedutthikkondirukkunnathu ennikku dukhamundu.`,
            `Idi nijamaayi kashtamaanu — konjam alla, valare.`,
            `Nee feel aakunnath saadharanamaaanu.`,
            `Nee idi deserve cheytha illa.`,
        ],
        anxious: [
            `Manassu valare vegathil paayunnathu pola.`,
            `Ee maadhiri tension ollilninnu valare ashaanthi undaakkunnu.`,
            `Ithallelam edge feel aavunnathu sahajamaaanu.`,
            `Onnu kondoru uncertainty pidichhuvekkunnath kashtamaanu.`,
            `Idi kurichu anxious aakunnath manushyate prathikriya.`,
            `Ninne nervous system entho nijamayullathinu respond aakkunnu.`,
        ],
        angry: [
            `Ee koppam nijamaayi artham varunnu.`,
            `Ithil nijamaayi oru visayam nannayi — ee frustration sari.`,
            `Njaaanum athupole feel aakumayirunnu.`,
            `Athe — idi nijamaayi anyaayam.`,
            `Ee maadhiri karyam aarkku aanu ullilekk kidakkaathe?`,
            `Iddathinu kooppadunnathu okay.`,
        ],
        tired: [
            `Ee madi nidra kondamatram maaru milla.`,
            `Nee nalla kaalam dhara orupaadu vechi nadinnittu.`,
            `Ithrallelam ondu energy thazhathil anubhavikkunnathu sahajam.`,
            `Ee maadhiri thallal padi padi koriyum, pinne okkaasaarattu adikkunnu.`,
            `Ithinal maribikkunathu ninnekku avakashamundu.`,
            `Idi nijamaayi shakthi theerunnathu, kevalavum urakkam varaathe alla.`,
        ],
        okay: [
            `Konjam koodi para.`,
            `Enthu nadakkunnu?`,
            `Ippol ninnil koodu bhaaram aayi thoannunnnathu enthanu?`,
            `Ippol ninte manassilulla muhyamaya vishayam enthanu?`,
        ],
    };

    const carryValidationsMl = [
        `Idi ippoluthe ninnoodu unde — njaan anubhavikkunnu.`,
        `Idi ippol settle aayilla ennaniisunnunu, adhu sahajamaanu.`,
        `Nee ippol kuda eedathu naduvillee, alla?`,
        `Idi ninne vittu pokunn illa. Oru nimisham koodi eedathu koode irikkaam.`,
        `Iddathi kurachu oru karyam baar baar ninakku thiriche varunnu.`,
    ];

    const extrasByToneMl: Record<LocalResponseTone, string[]> = {
        calm: [
            ``,
            `Ippol ore bhagam maathram nookunna.`,
            `Ella kaaryavum onnu kondu kazhikkanam enna avasaryamilla.`,
            `Idine mellage steady aakki vekkunna.`,
        ],
        supportive: [
            ``,
            `Nee yellaatum onnu kondu vekkaathe.`,
            `Athi bhaaram aayi thoannunnath, ath aadhyam nokkaam.`,
            `Ippol yellaatum kuttippidikkunnathupole thoannal, athu sari.`,
        ],
        practical: [
            ``,
            `Aadhyam enthu muhyamanu ath nokkaam.`,
            `Idine manageable aakki vekkunna.`,
            `Ippol oru useful bhagam maathram mathiyaakum.`,
        ],
        coach: [
            ``,
            `Aadhyam enthu pradhaanam ath nokkaam.`,
            `Ippol ore steady move maathram mathiyaakum.`,
            `Yellaatum onnu kondu solve cheyyaanam enna avasaryamilla.`,
        ],
        "gentle-humor": [
            ``,
            `Idine ignore cheyyaathe konjam light aakki nookaam.`,
            `Ippol oru chinna shift maathram mathiyaakum.`,
            `Njaan ippol ninnodoppam unda.`,
        ],
        direct: [
            ``,
            `Idine vyakthamayi vekkunna.`,
            `Ore ore real bhagam nokkaam.`,
            `Ippol munnilulla useful bhagam maathram mathiyaakum.`,
        ],
    };

    const carryExtrasMl: Record<LocalResponseTone, string[]> = {
        calm: [`Ippol idine evidekkum thosikaanum avasaryamilla.`, `Njaan nee thodum koodeyuntaakum.`],
        supportive: [`Nee idine ippol perfectly paryanum enna avasaryamilla.`, `Njaan ippol ninnodum koode undu.`],
        practical: [`Ippol idine simple aakki vekkunna.`, `Sariyaaya uttharam venda, munnilulla vyakthamaaya bhagam maathram nokkaam.`],
        coach: [`Enthenkilum cheyyunnadhin munpe idine steady aakkaam.`, `Pinnaale oru grounded step mathiyaakum.`],
        "gentle-humor": [`Idine halka aakki vekkunna, koottappeduthathe.`, `Ippol ella kaaryavum oru saari cheyyanam enna ille.`],
        direct: [`Ippol idine overcomplicate aakkathe.`, `Munpe real bhagam hidukkunna.`],
    };

    const reflectLinesMl = [
        keyTopic ? `Nee ${keyTopic} kurichu paranju — adil ippol enthanu koodu dukham tharunnath?` : `Ithil ippol enthanu koodu thoannunnath?`,
        `Ithil enthu aanu valare uncomfortable ayi thoanunnath?`,
        `Oru karyam mathram aaykedukkukaayaayirunnengil koodu kashtappeduttunathu enthu?`,
        `Ee sthithiyil entha aakkanam enna nee aagrahikkunnath?`,
    ];

    const nextStepLinesMl = [
        `Parayathe iriyu, allengil oru chinna kaaryam try cheyyaam — ninakku sheriyennu thoannunnath.`,
        `Chelarum munpe paranju thiirkkum, chelarum plan venam. Nee ippol evideyaanu?`,
        `Ith vivarichaal sahaayam aakumo, allengil oru chinna kadam. Enthu koodu upakaaramaakum ippol?`,
        `Njaan ninnooppam undu — parayukaanu allengil enthengilum concrete cheyyaam.`,
    ];

    const listeningOnlyExtrasMl = [
        `Ippol idi figure out cheyyaanulla avasaram illa.`,
        `Nee ellaam feel aakaam — adhu kashtamilla.`,
        `Njaan ippol unda. Parayaan thoannunnath para — koodu illa kammi.`,
        `Idi neat aakki wrap up cheyyaanulla avasaram illa.`,
    ];

    // ─── Odia (or) ─────────────────────────────────────────────────────────────
    const openersByToneOr: Record<LocalResponseTone, string[]> = {
        calm: [
            `Mu tumara saathire achi.`,
            `Aau dheere dheere eitaaku bhabhibu.`,
            `Thik achi. Aau sthire lubu.`,
            `Mu tumara saathire achi. Ek ek hissa dekhibu.`,
        ],
        supportive: [
            `Mu tumara saathire achi.`,
            `Mu shunuchi.`,
            `Thik achi — mu eithire achi.`,
            `Bhala hela je tume kaile.`,
            `Bujhiparichhi.`,
        ],
        practical: [
            `Thik achi. Aau spashta bhavare dekhibu.`,
            `Bujhiparichhi. Eitaaku ek ek step re neibaa.`,
            `Aau eitaaku steady kariba o kichi muhya jinisha dekhibu.`,
            `Mu saathire achi. Eitaaku sahaja rakhiba.`,
        ],
        coach: [
            `Thik achi — mu saathire achi. Agau eitaaku steady kariba.`,
            `Bujhiparichhi. Aase eitaaku step by step nibu.`,
            `Aau dheere hoi footing dhibu.`,
            `Mu shunuchi. Ek ek hissa dekhibu.`,
        ],
        "gentle-humor": [
            `Thik achi — mu eithire achi.`,
            `Hmm, mu shunuchi.`,
            `Bujhiparichhi. Mu saathire achi.`,
            `Aau, eitaaku thoda halka kariba — ek chota step boli.`,
        ],
        direct: [
            `Thik achi. Mu saathire achi.`,
            `Aau seedha dekhibu.`,
            `Bujhiparichhi. Eitaaku stable rakhiba.`,
            `Mu shunuchi. Seedha mudra kuu aasibu.`,
        ],
    };

    const validationsOr: Record<typeof signal, string[]> = {
        sad: [
            `Aitaa sachchi onek vedanaa dichhe.`,
            `Ee prakara kosto nijey nijey theek hue paaré naa.`,
            `Duhkha laguchhi je tume aitaa diey jauchha.`,
            `Aitaa sachchi kashtakar — thoda noy, onek.`,
            `Tume je feel karuchha seta khub sahaja.`,
            `Tume ei ta deserve kareni.`,
        ],
        anxious: [
            `Laaguchhi mathaa poori speed e chali achhi.`,
            `Ee prakara tension bhitaruthaa onek thakaa dey.`,
            `Ei samaye edge feel karibaa khub sahaja.`,
            `Ek saathere eta uncertainty sambhalibaa kashtaker.`,
            `Ei bisayare anxious thaaibaa manabik pratikriyaa.`,
            `Tumara nervous system kono asali bisayare respond karuchhi.`,
        ],
        angry: [
            `Ei raaga sachchi arthaparna.`,
            `Ithey asali kichha ghatichhi — ei frustration theek.`,
            `Mun bhi osei feel karibi.`,
            `Haan — aitaa sachchi aanjayapurna.`,
            `Ee prakara bisayara kona na kona lokan kehi bhi galat laagibaa.`,
            `Eitaa baabade raagibaa theek aahe.`,
        ],
        tired: [
            `Ee thaakaa kebal nindara karan theek hue naa.`,
            `Tume onek dinru onek kichhu sambhaaluchi aas.`,
            `Ete sab thilaa energy kame hoibaa bujhaa jaay.`,
            `Ee thaakaaa aaste aaste jaama hue jaay, pachhe ek saathere laage.`,
            `Eitaa niye thaakii thaaibaa tumara adhikar.`,
            `Aitaa sachchi nik hue jaabaa, kebal thakaan noy.`,
        ],
        okay: [
            `Aaru thoda kahe.`,
            `Ki heuuchhi?`,
            `Ebe tumara bhitare sab cheye beshi ki bujhi laaguchhi?`,
            `Ebe mathare sab cheye bada kotha ta ki?`,
        ],
    };

    const carryValidationsOr = [
        `Aitaa ebe bhi tum aara sathe achi — mu shunugalaa.`,
        `Aitaa ebe bhi settle hue naahi lagen aahe, seta bujhaa jaay.`,
        `Tume ebe bhi eitaar madhyare aacha, naa?`,
        `Aitaa tum ku chadei naahi. Thoda samay eitaa sathe rahihibu.`,
        `Ei bisayare kichu baar baar tumara kachhe phiri aasuchhi.`,
    ];

    const extrasByToneOr: Record<LocalResponseTone, string[]> = {
        calm: [
            ``,
            `Ebe kewal ek hissa dhari rahiparibaa.`,
            `Sab kichhu ek saathare sambhaalibara jaldi nahi.`,
            `Eitaaku bina force kara steady rakhibaaku heba.`,
        ],
        supportive: [
            ``,
            `Tume saba kichu ek saathare bahi jibaa nahii.`,
            `Jo sab cheye bhari laaguchhi, taa saathire pehle rahiba.`,
            `Je sab kichhu ekhana bhi uljhaa laage, taa bhi thik.`,
        ],
        practical: [
            ``,
            `Pehle jo sab cheye dorkari, taa dekhibaa.`,
            `Eitaaku manageable rakhiba.`,
            `Ebe ek kaama jinisha mattare sare.`,
        ],
        coach: [
            ``,
            `Pehle sab cheye workable ta khoji dekhibaa.`,
            `Ebe kewal ek steady move sare.`,
            `Tume saba ek saathare suljhibaa nahii.`,
        ],
        "gentle-humor": [
            ``,
            `Eitaaku ignore na kari thoda halka rakhiba.`,
            `Ebe ek chota shift sare.`,
            `Mu eithire achi tumara saathire.`,
        ],
        direct: [
            ``,
            `Aau eitaaku spashta rakhiba.`,
            `Ek ek real hissa dekhihaaba.`,
            `Ebe kewal agla useful hissa sare.`,
        ],
    };

    const carryExtrasOr: Record<LocalResponseTone, string[]> = {
        calm: [`Ebe eitaaku kahinkuu thelibaa darkaara nahi.`, `Aame ektu samayara saathire rahi paribaa.`],
        supportive: [`Tume eitaaku ekhani perfectly bujhhaibaa darkaara nahi.`, `Mu ekhana bhi tumara saathire achi.`],
        practical: [`Ebe eitaaku simple rakhiba.`, `Sampurna uttar nahi, parer spashta hissa maatra.`],
        coach: [`Kichu kariba agau eitaaku steady kariba.`, `Paare ek grounded step sare.`],
        "gentle-humor": [`Eitaaku halka rakhiba, jyaada uljhana na kariba.`, `Ebe sab kichu ek saathare ladibar dorkar nahi.`],
        direct: [`Ebe eitaaku overcomplicate na kariba.`, `Agau real hissa dhabiba.`],
    };

    const reflectLinesOr = [
        keyTopic ? `Tume ${keyTopic} bisayare kaile — sei re ebe ki sab cheye beshi dabauchhi?` : `Ei re ebe ki sab cheye beshi feel laaguchhi?`,
        `Ehitaa madhye ki sab cheye uncomfortable laaguchhi?`,
        `Jadi ekta jinisha chunibaa je sab cheye beshi kashtadei — sei ta ki?`,
        `Tume chahanthile ei obostha re ki alag thanda?`,
    ];

    const nextStepLinesOr = [
        `Aage kathaa karati thaa, naa ek chota jinisha try karaa — je thik laage sei ta.`,
        `Keu aagau sab bol dei, keu plan dorkar pade. Tume ebe kauthi?`,
        `Eitaaku kholite thaa, naa ek chota kadam. Ki beshi sahayya hebe ebe?`,
        `Mu tumara saathire achi — kahibaa naa kainchik concrete karaa.`,
    ];

    const listeningOnlyExtrasOr = [
        `Ebe eitaaku figure out karibaa dorkaar nei.`,
        `Tume sab kichhi feel karipaaribaa — seta thik.`,
        `Mu eithire achi. Je ichha hue bol — beshi naa kama.`,
        `Eitaaku neat kari wrap up karibaa dorkaar nei.`,
    ];

    // ─── Marathi (mr) ─────────────────────────────────────────────────────────
    const openersByToneMr: Record<LocalResponseTone, string[]> = {
        calm: [`Mi ithe aahe.`, `Chala he haluhalu gheuya.`, `Theek aahe. He aaramaat gheuya.`, `Mi tuzhyasobat aahe. Ek ek bhaag pahilya.`],
        supportive: [`Mi ithe aahe.`, `Mi aikto aahe.`, `Theek aahe — mi itheche aahe.`, `Barabar kela sangitles.`, `Samajla.`],
        practical: [`Theek aahe. He spashta nazar ne pahilya.`, `Samajla. He step by step gheuya.`, `Chala sambalto ani baghto kashacha mahattva aahe.`, `Mi sobat aahe. He saral thauvuya.`],
        coach: [`Theek aahe — mi sobat aahe. Aadhi he steady karuya.`, `Samajla. He step by step kadhilya.`, `Thoda savakaash houn footing dharuya.`, `Mi aikto aahe. Ek ek bhaag pahilya.`],
        "gentle-humor": [`Theek aahe — mi ithe aahe.`, `Hmm, mi aikto aahe.`, `Samajla. Mi sobat aahe.`, `Chala, he thoda halke karuya — ek chhota step karun.`],
        direct: [`Theek aahe. Mi sobat aahe.`, `Chala he seedhya nazar ne pahilya.`, `Samajla. He steady thauvuya.`, `Mi aikto aahe. Seedhya muddevar yeuya.`],
    };

    const validationsMr: Record<typeof signal, string[]> = {
        sad: [
            `He khare dukh dete.`,
            `Ya prakarche dard aapasap thik hoat nahi.`,
            `Tula ya madun jaayche aahe mhantlyavar mala vaait vaatate.`,
            `He kharch kashtdayak aahe — thode nahi, khup.`,
            `Tu je feel kartoys te poorn samaajhte.`,
            `Tu hya deserve nastos.`,
        ],
        anxious: [
            `Vatate dokyat poori speed aahe.`,
            `Ya prakarchi tension aatun khup thakavate.`,
            `Ya saravamedhe edge feel karane bilkul samajnyasarkhe aahe.`,
            `Ek saath itki uncertainty sambhalnee khupach kashtdayak aahe.`,
            `Yabaddal anxious rahane manawiy pratikriya aahe.`,
            `Tuzha nervous system konyatari kharyaa goshticha pratikaara kartoy.`,
        ],
        angry: [
            `Ha raag khup samajhnya layak aahe.`,
            `Ithe khary goshti ghadlyaa — ha frustration yogya aahe.`,
            `Mala pann taseech vaatale aste.`,
            `Ho — he khary mhanje anjaaypurnak aahe.`,
            `Asal'ya goshti konalahi aatparyant jatat.`,
            `Yaabaddal raagaavane theek aahe.`,
        ],
        tired: [
            `Hi thakaan sirf jhopet thik nahi hote.`,
            `Tu khup divas dhare khupach kahi sambhaltoys.`,
            `Ete saglya goshti niye energy kami hone banta aahe.`,
            `Hi thakaan halnhal jama hote ani ekdam lagte.`,
            `Ithle thaklyasarkhe rahaycha tula hak aahe.`,
            `He khary nik houne aahe, sirf thakaan nahi.`,
        ],
        okay: [`Adhik saang.`, `Kaay chaallu aahe?`, `Ata tujhyaat kaay jast bhaarite aahe?`, `Ata dokyat saglyyaat motha kaay aahe?`],
    };

    const carryValidationsMr = [
        `He abhi pann tujhyasobat aahe — mi te samjhu shakto.`,
        `He abhi settle nahi zhale ase vaatate, ani te samajte.`,
        `Tu ata pun yaachya madhye aahe, ho na?`,
        `He tuza peeccha sodat nahi. Thodi velaa asa ika vaduye.`,
        `Ya vishayaabaddal kainchik baar baar tujhyakade yete.`,
    ];

    const extrasByToneMr: Record<LocalResponseTone, string[]> = {
        calm: [``, `Ata faqt ek bhaag dharun chala shakato.`, `Sagle ek saath sambhalaychi ghai nahi.`, `He bina force karun steady thavata yete.`],
        supportive: [``, `Tula sagle ek saath uthaava laagat nahi.`, `Jo saglyyaat jad vaatate, tya barober rahilya.`, `Sagle ata pun guntaycha thi theek aahe.`],
        practical: [``, `Aadhi kaay saglyyaat mahattvaache aahe te pahilya.`, `He manageable thavta yete.`, `Ata ek kamaache goshta pahe jaane puresar aahe.`],
        coach: [``, `Aadhi saglyyaat workable bhaag shodhlya.`, `Ata faqt ek steady move puresar aahe.`, `Tula sagle ek saath sudhavayche nahi.`],
        "gentle-humor": [``, `He ignore na karta halke thavta yete.`, `Ata ek chhota shift puresar aahe.`, `Mi ithe tujhyasobat aahe.`],
        direct: [``, `Chala he spasht thauvuya.`, `Ek velela ek real bhaag pahata yeto.`, `Ata faqt pudha useful bhaag puresar aahe.`],
    };

    const carryExtrasMr: Record<LocalResponseTone, string[]> = {
        calm: [`Ata yaala kuthehi dhakalaaychi garj nahi.`, `Aapan thoda vel faqt yaच्याsobat rahu shakato.`],
        supportive: [`Tula he perfectly samjaavayche ata garj nahi.`, `Mi ata pun tujhyasobat aahe.`],
        practical: [`Ata he simple thauvuya.`, `Pura jaab nahi, faqt pudha spasht bhaag pahilya.`],
        coach: [`Kaahi karayla aadhi he steady karuya.`, `Nantar ek grounded step puresar hail.`],
        "gentle-humor": [`He halke thavta yete bina guntavit.`, `Ata puri kushti laadaaychi garj nahi.`],
        direct: [`Ata he overcomplicate karaayche nahi.`, `Aadhi real bhaag dharuya.`],
    };

    const reflectLinesMr = [
        keyTopic ? `Tumhi ${keyTopic} baadal sangitlas — tyaat ata kaay saglyyaat jast daabtay?` : `Yaatla kaay saglyyaat jast jaanvatoay ata?`,
        `Yaatlya kaay saglyyaat uncomfortable aahe?`,
        `Ek goshta nivadaychee asteel jo saglyyaat jast tras detoy — ti kaay aseel?`,
        `Tu ya situation madhe kaay vegale hove ase vaatate?`,
    ];

    const nextStepLinesMr = [
        `Bolat raha, ki ek chhoti goshta try karuya — jo yogya vaatate te.`,
        `Kahi lok aaghi sab bolun taktat, kahina plan pahije. Tu ata kuthe aahes?`,
        `He ughadat rahile, ki ek chhota paav. Kaay jast upyogi vaatel ata?`,
        `Mi sobat aahe — bolat raha ki kainchik concrete karuya.`,
    ];

    const listeningOnlyExtrasMr = [
        `Ata he figure out karayla ghai nahi.`,
        `Tu he sab feel karayla harakhat nahi — bilkul theek aahe.`,
        `Mi itheche aahe. Kaay vaatel te sang — zyada ki kami.`,
        `Yala neatly wrap up karayla nako.`,
    ];

    // ── International language banks (zh, es, ar, fr, pt, ru, id, ur) ────────────
    // NOTE: These banks use carefully translated content. Native speaker review
    // recommended for production accuracy — especially for Arabic (RTL) and
    // culturally-specific expressions. Mark reviewed with: // reviewed: [lang] [date]

    const openersByToneZh: Record<LocalResponseTone, string[]> = {
        calm: [`我在你身边。`, `让我们慢慢来。`, `好的。我们一步一步来。`, `我在这里，不着急。`, `那种感觉是真实的。`, `慢慢来，我不会走。`],
        supportive: [`我在听。`, `谢谢你告诉我这些。`, `说出来需要勇气。`, `我很高兴你联系了我。`, `我在，好好说说。`, `这听起来真的很难。`],
        practical: [`好的。我们来理清楚。`, `我明白了。我们一步一步看。`, `让我们找到最关键的地方。`, `我在。我们把这个理清楚。`],
        coach: [`好，我在。我们先稳住。`, `我明白了。我们一步一步来。`, `让我们慢下来，找到站稳的地方。`, `我在听。我们把这个理清楚。`],
        "gentle-humor": [`好，我在这里。`, `嗯，我在听。`, `明白了。我在你身边。`, `来，我们把这个轻松一点——一小步一小步。`],
        direct: [`好。我在。`, `直接说吧。`, `明白了。我们稳住。`, `我在听。直奔主题吧。`],
    };

    const validationsZh: Record<typeof signal, string[]> = {
        sad: [`这真的很痛。`, `这种伤痛不会自己消失。`, `我很遗憾你正在经历这些。`, `这确实很难——不只是有点难，是真的很难。`, `你现在的感受完全说得通。`, `你不应该承受这些。`],
        anxious: [`听起来你的脑子正在全速运转。`, `这种压力从里面把人榨干。`, `在这种情况下感到不安是完全正常的。`, `同时面对这么多不确定，真的很沉。`, `对此感到焦虑是非常人之常情的反应。`, `你的神经系统在对某种真实的东西作出反应。`],
        angry: [`这种愤怒完全说得通。`, `这里发生了真实的事情——这种挫败感是有根据的。`, `换我也会这样感觉。`, `对，这真的不公平。`, `这种事会让任何人都感到难受。`, `对此感到愤怒是完全可以的。`],
        tired: [`这种疲惫不是睡一觉就能解决的。`, `你已经扛着很多东西很长时间了。`, `在这么多压力下精力不足是自然的。`, `这种疲惫慢慢积累，然后一下子就爆发出来。`, `你有权力被这些压垮。`, `这是真正的耗竭，不只是累。`],
        okay: [`多说一点。`, `我在——发生什么了？`, `你现在心里最压着你的是什么？`, `好的。现在脑子里最大的事情是什么？`],
    };

    const carryValidationsZh = [`这还在你心里——我感觉得到。`, `听起来这件事还没有沉淀下来，这说得通。`, `你还在这件事的中间，对吗？`, `它没有离开你。我们再多待一会儿。`, `有些事情总是在你那里反复出现。`];

    const extrasByToneZh: Record<LocalResponseTone, string[]> = {
        calm: [``, `现在只抓住一个部分就好。`, `不用着急把所有事情一次搞定。`, `我们可以不强迫自己，慢慢稳住。`],
        supportive: [``, `你不必一次扛起所有的重量。`, `先停在感觉最重的那个地方。`, `现在还乱也没关系。`],
        practical: [``, `先找到最重要的那一件事。`, `我们可以把这个拆开来看。`, `现在有一个有用的部分就够了。`],
        coach: [``, `先找到最可以行动的那个部分。`, `现在只需要一个稳定的行动。`, `不必一次把所有事情都想清楚。`],
        "gentle-humor": [``, `我们可以轻松一点，但不忽略它。`, `现在一个小改变就够了。`, `我还在这里陪着你。`],
        direct: [``, `我们保持清晰。`, `一次面对一个真实的部分。`, `现在只有下一个有用的部分重要。`],
    };

    const carryExtrasZh: Record<LocalResponseTone, string[]> = {
        calm: [`我们现在不必把这个推向任何地方。`, `我们可以就这样陪着它一会儿。`],
        supportive: [`你现在不必把它解释得很清楚。`, `我还在这里陪着你。`],
        practical: [`现在保持简单就好。`, `不需要整个答案，只要下一步清楚的部分。`],
        coach: [`先稳住，再行动。`, `之后一个扎实的步骤就够了。`],
        "gentle-humor": [`我们可以保持轻松，不要越搞越重。`, `现在不需要把整件事都解决掉。`],
        direct: [`现在不要把它复杂化。`, `先抓住真实的那个部分。`],
    };

    const reflectLinesZh = [
        keyTopic ? `你提到了${keyTopic}——那里面什么让你感觉最急迫？` : `现在这件事里，什么让你感觉最压着你？`,
        `这件事里，什么让你觉得最不舒服？`,
        `如果只能选一件最困扰你的事——会是什么？`,
        `你希望这个情况里什么是不同的？`,
    ];

    const nextStepLinesZh = [`我们可以继续聊，或者找一件小事去试试——哪个感觉对就哪个。`, `有些人需要先把话说出来。有些人想要一个计划。你现在是哪种状态？`, `我们可以继续摊开来看，或者找一个小动作。现在哪个更有用？`, `我在你身边——无论是继续聊还是找一件具体的事。`];

    const listeningOnlyExtrasZh = [`你现在不必把这个想清楚。`, `我不会走。想说多少就说多少。`, `你可以有所有这些感受。`, `不需要把这件事整理得很好。`];

    const openersByToneEs: Record<LocalResponseTone, string[]> = {
        calm: [`Estoy aquí contigo.`, `Vamos despacio con esto.`, `Está bien. Lo tomamos con calma.`, `Estoy aquí. Vamos parte por parte.`, `Eso tiene mucho sentido.`, `Tómate tu tiempo. No voy a ningún lado.`],
        supportive: [`Te escucho.`, `Gracias por contarme esto.`, `No fue fácil decirlo y lo hiciste.`, `Me alegra que hayas escrito.`, `Te estoy escuchando, de verdad.`, `Eso suena muy difícil.`],
        practical: [`Bien. Lo miramos con claridad.`, `Entendido. Lo tomamos paso a paso.`, `Vamos a ver qué es lo más importante.`, `Estoy aquí. Lo hacemos manejable.`],
        coach: [`Bien, estoy contigo. Primero nos estabilizamos.`, `Entendido. Lo vamos a ir desgranando.`, `Vamos a ir despacio y encontrar un punto firme.`, `Te escucho. Lo vemos parte por parte.`],
        "gentle-humor": [`Bien, aquí estoy.`, `Hmm, te escucho.`, `Entendido. Estoy contigo.`, `Vamos a hacer esto un poco más liviano — un pequeño paso a la vez.`],
        direct: [`Bien. Estoy aquí.`, `Vamos directos.`, `Entendido. Lo mantenemos estable.`, `Te escucho. Al grano.`],
    };

    const validationsEs: Record<typeof signal, string[]> = {
        sad: [`Eso suena realmente doloroso.`, `Ese tipo de dolor no desaparece solo.`, `Lo siento mucho, de verdad.`, `Esto es genuinamente difícil — no solo un poco, bastante.`, `Lo que estás sintiendo tiene todo el sentido.`, `No mereces esto.`],
        anxious: [`Parece que tu mente está corriendo a toda velocidad.`, `Ese tipo de presión agota por dentro.`, `Tiene todo el sentido que te sientas al límite con esto.`, `Es mucho cargar tanta incertidumbre de golpe.`, `Sentir ansiedad por esto es una respuesta muy humana.`, `Tu sistema nervioso está reaccionando a algo real.`],
        angry: [`Ese enojo tiene todo el sentido.`, `Aquí pasó algo real — esa frustración es válida.`, `Yo me sentiría igual.`, `Sí — eso es genuinamente injusto.`, `Este tipo de cosas les cala hondo a cualquiera.`, `Está bien estar enojado por esto.`],
        tired: [`Ese agotamiento va más allá de lo que el sueño puede arreglar.`, `Has estado cargando mucho por mucho tiempo.`, `Con todo esto, es lógico que tu energía esté baja.`, `Ese tipo de cansancio se acumula en silencio y luego golpea de una vez.`, `Tienes todo el derecho de estar agotado por esto.`, `Eso es un desgaste real, no solo cansancio.`],
        okay: [`Cuéntame un poco más.`, `Estoy aquí — ¿qué está pasando?`, `¿Con qué estás más cargado ahora mismo?`, `¿Qué es lo que más está en tu cabeza?`],
    };

    const carryValidationsEs = [`Esto sigue estando contigo — lo puedo sentir.`, `Parece que esto todavía no se ha asentado, y tiene sentido.`, `Todavía estás en medio de esto, ¿verdad?`, `Esto no te ha soltado. Quedémonos con esto un momento más.`, `Algo de esto sigue volviendo para ti.`];

    const extrasByToneEs: Record<LocalResponseTone, string[]> = {
        calm: [``, `Por ahora podemos quedarnos con una sola parte.`, `No hay apuro con todo.`, `Podemos mantener esto estable sin forzarlo.`],
        supportive: [``, `No tienes que cargar con todo a la vez.`, `Quedémonos con lo que se siente más pesado primero.`, `Está bien si todo sigue sintiendo desordenado.`],
        practical: [``, `Solo miremos lo más importante primero.`, `Podemos hacer esto manejable.`, `Una cosa útil es suficiente por ahora.`],
        coach: [``, `Encontremos la parte más trabajable primero.`, `Solo necesitamos un paso firme ahora.`, `No tienes que desenredar todo a la vez.`],
        "gentle-humor": [``, `Podemos mantener esto un poco más liviano sin ignorarlo.`, `Un pequeño cambio es suficiente por ahora.`, `Sigo aquí contigo.`],
        direct: [``, `Mantengamos esto claro.`, `Podemos ver una parte real a la vez.`, `Solo importa el siguiente paso útil ahora.`],
    };

    const carryExtrasEs: Record<LocalResponseTone, string[]> = {
        calm: [`No tenemos que empujar esto a ningún lado todavía.`, `Podemos quedarnos con ello un momento.`],
        supportive: [`No tienes que explicarlo perfectamente ahora.`, `Sigo aquí contigo en esto.`],
        practical: [`Lo mantenemos simple por ahora.`, `No necesitamos toda la respuesta, solo el siguiente paso claro.`],
        coach: [`Primero estabilizamos esto, luego actuamos.`, `Un paso sólido después es suficiente.`],
        "gentle-humor": [`Podemos mantenerlo suave sin hacerlo más pesado.`, `No hay que resolver todo ahora.`],
        direct: [`No lo compliquemos ahora.`, `Primero la parte real.`],
    };

    const reflectLinesEs = [
        keyTopic ? `Mencionaste ${keyTopic} — ¿qué parte de eso se siente más urgente ahora?` : `¿Qué parte de esto es la que más te pesa ahora mismo?`,
        `¿Qué es lo que más incomodidad te genera en esto?`,
        `Si tuvieras que elegir una sola cosa que más te molesta — ¿cuál sería?`,
        `¿Qué desearías que fuera diferente en esta situación?`,
    ];

    const nextStepLinesEs = [`Podemos seguir hablando de esto, o encontrar una pequeña cosa para intentar — lo que se sienta mejor.`, `Algunos necesitan decirlo todo primero. Otros quieren un plan. ¿Dónde estás tú?`, `Podemos seguir desempacando esto, o encontrar un pequeño movimiento. ¿Qué se siente más útil ahora?`, `Estoy contigo — ya sea para seguir hablando o para encontrar algo concreto.`];

    const listeningOnlyExtrasEs = [`No tienes que resolver esto ahora.`, `No me voy a ningún lado. Di todo lo que necesites.`, `Tienes permitido sentir todo esto.`, `No necesitas envolver esto ordenadamente.`];

    const openersByToneAr: Record<LocalResponseTone, string[]> = {
        calm: [`أنا هنا معك.`, `لنأخذ هذا ببطء.`, `حسناً. دعنا نأخذه بهدوء.`, `أنا هنا. لنأخذه خطوة بخطوة.`, `هذا منطقي تماماً.`, `خذ وقتك. لن أذهب إلى أي مكان.`],
        supportive: [`أنا أسمعك.`, `شكراً لك على إخباري بهذا.`, `احتاج هذا شجاعة لقوله.`, `أنا سعيد أنك تواصلت.`, `أنا أستمع، بشكل كامل.`, `هذا يبدو صعباً حقاً.`],
        practical: [`حسناً. لنرَ هذا بوضوح.`, `فهمت. لنأخذه خطوة بخطوة.`, `دعنا نجد الجزء الأكثر أهمية.`, `أنا هنا. دعنا نجعله قابلاً للتعامل.`],
        coach: [`حسناً، أنا هنا. لنستقر أولاً.`, `فهمت. سنأخذه خطوة بخطوة.`, `دعنا نتمهل ونجد موطئ قدم.`, `أنا أسمعك. لنراه جزءاً جزءاً.`],
        "gentle-humor": [`حسناً، أنا هنا.`, `همم، أنا أسمعك.`, `فهمت. أنا معك.`, `لنجعل هذا أخف قليلاً — خطوة صغيرة في كل مرة.`],
        direct: [`حسناً. أنا هنا.`, `لنكن مباشرين.`, `فهمت. لنحافظ على الاستقرار.`, `أنا أسمعك. لنصل إلى الجوهر.`],
    };

    const validationsAr: Record<typeof signal, string[]> = {
        sad: [`هذا مؤلم حقاً.`, `هذا النوع من الألم لا يختفي من تلقاء نفسه.`, `أنا آسف أنك تمر بهذا.`, `هذا صعب بحق — ليس قليلاً، بل كثيراً.`, `ما تشعر به منطقي تماماً.`, `لم تستحق هذا.`],
        anxious: [`يبدو أن عقلك يعمل بأقصى سرعة.`, `هذا النوع من الضغط مرهق من الداخل.`, `من المنطقي تماماً أن تشعر بهذا التوتر.`, `تحمّل كل هذا الغموض دفعة واحدة أمر ثقيل.`, `القلق على هذا استجابة بشرية جداً.`, `جهازك العصبي يتفاعل مع شيء حقيقي.`],
        angry: [`هذا الغضب منطقي تماماً.`, `شيء حقيقي حدث هنا — هذا الإحباط مبرر.`, `كنت سأشعر بنفس الطريقة.`, `نعم — هذا ظلم حقيقي.`, `هذا النوع من الأشياء يؤثر في أي شخص.`, `من الطبيعي أن تغضب على هذا.`],
        tired: [`هذا الإرهاق أعمق مما يستطيع النوم إصلاحه.`, `لقد كنت تحمل الكثير لفترة طويلة.`, `لا عجب أن طاقتك منخفضة — هذا كثير.`, `هذا النوع من التعب يتراكم بهدوء ثم يصطدم بك دفعة واحدة.`, `من حقك أن تكون منهكاً من هذا.`, `هذا استنزاف حقيقي، وليس مجرد تعب.`],
        okay: [`أخبرني أكثر.`, `أنا هنا — ماذا يجري؟`, `ما الذي يثقل عليك أكثر الآن؟`, `ما الأمر الأكبر في ذهنك الآن؟`],
    };

    const carryValidationsAr = [`هذا لا يزال معك — أستطيع أن أشعر بذلك.`, `يبدو أن هذا لم يستقر بعد، وهذا منطقي.`, `أنت لا تزال في منتصف هذا، أليس كذلك؟`, `لم يتركك هذا. دعنا نبقى معه لحظة أطول.`, `هناك شيء في هذا يعود إليك مراراً.`];

    const extrasByToneAr: Record<LocalResponseTone, string[]> = {
        calm: [``, `يمكننا البقاء مع جزء واحد الآن.`, `لا داعي للتسرع.`, `يمكننا إبقاء هذا مستقراً دون إجبار أنفسنا.`],
        supportive: [``, `لا يجب عليك حمل كل هذا دفعة واحدة.`, `دعنا نبقى مع أثقل الأجزاء أولاً.`, `من الجيد أن يظل الأمر فوضوياً في الوقت الحالي.`],
        practical: [``, `لننظر أولاً إلى الأكثر أهمية.`, `يمكننا جعل هذا قابلاً للتعامل.`, `جزء واحد مفيد يكفي الآن.`],
        coach: [``, `دعنا نجد أكثر الأجزاء قابلية للتنفيذ.`, `نحتاج فقط إلى خطوة واحدة مستقرة الآن.`, `لست مضطراً لحل كل شيء دفعة واحدة.`],
        "gentle-humor": [``, `يمكننا الإبقاء على هذا أخف قليلاً دون تجاهله.`, `تغيير صغير واحد يكفي الآن.`, `ما زلت هنا معك.`],
        direct: [``, `دعنا نحافظ على الوضوح.`, `يمكننا التعامل مع جزء حقيقي واحد في كل مرة.`, `فقط الجزء المفيد التالي مهم الآن.`],
    };

    const carryExtrasAr: Record<LocalResponseTone, string[]> = {
        calm: [`لسنا مضطرين لدفع هذا إلى أي مكان الآن.`, `يمكننا البقاء معه لحظة.`],
        supportive: [`لا يجب عليك تفسيره بشكل مثالي الآن.`, `ما زلت هنا معك فيه.`],
        practical: [`نحافظ على البساطة الآن.`, `لا نحتاج إلى الإجابة الكاملة، فقط الجزء الواضح التالي.`],
        coach: [`نستقر أولاً قبل أي شيء.`, `خطوة راسخة لاحقاً تكفي.`],
        "gentle-humor": [`يمكننا إبقائه خفيفاً دون تعقيد.`, `لسنا بحاجة لحل كل شيء الآن.`],
        direct: [`لا نجعله معقداً الآن.`, `الجزء الحقيقي أولاً.`],
    };

    const reflectLinesAr = [
        keyTopic ? `ذكرت ${keyTopic} — ما الجزء الذي يبدو أكثر إلحاحاً الآن؟` : `ما الجزء من هذا الذي يثقل عليك أكثر الآن؟`,
        `ما الذي يسبب لك أكبر قدر من عدم الارتياح في هذا؟`,
        `إذا كان عليك اختيار شيء واحد يزعجك أكثر — ما الذي سيكون؟`,
        `ماذا تتمنى لو كان مختلفاً في هذا الموقف؟`,
    ];

    const nextStepLinesAr = [`يمكننا الاستمرار في الحديث، أو إيجاد شيء صغير نحاوله — أيهما يبدو صحيحاً.`, `بعض الناس يحتاجون إلى قول كل شيء أولاً. والبعض يريد خطة. أين أنت الآن؟`, `يمكننا الاستمرار في الحفر، أو إيجاد حركة صغيرة. ما الذي يبدو أكثر فائدة؟`, `أنا معك — سواء كان الأمر الاستمرار في الحديث أو إيجاد شيء ملموس.`];

    const listeningOnlyExtrasAr = [`لا يجب عليك معرفة هذا الآن.`, `لن أذهب إلى أي مكان. قل ما تحتاج.`, `يمكنك الشعور بكل هذا.`, `لا تحتاج إلى تلخيص هذا بشكل أنيق.`];

    const openersByToneFr: Record<LocalResponseTone, string[]> = {
        calm: [`Je suis là avec toi.`, `Prenons ça doucement.`, `D'accord. On y va à notre rythme.`, `Je suis là. Un pas à la fois.`, `Ça fait sens de se sentir comme ça.`, `Prends ton temps. Je ne vais nulle part.`],
        supportive: [`Je t'écoute.`, `Merci de m'avoir dit ça.`, `Il fallait du courage pour le dire.`, `Je suis content·e que tu aies écrit.`, `Je t'écoute vraiment.`, `Ça a l'air vraiment difficile.`],
        practical: [`D'accord. Voyons ça clairement.`, `Je comprends. On y va étape par étape.`, `Trouvons ce qui est le plus important.`, `Je suis là. On fait ça de façon gérable.`],
        coach: [`Bien, je suis là. On se stabilise d'abord.`, `Je comprends. On y va pas à pas.`, `Ralentissons et trouvons un point d'appui.`, `Je t'écoute. On voit ça partie par partie.`],
        "gentle-humor": [`Bien, je suis là.`, `Hmm, je t'écoute.`, `Je comprends. Je suis avec toi.`, `On va alléger un peu tout ça — un petit pas à la fois.`],
        direct: [`Bien. Je suis là.`, `On va droit au but.`, `Je comprends. On reste stable.`, `Je t'écoute. Allons à l'essentiel.`],
    };

    const validationsFr: Record<typeof signal, string[]> = {
        sad: [`C'est vraiment douloureux.`, `Ce genre de douleur ne s'en va pas tout seul.`, `Je suis désolé·e que tu traverses ça.`, `C'est vraiment difficile — pas juste un peu, vraiment.`, `Ce que tu ressens est tout à fait compréhensible.`, `Tu ne méritais pas ça.`],
        anxious: [`On dirait que ton esprit tourne à plein régime.`, `Ce genre de pression épuise de l'intérieur.`, `Ça fait sens de se sentir sur les nerfs avec tout ça.`, `Tenir autant d'incertitude en même temps, c'est lourd.`, `Ressentir de l'anxiété pour ça, c'est humain.`, `Ton système nerveux réagit à quelque chose de réel.`],
        angry: [`Cette colère est tout à fait compréhensible.`, `Il s'est passé quelque chose de réel ici — cette frustration est valide.`, `Je ressentirais la même chose à ta place.`, `Oui — c'est genuinement injuste.`, `Ce genre de chose affecte tout le monde.`, `C'est tout à fait normal d'être en colère pour ça.`],
        tired: [`Cette fatigue va plus loin que ce que le sommeil peut réparer.`, `Tu portes beaucoup depuis longtemps.`, `Pas étonnant que ton énergie soit basse — c'est beaucoup.`, `Ce genre de fatigue s'accumule en silence puis tout s'effondre d'un coup.`, `Tu as le droit d'être épuisé·e par tout ça.`, `C'est un vrai épuisement, pas juste de la fatigue.`],
        okay: [`Dis-m'en un peu plus.`, `Je suis là — qu'est-ce qui se passe ?`, `Qu'est-ce qui te pèse le plus en ce moment ?`, `C'est quoi la principale chose en tête ?`],
    };

    const carryValidationsFr = [`C'est toujours avec toi — je le sens.`, `On dirait que ça n'a pas encore été digéré, et c'est normal.`, `Tu es encore au milieu de tout ça, n'est-ce pas ?`, `Ça ne t'a pas lâché·e. Restons-y un peu plus longtemps.`, `Il y a quelque chose dans tout ça qui revient sans cesse.`];

    const extrasByToneFr: Record<LocalResponseTone, string[]> = {
        calm: [``, `Pour l'instant, on peut s'arrêter sur une partie.`, `Pas besoin de tout régler d'un coup.`, `On peut rester stable sans se forcer.`],
        supportive: [``, `Tu n'as pas à tout porter en même temps.`, `Restons avec ce qui semble le plus lourd en premier.`, `C'est okay si tout semble encore confus.`],
        practical: [``, `Regardons d'abord ce qui est le plus important.`, `On peut rendre ça gérable.`, `Un élément utile suffit pour l'instant.`],
        coach: [``, `Trouvons d'abord la partie la plus actionnable.`, `On n'a besoin que d'un seul mouvement stable.`, `Tu n'as pas à tout démêler en même temps.`],
        "gentle-humor": [``, `On peut garder ça un peu plus léger sans l'ignorer.`, `Un petit changement suffit pour l'instant.`, `Je suis toujours là avec toi.`],
        direct: [``, `Restons clair·e·s.`, `On peut traiter une vraie partie à la fois.`, `Seule la prochaine étape utile compte maintenant.`],
    };

    const carryExtrasFr: Record<LocalResponseTone, string[]> = {
        calm: [`On n'a pas à forcer ça quelque part encore.`, `On peut juste rester avec ça un moment.`],
        supportive: [`Tu n'as pas à l'expliquer parfaitement là.`, `Je suis toujours là avec toi dans ça.`],
        practical: [`On garde ça simple pour l'instant.`, `On n'a pas besoin de toute la réponse, juste la prochaine pièce claire.`],
        coach: [`On stabilise d'abord avant de faire quoi que ce soit.`, `Une étape solide plus tard suffit.`],
        "gentle-humor": [`On peut garder ça doux sans l'alourdir.`, `Pas besoin de tout résoudre maintenant.`],
        direct: [`On ne complique pas ça là.`, `On reste d'abord sur la partie réelle.`],
    };

    const reflectLinesFr = [
        keyTopic ? `Tu as mentionné ${keyTopic} — quelle partie semble la plus urgente maintenant ?` : `Quelle partie de tout ça te pèse le plus en ce moment ?`,
        `Qu'est-ce qui te semble le plus inconfortable là-dedans ?`,
        `S'il fallait choisir une seule chose qui te dérange le plus — ce serait quoi ?`,
        `Qu'est-ce que tu aimerais voir différemment dans cette situation ?`,
    ];

    const nextStepLinesFr = [`On peut continuer à en parler, ou trouver une petite chose à essayer — ce qui semble juste.`, `Certains ont besoin de tout dire d'abord. D'autres veulent un plan. Où en es-tu ?`, `On peut continuer à déposer tout ça, ou trouver un petit mouvement. Qu'est-ce qui serait le plus utile ?`, `Je suis là — que ce soit pour continuer à parler ou trouver quelque chose de concret.`];

    const listeningOnlyExtrasFr = [`Tu n'as pas à comprendre ça maintenant.`, `Je ne vais nulle part. Dis autant ou aussi peu que tu as besoin.`, `Tu as le droit de ressentir tout ça.`, `Tu n'as pas à emballer ça proprement.`];

    const openersByTonePt: Record<LocalResponseTone, string[]> = {
        calm: [`Estou aqui com você.`, `Vamos devagar com isso.`, `Tá bom. Vamos com calma.`, `Estou aqui. Vamos por partes.`, `Faz sentido se sentir assim.`, `Pode levar o tempo que precisar. Não vou a lugar nenhum.`],
        supportive: [`Estou te ouvindo.`, `Obrigado·a por me contar isso.`, `Tomar coragem pra falar sobre isso não é fácil.`, `Fico feliz que você entrou em contato.`, `Estou te escutando, de verdade.`, `Isso parece muito difícil.`],
        practical: [`Tá bom. Vamos entender isso com clareza.`, `Entendi. Vamos por partes.`, `Vamos encontrar o que é mais importante.`, `Estou aqui. Vamos tornar isso gerenciável.`],
        coach: [`Certo, estou aqui. Primeiro a gente se estabiliza.`, `Entendi. Vamos ir passo a passo.`, `Vamos devagar e encontrar uma base firme.`, `Te ouço. Vamos ver cada parte.`],
        "gentle-humor": [`Certo, estou aqui.`, `Hmm, te ouço.`, `Entendi. Estou com você.`, `Vamos tornar isso um pouco mais leve — um passo de cada vez.`],
        direct: [`Certo. Estou aqui.`, `Vamos direto ao ponto.`, `Entendi. Vamos manter a estabilidade.`, `Te ouço. Sem rodeios.`],
    };

    const validationsPt: Record<typeof signal, string[]> = {
        sad: [`Isso dói de verdade.`, `Esse tipo de dor não some sozinha.`, `Sinto muito que você está passando por isso.`, `É genuinamente difícil — não só um pouco, muito.`, `O que você está sentindo faz todo sentido.`, `Você não merecia isso.`],
        anxious: [`Parece que sua mente está acelerada.`, `Esse tipo de pressão esgota por dentro.`, `Faz todo sentido se sentir no limite com tudo isso.`, `Segurar tanta incerteza de uma vez é muito pesado.`, `Sentir ansiedade por isso é uma resposta muito humana.`, `Seu sistema nervoso está reagindo a algo real.`],
        angry: [`Essa raiva faz todo sentido.`, `Algo real aconteceu aqui — essa frustração é válida.`, `Eu me sentiria do mesmo jeito.`, `Sim — isso é genuinamente injusto.`, `Esse tipo de coisa incomoda qualquer pessoa.`, `Tá tudo bem estar com raiva disso.`],
        tired: [`Esse cansaço vai além do que o sono pode resolver.`, `Você vem carregando muito por muito tempo.`, `Com tudo isso, é natural que sua energia esteja baixa.`, `Esse tipo de cansaço vai se acumulando e bate de uma vez.`, `Você tem todo o direito de estar esgotado·a com isso.`, `Isso é um esgotamento real, não só cansaço.`],
        okay: [`Me conta um pouco mais.`, `Estou aqui — o que está acontecendo?`, `O que está pesando mais pra você agora?`, `O que é a coisa mais importante na sua cabeça?`],
    };

    const carryValidationsPt = [`Isso ainda está com você — consigo sentir isso.`, `Parece que isso ainda não se assentou, e faz sentido.`, `Você ainda está no meio disso, não é?`, `Isso não te soltou. Vamos ficar com isso um pouco mais.`, `Tem algo nisso que continua voltando pra você.`];

    const extrasByTonePt: Record<LocalResponseTone, string[]> = {
        calm: [``, `Por enquanto podemos focar em uma parte só.`, `Não precisa resolver tudo de uma vez.`, `Podemos manter isso estável sem forçar.`],
        supportive: [``, `Você não precisa carregar tudo de uma vez.`, `Vamos ficar com o que está mais pesado primeiro.`, `Tá bom se tudo ainda parece confuso.`],
        practical: [``, `Vamos olhar o mais importante primeiro.`, `Podemos tornar isso gerenciável.`, `Uma coisa útil já é suficiente por agora.`],
        coach: [``, `Vamos encontrar a parte mais acionável primeiro.`, `Só precisamos de um movimento firme agora.`, `Você não precisa desembaraçar tudo de uma vez.`],
        "gentle-humor": [``, `Podemos manter isso um pouco mais leve sem ignorar.`, `Uma pequena mudança já é o suficiente.`, `Ainda estou aqui com você.`],
        direct: [``, `Vamos manter isso claro.`, `Podemos lidar com uma parte real de cada vez.`, `Só o próximo passo útil importa agora.`],
    };

    const carryExtrasPt: Record<LocalResponseTone, string[]> = {
        calm: [`Não precisamos empurrar isso pra lugar nenhum ainda.`, `Podemos só ficar com isso um momento.`],
        supportive: [`Você não precisa explicar perfeitamente agora.`, `Ainda estou aqui com você nisso.`],
        practical: [`Mantemos simples por enquanto.`, `Não precisamos de toda a resposta, só do próximo passo claro.`],
        coach: [`Primeiro a gente estabiliza, depois age.`, `Um passo firme depois já é suficiente.`],
        "gentle-humor": [`Podemos manter isso suave sem complicar.`, `Não precisa resolver tudo agora.`],
        direct: [`Não vamos complicar isso agora.`, `Primeiro a parte real.`],
    };

    const reflectLinesPt = [
        keyTopic ? `Você mencionou ${keyTopic} — o que parece mais urgente nisso?` : `O que está pesando mais pra você nisso agora?`,
        `O que gera mais desconforto nisso tudo?`,
        `Se tivesse que escolher uma coisa que está te incomodando mais — qual seria?`,
        `O que você gostaria que fosse diferente nessa situação?`,
    ];

    const nextStepLinesPt = [`A gente pode continuar conversando sobre isso, ou encontrar uma coisa pequena pra tentar — o que parecer certo.`, `Algumas pessoas precisam falar tudo primeiro. Outras querem um plano. Onde você está?`, `Podemos continuar desempacotando isso, ou encontrar um movimento pequeno. O que parece mais útil agora?`, `Estou aqui com você — seja pra continuar conversando ou encontrar algo concreto.`];

    const listeningOnlyExtrasPt = [`Você não precisa resolver isso agora.`, `Não vou a lugar nenhum. Fala o quanto precisar.`, `Você pode sentir tudo isso.`, `Não precisa empacotar isso arrumado.`];

    const openersByToneRu: Record<LocalResponseTone, string[]> = {
        calm: [`Я здесь с тобой.`, `Давай разберёмся с этим не спеша.`, `Хорошо. Возьмём это спокойно.`, `Я здесь. Давай разберём по частям.`, `Это понятно — так чувствовать.`, `Не торопись. Я никуда не уйду.`],
        supportive: [`Я слушаю тебя.`, `Спасибо, что рассказал(а) мне.`, `Это требует смелости — говорить об этом.`, `Рад(а), что ты написал(а).`, `Я слушаю — внимательно.`, `Это звучит очень тяжело.`],
        practical: [`Хорошо. Давай посмотрим на это чётко.`, `Понял(а). Разберём шаг за шагом.`, `Найдём самое важное.`, `Я здесь. Сделаем это управляемым.`],
        coach: [`Хорошо, я здесь. Сначала стабилизируемся.`, `Понял(а). Разберём постепенно.`, `Давай замедлимся и найдём точку опоры.`, `Я слушаю. Разберём по частям.`],
        "gentle-humor": [`Хорошо, я здесь.`, `Хм, слушаю тебя.`, `Понял(а). Я с тобой.`, `Давай сделаем это чуть легче — по одному маленькому шагу.`],
        direct: [`Хорошо. Я здесь.`, `Говори прямо.`, `Понял(а). Держимся устойчиво.`, `Слушаю. Сразу к сути.`],
    };

    const validationsRu: Record<typeof signal, string[]> = {
        sad: [`Это действительно больно.`, `Такая боль не проходит сама по себе.`, `Мне жаль, что ты через это проходишь.`, `Это действительно тяжело — не немного, а по-настоящему.`, `То, что ты чувствуешь, совершенно понятно.`, `Ты не заслужил(а) этого.`],
        anxious: [`Похоже, твой ум работает на полной скорости.`, `Такое давление изматывает изнутри.`, `Чувствовать себя на грани в такой ситуации — это нормально.`, `Держать столько неопределённости сразу — это тяжело.`, `Тревога по этому поводу — очень человечная реакция.`, `Твоя нервная система реагирует на что-то реальное.`],
        angry: [`Этот гнев совершенно понятен.`, `Здесь что-то реальное произошло — это раздражение обоснованно.`, `Я бы чувствовал(а) то же самое.`, `Да — это действительно несправедливо.`, `Такое задевает любого человека.`, `Злиться на это — нормально.`],
        tired: [`Такая усталость глубже того, что сон может исправить.`, `Ты несёшь много уже долгое время.`, `Неудивительно, что нет сил — это много.`, `Такая усталость накапливается тихо, а потом бьёт разом.`, `Ты имеешь право быть измотан(а) этим.`, `Это настоящее истощение, а не просто усталость.`],
        okay: [`Расскажи немного больше.`, `Я здесь — что происходит?`, `Что сейчас давит на тебя больше всего?`, `Что занимает твои мысли больше всего?`],
    };

    const carryValidationsRu = [`Это всё ещё с тобой — я чувствую это.`, `Похоже, это ещё не осело — и это понятно.`, `Ты всё ещё в середине этого, правда?`, `Оно не отпустило тебя. Побудем с этим ещё немного.`, `Что-то в этом всё время возвращается к тебе.`];

    const extrasByToneRu: Record<LocalResponseTone, string[]> = {
        calm: [``, `Сейчас можно сосредоточиться на одной части.`, `Не нужно торопиться с этим.`, `Можно держаться устойчиво без лишнего давления.`],
        supportive: [``, `Тебе не нужно нести всё сразу.`, `Остановимся на том, что давит больше всего.`, `Хорошо, если всё ещё кажется запутанным.`],
        practical: [``, `Давай сначала найдём самое важное.`, `Можно сделать это управляемым.`, `Одного полезного шага пока достаточно.`],
        coach: [``, `Найдём самую рабочую часть сначала.`, `Сейчас нужен только один устойчивый шаг.`, `Не нужно разбираться во всём сразу.`],
        "gentle-humor": [``, `Можно немного облегчить это, не игнорируя.`, `Одного маленького сдвига пока достаточно.`, `Я всё ещё здесь с тобой.`],
        direct: [``, `Держимся ясности.`, `Можно разбирать одну реальную часть за раз.`, `Только следующий полезный шаг важен сейчас.`],
    };

    const carryExtrasRu: Record<LocalResponseTone, string[]> = {
        calm: [`Не нужно никуда подталкивать это сейчас.`, `Можно просто побыть с этим немного.`],
        supportive: [`Тебе не нужно объяснять это идеально сейчас.`, `Я всё ещё здесь с тобой.`],
        practical: [`Держим это простым пока.`, `Не нужен весь ответ, только следующий чёткий шаг.`],
        coach: [`Сначала стабилизируемся, потом действуем.`, `Одного твёрдого шага позже достаточно.`],
        "gentle-humor": [`Можно держать это мягко, без лишних сложностей.`, `Не нужно решать всё сейчас.`],
        direct: [`Не усложняем это сейчас.`, `Сначала реальная часть.`],
    };

    const reflectLinesRu = [
        keyTopic ? `Ты упомянул(а) ${keyTopic} — что в этом кажется самым срочным сейчас?` : `Что из всего этого давит на тебя больше всего прямо сейчас?`,
        `Что вызывает наибольший дискомфорт в этом?`,
        `Если выбрать одно, что беспокоит тебя больше всего — что это?`,
        `Что ты хотел(а) бы видеть по-другому в этой ситуации?`,
    ];

    const nextStepLinesRu = [`Можем продолжить разговор или найти одно маленькое дело — что кажется правильным.`, `Одним нужно сначала всё высказать. Другие хотят план. Где ты сейчас?`, `Можем продолжить разбирать это или найти маленькое действие. Что кажется полезнее?`, `Я с тобой — будь то продолжение разговора или что-то конкретное.`];

    const listeningOnlyExtrasRu = [`Тебе не нужно разбираться в этом прямо сейчас.`, `Я никуда не ухожу. Говори столько, сколько нужно.`, `Ты можешь чувствовать всё это.`, `Не нужно всё это аккуратно упаковывать.`];

    const openersByToneId: Record<LocalResponseTone, string[]> = {
        calm: [`Aku di sini bersamamu.`, `Mari kita hadapi ini pelan-pelan.`, `Oke. Kita ambil dengan tenang.`, `Aku di sini. Kita lihat satu per satu.`, `Wajar kalau merasa seperti itu.`, `Ambil waktumu. Aku tidak ke mana-mana.`],
        supportive: [`Aku mendengarmu.`, `Terima kasih sudah cerita ini kepadaku.`, `Butuh keberanian untuk mengatakannya.`, `Senang kamu menghubungiku.`, `Aku mendengarkan sepenuhnya.`, `Kedengarannya benar-benar sulit.`],
        practical: [`Oke. Kita lihat ini dengan jelas.`, `Aku mengerti. Kita ambil selangkah demi selangkah.`, `Mari cari bagian yang paling penting.`, `Aku di sini. Kita buat ini lebih terkelola.`],
        coach: [`Baik, aku di sini. Pertama kita stabilkan dulu.`, `Aku mengerti. Kita akan hadapi ini langkah demi langkah.`, `Mari kita perlambat dan temukan pijakan yang kuat.`, `Aku mendengarmu. Kita lihat satu bagian demi satu.`],
        "gentle-humor": [`Baik, aku di sini.`, `Hmm, aku mendengarmu.`, `Mengerti. Aku bersamamu.`, `Mari kita buat ini sedikit lebih ringan — satu langkah kecil.`],
        direct: [`Oke. Aku di sini.`, `Mari kita langsung saja.`, `Mengerti. Kita tetap stabil.`, `Aku mendengarmu. Langsung ke intinya.`],
    };

    const validationsId: Record<typeof signal, string[]> = {
        sad: [`Ini sungguh menyakitkan.`, `Rasa sakit seperti ini tidak hilang begitu saja.`, `Aku minta maaf kamu mengalami ini.`, `Ini sungguh berat — bukan hanya sedikit, tapi benar-benar berat.`, `Apa yang kamu rasakan sangat masuk akal.`, `Kamu tidak layak mengalami ini.`],
        anxious: [`Sepertinya pikiranmu sedang berjalan sangat cepat.`, `Tekanan seperti ini menguras dari dalam.`, `Wajar sekali merasa gelisah dengan semua ini.`, `Menanggung begitu banyak ketidakpastian sekaligus memang berat.`, `Merasa cemas tentang ini adalah respons yang sangat manusiawi.`, `Sistem sarafmu sedang bereaksi terhadap sesuatu yang nyata.`],
        angry: [`Kemarahan itu sangat masuk akal.`, `Ada sesuatu yang nyata terjadi di sini — frustrasi itu valid.`, `Aku pun akan merasakan hal yang sama.`, `Ya — itu sungguh tidak adil.`, `Hal seperti ini memang mengganggu siapa pun.`, `Tidak apa-apa merasa marah tentang ini.`],
        tired: [`Kelelahan ini lebih dalam dari yang bisa diperbaiki oleh tidur.`, `Kamu sudah menanggung banyak hal sejak lama.`, `Wajar kalau energimu rendah — ini memang banyak.`, `Kelelahan seperti ini menumpuk pelan-pelan lalu menghantam sekaligus.`, `Kamu boleh merasa kelelahan karena ini.`, `Ini kelelahan yang nyata, bukan sekadar capek.`],
        okay: [`Ceritakan sedikit lagi.`, `Aku di sini — ada apa?`, `Apa yang paling membebanimu sekarang?`, `Apa hal terbesar yang ada di pikiranmu?`],
    };

    const carryValidationsId = [`Ini masih bersamamu — aku merasakannya.`, `Sepertinya ini belum selesai dalam dirimu, dan itu wajar.`, `Kamu masih di tengah-tengah ini, kan?`, `Ini belum melepaskanmu. Mari kita tinggal di sini sedikit lebih lama.`, `Ada sesuatu tentang ini yang terus kembali untukmu.`];

    const extrasByToneId: Record<LocalResponseTone, string[]> = {
        calm: [``, `Untuk sekarang, kita fokus pada satu bagian saja.`, `Tidak perlu terburu-buru.`, `Kita bisa tetap stabil tanpa memaksanya.`],
        supportive: [``, `Kamu tidak perlu menanggung semuanya sekaligus.`, `Mari kita tinggal dulu di bagian yang terasa paling berat.`, `Tidak apa-apa kalau semuanya masih terasa kacau.`],
        practical: [``, `Pertama kita lihat yang paling penting.`, `Kita bisa membuat ini lebih terkelola.`, `Satu hal yang berguna sudah cukup untuk sekarang.`],
        coach: [``, `Mari temukan bagian yang paling bisa dijalankan dulu.`, `Kita hanya butuh satu langkah yang mantap sekarang.`, `Kamu tidak perlu mengurai semuanya sekaligus.`],
        "gentle-humor": [``, `Kita bisa membuat ini sedikit lebih ringan tanpa mengabaikannya.`, `Satu perubahan kecil sudah cukup untuk sekarang.`, `Aku masih di sini bersamamu.`],
        direct: [``, `Kita tetap jelas.`, `Kita bisa hadapi satu bagian nyata sekaligus.`, `Hanya langkah berguna berikutnya yang penting sekarang.`],
    };

    const carryExtrasId: Record<LocalResponseTone, string[]> = {
        calm: [`Kita tidak perlu mendorong ini ke mana-mana dulu.`, `Kita bisa tinggal bersamanya sebentar.`],
        supportive: [`Kamu tidak perlu menjelaskan ini dengan sempurna sekarang.`, `Aku masih di sini bersamamu.`],
        practical: [`Kita jaga tetap sederhana dulu.`, `Kita tidak butuh semua jawaban, hanya langkah berikutnya yang jelas.`],
        coach: [`Pertama kita stabilkan sebelum melakukan apa pun.`, `Satu langkah yang kokoh nanti sudah cukup.`],
        "gentle-humor": [`Kita bisa menjaga ini tetap ringan tanpa terlalu rumit.`, `Tidak perlu menyelesaikan semuanya sekarang.`],
        direct: [`Kita tidak perumit ini sekarang.`, `Bagian yang nyata dulu.`],
    };

    const reflectLinesId = [
        keyTopic ? `Kamu menyebut ${keyTopic} — bagian mana yang terasa paling mendesak sekarang?` : `Bagian mana dari ini yang paling membebanimu sekarang?`,
        `Apa yang membuat kamu paling tidak nyaman dengan semua ini?`,
        `Kalau harus memilih satu hal yang paling mengganggumu — apa itu?`,
        `Apa yang kamu harapkan berbeda dalam situasi ini?`,
    ];

    const nextStepLinesId = [`Kita bisa terus ngobrol tentang ini, atau menemukan satu hal kecil untuk dicoba — mana yang terasa benar.`, `Beberapa orang perlu mengungkapkan semuanya dulu. Yang lain ingin rencana. Kamu sekarang di mana?`, `Kita bisa terus membuka ini, atau menemukan satu langkah kecil. Mana yang lebih berguna sekarang?`, `Aku bersamamu — baik untuk melanjutkan ngobrol atau menemukan sesuatu yang konkret.`];

    const listeningOnlyExtrasId = [`Kamu tidak perlu memahami ini sekarang.`, `Aku tidak ke mana-mana. Katakan sebanyak atau sesedikit yang kamu butuhkan.`, `Kamu boleh merasakan semua ini.`, `Kamu tidak perlu membungkus ini dengan rapi.`];

    const openersByToneUr: Record<LocalResponseTone, string[]> = {
        calm: [`Main tumhare saath hoon.`, `Ise dheere dheere dekhte hain.`, `Theek hai. Aram se lete hain.`, `Main hoon yahan. Ek ek hissa dekhte hain.`, `Yeh baat samajh aati hai.`, `Waqt lena. Main kahin nahi ja raha.`],
        supportive: [`Main sun raha hoon.`, `Shukriya ke tumne mujhe bataya.`, `Yeh kehne mein himmat chahiye thi.`, `Khushi hui ke tumne likha.`, `Main poori tarah sun raha hoon.`, `Yeh sach mein mushkil lagg raha hai.`],
        practical: [`Theek hai. Ise saaf nazar se dekhte hain.`, `Samajh gaya. Ek ek kadam chalte hain.`, `Sabse zaroori hissa dhoondhte hain.`, `Main hoon. Ise sambhalne laiq banate hain.`],
        coach: [`Theek hai, main hoon. Pehle ise stable karte hain.`, `Samajh gaya. Ik ik step mein chalenge.`, `Thoda slow hoke khud ko theek karte hain.`, `Sun raha hoon. Ek ek hissa dekhte hain.`],
        "gentle-humor": [`Theek hai, main hoon yahan.`, `Hmm, sun raha hoon.`, `Samajh gaya. Tumhare saath hoon.`, `Chalo, ise thoda halka karte hain — ek chota kadam.`],
        direct: [`Theek hai. Main hoon.`, `Seedhe baat karte hain.`, `Samajh gaya. Stable rakhte hain.`, `Sun raha hoon. Seedhe mudde par aate hain.`],
    };

    const validationsUr: Record<typeof signal, string[]> = {
        sad: [`Yeh sach mein bahut dard deta hai.`, `Is tarah ka dard apne aap theek nahi hota.`, `Mujhe afsos hai ke tum isse guzar rahe ho.`, `Yeh sach mein mushkil hai — thoda nahi, bahut zyada.`, `Jo tum feel kar rahe ho, woh bilkul samajh aata hai.`, `Tum is ke laiq nahi the.`],
        anxious: [`Lagg raha hai dimaag poori speed mein chal raha hai.`, `Is tarah ka dabaao andar se bahut thaka deta hai.`, `In sab ke beech bechain rehna bilkul samajh aata hai.`, `Itni saari uncertainty ek saath uthana bahut bhaari hai.`, `Is par bechain rehna ek insaani response hai.`, `Tumhara nervous system kisi asli cheez par react kar raha hai.`],
        angry: [`Yeh gussa bilkul samajh aata hai.`, `Yahan kuch asal mein hua hai — yeh frustration durust hai.`, `Main bhi aisa hi feel karta.`, `Haan — yeh sach mein nainsaafi hai.`, `Is tarah ki baat kisi ko bhi andar tak jalati hai.`, `Is par gussa hona theek hai.`],
        tired: [`Yeh thakaan sirf neend se theek nahi hoti.`, `Tum bahut arsay se bahut kuch uthaye hue ho.`, `In sab ke saath energy ka kam hona samajh aata hai.`, `Yeh thakaan dheere dheere jama hoti hai, phir ek saath lagg jaati hai.`, `Tumhe isse thake rehne ka haq hai.`, `Yeh sach mein nik hona hai, sirf thakaan nahi.`],
        okay: [`Thoda aur batao.`, `Main hoon — kya ho raha hai?`, `Abhi tumhare upar sabse zyada kya bhaari hai?`, `Abhi dimaag mein sabse badi baat kya hai?`],
    };

    const carryValidationsUr = [`Yeh abhi bhi tumhare saath hai — main yeh mehsoos kar sakta hoon.`, `Lagg raha hai yeh abhi bhi settle nahi hua, aur yeh samajh aata hai.`, `Tum abhi bhi is ke beech mein ho, nahi?`, `Yeh tumhe chhod nahi raha. Thodi der aur is ke saath rehte hain.`, `Kuch is ke baare mein baar baar wapas aata hai tumhare liye.`];

    const extrasByToneUr: Record<LocalResponseTone, string[]> = {
        calm: [``, `Abhi sirf ek hissa pakad ke chal sakte hain.`, `Puri baat ek saath sulajhne ki jaldi nahi.`, `Bina force kiye stable rakh sakte hain.`],
        supportive: [``, `Tumhe sab kuch ek saath uthana nahi hai.`, `Jo sabse bhaari hai, pehle usi ke saath rehte hain.`, `Agar sab abhi bhi uljha lag raha hai, koi baat nahi.`],
        practical: [``, `Pehle jo sabse zaroori hai woh dekhte hain.`, `Ise sambhalne laiq rakh sakte hain.`, `Abhi ek kaam ki cheez dekhna kaafi hai.`],
        coach: [``, `Pehle sabse kaam ka hissa dhoondhte hain.`, `Abhi sirf ek stable move kaafi hai.`, `Tumhe sab kuch ek saath suljhana nahi hai.`],
        "gentle-humor": [``, `Ise halka rakh sakte hain bina ignore kiye.`, `Abhi ek chhota shift kaafi hai.`, `Main abhi bhi tumhare saath hoon.`],
        direct: [``, `Ise saaf rakhte hain.`, `Ek real hissa ek baar mein dekh sakte hain.`, `Abhi sirf agla useful hissa kaafi hai.`],
    };

    const carryExtrasUr: Record<LocalResponseTone, string[]> = {
        calm: [`Abhi ise kahin dhakelne ki zaroorat nahi.`, `Thodi der isi ke saath reh sakte hain.`],
        supportive: [`Tumhe ise ab perfectly samjhana zaruri nahi.`, `Main abhi bhi tumhare saath hoon isme.`],
        practical: [`Abhi ise simple rakhte hain.`, `Poora jawab nahi, bas agla saaf hissa dekhna hai.`],
        coach: [`Kuch karne se pehle ise stable karte hain.`, `Baad mein ek grounded step kaafi hoga.`],
        "gentle-humor": [`Ise halka rakh sakte hain bina uljhaye.`, `Abhi poori kushti ladne ki zaroorat nahi.`],
        direct: [`Abhi ise complicated nahi karte.`, `Pehle real hissa pakadte hain.`],
    };

    const reflectLinesUr = [
        keyTopic ? `Tumne ${keyTopic} ki baat ki — us mein abhi sabse zyada kya daba raha hai?` : `Is mein abhi sabse zyada kya tumhare upar bhaari hai?`,
        `Is mein sabse zyada kya uncomfortable hai?`,
        `Agar ek hi cheez chunni ho jo sabse zyada pareshaan kare — woh kya hogi?`,
        `Tum chahte ho is situation mein kya alag hota?`,
    ];

    const nextStepLinesUr = [`Hum baat karte rehte hain, ya ek chhoti cheez try karte hain — jo sahi lage woh.`, `Kuch logon ko pehle sab bol dena hota hai. Kuch plan chahte hain. Tum abhi kahan ho?`, `Ise aur kholte hain, ya ek chhota kadam. Abhi kya zyada useful lagta hai?`, `Main tumhare saath hoon — chahe baat karte rehna ho ya kuch concrete karna.`];

    const listeningOnlyExtrasUr = [`Abhi ise figure out karne ki zaroorat nahi.`, `Main kahin nahi ja raha. Jitna chahte ho utna bolo.`, `Tum yeh sab feel kar sakte ho.`, `Ise neatly wrap up karne ki koi zaroorat nahi.`];

    const bankLanguage = toReplyBankLanguage(language);

    const openers =
        bankLanguage === "hi"
            ? openersByToneHi[companionTone]
            : bankLanguage === "mr"
                ? openersByToneMr[companionTone]
                : bankLanguage === "bn"
                    ? openersByToneBn[companionTone]
                    : bankLanguage === "ta"
                        ? openersByToneTa[companionTone]
                        : bankLanguage === "te"
                            ? openersByToneTe[companionTone]
                            : bankLanguage === "gu"
                                ? openersByToneGu[companionTone]
                                : bankLanguage === "pa"
                                    ? openersByTonePa[companionTone]
                                    : bankLanguage === "kn"
                                        ? openersByToneKn[companionTone]
                                        : bankLanguage === "ml"
                                            ? openersByToneMl[companionTone]
                                            : bankLanguage === "or"
                                                ? openersByToneOr[companionTone]
                                                : bankLanguage === "zh"
                                                    ? openersByToneZh[companionTone]
                                                    : bankLanguage === "es"
                                                        ? openersByToneEs[companionTone]
                                                        : bankLanguage === "ar"
                                                            ? openersByToneAr[companionTone]
                                                            : bankLanguage === "fr"
                                                                ? openersByToneFr[companionTone]
                                                                : bankLanguage === "pt"
                                                                    ? openersByTonePt[companionTone]
                                                                    : bankLanguage === "ru"
                                                                        ? openersByToneRu[companionTone]
                                                                        : bankLanguage === "id"
                                                                            ? openersByToneId[companionTone]
                                                                            : bankLanguage === "ur"
                                                                                ? openersByToneUr[companionTone]
                                                                                : openersByToneEn[companionTone];

    const validations =
        bankLanguage === "hi"
            ? validationsHi
            : bankLanguage === "mr"
                ? validationsMr
                : bankLanguage === "bn"
                    ? validationsBn
                    : bankLanguage === "ta"
                        ? validationsTa
                        : bankLanguage === "te"
                            ? validationsTe
                            : bankLanguage === "gu"
                                ? validationsGu
                                : bankLanguage === "pa"
                                    ? validationsPa
                                    : bankLanguage === "kn"
                                        ? validationsKn
                                        : bankLanguage === "ml"
                                            ? validationsMl
                                            : bankLanguage === "or"
                                                ? validationsOr
                                                : bankLanguage === "zh"
                                                    ? validationsZh
                                                    : bankLanguage === "es"
                                                        ? validationsEs
                                                        : bankLanguage === "ar"
                                                            ? validationsAr
                                                            : bankLanguage === "fr"
                                                                ? validationsFr
                                                                : bankLanguage === "pt"
                                                                    ? validationsPt
                                                                    : bankLanguage === "ru"
                                                                        ? validationsRu
                                                                        : bankLanguage === "id"
                                                                            ? validationsId
                                                                            : bankLanguage === "ur"
                                                                                ? validationsUr
                                                                                : validationsEn;

    const reflectLines =
        bankLanguage === "hi"
            ? reflectLinesHi
            : bankLanguage === "mr"
                ? reflectLinesMr
                : bankLanguage === "bn"
                    ? reflectLinesBn
                    : bankLanguage === "gu"
                        ? reflectLinesGu
                        : bankLanguage === "pa"
                            ? reflectLinesPa
                            : bankLanguage === "kn"
                                ? reflectLinesKn
                                : bankLanguage === "ml"
                                    ? reflectLinesMl
                                    : bankLanguage === "or"
                                        ? reflectLinesOr
                                        : bankLanguage === "zh"
                                            ? reflectLinesZh
                                            : bankLanguage === "es"
                                                ? reflectLinesEs
                                                : bankLanguage === "ar"
                                                    ? reflectLinesAr
                                                    : bankLanguage === "fr"
                                                        ? reflectLinesFr
                                                        : bankLanguage === "pt"
                                                            ? reflectLinesPt
                                                            : bankLanguage === "ru"
                                                                ? reflectLinesRu
                                                                : bankLanguage === "id"
                                                                    ? reflectLinesId
                                                                    : bankLanguage === "ur"
                                                                        ? reflectLinesUr
                                                                        : reflectLinesEn;

    const nextStepLines =
        bankLanguage === "hi"
            ? nextStepLinesHi
            : bankLanguage === "mr"
                ? nextStepLinesMr
                : bankLanguage === "bn"
                    ? nextStepLinesBn
                    : bankLanguage === "gu"
                        ? nextStepLinesGu
                        : bankLanguage === "pa"
                            ? nextStepLinesPa
                            : bankLanguage === "kn"
                                ? nextStepLinesKn
                                : bankLanguage === "ml"
                                    ? nextStepLinesMl
                                    : bankLanguage === "or"
                                        ? nextStepLinesOr
                                        : bankLanguage === "zh"
                                            ? nextStepLinesZh
                                            : bankLanguage === "es"
                                                ? nextStepLinesEs
                                                : bankLanguage === "ar"
                                                    ? nextStepLinesAr
                                                    : bankLanguage === "fr"
                                                        ? nextStepLinesFr
                                                        : bankLanguage === "pt"
                                                            ? nextStepLinesPt
                                                            : bankLanguage === "ru"
                                                                ? nextStepLinesRu
                                                                : bankLanguage === "id"
                                                                    ? nextStepLinesId
                                                                    : bankLanguage === "ur"
                                                                        ? nextStepLinesUr
                                                                        : nextStepLinesEn;

    const extrasByTone =
        bankLanguage === "hi"
            ? extrasByToneHi
            : bankLanguage === "mr"
                ? extrasByToneMr
                : bankLanguage === "bn"
                    ? extrasByToneBn
                    : bankLanguage === "ta"
                        ? extrasByToneTa
                        : bankLanguage === "te"
                            ? extrasByToneTe
                            : bankLanguage === "gu"
                                ? extrasByToneGu
                                : bankLanguage === "pa"
                                    ? extrasByTonePa
                                    : bankLanguage === "kn"
                                        ? extrasByToneKn
                                        : bankLanguage === "ml"
                                            ? extrasByToneMl
                                            : bankLanguage === "or"
                                                ? extrasByToneOr
                                                : bankLanguage === "zh"
                                                    ? extrasByToneZh
                                                    : bankLanguage === "es"
                                                        ? extrasByToneEs
                                                        : bankLanguage === "ar"
                                                            ? extrasByToneAr
                                                            : bankLanguage === "fr"
                                                                ? extrasByToneFr
                                                                : bankLanguage === "pt"
                                                                    ? extrasByTonePt
                                                                    : bankLanguage === "ru"
                                                                        ? extrasByToneRu
                                                                        : bankLanguage === "id"
                                                                            ? extrasByToneId
                                                                            : bankLanguage === "ur"
                                                                                ? extrasByToneUr
                                                                                : extrasByToneEn;

    const seedIntent = pick(["clarify", "reflect", "reframe"] as const, seed >>> 3);

    const prompt =
        seedIntent === "clarify"
            ? pick(nextStepLines, seed >>> 4)
            : seedIntent === "reflect"
                ? pick(reflectLines, seed >>> 4)
                : language === "hi"
                    ? `Agar hum ise thoda narmi se reframe karein, kaunsi ek aur dayalu explanation sach ho sakti hai?`
                    : language === "ur"
                        ? `Agar hum ise halke se reframe karein, to ek aur meherbaan taaweel sach ho sakti hai?`
                        : language === "bn"
                            ? `Jodi eta ektu narm bhabe reframe kori, tahole ar ekta dayalu byakkha ki hote pare?`
                            : language === "gu"
                                ? `Je hum ane thoda narmi thi reframe kariye, to ek aur dayalu explanation shu ho shaake?`
                                : language === "pa"
                                    ? `Je assi ise thodi narmi naal reframe kariye, ta ik hor dayaalu explanation ki ho sakdi aa?`
                                    : language === "mr"
                                        ? `He haluhalu reframe kele tar, ek dayaalu explanation kaay ashu shakate jo satya ashu shakel?`
                                        : language === "kn"
                                            ? `Idannu mellage reframe maadidare, yaavudu ondu dayaavulla explaination satyavaagabahudhu?`
                                            : language === "ml"
                                                ? `Idi mellage reframe cheyyumbol, oru dayaavulla explanation satyam aakaam?`
                                                : language === "or"
                                                    ? `Jadi eitaaku dheere reframe karaa jaae, taa ek dayaamaya explanation satya heba ki?`
                                                    : language === "ta"
                                                        ? `Idhai mellaga reframe paarththaal, oru dayaavulla viLakkam kooda unmai aagalaam?`
                                                        : language === "te"
                                                            ? `Deeniki mellaga reframe cheste, inka oka dayaardra vaikhhari nijam kaavachhu?`
                                                            : language === "zh"
                                                                ? `如果我们温和地重新看待这件事，还有什么更善意的解释可能是真的？`
                                                                : language === "es"
                                                                    ? `Si lo vemos con más amabilidad, ¿qué otra explicación podría ser cierta?`
                                                                    : language === "ar"
                                                                        ? `إذا أعدنا صياغته بلطف، ما التفسير الأكثر تعاطفًا الذي قد يكون صحيحاً؟`
                                                                        : language === "fr"
                                                                            ? `Si on le voit avec plus de bienveillance, quelle autre explication pourrait être vraie?`
                                                                            : language === "pt"
                                                                                ? `Se a gente reframe isso com gentileza, qual outra explicação mais gentil pode ser verdade?`
                                                                                : language === "ru"
                                                                                    ? `Если посмотреть на это мягче, какое ещё более доброе объяснение может быть правдой?`
                                                                                    : language === "id"
                                                                                        ? `Kalau kita lihat ini dari sisi yang lebih baik, penjelasan apa yang lebih bijak yang bisa juga benar?`
                                                                                        : `If we reframe this gently: what's one kinder explanation that could also be true?`;

    // #8: Correction repair — prepend an acknowledgement opener
    const correctionPrefixes: Partial<Record<LocalReplyBankLanguage, string>> = {
        en: "Let me try that differently —",
        hi: "Chalo phir se samjhte hain —",
        mr: "Chala punaah samjhto —",
        bn: "Chalo abar bujhi —",
        ta: "Maarichchu paarkalam —",
        te: "Inkaa okasaari try cheddaam —",
        gu: "Chalo pharthi samjhiye —",
        pa: "Chalo phir samjhiye —",
        kn: "Innomme try maadona —",
        ml: "Innoru praavashyam nokkaaam —",
        or: "Aaau eka bhara bujhibaa —",
        zh: "让我换个方式来说 —",
        es: "Déjame intentarlo de otra manera —",
        ar: "دعني أحاول بطريقة مختلفة —",
        fr: "Laisse-moi essayer autrement —",
        pt: "Deixa eu tentar de outro jeito —",
        ru: "Попробую по-другому —",
        id: "Izinkan saya mencoba dengan cara lain —",
        ur: "Aane do phir se samjhane ki koshish karta hoon —",
    };
    const correctionPrefix = isCorrection ? (correctionPrefixes[bankLanguage] ?? correctionPrefixes.en) + " " : "";

    // #7: Follow-up prefix when reply is vague and we have a key topic from earlier
    const followUpPrefixes: Partial<Record<LocalReplyBankLanguage, (topic: string) => string>> = {
        en: (t) => `Still thinking about the ${t} situation —`,
        hi: (t) => `Abhi bhi ${t} ki baat chal rahi hai —`,
        mr: (t) => `Abhi ${t} ch goshta suru aahe —`,
        bn: (t) => `Ekhono ${t} er bishoy niye aacha —`,
        ta: (t) => `Ingum ${t} patthi pesrom —`,
        te: (t) => `Ippudu ${t} vishayame —`,
        gu: (t) => `Abhi ${t} ni vaat chal rahi chhe —`,
        pa: (t) => `Hali ${t} di gall chal rahi aa —`,
        kn: (t) => `Ippudu ${t} vishayakke —`,
        ml: (t) => `Ippol ${t} kayaryathil —`,
        or: (t) => `Ekhanu ${t} bisayare —`,
        zh: (t) => `还在想着${t}的事 —`,
        es: (t) => `Todavía pensando en lo de ${t} —`,
        ar: (t) => `لا أزال أفكر في موضوع ${t} —`,
        fr: (t) => `Je pense encore à la situation ${t} —`,
        pt: (t) => `Ainda pensando na situação de ${t} —`,
        ru: (t) => `Всё ещё думаю о ситуации с ${t} —`,
        id: (t) => `Masih memikirkan soal ${t} —`,
        ur: (t) => `Abhi bhi ${t} ke baare mein soch raha hoon —`,
    };
    const followUpPrefix = (isVagueReply && keyTopic)
        ? ((followUpPrefixes[bankLanguage] ?? followUpPrefixes.en)!(keyTopic) + " ")
        : "";

    // #10: Topic-aware contextual hint appended after main message (multi-language)
    const topicHintsByLang: Partial<Record<LocalReplyBankLanguage, Record<string, string>>> = {
        en: {
            work: "Work pressure like this can really pile up.",
            relationship: "Relationships can carry so much weight.",
            health: "Taking care of yourself matters most right now.",
            existential: "These bigger questions deserve space.",
            general: "",
        },
        hi: {
            work: "Is tarah ka kaam ka dabaao sach mein bhaari hota hai.",
            relationship: "Rishte bahut kuch uthate hain.",
            health: "Abhi apna khayal rakhna sabse zaroori hai.",
            existential: "Yeh bade sawaalon ko jagah milni chahiye.",
            general: "",
        },
        mr: {
            work: "Aasa kaamaacha dabaao khupach bhaari asato.",
            relationship: "Naate khup kahi sahan karat astat.",
            health: "Ata swatahchi kaaljee ghene saglaat mahattvaache aahe.",
            existential: "Ya moThya prashnaaanaa jagaa milaayla havi.",
            general: "",
        },
        bn: {
            work: "Ei dhoroner kajer chap sacchi onek bhari hoy.",
            relationship: "Sombondho onek kichhu bahan kore.",
            health: "Ekhon nijer joton neoa sabcheye dorkar.",
            existential: "Ei boro proshnogulo jaygar dabi rakhe.",
            general: "",
        },
        ta: {
            work: "Indha maadiri velai azhutham mela varum.",
            relationship: "Uravugal romba paaram vahaikkum.",
            health: "Ippovum unavvai paaththukkolla mudiyum.",
            existential: "Indha periya kelvigalukku idam theva.",
            general: "",
        },
        te: {
            work: "Ee taraha paani pressure nijamgaa penkutundi.",
            relationship: "Sambandhaalu chala bhaaram vahaistaayi.",
            health: "Ippudu meeru meemi chusukovalsinidi anipistundi.",
            existential: "Ee peddha prashnaalu jaagaa arham chestaayi.",
            general: "",
        },
        gu: {
            work: "Aa prakaarno kaam no dabaao sachu j vadhtu jaay che.",
            relationship: "Sambandho ghanu kainchuk vahe chhe.",
            health: "Abhi potani kaalagni rakhavi saagaman zaroori chhe.",
            existential: "Aa mota prashno ne jagya milavi joie.",
            general: "",
        },
        pa: {
            work: "Is tarah da kaam da dbaao sach mein vadhda jaanda hai.",
            relationship: "Rishte bahut kuch chukke hunde hain.",
            health: "Hun apna khayal rakhna sabto zaroor hai.",
            existential: "Eh vadde sawaal jagah de haqdar hain.",
            general: "",
        },
        kn: {
            work: "Ee tarah kaam othattada nijavaagi jaastaaguttade.",
            relationship: "Sambandha tumba hothtu vaahisuttave.",
            health: "Ippudu nimage jaghruta thegondu munduvaraguvudu mukhya.",
            existential: "Ee dodda prashnega jagha sigabeku.",
            general: "",
        },
        ml: {
            work: "Ithupola job pressure sacchi koodi varum.",
            relationship: "Bandhangal valare bharam vahikkunnundu.",
            health: "Ippol ninne sheriyaagi naakaanulla samayam idan.",
            existential: "Ee valiya chodyangalkku space venam.",
            general: "",
        },
        or: {
            work: "Ei dharan kaama r chap sachhi onek bhari.",
            relationship: "Sambandh bahut kichhi bahana kare.",
            health: "Ekhon nijakee jatna neiba sabse important.",
            existential: "Ei boro prashnagudi jagaa paibaara dabi rakhe.",
            general: "",
        },
        zh: {
            work: "这种工作压力真的会越积越重。",
            relationship: "感情关系可以承载很多东西。",
            health: "现在照顾好自己是最重要的。",
            existential: "这些更大的问题值得被认真对待。",
            general: "",
        },
        es: {
            work: "Este tipo de presión laboral realmente se acumula.",
            relationship: "Las relaciones pueden pesar mucho.",
            health: "Cuidarte es lo más importante ahora mismo.",
            existential: "Estas preguntas más grandes merecen espacio.",
            general: "",
        },
        ar: {
            work: "هذا النوع من ضغط العمل يتراكم فعلاً.",
            relationship: "العلاقات يمكن أن تحمل ثقلاً كبيراً.",
            health: "الاهتمام بنفسك هو الأهم الآن.",
            existential: "هذه الأسئلة الكبيرة تستحق مساحة.",
            general: "",
        },
        fr: {
            work: "Ce genre de pression au travail s'accumule vraiment.",
            relationship: "Les relations peuvent peser beaucoup.",
            health: "Prendre soin de toi est ce qui compte le plus maintenant.",
            existential: "Ces grandes questions méritent de la place.",
            general: "",
        },
        pt: {
            work: "Esse tipo de pressão no trabalho realmente se acumula.",
            relationship: "Os relacionamentos podem carregar muito peso.",
            health: "Cuidar de si mesmo é o mais importante agora.",
            existential: "Essas questões maiores merecem espaço.",
            general: "",
        },
        ru: {
            work: "Такое давление на работе действительно накапливается.",
            relationship: "Отношения могут нести в себе очень много.",
            health: "Прямо сейчас важнее всего позаботиться о себе.",
            existential: "Эти большие вопросы заслуживают пространства.",
            general: "",
        },
        id: {
            work: "Tekanan kerja seperti ini memang bisa menumpuk.",
            relationship: "Hubungan bisa membawa beban yang sangat berat.",
            health: "Merawat dirimu sendiri adalah hal terpenting saat ini.",
            existential: "Pertanyaan-pertanyaan besar ini layak mendapat ruang.",
            general: "",
        },
        ur: {
            work: "Kaam ka yeh bojh dil pe bhaari pad raha hoga.",
            relationship: "Rishtey bahut kuch sahen karte hain — yeh sach hai.",
            health: "Apna khayal rakhna abhi sabse pehli baat hai.",
            existential: "Yeh bade sawaal hain — inhe jagah milni chahiye.",
            general: "",
        },
    };
    const topicHint = (topic !== "general" && signal !== "okay")
        ? ` ${(topicHintsByLang[bankLanguage] ?? topicHintsByLang.en)![topic] ?? ""}`
        : "";

    const opener = pick(openers, seed);
    const hasCarry = signal === "okay" && hasRecentEmotionalSignal(recentContext);

    const validation =
        hasCarry && bankLanguage === "hi"
            ? pick(carryValidationsHi, seed >>> 1)
            : hasCarry && bankLanguage === "mr"
                ? pick(carryValidationsMr, seed >>> 1)
                : hasCarry && bankLanguage === "bn"
                    ? pick(carryValidationsBn, seed >>> 1)
                    : hasCarry && bankLanguage === "ta"
                        ? pick(carryValidationsTa, seed >>> 1)
                        : hasCarry && bankLanguage === "te"
                            ? pick(carryValidationsTe, seed >>> 1)
                            : hasCarry && bankLanguage === "gu"
                                ? pick(carryValidationsGu, seed >>> 1)
                                : hasCarry && bankLanguage === "pa"
                                    ? pick(carryValidationsPa, seed >>> 1)
                                    : hasCarry && bankLanguage === "kn"
                                        ? pick(carryValidationsKn, seed >>> 1)
                                        : hasCarry && bankLanguage === "ml"
                                            ? pick(carryValidationsMl, seed >>> 1)
                                            : hasCarry && bankLanguage === "or"
                                                ? pick(carryValidationsOr, seed >>> 1)
                                                : hasCarry && bankLanguage === "zh"
                                                    ? pick(carryValidationsZh, seed >>> 1)
                                                    : hasCarry && bankLanguage === "es"
                                                        ? pick(carryValidationsEs, seed >>> 1)
                                                        : hasCarry && bankLanguage === "ar"
                                                            ? pick(carryValidationsAr, seed >>> 1)
                                                            : hasCarry && bankLanguage === "fr"
                                                                ? pick(carryValidationsFr, seed >>> 1)
                                                                : hasCarry && bankLanguage === "pt"
                                                                    ? pick(carryValidationsPt, seed >>> 1)
                                                                    : hasCarry && bankLanguage === "ru"
                                                                        ? pick(carryValidationsRu, seed >>> 1)
                                                                        : hasCarry && bankLanguage === "id"
                                                                            ? pick(carryValidationsId, seed >>> 1)
                                                                            : hasCarry && bankLanguage === "ur"
                                                                                ? pick(carryValidationsUr, seed >>> 1)
                                                                                : hasCarry
                                                                                    ? pick(carryValidationsEn, seed >>> 1)
                                                                                    : pick(validations[signal], seed >>> 1);

    const extra =
        hasCarry && bankLanguage === "hi"
            ? pick(carryExtrasHi[companionTone], seed >>> 5)
            : hasCarry && bankLanguage === "mr"
                ? pick(carryExtrasMr[companionTone], seed >>> 5)
                : hasCarry && bankLanguage === "bn"
                    ? pick(carryExtrasBn[companionTone], seed >>> 5)
                    : hasCarry && bankLanguage === "gu"
                        ? pick(carryExtrasGu[companionTone], seed >>> 5)
                        : hasCarry && bankLanguage === "pa"
                            ? pick(carryExtrasPa[companionTone], seed >>> 5)
                            : hasCarry && bankLanguage === "kn"
                                ? pick(carryExtrasKn[companionTone], seed >>> 5)
                                : hasCarry && bankLanguage === "ml"
                                    ? pick(carryExtrasMl[companionTone], seed >>> 5)
                                    : hasCarry && bankLanguage === "or"
                                        ? pick(carryExtrasOr[companionTone], seed >>> 5)
                                        : hasCarry && bankLanguage === "zh"
                                            ? pick(carryExtrasZh[companionTone], seed >>> 5)
                                            : hasCarry && bankLanguage === "es"
                                                ? pick(carryExtrasEs[companionTone], seed >>> 5)
                                                : hasCarry && bankLanguage === "ar"
                                                    ? pick(carryExtrasAr[companionTone], seed >>> 5)
                                                    : hasCarry && bankLanguage === "fr"
                                                        ? pick(carryExtrasFr[companionTone], seed >>> 5)
                                                        : hasCarry && bankLanguage === "pt"
                                                            ? pick(carryExtrasPt[companionTone], seed >>> 5)
                                                            : hasCarry && bankLanguage === "ru"
                                                                ? pick(carryExtrasRu[companionTone], seed >>> 5)
                                                                : hasCarry && bankLanguage === "id"
                                                                    ? pick(carryExtrasId[companionTone], seed >>> 5)
                                                                    : hasCarry && bankLanguage === "ur"
                                                                        ? pick(carryExtrasUr[companionTone], seed >>> 5)
                                                                        : hasCarry
                                                                            ? pick(carryExtrasEn[companionTone], seed >>> 5)
                                                                            : userIntent === "venting"
                                                                                ? pick(
                                                                                    bankLanguage === "hi" ? listeningOnlyExtrasHi
                                                                                    : bankLanguage === "bn" ? listeningOnlyExtrasBn
                                                                                    : bankLanguage === "ta" ? listeningOnlyExtrasTa
                                                                                    : bankLanguage === "te" ? listeningOnlyExtrasTe
                                                                                    : bankLanguage === "gu" ? listeningOnlyExtrasGu
                                                                                    : bankLanguage === "pa" ? listeningOnlyExtrasPa
                                                                                    : bankLanguage === "kn" ? listeningOnlyExtrasKn
                                                                                    : bankLanguage === "ml" ? listeningOnlyExtrasMl
                                                                                    : bankLanguage === "or" ? listeningOnlyExtrasOr
                                                                                    : bankLanguage === "mr" ? listeningOnlyExtrasMr
                                                                                    : bankLanguage === "zh" ? listeningOnlyExtrasZh
                                                                                    : bankLanguage === "es" ? listeningOnlyExtrasEs
                                                                                    : bankLanguage === "ar" ? listeningOnlyExtrasAr
                                                                                    : bankLanguage === "fr" ? listeningOnlyExtrasFr
                                                                                    : bankLanguage === "pt" ? listeningOnlyExtrasPt
                                                                                    : bankLanguage === "ru" ? listeningOnlyExtrasRu
                                                                                    : bankLanguage === "id" ? listeningOnlyExtrasId
                                                                                    : bankLanguage === "ur" ? listeningOnlyExtrasUr
                                                                                    : listeningOnlyExtrasEn,
                                                                                    seed >>> 5)
                                                                                : pick(extrasByTone[companionTone], seed >>> 5);

    const base = `${correctionPrefix}${followUpPrefix}${opener} ${validation}`.trim();
    const extraPart = suppressExtras ? "" : (extra ? " " + extra : "");
    const finalMsg = dedupeAdjacentSentences(
        `${base}${extraPart}${topicHint}`.trim()
    );

    // Age-aware closing: short, warm suffix for notably young or older users
    const userAge = toneContext?.userAge;
    const ageClosersByLang: Record<string, Partial<Record<LocalReplyBankLanguage, string>>> = {
        under_13: {
            en: "You're doing really well just by sharing this.",
            hi: "Yeh share karna himmat ki baat hai.",
            mr: "He share karane khupach dhads aache.",
            bn: "Eta share kora onek sahosher kaaj.",
            ta: "Idha sollaradhe nalla irukkudhu.",
            te: "Idi cheppadam chala brave ga undi.",
            kn: "Idu heltirodu tumba olle vishaya.",
            ml: "Idi paranjathu valare nannaayi.",
            gu: "Aa share karavanu ek himmat ni vaat chhe.",
            pa: "Eh share karna bahut himmat di gall hai.",
            or: "Eta share kara onek sahasa r kaaj.",
            zh: "能说出来就已经很厉害了。",
            es: "Compartir esto ya es un gran paso.",
            ar: "مجرد مشاركتك هذا أمر شجاع جداً.",
            fr: "Le fait d'en parler montre déjà beaucoup de courage.",
            pt: "Só de compartilhar isso você está indo muito bem.",
            ru: "То, что ты поделился — это уже очень смело.",
            id: "Sudah berani berbagi seperti ini itu keren.",
            ur: "Yeh share karna himmat ki baat hai.",
        },
        "13_17": {
            en: "You've got this.",
            hi: "Tum sambhal loge yaar.",
            mr: "Tu handle karasheel.",
            bn: "Tumi thik korte parbe.",
            ta: "Unakkale mudiyum.",
            te: "Nuvvu manage cheyagalagaavu.",
            kn: "Neevu handle maadabahudu.",
            ml: "Ninakku parreyum.",
            gu: "Tu sambhali laishe.",
            pa: "Tu sambhal lavega.",
            or: "Tume sambhaliba pariba.",
            zh: "你能行的。",
            es: "Tú puedes con esto.",
            ar: "أنت قادر على ذلك.",
            fr: "Tu vas y arriver.",
            pt: "Você consegue.",
            ru: "Ты справишься.",
            id: "Kamu bisa melewati ini.",
            ur: "Tum sambhal loge.",
        },
        "65_plus": {
            en: "Take your time — there is no rush.",
            hi: "Apni speed se chalo — koi jaldi nahi hai.",
            mr: "Tuzha vel ghe — kaahlichi ghai nahi.",
            bn: "Tomar time nao — kono taratari nei.",
            ta: "Un neram eduthukko — avasaara illai.",
            te: "Nee samayam teesukundu — avasaara ledu.",
            kn: "Nimma samaya tagondi — avasara illa.",
            ml: "Nee samayam edukku — tharamillaa.",
            gu: "Tamaro samay lejo — koi uchhat nathi.",
            pa: "Apna waqt lo — koi jaldi nahin.",
            or: "Tumara samay niao — kono jaldi nei.",
            zh: "慢慢来，不用着急。",
            es: "Tómate tu tiempo, no hay prisa.",
            ar: "خذ وقتك — لا داعي للتسرع.",
            fr: "Prends ton temps — il n'y a aucune urgence.",
            pt: "Leva o tempo que precisar — sem pressa.",
            ru: "Не торопись — всё в порядке.",
            id: "Santai saja, tidak perlu buru-buru.",
            ur: "Apni speed se chalo — koi jaldi nahi.",
        },
        "18_24": {
            en: "You're doing the right thing by talking about it.",
            hi: "Is baare mein baat karna sahi kadam hai.",
            mr: "Yaabaddal bolne he yogy aahe.",
            bn: "Eta niye kotha bola thik kaaj kara hochhe.",
            ta: "Idha pathi pesuradhu sari dhan.",
            te: "Idi gurinchi maatladatam manchidi.",
            kn: "Idu bagge mathaduvudu sariyaada kaelasa.",
            ml: "Itu kurichu samsaarikkunnathu shariyanukkaranam.",
            gu: "Aa baare vaat karavi yogya che.",
            pa: "Is baare gall karna sahi kadam hai.",
            or: "Ei bishayare kotha kahiba thik kaaj.",
            zh: "能说出来是正确的选择。",
            es: "Hablar de esto es lo correcto.",
            ar: "التحدث عن هذا هو الشيء الصحيح.",
            fr: "Parler de ça, c'est la bonne chose à faire.",
            pt: "Falar sobre isso é a coisa certa a fazer.",
            ru: "Ты правильно делаешь, что говоришь об этом.",
            id: "Kamu sudah melakukan hal yang benar dengan membicarakannya.",
            ur: "Is baare mein baat karna sahi kadam hai.",
        },
        "25_34": {
            en: "You're not alone in this — a lot of people carry something like this.",
            hi: "Tum akele nahi ho isme — bahut log aise hi kuch uthate hain.",
            mr: "Tu ekta nahi — aneka lok ase kahi sahan kartat.",
            bn: "Tumi ekla nao — onek lok ai rokom kichhu bahan kore.",
            ta: "Nee thani illai — neraya pera indha maadiri oru tholai irukku.",
            te: "Nuvvu okkadivu kaadu — chala mandhi ila emi o mootukuntaaru.",
            kn: "Neenu ontiiya alla — tumba jana heegey ennuva edanno bahoosuttaare.",
            ml: "Nee thaaniyan alla — nireyaal peral ithupole entho vehikkunnundu.",
            gu: "Tu eklo nathi — ghano log aavun kainchuk vahe chhe.",
            pa: "Tu akela nahi — bahut log aisa kuch chuk de hain.",
            or: "Tume eka nahi — onek lok eidharan kichhi bahi chaluchhi.",
            zh: "你不是一个人——很多人都有过类似的感受。",
            es: "No estás solo en esto — mucha gente carga con algo así.",
            ar: "أنت لست وحدك في هذا — كثير من الناس يحملون شيئاً مشابهاً.",
            fr: "Tu n'es pas seul — beaucoup de gens portent quelque chose comme ça.",
            pt: "Você não está sozinho nisso — muita gente carrega algo assim.",
            ru: "Ты не один — многие люди несут в себе нечто подобное.",
            id: "Kamu tidak sendirian — banyak orang merasakan hal serupa.",
            ur: "Tum akele nahi ho — bahut log aise hi kuch uthate hain.",
        },
        "35_44": {
            en: "It's okay to not have everything figured out.",
            hi: "Koi baat nahi agar sab kuch clear nahi hai abhi.",
            mr: "Sab kahi clear nasale tari chalte.",
            bn: "Sob ta clear na hole chalta — ekhon thik ache.",
            ta: "Ellame theriyaama irundhaalum paravaillai.",
            te: "Anni ardham kaakunda undi ante nee ledu.",
            kn: "Ellavu artha aagabekilla — adhu sari.",
            ml: "Ellaam manasilaakathe paravaailla.",
            gu: "Sab kainchuk clear na hoy to chalse.",
            pa: "Sab kuch clear na hove, thik hai.",
            or: "Sab kichhi spashtа na hole, thik achhi.",
            zh: "不需要什么都想明白，这没关系。",
            es: "Está bien no tener todo resuelto todavía.",
            ar: "لا بأس في أن لا يكون لديك إجابة لكل شيء.",
            fr: "C'est normal de ne pas avoir tout compris.",
            pt: "Tudo bem não ter tudo resolvido.",
            ru: "Нормально — не иметь ответов на всё.",
            id: "Tidak apa-apa kalau belum segalanya terpahami.",
            ur: "Koi baat nahi agar sab kuch clear nahi hai abhi.",
        },
        "45_54": {
            en: "You're allowed to put yourself first right now.",
            hi: "Abhi apne aap ko pehle rakhna bilkul theek hai.",
            mr: "Sthaavar rahane yogya aahe — swatahkade lakshy dya.",
            bn: "Ekhon nijeke agey rakhte para — eta thik.",
            ta: "Ippovum unavvai munnu vaikka urimai irukkudhu.",
            te: "Ippudu meeru meemi mundu pettukovalsi inthe sari.",
            kn: "Ippudu nimage munnadhikarata koduvudu sari.",
            ml: "Ippol ninnekku mukhyata kodukkaanulla avakasham undu.",
            gu: "Abhi potane pahela rakhvo bilkul thik chhe.",
            pa: "Hun apne aap nu pehle rakhna bilkul theek hai.",
            or: "Ekhon nijekku age rakhiba thik.",
            zh: "现在把自己放在第一位是完全可以的。",
            es: "Está bien que te pongas a ti primero ahora mismo.",
            ar: "من حقك أن تضع نفسك في المقام الأول الآن.",
            fr: "Tu as le droit de te mettre en premier en ce moment.",
            pt: "Você tem permissão para se colocar em primeiro lugar agora.",
            ru: "Сейчас можно поставить себя на первое место.",
            id: "Boleh kok mendahulukan dirimu sendiri sekarang.",
            ur: "Abhi apne aap ko pehle rakhna bilkul theek hai.",
        },
        "55_64": {
            en: "What you're feeling is completely valid — don't push it aside.",
            hi: "Jo tum feel kar rahe ho, woh bilkul sahi hai — ise ignore mat karo.",
            mr: "Tu jo feel karto te khup valid aahe — te baajula dhakku nako.",
            bn: "Tumi je feel korcho seta puroto sathik — eta ekpashe sarie diyo na.",
            ta: "Nee feel panradhu konjam um thevaiyaana — adha oda vidalaadhey.",
            te: "Mee feel avutunnaaru adi bilkul valid — daanini tappinchukoboddu.",
            kn: "Neevu feel aaguttiruvadudu sampoornavagi sariyaagide — adannu agalagisi bidabedi.",
            ml: "Nee feel aakkunnathu bilkul valid aanu — adhu marakkaathe.",
            gu: "Tu je feel kare chhe te bilkul valid chhe — tene ek baaju nakho.",
            pa: "Jo tu feel kar raha hai, bilkul sahi hai — ise ek passe na dhak.",
            or: "Tume je feel karuchha seta puro satya — eta ek paase thili diyo na.",
            zh: "你的感受是完全正当的——不要把它推开。",
            es: "Lo que sientes es completamente válido — no lo ignores.",
            ar: "ما تشعر به صحيح تماماً — لا تتجاهله.",
            fr: "Ce que tu ressens est tout à fait valide — ne le mets pas de côté.",
            pt: "O que você sente é completamente válido — não empurre isso para o lado.",
            ru: "Твои чувства полностью оправданы — не отмахивайся от них.",
            id: "Apa yang kamu rasakan itu sah sepenuhnya — jangan dikesampingkan.",
            ur: "Jo tum feel kar rahe ho, woh bilkul sahi hai — ise ignore mat karo.",
        },
    };
    const ageCloser = userAge ? (ageClosersByLang[userAge]?.[bankLanguage] ?? "") : "";
    const messageWithAge = ageCloser
        ? dedupeAdjacentSentences(`${finalMsg} ${ageCloser}`.trim())
        : finalMsg;

    // Apply gendered verb forms per language (companion voice + user address)
    const companionGender = toneContext?.companion?.gender;
    const userGender = toneContext?.userGender;
    let finalMessage = messageWithAge.replaceAll("Imotara", companionName);
    if (language === "hi") {
        finalMessage = applyHindiCompanionGender(finalMessage, companionGender);
        finalMessage = applyHindiUserGender(finalMessage, userGender);
    } else if (language === "gu") {
        finalMessage = applyGujaratiCompanionGender(finalMessage, companionGender);
        finalMessage = applyGujaratiUserGender(finalMessage, userGender);
    } else if (language === "pa") {
        finalMessage = applyPunjabiCompanionGender(finalMessage, companionGender);
        finalMessage = applyPunjabiUserGender(finalMessage, userGender);
    } else if (language === "bn") {
        finalMessage = applyBengaliCompanionGender(finalMessage, companionGender);
    } else if (language === "mr") {
        finalMessage = applyMarathiCompanionGender(finalMessage, companionGender);
        finalMessage = applyMarathiUserGender(finalMessage, userGender);
    } else if (language === "ta") {
        finalMessage = applyTamilCompanionGender(finalMessage, companionGender);
    } else if (language === "te") {
        finalMessage = applyTeluguCompanionGender(finalMessage, companionGender);
    } else if (language === "kn") {
        finalMessage = applyKannadaCompanionGender(finalMessage, companionGender);
    } else if (language === "ml") {
        finalMessage = applyMalayalamCompanionGender(finalMessage, companionGender);
    } else if (language === "or") {
        finalMessage = applyOdiaCompanionGender(finalMessage, companionGender);
    }

    // Occasionally address user by name (~1 in 3 replies, seed-driven for consistency)
    // A comma-prefix works naturally in all 10 supported languages.
    const userName = (toneContext?.userName ?? "").trim();
    if (userName && seed % 3 === 0) {
        finalMessage = `${userName}, ${finalMessage}`;
    }

    return {
        message: finalMessage,
        reflectionSeed: { intent: seedIntent, title: "", prompt },
    };
}
