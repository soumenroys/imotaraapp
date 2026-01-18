// src/lib/ai/orchestrator/runImotara.ts

import type { ImotaraResponse } from "../response/responseBlueprint";
import { DEFAULT_RESPONSE_BLUEPRINT } from "../response/responseBlueprint";

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
        title: "One detail",
        prompt: "What’s the main thing you want from this chat—comfort, clarity, or a next step?",
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

    return {
        reflectionSeed: makeReflectionSeed(msg),
        message: cap(message, 240),
        followUp: cap(followUp, 200),

        meta: {
            styleContract: "1.0",
            blueprint: "1.0",
            blueprintUsed: DEFAULT_RESPONSE_BLUEPRINT,
        },
    };
}

export async function runImotara(input: {
    userMessage: string;
    sessionContext?: unknown;
}): Promise<ImotaraResponse> {
    const userMessage = oneLine(input.userMessage);
    const ctx = (input.sessionContext ?? {}) as SessionContext;

    if (!userMessage) {
        return {
            message: "Tell me what’s on your mind—one line is enough.",
            followUp: "What’s the main thing you want help with right now?",

            meta: {
                styleContract: "1.0",
                blueprint: "1.0",
                blueprintUsed: DEFAULT_RESPONSE_BLUEPRINT,
            },
        };
    }

    return draftResponse(userMessage, ctx);
}
