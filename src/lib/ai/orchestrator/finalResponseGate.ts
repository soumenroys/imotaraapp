// src/lib/ai/orchestrator/finalResponseGate.ts

import type { ImotaraResponse } from "../response/responseBlueprint";
import { compatibilityGate } from "../compat/compatibilityGate";

type FinalGateInput = {
    response: ImotaraResponse;
    userMessage: string;
    ctx: any; // keep loose; ctx shape evolves
};

function oneLine(s: string): string {
    return String(s ?? "").replace(/\s+/g, " ").trim();
}

function cap(s: string, max: number): string {
    const t = oneLine(s);
    if (t.length <= max) return t;
    return t.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

// Conservative markdown scrub (only if needed)
function stripObviousMarkdown(s: string): string {
    const t = String(s ?? "");
    // Remove the most common “formatting intent” tokens, keep text.
    return t
        .replace(/```[\s\S]*?```/g, "")     // fenced code blocks
        .replace(/`([^`]+)`/g, "$1")        // inline code
        .replace(/[*_#>[\\]]/g, "")         // common markdown tokens
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // links -> label
}

function getEffectiveAge(ctx: any): string | null {
    return (
        ctx?.toneContext?.companion?.ageRange ??
        ctx?.toneContext?.user?.ageRange ??
        null
    );
}

function getRelationshipStyle(ctx: any): string | null {
    return (
        ctx?.toneContext?.companion?.relationship ??
        ctx?.persona?.relationshipTone ??
        null
    );
}

/**
 * FinalResponseGate = (11.6 normalization) + (11.7 memory safety stub) + (11.8 persona contradiction)
 * Single place to ensure: clean format, safe memory usage signals, coherent persona.
 */
export function applyFinalResponseGate(input: FinalGateInput): ImotaraResponse {
    const { response, ctx } = input;

    const out: ImotaraResponse = {
        ...response,
        message: String(response?.message ?? ""),
        followUp: typeof response?.followUp === "string" ? response.followUp : "",
        meta: {
            ...(response as any)?.meta,
            styleContract: "1.0",
            blueprint: "1.0",
        },
    };

    // 11.6 — Normalize hard constraints
    out.message = cap(out.message, 240);
    if (out.followUp) out.followUp = cap(out.followUp, 200);

    // Remove obvious markdown only if it appears (keep text otherwise)
    const gateBefore = compatibilityGate(out);
    if (!gateBefore.ok && gateBefore.issues.some(i => i.code === "has_markdown")) {
        out.message = cap(stripObviousMarkdown(out.message), 240);
        if (out.followUp) out.followUp = cap(stripObviousMarkdown(out.followUp), 200);
    }

    // Ensure meta.toneEcho exists (compatibilityGate expects it)
    (out.meta as any).toneEcho = (out.meta as any).toneEcho ?? {
        relationshipTone: getRelationshipStyle(ctx),
        ageTone: getEffectiveAge(ctx),
        genderTone:
            ctx?.toneContext?.companion?.gender ??
            ctx?.toneContext?.user?.gender ??
            null,
        companionName:
            ctx?.toneContext?.companion?.enabled === true
                ? (ctx?.toneContext?.companion?.name ?? null)
                : null,
    };

    // 11.7 — Memory relevance guardrail (lightweight stub)
    // Today: runImotara doesn’t inject long-term memory here, but we enforce a rule:
    // if any future pinnedRecall exists, it must be explicitly marked “relevant”.
    // Otherwise, clear it to prevent “random old jumps”.
    if (Array.isArray(ctx?.pinnedRecall) && ctx.pinnedRecall.length > 0) {
        // If caller didn’t mark it as relevant, drop it.
        const isRelevant = ctx?.pinnedRecallRelevant === true;
        if (!isRelevant) {
            ctx.pinnedRecall = [];
            (out.meta as any).memoryGuard = { droppedPinnedRecall: true };
        }
    }

    // 11.8 — Persona contradiction handling (mentor + under_13 etc.)
    const age = getEffectiveAge(ctx);
    const rel = getRelationshipStyle(ctx);

    const contradiction =
        age === "under_13" &&
        (rel === "mentor" || rel === "coach" || rel === "partner_like");

    if (contradiction) {
        // Tiny, safe behavior: ask user to resolve, not “pretend” incoherently.
        const prompt =
            "Quick check—do you want me to talk like a kid-friendly friend, or keep a mentor/coach style?";

        // Don’t overwrite an existing strong follow-up; append only if short.
        if (!out.followUp) out.followUp = prompt;
        else if (out.followUp.length < 120) out.followUp = cap(`${out.followUp} ${prompt}`, 200);

        (out.meta as any).personaGuard = { contradiction: { age, relationship: rel } };
    }

    // Final compat report (QA-only usage downstream)
    const gateAfter = compatibilityGate(out);
    (out.meta as any).compat = gateAfter;

    return out;
}
