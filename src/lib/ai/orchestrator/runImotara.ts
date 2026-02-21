// src/lib/ai/orchestrator/runImotara.ts

import type { ImotaraResponse } from "../response/responseBlueprint";
import { DEFAULT_RESPONSE_BLUEPRINT } from "../response/responseBlueprint";
import { applySoftEnforcement } from "@/lib/ai/guardrails/softEnforcement";
import type { EmotionAnalysis } from "@/lib/ai/emotion/emotionTypes";
import { normalizeEmotion } from "@/lib/ai/emotion/normalizeEmotion";
import { applyFinalResponseGate } from "@/lib/ai/orchestrator/finalResponseGate";

type SessionContext = {
    persona?: {
        relationshipTone?: string;
        ageTone?: string;
        genderTone?: string;
        name?: string;
    };
    toneContext?: any;
    recent?: Array<{ role: "user" | "assistant"; content: string }>;
    source?: string;
    debug?: boolean;
};

function oneLine(s: string): string {
    return String(s ?? "").replace(/\s+/g, " ").trim();
}

function cap(s: string, max: number): string {
    const t = oneLine(s);
    if (t.length <= max) return t;
    return t.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

function getUserName(ctx: SessionContext): string | null {
    const n =
        ctx?.toneContext?.user?.name ??
        ctx?.toneContext?.profile?.name ??
        ctx?.persona?.name;
    const name = typeof n === "string" ? oneLine(n) : "";
    return name.length >= 2 ? name : null;
}

function pickRelationshipTone(ctx: SessionContext): string {
    const rel =
        ctx?.toneContext?.companion?.enabled
            ? ctx?.toneContext?.companion?.relationship
            : ctx?.persona?.relationshipTone;

    return typeof rel === "string" ? rel : "prefer_not";
}

function recentlyAsked(ctx: SessionContext, needle: string): boolean {
    const recent = ctx?.recent ?? [];
    const assistantText = recent
        .filter((m) => m.role === "assistant")
        .map((m) => (m.content || "").toLowerCase())
        .join(" | ");
    return assistantText.includes(needle.toLowerCase());
}

function makeReflectionSeed(userMessage: string): ImotaraResponse["reflectionSeed"] {
    const m = userMessage.toLowerCase();

    if (m.includes("stranger") || m.includes("met") || m.includes("someone")) {
        return {
            intent: "reflect",
            title: "A chance encounter",
            prompt: "What stood out about that person or that moment?",
        };
    }

    if (m.includes("money") || m.includes("paid") || m.includes("salary") || m.includes("bonus")) {
        return {
            intent: "reflect",
            title: "Money & relief",
            prompt: "What does this money change for you right now—safety, freedom, or something else?",
        };
    }

    if (m.includes("ecstatic") || m.includes("amazing") || m.includes("happy") || m.includes("great") || m.includes("cool")) {
        return {
            intent: "reflect",
            title: "Savoring the good",
            prompt: "What exactly feels good about it—your body, your thoughts, or the situation itself?",
        };
    }

    return {
        intent: "clarify",
        title: "", // ✅ remove robotic heading like "One detail"
        prompt: "What’s the main thing you want from this chat—comfort, clarity, or a next step?",
    };
}

type SupportedLanguage = "en" | "hi" | "bn";

function getPreferredLanguage(ctx: SessionContext): SupportedLanguage {
    const raw = String((ctx as any)?.preferredLanguage ?? "").trim().toLowerCase();
    // Accept both base and BCP-47 tags
    if (raw === "hi" || raw.startsWith("hi-")) return "hi";
    if (raw === "bn" || raw.startsWith("bn-")) return "bn";
    return "en";
}

function draftResponseForLanguage(userMessage: string, ctx: SessionContext): ImotaraResponse {
    const lang = getPreferredLanguage(ctx);
    if (lang === "en") return draftResponse(userMessage, ctx);

    // Minimal localized fallback (keeps existing logic intact for English,
    // ensures non-English settings never get an English response).
    const msg = oneLine(userMessage);
    const name = getUserName(ctx);
    const rel = pickRelationshipTone(ctx);

    const opener =
        lang === "hi"
            ? rel === "friend"
                ? (name ? `समझ गया, ${name}.` : "समझ गया.")
                : rel === "mentor"
                    ? (name ? `मैं सुन रहा हूँ, ${name}.` : "मैं सुन रहा हूँ.")
                    : rel === "coach"
                        ? (name ? `ठीक है, ${name}.` : "ठीक है.")
                        : (name ? `मैं समझ रहा हूँ, ${name}.` : "मैं समझ रहा हूँ.")
            : // bn
            rel === "friend"
                ? (name ? `বুঝলাম, ${name}.` : "বুঝলাম.")
                : rel === "mentor"
                    ? (name ? `আমি শুনছি, ${name}.` : "আমি শুনছি.")
                    : rel === "coach"
                        ? (name ? `ঠিক আছে, ${name}.` : "ঠিক আছে.")
                        : (name ? `আমি বুঝতে পারছি, ${name}.` : "আমি বুঝতে পারছি.");

    const message =
        lang === "hi"
            ? `${opener} मैं आपके साथ हूँ। अभी इस पल में सबसे भारी क्या लग रहा है?`
            : `${opener} আমি আপনার পাশে আছি। এই মুহূর্তে সবচেয়ে ভারী কী লাগছে?`;

    const followUp =
        lang === "hi"
            ? "अभी आपके लिए सबसे ज़्यादा मदद क्या होगी — सुकून, स्पष्टता, या एक छोटा अगला कदम?"
            : "এই মুহূর্তে আপনার সবচেয়ে দরকার কী — সান্ত্বনা, পরিষ্কার বোঝা, না একদম ছোট পরের পদক্ষেপ?";

    return {
        message,
        followUp,
        meta: {
            styleContract: "1.0",
            blueprint: "1.0",
            blueprintUsed: DEFAULT_RESPONSE_BLUEPRINT,
        },
    };
}

function draftResponse(userMessage: string, ctx: SessionContext): ImotaraResponse {
    // IMPORTANT: response MUST be driven by current userMessage (history is only for avoiding repeats)
    const msg = oneLine(userMessage);
    const lower = msg.toLowerCase();

    const name = getUserName(ctx);
    const rel = pickRelationshipTone(ctx);

    // tone-only opener
    const opener =
        rel === "friend"
            ? (name ? `Got you, ${name}.` : "Got you.")
            : rel === "mentor"
                ? (name ? `I’m listening, ${name}.` : "I’m listening.")
                : rel === "coach"
                    ? (name ? `Okay, ${name}.` : "Okay.")
                    : (name ? `I hear you, ${name}.` : "I hear you.");

    let message = "";
    let followUp = "";

    if (lower.includes("stranger") || lower.includes("met") || lower.includes("someone")) {
        message =
            `${opener} That sounds like one of those moments that can leave a little ripple — even if it was brief.`;
        followUp =
            "What stood out most — what they said/did, how you felt, or the situation itself?";
    } else if (lower.includes("money") || lower.includes("office") || lower.includes("salary") || lower.includes("bonus")) {
        message =
            `${opener} Getting money from work can bring a mix of relief and momentum.`;
        followUp =
            "Is it mostly relief (like bills/pressure easing), or more of a happy “I earned this” feeling?";
    } else if (
        lower.includes("ecstatic") ||
        lower.includes("amazing") ||
        lower.includes("fantastic") ||
        lower.includes("happy") ||
        lower.includes("great") ||
        lower.includes("cool")
    ) {
        message =
            `${opener} That sounds really uplifting — it’s lovely to hear that kind of energy from you.`;
        followUp =
            "What do you think sparked this feeling — something that happened, or just one of those rare, good moments?";
    } else {
        // memory-aware: avoid asking the same “comfort/clarity/next step” repeatedly
        const asked = recentlyAsked(ctx, "comfort, clarity, or a next step");

        message = `${opener} I’m with you in this.`;
        followUp = asked
            ? "Where do you feel this most right now — in your body, your thoughts, or the situation around you?"
            : "What would help most right now — comfort, clarity, or a practical next step?";
    }

    const userPrefs = {
        companionTone: ctx.persona?.relationshipTone,
        ageTone: ctx.persona?.ageTone,
        genderTone: ctx.persona?.genderTone,
    };

    const enforcedMessage = applySoftEnforcement({ text: message, userPrefs });
    const enforcedFollowUp = applySoftEnforcement({ text: followUp, userPrefs });

    const meta: ImotaraResponse["meta"] = {
        styleContract: "1.0",
        blueprint: "1.0",
        blueprintUsed: DEFAULT_RESPONSE_BLUEPRINT,
    };

    // ✅ Baby Step 11.3 — echo applied/requested tone choices for QA/compat gate
    // (Kept as server-added debug metadata; clients may ignore.)
    (meta as any).toneEcho = {
        relationshipTone: ctx.persona?.relationshipTone ?? null,
        ageTone: ctx.persona?.ageTone ?? null,
        genderTone: ctx.persona?.genderTone ?? null,
    };

    // QA-only: attach notes only when debug is enabled
    if (ctx.debug) {
        meta.softEnforcement = {
            message: {
                severity: enforcedMessage.severity,
                notes: enforcedMessage.notes,
            },
            followUp: {
                severity: enforcedFollowUp.severity,
                notes: enforcedFollowUp.notes,
            },
        };
    }

    // ✅ Baby Step 11.7.3 — derive emotion from the last user text (deterministic, no AI)
    const userName = (ctx as any)?.toneContext?.user?.name as string | undefined;
    const userText = String(userMessage ?? "");

    const t = userText.toLowerCase();

    // tiny helper: deterministic keyword → primary emotion
    const inferPrimaryFromText = (text: string): EmotionAnalysis["primary"] => {
        const s = String(text || "").toLowerCase();

        return /\b(stress|stressed|anxious|anxiety|worried|panic|overwhelmed|burnt out|burned out)\b/.test(s) ? "anxiety" :
            /\b(sad|down|depressed|heartbroken|lonely|cry|crying)\b/.test(s) ? "sadness" :
                /\b(angry|mad|furious|irritated|annoyed)\b/.test(s) ? "anger" :
                    /\b(scared|afraid|fear|terrified)\b/.test(s) ? "fear" :
                        /\b(happy|glad|excited|joy|relieved)\b/.test(s) ? "joy" :
                            "neutral";
    };

    // 1) primary from *current* message
    let primary = inferPrimaryFromText(t);

    // 2) ✅ Emotion continuity:
    // If current looks neutral, keep the last non-neutral from recent user turns (if any).
    if (primary === "neutral") {
        const recent = (ctx?.recent ?? []).slice().reverse(); // newest → oldest
        for (const m of recent) {
            if (m?.role !== "user") continue;
            const prev = inferPrimaryFromText(m.content);
            if (prev !== "neutral") {
                primary = prev;
                break;
            }
        }
    }

    const fallbackSummary = userName
        ? `Feeling mostly ${primary} for ${userName}.`
        : `Feeling mostly ${primary}.`;

    const emotion: EmotionAnalysis = normalizeEmotion(
        {
            primary,
            intensity: "medium",
            confidence: 0.75,
            summary: fallbackSummary,
        },
        fallbackSummary
    );

    // Keep it inside meta so we don't break ImotaraResponse typing
    (meta as any).emotion = emotion;

    return {
        reflectionSeed: makeReflectionSeed(msg),
        message: cap(enforcedMessage.adjustedText, 240),
        followUp: cap(enforcedFollowUp.adjustedText, 200),
        meta,
    };
}

export async function runImotara(input: {
    userMessage: string;
    sessionContext?: Record<string, unknown> | null;
    toneContext?: unknown;
}): Promise<ImotaraResponse> {
    const userMessage = oneLine(input.userMessage);

    // Merge toneContext into ctx so companion name / age / gender / relationship
    // are available consistently across the orchestrator.
    const baseSession =
        input.sessionContext && typeof input.sessionContext === "object"
            ? (input.sessionContext as Record<string, unknown>)
            : {};

    const ctx = {
        ...baseSession,
        ...(input.toneContext ? { toneContext: input.toneContext } : {}),
    } as SessionContext;

    // ✅ Baby Step 9.7 — minimal consume of recentMessages (parity with mobile/web payload)
    // Clients send: sessionContext.recentMessages = [{ role, content }]
    // Orchestrator currently reads: sessionContext.recent
    if (
        !Array.isArray((ctx as any).recent) &&
        Array.isArray((ctx as any).recentMessages)
    ) {
        (ctx as any).recent = (ctx as any).recentMessages;
    }

    // ✅ Baby Step 9.8 — clamp memory to last 8 turns (lightweight continuity)
    if (Array.isArray((ctx as any).recent)) {
        (ctx as any).recent = (ctx as any).recent.slice(-8);
    }

    // ✅ Baby Step 11.9 — preserve pinnedRecall passed from API, but ONLY if explicitly marked relevant
    // This prevents “random old jumps” while allowing safe memory usage when we have high confidence.
    const pr = (ctx as any).pinnedRecall;
    const prRelevant = (ctx as any).pinnedRecallRelevant === true;

    if (prRelevant && Array.isArray(pr)) {
        (ctx as any).pinnedRecall = pr.slice(0, 3);
    } else {
        (ctx as any).pinnedRecall = [];
        (ctx as any).pinnedRecallRelevant = false;
    }

    // ✅ Baby Step 11.9.1 — identity memory only (safe): hydrate missing user name
    // We only use identity:* keys and ONLY when pinnedRecallRelevant === true.
    try {
        const pinned: string[] = (ctx as any).pinnedRecall ?? [];
        const identity = pinned
            .filter((s) => typeof s === "string" && s.startsWith("identity:"))
            .slice(0, 3);

        const getValue = (k: string): string | null => {
            const hit = identity.find((s) => s.startsWith(`identity:${k}=`));
            if (!hit) return null;
            const v = hit.split("=", 2)[1] ?? "";
            const clean = String(v).replace(/\s+/g, " ").trim();
            return clean.length ? clean : null;
        };

        const nameFromMemory =
            getValue("preferred_name") ?? getValue("name") ?? getValue("nickname");

        // Only set if not already present, and only if user didn’t opt out of name usage.
        const useName = (ctx as any)?.toneContext?.user?.useName !== false;

        if (useName && nameFromMemory) {
            const existing = (ctx as any)?.toneContext?.user?.name;
            if (!existing) {
                (ctx as any).toneContext = (ctx as any).toneContext ?? {};
                (ctx as any).toneContext.user = (ctx as any).toneContext.user ?? {};
                (ctx as any).toneContext.user.name = nameFromMemory;
            }
        }
    } catch {
        // never fail the request due to memory hydration
    }

    if (!userMessage) {
        const useName =
            (ctx as any)?.toneContext?.user?.useName !== false;

        const userName =
            useName &&
                (ctx as any)?.toneContext?.user?.name &&
                typeof (ctx as any).toneContext.user.name === "string"
                ? String((ctx as any).toneContext.user.name).trim()
                : "";

        const prefix = userName ? `${userName}, ` : "";

        return {
            message: `${prefix}tell me what’s on your mind—one line is enough.`,
            followUp: "What’s the main thing you want help with right now?",

            meta: {
                styleContract: "1.0",
                blueprint: "1.0",
                blueprintUsed: DEFAULT_RESPONSE_BLUEPRINT,
            },
        };
    }

    const response = await draftResponseForLanguage(userMessage, ctx);

    const useName =
        (ctx as any)?.toneContext?.user?.useName !== false;

    const userName =
        useName &&
            (ctx as any)?.toneContext?.user?.name &&
            typeof (ctx as any).toneContext.user.name === "string"
            ? String((ctx as any).toneContext.user.name).trim()
            : "";

    // ✅ Baby Step 11.7.18 — if user prefers no name, strip it from drafted text
    if (!useName && response?.message && (ctx as any)?.toneContext?.user?.name) {
        const rawName = String((ctx as any).toneContext.user.name).trim();
        const nameRegex = new RegExp(`\\b${rawName}\\b\\s*,?\\s*`, "gi");

        response.message = String(response.message)
            .replace(nameRegex, "")
            // Clean up leftovers like "I hear you, ." or double spaces
            .replace(/\s+,/g, ",")
            .replace(/,\s*\./g, ".")
            .replace(/\s{2,}/g, " ")
            .replace(/\s+\./g, ".")
            .trim();
    }

    // Relationship-tone soft opener (no identity simulation; just style)
    // ✅ Goal: keep the user's chosen style, but prevent incoherent mixes by adjusting ONLY the opener phrasing.
    let relationshipStyle =
        (ctx as any)?.toneContext?.companion?.relationship ?? null;

    // Fallback to stored persona relationshipTone when companion settings aren't present
    if (!relationshipStyle || relationshipStyle === "prefer_not") {
        const fallback = pickRelationshipTone(ctx);
        relationshipStyle = fallback === "prefer_not" ? null : fallback;
    }

    const effectiveAge =
        (ctx as any)?.toneContext?.companion?.ageRange ??
        (ctx as any)?.toneContext?.user?.ageRange ??
        null;

    let softOpener = "";

    // ✅ Guard against incoherent mixes (e.g., "mentor" voice + under_13)
    // We DO NOT silently flatten everything to "friend".
    // Instead: keep the chosen relationship style, but use a kid-safe opener that matches it.
    if (effectiveAge === "under_13") {
        if (!relationshipStyle) relationshipStyle = "friend";

        if (relationshipStyle === "mentor") {
            softOpener = "Okay — let’s take one small step at a time. ";
        } else if (relationshipStyle === "coach") {
            softOpener = "Alright — here’s one simple thing to try. ";
        } else if (relationshipStyle === "partner_like") {
            softOpener = "Hey — I’m here with you. Let’s do one small step. ";
        } else if (relationshipStyle === "friend") {
            softOpener = "Hey — let’s make this simple. ";
        }
    } else {
        // Default mentor opener (non-under_13)
        if (relationshipStyle === "mentor") {
            softOpener = "Let’s slow this down and find one clear next step. ";
        }
    }

    // Personalized greeting (natural, non-creepy, no invented memory)
    // - Uses name only when allowed
    // - Avoids repeating if draft already addressed them
    // - Keeps softOpener as tone guidance
    if (userName && response?.message) {
        const firstLine = String(response.message).split("\n")[0] ?? "";
        const alreadyUsed =
            firstLine.toLowerCase().includes(userName.toLowerCase()) ||
            firstLine.toLowerCase().startsWith("hey ");

        if (!alreadyUsed) {
            response.message = `Hey ${userName} —\n\n${softOpener}${response.message}`;
        } else if (softOpener) {
            response.message = `${softOpener}${response.message}`;
        }
    } else if (softOpener && response?.message) {
        response.message = `${softOpener}${response.message}`;
    }

    // ✅ Baby Step 11.7.12 — echo tone settings for transparency/debug
    const ageTone =
        (ctx as any)?.toneContext?.companion?.ageRange ??
        (ctx as any)?.toneContext?.user?.ageRange ??
        null;

    const genderTone =
        (ctx as any)?.toneContext?.companion?.gender ??
        (ctx as any)?.toneContext?.user?.gender ??
        null;

    const companionName =
        (ctx as any)?.toneContext?.companion?.enabled === true
            ? ((ctx as any)?.toneContext?.companion?.name ?? null)
            : null;

    const existingMeta = (response as any).meta ?? {};
    const carriedEmotion = carryForwardEmotion(
        existingMeta.emotion,
        (ctx as any)?.recent
    );

    (response as any).meta = {
        ...existingMeta,
        emotion: carriedEmotion,
        toneEcho: {
            ...(existingMeta.toneEcho ?? {}),
            relationshipTone: relationshipStyle,
            ageTone,
            genderTone,
            companionName,
        },
    };

    function carryForwardEmotion(
        current: any,
        recent: any[] | undefined
    ) {
        if (!recent || !recent.length) return current;

        // Only intervene if emotion is neutral or missing
        if (current?.primary && current.primary !== "neutral") {
            return current;
        }

        // Find last assistant emotion
        for (let i = recent.length - 1; i >= 0; i--) {
            const m = recent[i];
            if (m?.role === "assistant" && m?.meta?.emotion?.primary) {
                return {
                    ...(m.meta.emotion ?? {}),
                    primary: m.meta.emotion.primary,
                    intensity: m.meta.emotion.intensity ?? "low",
                    confidence: typeof m.meta.emotion.confidence === "number" ? m.meta.emotion.confidence : 0.4,
                    carried: true,
                };
            }
        }

        return current;
    }

    // ✅ Baby Step 11.7.16 — if under_13, keep wording extra simple (no identity simulation)
    if (effectiveAge === "under_13" && response?.message) {
        response.message = String(response.message)
            .replace(/\bI hear you\b/gi, "I get it")
            .replace(/\bWhat would help most right now\b/gi, "What would help right now");
    }

    // ✅ Baby Step 11.7.21 — optional companion sign-off (safe, not identity simulation)
    const companionEnabled =
        (ctx as any)?.toneContext?.companion?.enabled === true &&
        (ctx as any)?.toneContext?.companion?.signatureEnabled === true;

    const companionNameForSignoff =
        companionEnabled && typeof (ctx as any)?.toneContext?.companion?.name === "string"
            ? String((ctx as any).toneContext.companion.name).trim()
            : "";

    if (companionNameForSignoff && response?.message) {
        // Avoid duplicating if already present
        if (!response.message.toLowerCase().includes(companionNameForSignoff.toLowerCase())) {
            response.message = `${response.message}\n— ${companionNameForSignoff}`;
        }
    }

    return applyFinalResponseGate({
        response,
        userMessage,
        ctx,
    });
}
