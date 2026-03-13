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
    | "bn"
    | "ta"
    | "te"
    | "gu"
    | "pa"
    | "kn"
    | "ml"
    | "or";

type LocalReplyBankLanguage = "en" | "hi" | "bn" | "ta" | "te";

type ToneContext = {
    companion?: {
        name?: string;
        relationship?: string;
        tone?: LocalResponseTone;
    };
};

type LocalRecentContext = {
    recentUserTexts?: string[];
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
    if (language === "gu" || language === "pa") return "hi";
    if (language === "kn" || language === "ml") return "ta";
    if (language === "or") return "bn";
    return language;
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
    if (/[\u0900-\u097f]/.test(raw)) return "hi";
    if (/[\u0B80-\u0BFF]/.test(raw)) return "ta";
    if (/[\u0C00-\u0C7F]/.test(raw)) return "te";
    if (/[\u0A80-\u0AFF]/.test(raw)) return "gu";
    if (/[\u0A00-\u0A7F]/.test(raw)) return "pa";
    if (/[\u0C80-\u0CFF]/.test(raw)) return "kn";
    if (/[\u0D00-\u0D7F]/.test(raw)) return "ml";
    if (/[\u0B00-\u0B7F]/.test(raw)) return "or";

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

    return "en";
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

    if (/(sad|down|depressed|hopeless|cry)/.test(t)) return "sad";
    if (/(anxious|worried|panic|overwhelm|stress|pressure)/.test(t)) return "anxious";
    if (/(angry|mad|furious|irritated|annoyed)/.test(t)) return "angry";
    if (/(tired|exhausted|drained|sleepy|burnt)/.test(t)) return "tired";
    return "okay";
}

export function buildLocalReply(
    message: string,
    toneContext?: ToneContext,
    recentContext?: LocalRecentContext
): LocalReplyResult {
    const companionName = toneContext?.companion?.name ?? "Imotara";
    const companionTone: LocalResponseTone = toneContext?.companion?.tone ?? "supportive";
    const language = detectLanguage(message, recentContext);
    const recentSignature = buildRecentSignature(recentContext);
    const seed = hash32(
        `${message}::${language}::${recentSignature}::${toneContext?.companion?.relationship ?? ""}::${toneContext?.companion?.tone ?? ""}`
    );
    const signal = detectSignal(message, language);

    const openersByToneEn: Record<LocalResponseTone, string[]> = {
        calm: [
            `I’m here with you.`,
            `Let’s slow this down together.`,
            `Okay. We can take this gently.`,
            `I’m with you. Let’s take one piece at a time.`,
        ],
        supportive: [
            `I’m here with you.`,
            `I hear you.`,
            `Okay — I’m with you.`,
            `I’m glad you said that.`,
            `Got it. I’m listening.`,
        ],
        practical: [
            `Okay. Let’s look at this clearly.`,
            `Got it. Let’s take this one piece at a time.`,
            `Alright — let’s steady this and see what matters most.`,
            `I’m with you. Let’s keep it simple.`,
        ],
        coach: [
            `Okay — I’m with you. Let’s steady this.`,
            `Got it. We can work through this step by step.`,
            `Alright — let’s slow this down and get our footing.`,
            `I hear you. Let’s take it one piece at a time.`,
        ],
        "gentle-humor": [
            `Okay — I’m with you.`,
            `Mm. I hear you.`,
            `Got it. I’m here.`,
            `Alright — let’s make this feel a little lighter, one step at a time.`,
        ],
        direct: [
            `Alright. I’m with you.`,
            `Okay. Let’s be clear about this.`,
            `Got it. Let’s keep this steady.`,
            `I hear you. Let’s get to the heart of it.`,
        ],
    };

    const openersByToneHi: Record<LocalResponseTone, string[]> = {
        calm: [
            `Main yahin hoon.`,
            `Chalo ise dheere se dekhte hain.`,
            `Theek hai. Hum ise aaraam se lete hain.`,
            `Main tumhare saath hoon. Ek ek hissa dekhte hain.`,
        ],
        supportive: [
            `Main tumhare saath hoon.`,
            `Main sun raha hoon.`,
            `Theek hai — main yahin hoon.`,
            `Achha hua tumne bataya.`,
            `Samajh gaya. Main sun raha hoon.`,
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
        ],
        supportive: [
            `Ami tomar sathe achhi.`,
            `Ami shunchi.`,
            `Thik ache — ami ekhanei achhi.`,
            `Bhalo korecho je bolechho.`,
            `Bujhte parchi.`,
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
        sad: [`That sounds heavy.`, `That can really hurt.`, `I’m sorry you’re carrying that.`, `That’s a lot to sit with.`],
        anxious: [
            `That sounds like your mind is running fast.`,
            `That kind of pressure can feel loud.`,
            `It makes sense you’d feel tense with that.`,
            `That overwhelm feeling is real.`,
        ],
        angry: [
            `That sounds frustrating.`,
            `I can see how that would irritate you.`,
            `That would get under anyone’s skin.`,
            `Yeah — that’s a rough feeling.`,
        ],
        tired: [`That sounds draining.`, `No wonder you feel worn out.`, `That kind of tired can build up.`, `That’s a lot of load for one day.`],
        okay: [
            `Tell me a little more.`,
            `I’m with you — what’s going on?`,
            `I’m listening. What’s sitting with you right now?`,
            `Okay. What’s the main thing on your mind?`,
        ],
    };

    const carryValidationsEn = [
        `I can feel this is still sitting with you.`,
        `This sounds like it is still weighing on you.`,
        `I’m still with the thread of what you’re carrying.`,
        `It seems this is still heavy in the background.`,
    ];

    const validationsHi: Record<typeof signal, string[]> = {
        sad: [`Yeh kaafi bhaari lag raha hai.`, `Yeh sach mein chot pahucha sakta hai.`, `Mujhe afsos hai ki tum yeh sab utha rahe ho.`, `Yeh kaafi zyada hai saath le kar chalne ke liye.`],
        anxious: [
            `Lag raha hai dimaag bahut tez chal raha hai.`,
            `Is tarah ka pressure kaafi loud lag sakta hai.`,
            `Aise mein tense feel hona bilkul samajh aata hai.`,
            `Yeh overwhelm waali feeling sach hoti hai.`,
        ],
        angry: [
            `Yeh kaafi frustrating lag raha hai.`,
            `Samajh sakta hoon yeh irritate karega.`,
            `Yeh kisi ke bhi skin ke neeche chala jaaye.`,
            `Haan — yeh rough feeling hai.`,
        ],
        tired: [`Yeh kaafi draining lag raha hai.`, `Isliye tum itna worn out feel kar rahe ho, yeh samajh aata hai.`, `Is tarah ki thakan jama hoti jaati hai.`, `Ek din ke liye yeh kaafi zyada load hai.`],
        okay: [
            `Thoda aur batao.`,
            `Main saath hoon — kya chal raha hai?`,
            `Main sun raha hoon. Abhi tumhare andar sabse zyada kya baitha hai?`,
            `Theek hai. Abhi dimaag mein sabse badi baat kya hai?`,
        ],
    };

    const carryValidationsHi = [
        `Lag raha hai yeh baat abhi bhi tumhare andar baithi hui hai.`,
        `Yeh abhi bhi tum par bhaari si tikki hui lag rahi hai.`,
        `Jo tum utha rahe ho, uska thread abhi bhi chal raha hai.`,
        `Lagta hai yeh baat pichhe se abhi bhi weight de rahi hai.`,
    ];

    const validationsBn: Record<typeof signal, string[]> = {
        sad: [`Eta onek bhaari lagchhe.`, `Eta khub kosto dite pare.`, `Dukkho lagchhe je tomake eta niye cholte hochhe.`, `Eta bose thakar jonno onekta.`],
        anxious: [
            `Mone hochhe mathata khub taratari cholchhe.`,
            `Erokom pressure khub jore mone hote pare.`,
            `Erokom obosthay tense lagata shobhabik.`,
            `Ei overwhelm er feeling ta khub real.`,
        ],
        angry: [
            `Eta khub frustrating lagchhe.`,
            `Bujhte parchi eta irritate korte pare.`,
            `Eta karoroi kharap lagte parto.`,
            `Haan — eta rough feeling.`,
        ],
        tired: [`Eta khub draining lagchhe.`, `Tai eto klanto lagchhe, eta bujhte parchi.`, `Erokom klanti jome jete pare.`, `Ek diner jonno eta onekta load.`],
        okay: [
            `Aro ektu bolo.`,
            `Ki hochhe ektu bolbe?`,
            `Ekhon tomar modhye shobcheye beshi ki bose ache?`,
            `Ekhon mathay shobcheye boro kotha ta ki?`,
        ],
    };

    const carryValidationsBn = [
        `Mone hochhe eta ekhono tomar moddhe bose ache.`,
        `Eta ekhono pichhone theke weight dicche mone hochhe.`,
        `Tumi ja niye cholchho, tar thread ta ekhono cholche.`,
        `Mone hochhe kothata ekhono bhitor theke bhaari kore rekhechhe.`,
    ];

    const validationsTa: Record<typeof signal, string[]> = {
        sad: [
            `Idhu romba heavy aa irukku pola.`,
            `Idhu unakku kastama irukkalam.`,
            `Idha nee sumandhuttu irukkaradhu kashtam nu puriyudhu.`,
            `Idhu neraya sumai maari theriyudhu.`,
        ],
        anxious: [
            `Un manasu romba vegama odudhu pola theriyudhu.`,
            `Indha maadhiri pressure romba loud aa thonalaam.`,
            `Ippadi irundha tense aa feel panna saadharanam.`,
            `Indha overwhelm feeling nijam dhan.`,
        ],
        angry: [
            `Idhu romba frustrating aa theriyudhu.`,
            `Idhu kovam varra maadhiri irukku nu puriyudhu.`,
            `Yaarukkum idhu kashtama thonum.`,
            `Aama — idhu rough feeling dhan.`,
        ],
        tired: [
            `Idhu romba draining aa theriyudhu.`,
            `Adhan nee ivlo tired aa irukka pola.`,
            `Indha maadhiri saerndhu tiredness varalam.`,
            `Oru naalukku idhu romba load.`,
        ],
        okay: [
            `Konjam innum sollu.`,
            `Enna nadakkudhu konjam solluva?`,
            `Ippo unakku ullae romba weight aa irukkiradhu enna?`,
            `Ippo un manasula mukkiyama irukkira vishayam enna?`,
        ],
    };

    const validationsTe: Record<typeof signal, string[]> = {
        sad: [
            `Idi chaala bhaaranga anipistondi.`,
            `Idi neeku kashtam ga undochu.`,
            `Idi nee meeda chaala bharam laga undi ani ardham avutondi.`,
            `Idi chaala load la anipistondi.`,
        ],
        anxious: [
            `Nee manasu chaala veganga parigedutundi anipistondi.`,
            `Ilaanti pressure chaala loud ga anipinchachu.`,
            `Ila unte tense ga feel avvadam saadharanam.`,
            `Idi overwhelm feeling nijam ga untundi.`,
        ],
        angry: [
            `Idi chaala frustrating ga undi anipistondi.`,
            `Idi kopam teppinche vishayam ani ardham avutondi.`,
            `Evarikaina idi kastam ga anipinchachu.`,
            `Avunu — idi rough feeling.`,
        ],
        tired: [
            `Idi chaala draining ga anipistondi.`,
            `Anduke nuvvu inta tired ga unnattu anipistondi.`,
            `Ilaanti alasyam kalisi peruguthundi.`,
            `Oka rojuki idi chaala load.`,
        ],
        okay: [
            `Konchem inka cheppu.`,
            `Em jarugutundo konchem chepthava?`,
            `Ippudu nee lo ekkuvaga bharam ga anipistondi enti?`,
            `Ippudu nee manasulo mukhyamaina vishayam enti?`,
        ],
    };

    const reflectLinesEn = [
        `When you say “${(message || "").trim().slice(0, 120)}${(message || "").length > 120 ? "…" : ""}”, what part feels strongest right now?`,
        `What’s the part of this that feels most uncomfortable?`,
        `If we zoom in: what’s the one detail that’s bothering you most?`,
        `What do you wish was different about this situation?`,
    ];

    const reflectLinesHi = [
        `Jab tum kehte ho “${(message || "").trim().slice(0, 120)}${(message || "").length > 120 ? "…" : ""}”, abhi sabse zyada kya mehsoos ho raha hai?`,
        `Isme sabse zyada uncomfortable kya lag raha hai?`,
        `Agar hum thoda zoom in karein, sabse zyada pareshaan kya kar raha hai?`,
        `Tum chahte ho is situation mein kya alag hota?`,
    ];

    const reflectLinesBn = [
        `Jokhon bolo “${(message || "").trim().slice(0, 120)}${(message || "").length > 120 ? "…" : ""}”, ekhon shobcheye jore ki lagchhe?`,
        `Eitar modhye shobcheye beshi uncomfortable ki lagchhe?`,
        `Jodi ektu zoom in kori, shobcheye beshi ki jhamela dicchhe?`,
        `Tumi chaite e situation ta kivabe alada hoto?`,
    ];

    const nextStepLinesEn = [
        `Want comfort, clarity, or a next step?`,
        `Do you want to talk it out, or want something practical to do next?`,
        `Would it help to unpack it, or to pick one small action?`,
        `Should we focus on what you’re feeling, or what you can do next?`,
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
            `Let’s only look at what matters first.`,
            `We can keep this workable.`,
            `One useful piece is enough for now.`,
        ],
        coach: [
            ``,
            `Let’s find the most workable part first.`,
            `We only need one steady move right now.`,
            `You do not need to untangle everything at once.`,
        ],
        "gentle-humor": [
            ``,
            `We can keep this a little lighter without ignoring it.`,
            `One small shift is enough for now.`,
            `I’m still right here with you.`,
        ],
        direct: [
            ``,
            `Let’s keep this clear.`,
            `We can deal with one real part at a time.`,
            `Only the next useful piece matters right now.`,
        ],
    };

    const carryExtrasEn: Record<LocalResponseTone, string[]> = {
        calm: [`We do not have to force this anywhere yet.`, `We can just stay with it for a moment.`],
        supportive: [`You do not have to explain it perfectly right now.`, `I’m still here with you in it.`],
        practical: [`We can keep this simple for now.`, `We only need the next clear piece, not the whole answer.`],
        coach: [`We can steady this before doing anything else.`, `One grounded step later is enough.`],
        "gentle-humor": [`We can keep this soft without making it heavy-er.`, `No need to wrestle the whole thing right now.`],
        direct: [`Let’s not overcomplicate it right now.`, `We can stay with the real part first.`],
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
            `সবকিছু একসাথে সামলানোর তাড়া নেই।`,
            `এটাকে জোর না করে steady রাখা যায়।`,
        ],
        supportive: [
            ``,
            `তোমাকে সবটা একসাথে বয়ে নিতে হবে না।`,
            `যেটা সবচেয়ে ভারী লাগছে, আগে সেটার সঙ্গেই থাকি।`,
            `সবকিছু এখনও এলোমেলো লাগলে তাতেও সমস্যা নেই।`,
        ],
        practical: [
            ``,
            `চলো আগে সবচেয়ে দরকারি অংশটাই দেখি।`,
            `এটাকে manageable রাখা যাবে।`,
            `এখন একটা কাজের জিনিস ধরলেই যথেষ্ট।`,
        ],
        coach: [
            ``,
            `চলো আগে সবচেয়ে workable অংশটা খুঁজি।`,
            `এখন শুধু একটা steady move হলেই হবে।`,
            `সবটা একসাথে মেলাতে হবে না।`,
        ],
        "gentle-humor": [
            ``,
            `এটাকে হালকা রাখা যায়, তবু সিরিয়াস থাকাও যাবে।`,
            `এখন একটা ছোট shift হলেই যথেষ্ট।`,
            `আমি এখানেই আছি তোমার সাথে।`,
        ],
        direct: [
            ``,
            `চলো এটাকে পরিষ্কার রাখি।`,
            `একবারে একটা বাস্তব অংশ ধরা যায়।`,
            `এখন শুধু পরের useful অংশটাই যথেষ্ট।`,
        ],
    };

    const carryExtrasBn: Record<LocalResponseTone, string[]> = {
        calm: [`এটাকে এখনই কোথাও ঠেলে নিতে হবে না।`, `আমরা একটু সময় শুধু এটার সাথেই থাকতে পারি।`],
        supportive: [`এখনই একদম ঠিক করে বোঝাতে হবে না।`, `আমি এখনও তোমার সাথেই আছি এতে।`],
        practical: [`এখন এটাকে simple রাখি।`, `পুরো উত্তর না, শুধু পরের পরিষ্কার অংশটাই যথেষ্ট।`],
        coach: [`কিছু করার আগে এটাকে steady করি।`, `পরে একটা grounded step হলেই চলবে।`],
        "gentle-humor": [`এটাকে হালকা রাখা যায়, বেশি জট না বাড়িয়ে।`, `এখন পুরো কুস্তি লড়ার দরকার নেই।`],
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

    const bankLanguage = toReplyBankLanguage(language);

    const openers =
        bankLanguage === "hi"
            ? openersByToneHi[companionTone]
            : bankLanguage === "bn"
                ? openersByToneBn[companionTone]
                : bankLanguage === "ta"
                    ? openersByToneTa[companionTone]
                    : bankLanguage === "te"
                        ? openersByToneTe[companionTone]
                        : openersByToneEn[companionTone];

    const validations =
        bankLanguage === "hi"
            ? validationsHi
            : bankLanguage === "bn"
                ? validationsBn
                : bankLanguage === "ta"
                    ? validationsTa
                    : bankLanguage === "te"
                        ? validationsTe
                        : validationsEn;

    const reflectLines =
        bankLanguage === "hi"
            ? reflectLinesHi
            : bankLanguage === "bn"
                ? reflectLinesBn
                : reflectLinesEn;

    const nextStepLines =
        bankLanguage === "hi"
            ? nextStepLinesHi
            : bankLanguage === "bn"
                ? nextStepLinesBn
                : nextStepLinesEn;

    const extrasByTone =
        bankLanguage === "hi"
            ? extrasByToneHi
            : bankLanguage === "bn"
                ? extrasByToneBn
                : bankLanguage === "ta"
                    ? extrasByToneTa
                    : bankLanguage === "te"
                        ? extrasByToneTe
                        : extrasByToneEn;

    const intent = pick(["clarify", "reflect", "reframe"] as const, seed >>> 3);

    const prompt =
        intent === "clarify"
            ? pick(nextStepLines, seed >>> 4)
            : intent === "reflect"
                ? pick(reflectLines, seed >>> 4)
                : language === "hi"
                    ? `Agar hum ise thoda narmi se reframe karein, kaunsi ek aur dayalu explanation sach ho sakti hai?`
                    : language === "bn"
                        ? `Jodi eta ektu narm bhabe reframe kori, tahole ar ekta dayalu byakkha ki hote pare?`
                        : `If we reframe this gently: what’s one kinder explanation that could also be true?`;

    const opener = pick(openers, seed);
    const hasCarry = signal === "okay" && hasRecentEmotionalSignal(recentContext);

    const validation =
        hasCarry && bankLanguage === "hi"
            ? pick(carryValidationsHi, seed >>> 1)
            : hasCarry && bankLanguage === "bn"
                ? pick(carryValidationsBn, seed >>> 1)
                : hasCarry
                    ? pick(carryValidationsEn, seed >>> 1)
                    : pick(validations[signal], seed >>> 1);

    const extra =
        hasCarry && bankLanguage === "hi"
            ? pick(carryExtrasHi[companionTone], seed >>> 5)
            : hasCarry && bankLanguage === "bn"
                ? pick(carryExtrasBn[companionTone], seed >>> 5)
                : hasCarry
                    ? pick(carryExtrasEn[companionTone], seed >>> 5)
                    : pick(extrasByTone[companionTone], seed >>> 5);

    const base = `${opener} ${validation}`.trim();
    const finalMsg = dedupeAdjacentSentences(
        `${base}${extra ? " " + extra : ""}`.trim()
    );

    return {
        message: finalMsg.replaceAll("Imotara", companionName),
        reflectionSeed: { intent, title: "", prompt },
    };
}