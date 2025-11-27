// src/app/api/chat-reply/route.ts
//
// Server endpoint to generate a single Imotara chat reply using the
// shared AI client (callImotaraAI). This is used by the Chat page
// to optionally upgrade the local/fallback reply templates.
//
// Request shape:
//   POST { messages: { role: "user" | "assistant" | "system"; content: string }[], emotion?: string }
//
// Response shape:
//   Same as ImotaraAIResponse from aiClient: { text, meta }

import { NextResponse } from "next/server";
import { callImotaraAI } from "@/lib/imotara/aiClient";
import type { ImotaraAIResponse } from "@/lib/imotara/aiClient";

type ChatReplyRequest = {
    messages?: {
        role: "user" | "assistant" | "system";
        content: string;
    }[];
    emotion?: string;
};

// keep context + prompt modest
const MAX_TURNS = 8;
const MAX_CHARS = 4000;

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as ChatReplyRequest | null;

        const rawMessages = Array.isArray(body?.messages)
            ? body!.messages
            : [];

        // Keep only last few turns for context, and ensure valid shapes
        const recent = rawMessages
            .filter(
                (m) =>
                    m &&
                    typeof m.content === "string" &&
                    m.content.trim().length > 0 &&
                    (m.role === "user" ||
                        m.role === "assistant" ||
                        m.role === "system")
            )
            .slice(-MAX_TURNS);

        const emotion = (body?.emotion || "").toLowerCase().trim();

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

        const prompt = [
            "The following is a chat between a teenager and Imotara, a calm, supportive emotional companion.",
            "Imotara speaks in 2–3 short sentences, with warmth, validation, and gentle encouragement.",
            "Imotara never gives medical, diagnostic, or crisis advice. Instead, it encourages the user to reach out to trusted people or local services if needed.",
            "Imotara sounds like a caring, emotionally-aware friend — not a therapist, doctor, or hotline.",
            "",
            emotionHint,
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

        // We always return the AI response shape, but the client
        // will only *use* it as primary text if meta.from === "openai"
        // and text is non-empty.
        return NextResponse.json(ai, { status: 200 });
    } catch (err) {
        console.error("[/api/chat-reply] error:", err);
        // We still return a valid ImotaraAIResponse shape so the client
        // can simply ignore it (meta.from !== "openai") and fall back.
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
