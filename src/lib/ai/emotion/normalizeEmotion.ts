// src/lib/ai/emotion/normalizeEmotion.ts

import type { EmotionAnalysis, EmotionIntensity, EmotionPrimary } from "./emotionTypes";

const PRIMARY_SET: Set<EmotionPrimary> = new Set([
    "neutral",
    "joy",
    "sadness",
    "anger",
    "fear",
    "anxiety",
    "disgust",
    "surprise",
    "love",
    "curiosity",
    "confusion",
    "shame",
    "guilt",
    "loneliness",
    "hope",
]);

const INTENSITY_SET: Set<EmotionIntensity> = new Set(["low", "medium", "high"]);

function clamp01(n: unknown): number {
    const x = typeof n === "number" ? n : Number(n);
    if (!Number.isFinite(x)) return 0.5;
    return Math.max(0, Math.min(1, x));
}

function asPrimary(x: unknown): EmotionPrimary | undefined {
    if (typeof x !== "string") return undefined;
    const v = x.trim().toLowerCase() as EmotionPrimary;
    return PRIMARY_SET.has(v) ? v : undefined;
}

function asIntensity(x: unknown): EmotionIntensity | undefined {
    if (typeof x !== "string") return undefined;
    const v = x.trim().toLowerCase() as EmotionIntensity;
    return INTENSITY_SET.has(v) ? v : undefined;
}

function oneLine(x: unknown): string {
    if (typeof x !== "string") return "";
    return x.replace(/\s+/g, " ").trim();
}

/**
 * Guarantees a non-null, well-formed EmotionAnalysis.
 * Use this at the boundary (model JSON → internal types, API response, DB/memory).
 */
export function normalizeEmotion(input: any, fallbackSummary?: string): EmotionAnalysis {
    const primary = asPrimary(input?.primary) ?? "neutral";

    const secondaryRaw = asPrimary(input?.secondary);
    const secondary = secondaryRaw && secondaryRaw !== primary ? secondaryRaw : undefined;

    const intensity = asIntensity(input?.intensity) ?? "medium";
    const confidence = clamp01(input?.confidence);

    const summary =
        oneLine(input?.summary) ||
        oneLine(fallbackSummary) ||
        (primary === "neutral"
            ? "Neutral tone."
            : `Feeling mostly ${primary}${secondary ? ` with some ${secondary}` : ""}.`);

    return {
        primary,
        secondary,
        intensity,
        confidence,
        summary,
    };
}
