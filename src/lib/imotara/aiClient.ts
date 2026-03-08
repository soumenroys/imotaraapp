// src/lib/imotara/aiClient.ts
//
// Single place to talk to the AI engine for Imotara.
// ⚠️ SERVER-ONLY: do not import this into client components.

"use server";

function stripQuestionsIfNeeded(text: string, noQuestions?: boolean): string {
  if (!noQuestions || !text) return text;

  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim());
  const filtered = sentences.filter(
    (s) =>
      !/[?]\s*$/.test(s) && !/^(what|which|how|why|when|where|who)\b/i.test(s),
  );

  return (filtered.length ? filtered : sentences.slice(0, 1)).join(" ").trim();
}

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
   */
  abortMs?: number;

  /**
   * If true, remove any question(s) from the final text.
   * Used for "pause / goodbye / talk later" closure states.
   */
  noQuestions?: boolean;
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
  options: CallImotaraAIOptions = {},
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
      "- Calm, warm, grounded, and natural.",
      "- Speak like a real human companion, not a therapeutic script.",
      "- Be specific to what the user actually said. Avoid vague reassurance and generic advice.",
      "- Keep it short: 2–5 sentences.",
      "",
      "Response goals:",
      "1) First respond directly to the user's actual message or question.",
      "2) Show care and emotional attunement only as much as the moment naturally calls for.",
      "3) Continue the conversation in a human way; do not force a follow-up question in every reply.",
      "4) Offer a gentle practical suggestion only when it truly fits the user's situation.",
      "",
      "Constraints:",
      "- Do not default to therapy-style wording for casual or everyday conversation.",
      "- Do not repeatedly use phrases like 'I'm here with you', 'take your time', or similar reassurance unless the moment clearly needs them.",
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
    // ✅ Use structured input so the model cleanly separates "system" vs "user".
    // This reduces repetitive template loops and improves continuity/intent-following.
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
        input: [
          {
            role: "system",
            content: [{ type: "text", text: systemPrompt }],
          },
          {
            role: "user",
            content: [{ type: "text", text: prompt }],
          },
        ],
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
    console.log("IMOTARA OPENAI RESPONSE:", JSON.stringify(data).slice(0, 500));

    // usedModel is safe here because we're in the successful parse path
    const usedModel = data?.model || model;

    // Prefer the full convenience field output_text, then fall back
    // to structured output by joining all text pieces, not just the first one.
    let text: string | undefined;

    if (Array.isArray(data.output_text) && data.output_text.length > 0) {
      text = data.output_text
        .map((part) => String(part ?? "").trim())
        .filter(Boolean)
        .join(" ")
        .trim();
    } else if (Array.isArray(data.output) && data.output.length > 0) {
      text = data.output
        .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
        .map((piece) => (typeof piece?.text === "string" ? piece.text.trim() : ""))
        .filter(Boolean)
        .join(" ")
        .trim();
    }

    // Keep existing behavior for “success but empty output”: provide a gentle default.
    if (!text) {
      text =
        "I’m here with you. I don’t have a detailed answer right now, " +
        "but I’m listening to what you’re feeling.";
    }

    // ✅ Enforce "no questions" when requested (closure states).
    // This is a safety net in case the model still asks something.
    if (options.noQuestions && text) {
      const parts = text.split(/(?<=[.!?])\s+/).map((s) => s.trim());
      const kept = parts.filter(
        (s) =>
          !/[?]\s*$/.test(s) &&
          !/^(what|which|how|why|when|where|who)\b/i.test(s),
      );
      text = (kept.length ? kept : parts.slice(0, 1)).join(" ").trim();
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
