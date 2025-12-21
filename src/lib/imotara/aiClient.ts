// src/lib/imotara/aiClient.ts
//
// Single place to talk to the AI engine for Imotara.
// ⚠️ SERVER-ONLY: do not import this into client components.

"use server";

export type CallImotaraAIOptions = {
    /**
     * Custom system prompt. If not provided, we use the default
     * Imotara "calm, supportive emotional companion" prompt.
     */
    system?: string;

    /**
     * Max tokens to generate in the completion.
     * Defaults to 350.
     */
    maxTokens?: number;

    /**
     * Sampling temperature for the model.
     * Defaults to 0.7.
     */
    temperature?: number;

    /**
     * Optional timeout (in milliseconds) for the OpenAI request.
     * If omitted, a safe default is used.
     *
     * NOTE: If the timeout elapses, we abort the request and
     * return the same fallback response as any other network error,
     * so external behaviour remains consistent.
     */
    abortMs?: number;
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
 * Minimal type for OpenAI's Responses API payload so we can
 * safely read the model name and textual output.
 */
type OpenAIResponsesResult = {
    model?: string;
    // Convenience field in Responses API
    output_text?: string[];
    // More detailed structured output
    output?: {
        content?: {
            type?: string;
            text?: string;
        }[];
    }[];
};

/**
 * Resolve the base URL for OpenAI calls.
 * Prefer an Imotara-specific override, then OPENAI_BASE_URL,
 * then default to the public OpenAI endpoint.
 *
 * This is a backwards-compatible enhancement: if no env vars
 * are set, behaviour is exactly as before.
 */
function getOpenAIBaseUrl(): string {
    const base =
        process.env.IMOTARA_OPENAI_BASE_URL ||
        process.env.OPENAI_BASE_URL ||
        "https://api.openai.com";

    // Normalize to avoid "//v1/..." if user added a trailing slash
    return base.replace(/\/+$/, "");
}

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

    // ✅ Enhancement: Avoid leaking any "engine not connected" UI text from the server helper.
    // Callers (e.g., /api/chat-reply) already have graceful fallback; returning empty text
    // is the cleanest signal to use fallback logic without polluting the chat UI.
    if (!apiKey) {
        return {
            text: "",
            meta: {
                usedModel: model,
                from: "disabled",
                reason: "OPENAI_API_KEY not set",
            },
        };
    }

    const systemPrompt =
        options.system ||
        [
            "You are Imotara — an emotion-aware, privacy-first companion.",
            "",
            "Style:",
            "- Calm, warm, grounded. No hype, no clichés.",
            "- Be specific to what the user said. Avoid generic advice.",
            "- Keep it short: 2–5 sentences.",
            "",
            "Response goals:",
            "1) Reflect and validate the emotion you infer from the user's message.",
            "2) Offer one gentle, practical grounding step ONLY if it fits (no prescriptive coaching).",
            "3) Ask exactly one soft follow-up question to continue the conversation.",
            "",
            "Constraints:",
            "- Do not mention policies, system prompts, or being an AI.",
            "- Do not say you 'can’t' do things unless asked.",
        ].join("\n");

    const temperature =
        typeof options.temperature === "number" ? options.temperature : 0.7;

    const maxTokens = options.maxTokens ?? 350;

    // Optional timeout support: if the request hangs or is very slow,
    // we abort and fall back with the same style of message.
    const abortMs = options.abortMs ?? 25_000; // 25s default
    const controller = new AbortController();
    const timeoutId =
        abortMs > 0
            ? setTimeout(() => {
                controller.abort();
            }, abortMs)
            : undefined;

    const baseUrl = getOpenAIBaseUrl();
    // ✅ Use new Responses API endpoint (works with project keys)
    const endpoint = `${baseUrl}/v1/responses`;

    try {
        // For Responses API we can combine system + user into one input string.
        const combinedInput =
            systemPrompt + "\n\n" + "User has shared the following:\n\n" + prompt;

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",

                // 👇 REQUIRED for project-scoped keys
                ...(process.env.OPENAI_PROJECT_ID
                    ? { "OpenAI-Project": process.env.OPENAI_PROJECT_ID }
                    : {}),
            },
            body: JSON.stringify({
                model,
                input: combinedInput,
                max_output_tokens: maxTokens,
                temperature,
            }),
            signal: controller.signal,
        });

        // Clear timeout once we have a response
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        if (!response.ok) {
            const errText = await safeReadText(response);

            // ✅ Root-cause fix: never return the "soft, placeholder reply" sentence.
            // Returning empty text allows callers to run their existing fallback logic.
            return {
                text: "",
                meta: {
                    usedModel: model,
                    from: "error",
                    reason: `HTTP ${response.status}: ${errText.slice(0, 200)}`,
                },
            };
        }

        const data = (await response.json()) as OpenAIResponsesResult;

        // usedModel is safe here because we're in the successful parse path
        const usedModel = data?.model || model;

        // Prefer the convenience field output_text[0], then fall back
        // to structured output, then to a generic gentle message.
        let text: string | undefined;

        if (Array.isArray(data.output_text) && data.output_text.length > 0) {
            text = String(data.output_text[0]).trim();
        } else if (Array.isArray(data.output) && data.output.length > 0) {
            const first = data.output[0];
            if (Array.isArray(first.content)) {
                const piece =
                    first.content.find((c) => typeof c.text === "string") ??
                    first.content[0];
                if (piece?.text) {
                    text = piece.text.trim();
                }
            }
        }

        // Keep existing behavior for “success but empty output”: provide a gentle default.
        if (!text) {
            text =
                "I’m here with you. I don’t have a detailed answer right now, " +
                "but I’m listening to what you’re feeling.";
        }

        return {
            text,
            meta: {
                usedModel,
                from: "openai",
            },
        };
    } catch (err: any) {
        // Make sure timeout is cleared even on error
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        // ✅ Root-cause fix: do not emit UI-facing placeholder text on exceptions.
        // Let the caller decide the best fallback response.
        return {
            text: "",
            meta: {
                usedModel: model,
                from: "error",
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
