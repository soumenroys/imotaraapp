// src/app/api/imotara-ai/route.ts
//
// 🧠 Minimal GPT-powered endpoint for Imotara.
// This does NOT replace your existing local analysis yet.
// It just takes a "message" from the user and returns an
// empathetic reply from ChatGPT via callImotaraLLM.

import { NextRequest, NextResponse } from "next/server";
import {
    callImotaraLLM,
    type ImotaraChatMessage,
} from "@/lib/imotara/openaiClient";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => null) as
            | { message?: string }
            | null;

        const userMessage = body?.message?.trim();

        if (!userMessage) {
            return NextResponse.json(
                { error: "Missing `message` in request body." },
                { status: 400 }
            );
        }

        const messages: ImotaraChatMessage[] = [
            {
                role: "system",
                content:
                    "You are Imotara, a gentle, emotionally-aware companion for teenagers and young adults. "
                    + "Respond in 2–5 sentences, with warmth, empathy, and psychological safety. "
                    + "Do not mention that you are an AI, do not give medical or clinical advice, "
                    + "and avoid diagnosing conditions. Focus on listening, emotional validation, "
                    + "reflecting what you heard, and offering one or two simple, kind next steps.",
            },
            {
                role: "user",
                content: userMessage,
            },
        ];

        const reply = await callImotaraLLM(messages);

        return NextResponse.json(
            {
                reply,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("[Imotara] /api/imotara-ai POST failed:", error);
        return NextResponse.json(
            {
                error:
                    "Something went wrong while reaching Imotara's AI companion. "
                    + "You still matter, even if my smarter brain is offline for a moment.",
            },
            { status: 500 }
        );
    }
}
