// src/lib/imotara/aiClient.ts
//
// Single place to talk to the AI engine for Imotara.
// ⚠️ SERVER-ONLY: do not import this into client components.

"use server";

type CallImotaraAIOptions = {
    system?: string;
    maxTokens?: number;
    temperature?: number;
};

export type ImotaraAIResponse = {
    text: string;
    meta: {
        usedModel: string;
        from: "openai" | "fallback" | "disabled" | "error";
        reason?: string;
    };
};

/**
 * Core helper to call the configured AI model.
 * Keeps all OpenAI details in one place so the rest of the app
 * just uses a simple function.
 */
export async function callImotaraAI(
    prompt: string,
    options: CallImotaraAIOptions = {}
): Promise<ImotaraAIResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.IMOTARA_AI_MODEL || "gpt-4.1-mini";

    // If there is no API key, we gracefully fall back.
    if (!apiKey) {
        return {
            text:
                "Imotara's deep AI engine is not connected right now, " +
                "so I can only give a lightweight response. Please ask Soumen to configure the AI key.",
            meta: {
                usedModel: model,
                from: "disabled",
                reason: "OPENAI_API_KEY not set",
            },
        };
    }

    const systemPrompt =
        options.system ||
        "You are Imotara, a calm, supportive emotional companion. " +
        "You respond briefly, with empathy and clarity, to help the user reflect on their feelings.";

    const temperature =
        typeof options.temperature === "number" ? options.temperature : 0.7;

    const maxTokens = options.maxTokens ?? 350;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt },
                ],
                max_tokens: maxTokens,
                temperature,
            }),
        });

        if (!response.ok) {
            const errText = await safeReadText(response);

            return {
                text:
                    "I tried to connect to Imotara's AI engine, but something went wrong. " +
                    "For now, please treat this as a soft, placeholder reply.",
                meta: {
                    usedModel: model,
                    from: "error",
                    reason: `HTTP ${response.status}: ${errText.slice(0, 200)}`,
                },
            };
        }

        const data = (await response.json()) as any;

        const text: string =
            data?.choices?.[0]?.message?.content?.toString().trim() ||
            "I’m here with you. I don’t have a detailed answer right now, " +
            "but I’m listening to what you’re feeling.";

        return {
            text,
            meta: {
                usedModel: model,
                from: "openai",
            },
        };
    } catch (err: any) {
        return {
            text:
                "Imotara's AI engine seems temporarily unreachable. " +
                "Please try again after some time.",
            meta: {
                usedModel: model,
                from: "fallback",
                reason: err?.message || "Unknown network or runtime error",
            },
        };
    }
}

async function safeReadText(response: Response): Promise<string> {
    try {
        return await response.text();
    } catch {
        return "";
    }
}
