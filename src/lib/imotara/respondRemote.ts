// src/lib/imotara/respondRemote.ts
import type { ImotaraResponse } from "@/lib/ai/response/responseBlueprint";

/** Lightweight script-based language detection for the web client.
 *  Mirrors the mobile detectLangFromScript logic — returns a BCP-47-like code. */
function detectLangFromMessage(text: string): string {
    if (!text) return "en";
    if (/[\u0980-\u09FF]/.test(text)) return "bn";
    if (/[\u0904-\u0939\u0958-\u0963\u0971-\u097F]/.test(text)) return "hi";
    if (/[\u0B80-\u0BFF]/.test(text)) return "ta";
    if (/[\u0C00-\u0C7F]/.test(text)) return "te";
    if (/[\u0A80-\u0AFF]/.test(text)) return "gu";
    if (/[\u0C80-\u0CFF]/.test(text)) return "kn";
    if (/[\u0D00-\u0D7F]/.test(text)) return "ml";
    if (/[\u0A00-\u0A7F]/.test(text)) return "pa";
    if (/[\u0B00-\u0B7F]/.test(text)) return "or";
    if (/[\u0600-\u06FF]/.test(text)) return "ar";
    if (/[\u0400-\u04FF]/.test(text)) return "ru";
    if (/[\u4E00-\u9FFF]/.test(text)) return "zh";
    if (/[\u3040-\u30FF]/.test(text)) return "ja";
    return "en";
}

export async function respondRemote(input: {
    message: string;
    context?: unknown;
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
        companion?: { relationship?: string; ageRange?: string };
        user?: { ageRange?: string };
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
    // Detect language from the current message for accurate lang-mirroring on server
    const detectedLang = detectLangFromMessage(input.message);
    const profileLang = typeof (ctx as Record<string, unknown>).preferredLang === "string"
        ? (ctx as Record<string, unknown>).preferredLang as string
        : undefined;
    const lang = profileLang || detectedLang;

    try {
        const aiRes = await fetch("/api/chat-reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
            messages,
            lang,
            ...(tone ? { tone } : {}),
            ...(toneCtx?.user?.ageRange ? { userAge: toneCtx.user.ageRange } : {}),
            ...(toneCtx?.companion?.ageRange ? { companionAge: toneCtx.companion.ageRange } : {}),
            ...(typeof ctx.emotionMemory === "string" && ctx.emotionMemory ? { emotionMemory: ctx.emotionMemory } : {}),
        }),
        });

        if (aiRes.ok) {
            const data = await aiRes.json();
            const text = typeof data?.text === "string" ? data.text.trim() : "";

            if (data?.meta?.from === "openai" && text) {
                return {
                    message: text,
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
        // AI path unavailable — fall through to template path below
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
