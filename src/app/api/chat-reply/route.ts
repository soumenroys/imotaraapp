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
import { formatImotaraReply } from "@/lib/imotara/response/responseFormatter";

import {
  getSupabaseAdmin,
  getSupabaseUserServerClient,
} from "@/lib/supabaseServer";
import { fetchUserMemories } from "@/lib/memory/fetchUserMemories";

type ChatReplyRequest = {
  user?: { id?: string; name?: string };
  // ✅ Privacy guard: when false, server will not read user_memory
  allowMemory?: boolean;

  // ✅ Companion tone + language (safe additions; backward compatible)
  // tone defaults to "close_friend" in formatter if not provided
  tone?: "close_friend" | "calm_companion" | "coach" | "mentor";
  lang?: string; // e.g. "en", "hi", "bn", "ta" ... (accepts "en-IN" etc.)

  // ✅ Age context (guides register/vocabulary without claiming to be human)
  userAge?: string;      // e.g. "13_17", "25_34", "65_plus"
  companionAge?: string; // age range of the companion persona

  messages?: {
    role: "user" | "assistant" | "system";
    content: string;
  }[];
  emotion?: string;

  // ✅ Long-term emotional memory summary (client-side localStorage → injected by runRespondWithConsent)
  emotionMemory?: string;

  // compat: some callers may send a single text field
  text?: string;
  message?: string;
};

// keep context + prompt modest
const MAX_TURNS = 8;
const MAX_CHARS = 4000;

// Keywords that signal emotional distress across a conversation
const EMOTIONAL_SIGNAL_RE =
  /\b(sad|anxious|anxiety|stress(?:ed|ful)?|overwhelm(?:ed|ing)?|depressed|depression|lonely|exhaust(?:ed|ing)?|drained|frustrated|angry|upset|hurt|scared|fearful?|worried|worry|hopeless|empty|numb|cry(?:ing)?|lost|stuck|panic(?:ked|king)?|brok(?:en|e)|heavy|grief|grieve|grieving|tired|burnt?\s*out)\b/i;

type EmotionalArcResult = {
  depth: "light" | "moderate" | "deep";
  emotionalTurnCount: number;
  userTurnCount: number;
};

function detectEmotionalArc(
  messages: { role: string; content: string }[],
): EmotionalArcResult {
  const userMsgs = messages.filter((m) => m.role === "user");
  const emotionalTurns = userMsgs.filter((m) =>
    EMOTIONAL_SIGNAL_RE.test(m.content),
  );
  const userTurnCount = userMsgs.length;
  const emotionalTurnCount = emotionalTurns.length;

  if (
    emotionalTurnCount >= 2 ||
    (userTurnCount >= 4 && emotionalTurnCount >= 1)
  ) {
    return { depth: "deep", emotionalTurnCount, userTurnCount };
  }
  if (emotionalTurnCount === 1 || userTurnCount >= 3) {
    return { depth: "moderate", emotionalTurnCount, userTurnCount };
  }
  return { depth: "light", emotionalTurnCount, userTurnCount };
}

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
    { status: 200 },
  );
}

export async function POST(req: Request) {
  try {
    console.log("[imotara][chat-reply] POST hit");
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
          (m.role === "user" || m.role === "assistant" || m.role === "system"),
      )
      .slice(-MAX_TURNS);

    const emotion = (body?.emotion || "").toLowerCase().trim();

    // Detect emotional depth across conversation turns
    const arc = detectEmotionalArc(recent);

    // ✅ Conversation state signal: detect "pause / goodbye / brb" so we don't reopen the topic.
    const lastUserMsg =
      [...recent]
        .reverse()
        .find((m) => m.role === "user")
        ?.content?.trim() ?? "";

    // Normalize message for detection
    const normalizedMsg = lastUserMsg
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

    const isClosureIntent =
      normalizedMsg.length > 0 &&
      (normalizedMsg.includes("talk later") ||
        normalizedMsg.includes("chat later") ||
        normalizedMsg.includes("see you") ||
        normalizedMsg.includes("bye") ||
        normalizedMsg.includes("good night") ||
        normalizedMsg.includes("gn") ||
        normalizedMsg.includes("brb") ||
        normalizedMsg.includes("ttyl") ||
        normalizedMsg.includes("catch you") ||
        normalizedMsg.includes("going for a walk") ||
        normalizedMsg.includes("going out") ||
        normalizedMsg.includes("will talk later"));

    console.log("[imotara][closure]", {
      lastUserMsg,
      normalizedMsg,
      isClosureIntent,
    });

    const closureHint = isClosureIntent
      ? [
          "STATE: The user is pausing/ending the chat (going for a walk / will talk later).",
          "Your reply must be a gentle send-off: acknowledge + encourage + reassure you'll be here later.",
          "CRITICAL: Do NOT ask ANY question. End the conversation naturally.",
          "Keep it to 1–2 short sentences.",
        ].join("\n")
      : "";

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
          const memories = await fetchUserMemories(
            supabaseAdmin as any,
            authedUserId,
            20,
          );

          const raw = Array.isArray(memories)
            ? (memories.find((m: any) => m?.key === "preferred_name")?.value ??
              "")
            : "";

          preferredName =
            typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
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

    // ✅ Strong continuity: last 3 user turns (most recent last)
    const recentUserTurns = recent
      .filter((m) => m.role === "user")
      .slice(-3)
      .map((m) => String(m.content).trim())
      .filter(Boolean);

    const recentUserBlock = recentUserTurns.length
      ? recentUserTurns.map((t) => `- ${t}`).join("\n")
      : "";

    const emotionHint = emotion
      ? `The user currently seems to be feeling: ${emotion}.\n`
      : "";

    const nameHint = preferredName
      ? `The user's preferred name is: ${preferredName}.\nUse it naturally (not every line).\n`
      : "";

    // Companion persona: translate tone → natural writing style for the AI
    const tonePersonaMap: Record<string, string> = {
      close_friend: "You are speaking as a close, trusted friend — warm, casual, talks like a real person. Match the user's energy and language style naturally.",
      calm_companion: "You are speaking as a calm, gentle companion — patient, soft-spoken, never rushing. Keep phrasing unhurried and reassuring.",
      coach: "You are speaking as an encouraging coach — practical, forward-looking, motivating without being pushy. Gently nudge toward clarity or action when appropriate.",
      mentor: "You are speaking as a wise, thoughtful mentor — help the user find their own answers through gentle questions and perspective, not advice-giving.",
    };
    const companionPersonaHint = body?.tone
      ? tonePersonaMap[body.tone] ?? ""
      : "";

    // Age context: adapt vocabulary and register to the user's life stage
    const userAgeHintMap: Record<string, string> = {
      under_13: "The user is a child (under 13). Use very simple, gentle, encouraging language. Avoid adult idioms.",
      "13_17": "The user is a teenager (13–17). Use relatable, peer-like language — not patronising. They understand nuance.",
      "18_24": "The user is a young adult (18–24). Casual, direct, and real.",
      "25_34": "The user is in their late 20s or 30s. Peer-like tone.",
      "35_44": "The user is in their mid-30s to mid-40s.",
      "45_54": "The user is in their mid-40s to mid-50s. Steady and grounded tone.",
      "55_64": "The user is in their late 50s to early 60s. Patient and respectful register.",
      "65_plus": "The user is 65 or older. Use a warm, unhurried, respectful register — never condescending.",
    };
    const userAgeHint = body?.userAge
      ? (userAgeHintMap[body.userAge] ?? "")
      : "";

    // Arc-aware response depth instruction
    const lengthInstruction =
      arc.depth === "deep"
        ? "Use 3–4 sentences that feel warm and connected — not clinical or formulaic."
        : "Reply in 2–3 short sentences.";

    // For sustained emotional conversations, remind the model to honour the arc
    const arcDepthHint =
      arc.depth === "deep"
        ? [
            `CONVERSATION ARC: This is a sustained emotional conversation (${arc.userTurnCount} user turns, ${arc.emotionalTurnCount} with emotional signals).`,
            "Show that you have been listening across the whole conversation — not just the latest message.",
            "Your reply must feel continuous: acknowledge the ongoing thread, not restart the topic.",
            "First: validate what the user has been carrying. Then: stay present. Do not rush to advice.",
          ].join("\n")
        : arc.depth === "moderate"
          ? "This conversation has emotional context. Build on what the user shared earlier — reference at least one specific detail from a previous turn."
          : "";

    const emotionMemoryHint =
      typeof body?.emotionMemory === "string" && body.emotionMemory.trim()
        ? body.emotionMemory.trim()
        : "";

    const prompt = [
      "You are Imotara — a calm, warm, emotionally-aware companion (not a therapist).",
      emotionMemoryHint,
      companionPersonaHint,
      userAgeHint,
      lengthInstruction,
      "Do NOT sound generic. Avoid repeating the same opener style like: 'I'm with you / I'm here / I hear you' every turn.",
      "IMPORTANT: Your reply MUST reference at least one concrete detail from the user's most recent message OR the recent user messages below.",
      "If the user already gave context, do NOT ask vague questions like 'what's on your mind' or 'what's going on' — continue the same thread.",
      "QUESTION RULE: Do NOT end every reply with a question. A real friend sometimes just listens and reflects without asking anything. Only ask a question when it genuinely opens something new — not as a default closer. Maximum one question per reply, and skip it entirely if the user is sharing something tender.",
      "OPENER RULE: Never start with 'Got it', 'Absolutely', 'Of course', or similar filler acknowledgements. Respond directly to what the user said.",
      "No medical, diagnostic, or crisis instructions. If serious risk appears, encourage reaching out to trusted people/local services.",
      "",
      arcDepthHint,
      emotionHint,
      nameHint,
      closureHint,
      recentUserBlock
        ? "Recent user messages (last 3):\n" + recentUserBlock
        : "",
      "",
      "Full recent chat context (most recent at the end):",
      conversationText || "(No previous context; this is the first message.)",
      "",
      "Now write Imotara's next reply — warm, specific to what the user said, and feels like a natural continuation.",
    ]
      .filter(Boolean)
      .join("\n");

    const maxTokens = isClosureIntent
      ? 80
      : arc.depth === "deep"
        ? 380
        : arc.depth === "moderate"
          ? 300
          : 260;

    const ai: ImotaraAIResponse = await callImotaraAI("Reply now.", {
      system: prompt,
      maxTokens,
      temperature: 0.8,
      noQuestions: isClosureIntent,
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
        { status: 200 },
      );
    }
    // ✅ Permanent architecture gate:
    // Force EVERY successful reply through the Three-Part Humanized framework.
    const lastUser =
      [...recent].reverse().find((m) => m.role === "user")?.content ?? "";
    const formatted = formatImotaraReply({
      raw: candidate,
      lang: body?.lang,
      tone: body?.tone,
      seed: `${lastUser}|${emotion}|${preferredName}`,
      intent: arc.depth !== "light" ? "emotional" : undefined,
    });

    // If formatting somehow yields empty, fall back to the original candidate.
    const finalText = (formatted || candidate).trim();

    // Normal successful path (same response shape)
    return NextResponse.json(
      {
        ...ai,
        text: finalText,
        meta: {
          ...(ai?.meta ?? {}),
          framework: "three-part-v1",
        },
      },
      { status: 200 },
    );
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
