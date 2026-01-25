import { NextResponse } from "next/server";
import { runImotara } from "@/lib/ai/orchestrator/runImotara";
import type { EmotionAnalysis } from "@/lib/ai/emotion/emotionTypes";
import { normalizeEmotion } from "@/lib/ai/emotion/normalizeEmotion";

import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseUserServer } from "@/lib/supabase/userServer";
import { fetchUserMemories } from "@/lib/memory/fetchUserMemories";
import { selectPinnedRecall } from "@/lib/memory/memoryRelevance";
import { buildLocalReply } from "@/lib/ai/local/localReplyEngine";

export async function POST(req: Request) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // QA request flag (accepts "1" or "true")
    const qaHeader = req.headers.get("x-imotara-qa");
    const qa = qaHeader === "1" || qaHeader?.toLowerCase() === "true";

    // Support multiple payload shapes without adding any AI logic here:
    // Preferred: { message, context }
    // Legacy: { text }
    // Older: { inputs: [{ text: string, ... }], options?: ... }
    const rawMessage =
        (body?.message ??
            body?.text ??
            (Array.isArray(body?.inputs) && (body.inputs as unknown[]).length
                ? (body.inputs as Array<Record<string, unknown>>)[
                    (body.inputs as unknown[]).length - 1
                ]?.text
                : "") ??
            "");

    const message = typeof rawMessage === "string" ? rawMessage : String(rawMessage ?? "");
    console.log("[QA] /api/respond message:", message);
    const baseCtx = (body?.context ?? body?.options ?? {}) as Record<string, unknown>;

    const toneContext =
        (body?.toneContext ?? (baseCtx as any)?.toneContext ?? undefined) as unknown;

    // ✅ Baby Step 3.4.1 — derive analysis source (single truth)
    const analysisModeRaw =
        (baseCtx as any)?.analysisMode ??
        (baseCtx as any)?.analysis?.mode ??
        (body as any)?.analysisMode ??
        (body as any)?.analysis?.mode ??
        undefined;

    const analysisSource = analysisModeRaw === "local" ? "local" : "cloud";

    // ✅ Baby Step 11.7 — memory relevance guard (inject ONLY if relevant)
    // Prefer user-scoped Supabase (RLS) when cookies exist; fall back to service role.
    let supabase: any = supabaseServer;
    let authUserId: string | null = null;

    try {
        const s = await supabaseUserServer();
        supabase = s;

        const { data } = await s.auth.getUser();
        authUserId = data?.user?.id ?? null;
    } catch {
        supabase = supabaseServer;
        authUserId = null;
    }

    const userId =
        authUserId ??
        (baseCtx as any)?.user?.id ??
        (baseCtx as any)?.userId ??
        (body as any)?.user?.id ??
        "dev-user";

    // Normalize user id into context so downstream code has one place to look.
    // (Helps memory + personalization consistency across web/mobile.)
    (baseCtx as any).user = (baseCtx as any).user ?? {};
    (baseCtx as any).user.id = String(userId);

    let pinnedRecall: string[] = [];
    let pinnedRecallRelevant = false;

    // QA-only debug info (returned only when QA header is present)
    let pinnedRecallDebugTop:
        | Array<{ score: number; type: string; key: string }>
        | undefined;

    try {
        // fetchUserMemories signature: (supabaseClient, userId, limit)
        const memories = await fetchUserMemories(supabase, String(userId), 20);

        const selected = selectPinnedRecall(memories, message, {
            maxItems: 3,
            minScore: 0.18,
            minConfidence: 0.35,
        });

        pinnedRecall = selected.pinnedRecall;
        pinnedRecallRelevant = selected.pinnedRecallRelevant;

        if (qa) {
            pinnedRecallDebugTop = selected.scored.slice(0, 5).map((m) => ({
                score: m.score,
                type: m.type,
                key: m.key,
            }));
        }
    } catch {
        pinnedRecall = [];
        pinnedRecallRelevant = false;

        if (qa) {
            pinnedRecallDebugTop = [
                { score: 0, type: "error", key: "fetchUserMemories_failed" },
            ];
        }
    }

    // ✅ Local analysis mode: use lightweight local reply engine
    if (analysisSource === "local") {
        const local = buildLocalReply(message, toneContext);

        return NextResponse.json(
            {
                ...local,
                meta: {
                    styleContract: "1.0",
                    blueprint: "1.0",
                    analysisSource: "local",
                },
            },
            { status: 200 }
        );
    }

    const result = await runImotara({
        userMessage: message,
        sessionContext: {
            ...baseCtx,
            pinnedRecall,
            pinnedRecallRelevant,
            ...(qa ? { debug: true, pinnedRecallDebugTop } : {}),
        },
        toneContext, // ✅ enables companion tone + personal references consistently
    });

    // Public-release lock: never serialize QA-only metadata unless QA header is present
    const resultMeta =
        (((result as unknown) as { meta?: unknown })?.meta ?? {}) as Record<string, unknown>;

    const safeMeta = qa
        ? resultMeta
        : (() => {
            const m: Record<string, unknown> = { ...resultMeta };
            delete m.softEnforcement;
            // ✅ Keep emotion in public release (safe + non-sensitive)
            return m;
        })();

    // ✅ Baby Step 11.6.1 — guarantee emotion exists at API boundary
    const emotion: EmotionAnalysis = normalizeEmotion(
        (safeMeta as any)?.emotion,
        "Neutral or mixed feelings."
    );

    const metaWithEmotion: Record<string, unknown> = {
        ...safeMeta,
        emotion,

        // ✅ Baby Step 3.4.1 — exposed for UI parity
        analysisSource,
    };

    // 🔒 Contract guard: allow ONLY one ask channel
    if ((result as any)?.followUp && (result as any)?.reflectionSeed) {
        (result as any).reflectionSeed = null;
    }

    return NextResponse.json(
        {
            requestId: (body as any)?.requestId ?? null,
            ...result,
            meta: {
                styleContract: "1.0",
                blueprint: "1.0",
                ...metaWithEmotion,
            },
        },
        { status: 200 }
    );
}

export async function GET() {
    return NextResponse.json(
        {
            ok: true,
            route: "/api/respond",
            contract: "ImotaraResponse",
            note: "User (and mobile) response endpoint. Use this across Web/iOS/Android for parity.",
        },
        { status: 200 }
    );
}
