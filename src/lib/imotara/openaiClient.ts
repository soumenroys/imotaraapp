// src/lib/imotara/openaiClient.ts
//
// 🔒 Server-only OpenAI / ChatGPT helper for Imotara.
// This file NEVER runs on the client – it is safe to use OPENAI_API_KEY here.

"use server";

type ImotaraChatRole = "system" | "user" | "assistant";

export type ImotaraChatMessage = {
    role: ImotaraChatRole;
    content: string;
};

/**
 * callImotaraLLM
 *
 * Minimal wrapper around OpenAI's Chat Completions API.
 * - Returns the assistant's text reply as a simple string.
 * - On any error (no key, network failure, etc.) it returns a
 *   gentle fallback message instead of throwing.
 */
export async function callImotaraLLM(
    messages: ImotaraChatMessage[]
): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        console.warn(
            "[Imotara] OPENAI_API_KEY is not set. Falling back to local-style message."
        );
        return "I’m here with you. (Imotara is currently using local analysis because the AI key is not available.)";
    }

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                // 🧠 You can change this model later if you want (e.g. gpt-5.1).
                model: "gpt-4.1",
                messages,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            console.error(
                "[Imotara] OpenAI API error:",
                response.status,
                response.statusText
            );
            return "I’m here with you, even if my smarter AI brain is having a temporary issue. Let’s take a slow breath together for now.";
        }

        const data = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
        };

        const content =
            data.choices?.[0]?.message?.content ??
            "I’m here with you. I don’t have the perfect words right now, but I’m listening.";

        return content;
    } catch (error) {
        console.error("[Imotara] OpenAI request failed:", error);
        return "I’m here with you. Something went wrong reaching my AI brain, but your feelings still matter.";
    }
}
