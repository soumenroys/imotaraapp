// src/lib/imotara/respondRemote.ts
import type { ImotaraResponse } from "@/lib/ai/response/responseBlueprint";

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
    try {
        const aiRes = await fetch("/api/chat-reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
            messages,
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
