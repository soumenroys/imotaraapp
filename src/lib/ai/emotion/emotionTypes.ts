// src/lib/ai/emotion/emotionTypes.ts

export type EmotionPrimary =
    | "neutral"
    | "joy"
    | "sadness"
    | "anger"
    | "fear"
    | "anxiety"
    | "disgust"
    | "surprise"
    | "love"
    | "curiosity"
    | "confusion"
    | "shame"
    | "guilt"
    | "loneliness"
    | "hope";

export type EmotionIntensity = "low" | "medium" | "high";

export type EmotionAnalysis = {
    primary: EmotionPrimary;
    secondary?: EmotionPrimary;
    intensity: EmotionIntensity;

    /** 0..1 – internal signal only */
    confidence: number;

    /** One-line human summary (safe + short) */
    summary: string;
};
