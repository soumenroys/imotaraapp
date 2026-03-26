// src/lib/imotara/respondRemote.ts
import type { ImotaraResponse } from "@/lib/ai/response/responseBlueprint";

/** Script-based language detection — handles native scripts via Unicode ranges.
 *  Urdu-specific chars are checked before the generic Arabic block to avoid misclassification. */
function detectLangFromScript(text: string): string {
    if (!text) return "en";
    if (/[\u0980-\u09FF]/.test(text)) return "bn";          // Bengali
    if (/[\u0904-\u0939\u0958-\u0963\u0971-\u097F]/.test(text)) return "hi"; // Hindi/Devanagari (incl. Marathi)
    if (/[\u0B80-\u0BFF]/.test(text)) return "ta";          // Tamil
    if (/[\u0C00-\u0C7F]/.test(text)) return "te";          // Telugu
    if (/[\u0A80-\u0AFF]/.test(text)) return "gu";          // Gujarati
    if (/[\u0C80-\u0CFF]/.test(text)) return "kn";          // Kannada
    if (/[\u0D00-\u0D7F]/.test(text)) return "ml";          // Malayalam
    if (/[\u0A00-\u0A7F]/.test(text)) return "pa";          // Punjabi/Gurmukhi
    if (/[\u0B00-\u0B7F]/.test(text)) return "or";          // Odia
    if (/[\u0590-\u05FF]/.test(text)) return "he";          // Hebrew
    // Check Urdu-specific chars (ں پ چ ڈ ٹ گ ک ے ۓ) before generic Arabic block
    if (/[\u067E\u0686\u0688\u0691\u0679\u06AF\u06A9\u06BA\u06D2\u06D3]/.test(text)) return "ur";
    if (/[\u0600-\u06FF]/.test(text)) return "ar";          // Arabic
    if (/[\u0400-\u04FF]/.test(text)) return "ru";          // Russian/Cyrillic
    if (/[\u4E00-\u9FFF]/.test(text)) return "zh";          // Chinese
    if (/[\u3040-\u30FF]/.test(text)) return "ja";          // Japanese
    return "en";
}

/** Roman-script hint detection for transliterated Indian languages.
 *  Used as fallback when script detection returns "en" (Latin input). */
function detectLangFromRomanHints(text: string): string {
    if (!text) return "en";
    const t = text;
    const scores: Record<string, number> = {};
    const tally = (lang: string, re: RegExp) => {
        const m = t.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"));
        if (m) scores[lang] = (scores[lang] || 0) + m.length;
    };
    // Hindi
    tally("hi", /\b(hai|haan|nahi|nahin|kya|kyun|kaise|aaj|kal|bhai|yaar|ghar|Thik|Tum|Aap|Hum|Woh|Yeh|Aur|Bas|Chal|Gaya|Raha|Chahiye|Abhi|Zyada|Maza|Maaf|Shukriya|mujhe|meri|tera|apna|sab|kuch|bahut|karo|karna|hoga)\b/i);
    // Bengali
    tally("bn", /\b(ami|tumi|apni|kemon|bhalo|achi|ekhon|korcho|lagche|hocche|korbo|kaaj|kaz|kajer|boddo|chap|onek|ektu|ki khobor|thik ache|kothay|keno|hobe|cholo|bondhu|bari|ghor|mon|jabo|ashbo|bolbo|bujhte)\b/i);
    // Marathi
    tally("mr", /\b(kay|kaay|kasa|kashi|bara|baray|thik aahe|aata|mi|mee|tumhi|mala|tula|ghari|ithe|tithe|zhala|zala|chhan|khup|vatat|vatte|vallagche|dhur|nako|jevla|sang|yete|jaato)\b/i);
    // Tamil
    tally("ta", /\b(enna|epdi|seri|sari|inga|anga|ippo|saptiya|veetla|amma|appa|nan|naan|unaku|romba|konjam|nalla|illa|sollu|pesu|venum|vendam|irukku|podhum)\b/i);
    // Telugu
    tally("te", /\b(enti|ela|em|emi|ippudu|inka|avuna|kaadu|ledu|undhi|nenu|nuvvu|meeru|amma|nanna|baaga|chala|konchem|sare|parledu|enduku|ekkada)\b/i);
    // Gujarati
    tally("gu", /\b(shu|kem|kem cho|majama|saru|saras|have|tame|hu|hun|mane|tane|aaje|kaal|ghar|su che|barabar|chalo|joie|nathi|che|lage che)\b/i);
    // Punjabi
    tally("pa", /\b(ki|kida|kive|haanji|hanji|nahi|hun|tusi|main|mera|meri|sada|sadi|paji|veer|bhain|maa|papa|ghar|kithe|kithon|changa|vadhiya|roti|aaja)\b/i);
    // Kannada
    tally("kn", /\b(yenu|enu|hegide|sari|chennagide|ivattu|naanu|neenu|nimge|nanage|amma|appa|bega|mane|illi|alli|yaake|hege|oota|neeru|tumba|bejar|ide|illa|saku|swalpa)\b/i);
    // Malayalam
    tally("ml", /\b(entha|enthaanu|engane|sheri|ippo|inni|njaan|njan|nee|ningal|enikku|ninakku|amma|achan|chetta|chechi|vellam|urakkam|ivide|avide)\b/i);
    // Odia
    tally("or", /\b(kana|kanha|kemiti|kemti|bhala|bhal|thik achhi|mu|tume|apana|mo|tora|ghar|bahare|ethi|sethi|aaji|kali|asuchi|jauchhi)\b/i);

    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return best && best[1] >= 1 ? best[0] : "en";
}

/** Combined detection: script first, then Roman hints as fallback. */
function detectLangFromMessage(text: string): string {
    const scriptLang = detectLangFromScript(text);
    if (scriptLang !== "en") return scriptLang;
    return detectLangFromRomanHints(text);
}

/** Detects explicit language-switch intent in a message.
 *  Only fires when a clear switch verb is present alongside a language name —
 *  bare language mentions ("I love Arabic poetry") will NOT match.
 *  Returns the ISO code if found, otherwise null. */
function detectExplicitLangRequest(text: string): string | null {
    if (!text) return null;
    const t = text.toLowerCase().trim();

    // Intent verbs that signal the user wants to switch language
    const intentVerb = /\b(speak|talk|reply|write|respond|use|switch|change|try|chat|communicate|answer|converse)\b/;
    // Preposition patterns: "in X", "to X", "using X", "with X"
    const prep = /\b(in|to|using|with|into)\b/;
    // Combined: verb ... lang  OR  (in|to) ... lang
    const hasIntent = intentVerb.test(t) || prep.test(t);

    // Language name → ISO code. Each entry is [regex-pattern, iso-code].
    // Patterns use word boundaries to avoid partial matches.
    const langPatterns: [RegExp, string][] = [
        [/\benglish\b/,    "en"],
        [/\bhindi\b/,      "hi"],
        [/\bbengali\b|\bbangla\b/, "bn"],
        [/\bmarathi\b/,    "mr"],
        [/\btamil\b/,      "ta"],
        [/\btelugu\b/,     "te"],
        [/\bgujarati\b/,   "gu"],
        [/\bkannada\b/,    "kn"],
        [/\bmalayalam\b/,  "ml"],
        [/\bpunjabi\b/,    "pa"],
        [/\bodia\b|\boriya\b/, "or"],
        [/\barabic\b/,     "ar"],
        [/\burdu\b/,       "ur"],
        [/\brussian\b/,    "ru"],
        [/\bchinese\b|\bmandarin\b/, "zh"],
        [/\bjapanese\b/,   "ja"],
        [/\bspanish\b/,    "es"],
        [/\bfrench\b/,     "fr"],
        [/\bgerman\b/,     "de"],
        [/\bportuguese\b/, "pt"],
    ];

    if (!hasIntent) return null;

    for (const [pattern, code] of langPatterns) {
        if (pattern.test(t)) return code;
    }
    return null;
}

export async function respondRemote(input: {
    message: string;
    context?: unknown;
    onChunk?: (partial: string) => void;
}): Promise<ImotaraResponse> {
    const qa =
        typeof window !== "undefined" &&
        window.localStorage.getItem("imotaraQa") === "1";

    const ctx =
        input.context && typeof input.context === "object" && !Array.isArray(input.context)
            ? (input.context as Record<string, unknown>)
            : {};

    // Build conversation history for the AI path
    const rawRecent = Array.isArray(ctx.recentMessages)
        ? (ctx.recentMessages as { role: string; content: string }[])
        : [];

    // Ensure current user message is at the end (avoid duplicating if already present)
    const lastMsg = rawRecent[rawRecent.length - 1];
    const messages =
        lastMsg?.role === "user" && lastMsg?.content?.trim() === input.message.trim()
            ? rawRecent
            : [...rawRecent, { role: "user", content: input.message }];

    // Map companion relationship → tone for /api/chat-reply
    const toneCtx = ctx.toneContext as {
        companion?: { relationship?: string; ageRange?: string; name?: string; gender?: string };
        user?: { ageRange?: string; gender?: string; responseStyle?: string };
    } | undefined;
    const relationship = toneCtx?.companion?.relationship;
    const toneMap: Record<string, "close_friend" | "calm_companion" | "coach" | "mentor"> = {
        mentor: "mentor",
        coach: "coach",
        friend: "close_friend",
        partner_like: "close_friend",
        elder: "calm_companion",
        parent_like: "calm_companion",
    };
    const tone = relationship ? (toneMap[relationship] ?? undefined) : undefined;

    // ── AI path: try /api/chat-reply (OpenAI) first ──────────────────────────
    // Lang priority: explicit switch request > script/Roman detection > profile preference > "en"
    // Explicit wins so the user can override a locked profile language mid-conversation.
    const explicitLang = detectExplicitLangRequest(input.message);
    const detectedLang = detectLangFromMessage(input.message);
    const profileLang = typeof (ctx as Record<string, unknown>).preferredLang === "string"
        ? (ctx as Record<string, unknown>).preferredLang as string
        : undefined;
    const lang = explicitLang || (detectedLang !== "en" ? detectedLang : (profileLang || "en"));

    // Gender: read from toneContext if provided
    const ctxTone = ctx.toneContext as { user?: { gender?: string }; companion?: { gender?: string } } | undefined;
    const userGender = ctxTone?.user?.gender;
    const companionGender = ctxTone?.companion?.gender;

    const companionName = toneCtx?.companion?.name?.trim() || undefined;
    const responseStyle = toneCtx?.user?.responseStyle || undefined;
    const olderContext = typeof (ctx as Record<string, unknown>).olderContext === "string"
        ? (ctx as Record<string, unknown>).olderContext as string
        : undefined;

    const chatReplyBody = JSON.stringify({
        messages,
        lang,
        ...(tone ? { tone } : {}),
        ...(toneCtx?.user?.ageRange ? { userAge: toneCtx.user.ageRange } : {}),
        ...(toneCtx?.companion?.ageRange ? { companionAge: toneCtx.companion.ageRange } : {}),
        ...(companionName ? { companionName } : {}),
        ...(responseStyle ? { responseStyle } : {}),
        ...(olderContext ? { olderContext } : {}),
        ...(typeof ctx.emotionMemory === "string" && ctx.emotionMemory ? { emotionMemory: ctx.emotionMemory } : {}),
        ...(userGender && userGender !== "prefer_not" && userGender !== "other" ? { userGender } : {}),
        ...(companionGender && companionGender !== "prefer_not" && companionGender !== "other" ? { companionGender } : {}),
    });

    try {
        // ── Streaming path (web) ────────────────────────────────────────────────
        const aiRes = await fetch("/api/chat-reply?stream=1", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: chatReplyBody,
        });

        if (aiRes.ok && aiRes.body) {
            const reader = aiRes.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let fullText = "";
            let done = false;

            while (!done) {
                const { done: streamDone, value } = await reader.read();
                if (streamDone) break;

                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split("\n\n");
                buffer = parts.pop() ?? "";

                for (const part of parts) {
                    const line = part.trim();
                    if (!line.startsWith("data: ")) continue;
                    const data = line.slice(6).trim();
                    if (data === "[DONE]") { done = true; break; }
                    try {
                        const { t } = JSON.parse(data) as { t?: string };
                        if (t) {
                            fullText += t;
                            input.onChunk?.(fullText);
                        }
                    } catch { /* skip malformed chunk */ }
                }
            }

            if (fullText.trim()) {
                return {
                    message: fullText,
                    followUp: "",
                    meta: {
                        styleContract: "1.0",
                        blueprint: "1.0",
                        analysisSource: "cloud",
                    } as any,
                };
            }
        }
    } catch {
        // Streaming path unavailable — fall through to template path below
    }

    // ── Template fallback: /api/respond (runImotara, works offline) ───────────
    const res = await fetch("/api/respond", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(qa ? { "x-imotara-qa": "1" } : {}),
        },
        body: JSON.stringify({
            message: input.message,
            context: input.context,
        }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
            `[imotara] /api/respond failed: ${res.status} ${res.statusText} ${text}`
        );
    }

    return (await res.json()) as ImotaraResponse;
}
