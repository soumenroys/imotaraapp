// src/app/api/chat-reply/route.ts
//
// Server endpoint to generate a single Imotara chat reply using the
// shared AI client (callImotaraAI). This is used by the Chat page
// to optionally upgrade the local/fallback reply templates.
//
// Request shape (current):
//   POST { messages: { role: "user" | "assistant" | "system"; content: string }[], emotion?: string }
//
// Extra compatibility (safe additions):
//   Also accepts POST { text: string } or { message: string } and converts to messages[].
//
// Response shape:
//   Same as ImotaraAIResponse from aiClient: { text, meta }

import { NextResponse } from "next/server";
import { callImotaraAI } from "@/lib/imotara/aiClient";
import type { ImotaraAIResponse } from "@/lib/imotara/aiClient";

import { getSupabaseAdmin, getSupabaseUserServerClient } from "@/lib/supabaseServer";
import { fetchUserMemories } from "@/lib/memory/fetchUserMemories";


type ChatReplyRequest = {
    user?: { id?: string; name?: string };
    // ✅ Privacy guard: when false, server will not read user_memory
    allowMemory?: boolean;
    messages?: {
        role: "user" | "assistant" | "system";
        content: string;
    }[];
    emotion?: string;

    // compat: some callers may send a single text field
    text?: string;
    message?: string;
};

// keep context + prompt modest
const MAX_TURNS = 8;
const MAX_CHARS = 4000;

function isBadPlaceholderText(s: string): boolean {
    const t = (s ?? "").trim();
    if (!t) return true;

    // The exact string you reported + common variants
    return (
        t.includes("soft, placeholder reply") ||
        t.includes("I tried to connect to Imotara's AI engine") ||
        t.includes("but something went wrong")
    );
}

export async function GET() {
    // Friendly response so opening in browser doesn't show 405
    return NextResponse.json(
        {
            ok: true,
            endpoint: "/api/chat-reply",
            methods: ["GET", "POST"],
            expects:
                'POST { messages: [{ role: "user", content: "..." }], emotion?: "neutral" }',
            compat: 'Also accepts POST { text: "..." } or { message: "..." }',
        },
        { status: 200 }
    );
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as ChatReplyRequest | null;

        // Allow single-text payloads without breaking existing behaviour
        let rawMessages = Array.isArray(body?.messages) ? body!.messages : [];

        if (!rawMessages.length) {
            const single =
                (typeof body?.text === "string" ? body.text : "") ||
                (typeof body?.message === "string" ? body.message : "");
            const cleaned = single.trim();
            if (cleaned) {
                rawMessages = [{ role: "user", content: cleaned }];
            }
        }

        // Keep only last few turns for context, and ensure valid shapes
        const recent = rawMessages
            .filter(
                (m) =>
                    m &&
                    typeof m.content === "string" &&
                    m.content.trim().length > 0 &&
                    (m.role === "user" || m.role === "assistant" || m.role === "system")
            )
            .slice(-MAX_TURNS);

        const emotion = (body?.emotion || "").toLowerCase().trim();

        // ✅ Optional memory: preferred name (spoof-proof)
        // - Identify user via Supabase Auth from cookies (anonymous auth supported)
        // - Use admin client only to read memory rows (bypasses RLS), BUT ONLY for the authenticated user id
        let preferredName = "";
        try {
            const allowMemory = body?.allowMemory !== false; // default true (backward compatible)
            if (allowMemory) {
                const supabaseUser = await getSupabaseUserServerClient();
                const { data } = await supabaseUser.auth.getUser();
                let authedUserId = data?.user?.id ?? "";

                // ✅ In production, if not authenticated, do not read memory
                if (!authedUserId && process.env.NODE_ENV === "production") {
                    authedUserId = "";
                }

                if (authedUserId) {
                    const supabaseAdmin = getSupabaseAdmin();
                    const memories = await fetchUserMemories(supabaseAdmin as any, authedUserId, 20);

                    const raw =
                        Array.isArray(memories)
                            ? (memories.find((m: any) => m?.key === "preferred_name")?.value ?? "")
                            : "";

                    preferredName = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
                }

            }
        } catch {
            // no-op: never block chat replies if memory fetch fails
        }



        let conversationText = recent
            .map((m) => {
                const label =
                    m.role === "user"
                        ? "User"
                        : m.role === "assistant"
                            ? "Imotara"
                            : "System";
                return `${label}: ${m.content}`;
            })
            .join("\n");

        if (conversationText.length > MAX_CHARS) {
            // Keep the most recent part if the text is too long
            conversationText = conversationText.slice(-MAX_CHARS);
        }

        const emotionHint = emotion
            ? `The user currently seems to be feeling: ${emotion}.\n`
            : "";

        const nameHint = preferredName
            ? `The user's preferred name is: ${preferredName}.\nUse it naturally (not every line).\n`
            : "";

        const prompt = [
            "The following is a chat between a teenager and Imotara, a calm, supportive emotional companion.",
            "Imotara speaks in 2–3 short sentences, with warmth, validation, and gentle encouragement.",
            "Imotara never gives medical, diagnostic, or crisis advice. Instead, it encourages the user to reach out to trusted people or local services if needed.",
            "Imotara sounds like a caring, emotionally-aware friend — not a therapist, doctor, or hotline.",
            "",
            emotionHint,
            nameHint,
            "Here is the recent conversation context (most recent at the end):",
            conversationText || "(No previous context; this is the first message.)",
            "",
            "Now write a single reply from Imotara to the user.",
            "Requirements:",
            "- Use simple, everyday language.",
            "- Be kind and non-judgmental.",
            "- Acknowledge the user's feelings.",
            "- Offer gentle reflection or next tiny step, without pressure.",
        ]
            .filter(Boolean)
            .join("\n");

        const ai: ImotaraAIResponse = await callImotaraAI(prompt, {
            maxTokens: 260,
            temperature: 0.8,
        });

        // ✅ ROOT-CAUSE FIX:
        // If the AI client returns a placeholder/failure string, do NOT pass it through as a valid reply.
        // Return text="" and meta.from !== "openai" so the Chat page uses its existing fallback reply.
        const candidate = (ai?.text ?? "").trim();

        // Only flag as placeholder if there IS text and it matches known bad strings.
        // Empty text now means: AI unavailable → let fallback logic happen naturally.
        if (candidate && isBadPlaceholderText(candidate)) {
            return NextResponse.json(
                {
                    text: "",
                    meta: {
                        ...(ai?.meta ?? {}),
                        from: "fallback",
                        reason: "filtered-placeholder-reply",
                    },
                },
                { status: 200 }
            );
        }
        // Normal successful path
        return NextResponse.json(ai, { status: 200 });
    } catch (err) {
        const PROD = process.env.NODE_ENV === "production";
        const SHOULD_LOG = !PROD && process.env.NODE_ENV !== "test";

        if (SHOULD_LOG) {
            console.warn("[/api/chat-reply] error:", String(err));
        }

        // Return a valid ImotaraAIResponse shape so the client can ignore it
        // (meta.from !== "openai") and fall back gracefully.
        const fallback: ImotaraAIResponse = {
            text: "",
            meta: {
                usedModel: "unknown",
                from: "error",
                reason: "chat-reply route error",
            },
        };
        return NextResponse.json(fallback, { status: 200 });
    }
}
