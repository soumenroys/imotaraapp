// src/lib/imotara/reflectionSeedContract.ts

import type {
    ImotaraResponse,
    ReflectionSeed,
    ReflectionIntent,
} from "@/lib/ai/response/responseBlueprint";

/**
 * Reflection Seed Card: Canonical Contract + Render Rules
 *
 * This module defines:
 * - When the card should show
 * - How the payload is normalized
 * - UI-safe constraints (length, trimming)
 *
 * RULES (LOCKED):
 * 1) Card is optional.
 * 2) If present, it is shown ABOVE the assistant message.
 * 3) Title is short (<= 42 chars). Prompt is one line (<= 120 chars).
 * 4) No markdown. No emojis by default.
 * 5) Intent controls the micro-label only ("Reflect" | "Clarify" | "Reframe").
 */

export type ReflectionSeedLabel = "Reflect" | "Clarify" | "Reframe";

export function intentToLabel(intent: ReflectionIntent): ReflectionSeedLabel {
    switch (intent) {
        case "clarify":
            return "Clarify";
        case "reframe":
            return "Reframe";
        case "reflect":
        default:
            return "Reflect";
    }
}

export type NormalizedReflectionSeed = ReflectionSeed & {
    label: ReflectionSeedLabel;
    title: string; // trimmed, length-capped
    prompt: string; // trimmed, length-capped, single-line
};

/** Hard caps to keep UI identical across platforms */
export const REFLECTION_SEED_LIMITS = {
    titleMax: 42,
    promptMax: 120,
} as const;

function stripMarkdownAndNewlines(s: string): string {
    // Minimal "UI safety" sanitizer.
    // We are not doing full markdown parsing here; we just remove common tokens.
    const noMd = s
        .replace(/[*_`>#]/g, "")
        .replace(/\[(.*?)\]\((.*?)\)/g, "$1"); // [text](url) -> text
    return noMd.replace(/\s+/g, " ").trim(); // collapse + single line
}

function cap(s: string, max: number): string {
    const t = s.trim();
    if (t.length <= max) return t;
    return t.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

/**
 * Normalize a raw ReflectionSeed into a strict UI-safe object.
 * Returns null if invalid.
 */
export function normalizeReflectionSeed(
    seed: unknown
): NormalizedReflectionSeed | null {
    if (!seed || typeof seed !== "object") return null;

    const s = seed as any;
    const intent: ReflectionIntent =
        s.intent === "clarify" || s.intent === "reframe" || s.intent === "reflect"
            ? s.intent
            : "reflect";

    const rawTitle = typeof s.title === "string" ? s.title : "";
    const rawPrompt = typeof s.prompt === "string" ? s.prompt : "";

    const title = cap(stripMarkdownAndNewlines(rawTitle), REFLECTION_SEED_LIMITS.titleMax);
    const prompt = cap(
        stripMarkdownAndNewlines(rawPrompt),
        REFLECTION_SEED_LIMITS.promptMax
    );

    // Must have at least a prompt. Title can fall back.
    if (!prompt) return null;

    return {
        intent,
        label: intentToLabel(intent),
        title: title || "Reflection seed",
        prompt,
    };
}

/**
 * Extract normalized reflection seed from an ImotaraResponse.
 * This is the ONLY approved way for UI to read the card payload.
 */
export function getReflectionSeedCard(
    response: ImotaraResponse
): NormalizedReflectionSeed | null {
    return normalizeReflectionSeed(response?.reflectionSeed);
}

/**
 * Canonical render decision:
 * - show card only when normalized seed exists
 */
export function shouldShowReflectionSeedCard(
    response: ImotaraResponse
): boolean {
    return !!getReflectionSeedCard(response);
}
