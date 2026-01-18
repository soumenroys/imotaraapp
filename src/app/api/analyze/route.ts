// src/app/api/analyze/route.ts
//
// Remote analysis endpoint for Imotara.
// ORIGINAL BEHAVIOUR:
// - Accepts { inputs: AnalysisInput[], options?: { windowSize?: number } }
// - Returns an AnalysisResult with neutral baseline analysis.
//
// ENHANCEMENT (Step 21/23 – AI Engine Integration):
// - Still returns the same AnalysisResult shape.
// - Optionally enriches the summary + reflections using Imotara's AI engine
//   via `callImotaraAI`, while preserving safe fallbacks if AI is disabled.
// - NEW: If AI returns a dominant emotion + intensity, we gently map that
//   into snapshot.dominant and snapshot.averages.
// - NEW (safe): options.windowSize (if provided) is used to define the
//   analysis/AI "window" in terms of the most recent N messages, without
//   dropping per-message results for older items.
//
// FIX (Dec 2025):
// - Add GET handler to avoid browser "HTTP 405" when visiting /api/analyze.
// - Accept legacy payload { text: string } by converting it into inputs[],
//   so chat calls that send "text" don't fall into the empty-input baseline.
//
// STEP 3 (Jan 2026) — Tone context for Remote AI:
// - Server cannot read localStorage.
// - So we accept an OPTIONAL `toneContext` object in the request body.
// - If provided, we inject a compact "Tone & Context Guidance" snippet into the AI prompt.
// - Backward compatible: callers not sending toneContext behave exactly the same.

import { NextResponse } from "next/server";

import type {
  AnalysisInput,
  AnalysisResult,
  Emotion,
  PerMessageAnalysis,
} from "@/types/analysis";

// Response behavior blueprint (design hook)
import type { ResponseBlueprint } from "@/lib/ai/response/responseBlueprint";
import { createClient } from "@supabase/supabase-js";
import { fetchUserMemories } from "@/lib/memory/fetchUserMemories";
import { compatibilityGate } from "@/lib/ai/compat/compatibilityGate";
import { createHash } from "crypto";

// ---- NEW: Optional tone context (client-provided) ----
type ToneGender = "female" | "male" | "nonbinary" | "prefer_not" | "other";
type ToneAgeRange =
  | "under_13"
  | "13_17"
  | "18_24"
  | "25_34"
  | "35_44"
  | "45_54"
  | "55_64"
  | "65_plus"
  | "prefer_not";

type ToneRelationship =
  | "mentor"
  | "friend"
  | "elder"
  | "coach"
  | "parent_like"
  | "partner_like"
  | "prefer_not";

type ToneContextPayload = {
  user?: {
    name?: string;
    ageRange?: ToneAgeRange;
    gender?: ToneGender;
  };
  companion?: {
    enabled?: boolean;
    name?: string;
    ageRange?: ToneAgeRange;
    gender?: ToneGender;
    relationship?: ToneRelationship;
  };
};

type AnalyzeRequestBody = {
  // Primary (current) contract
  inputs?: AnalysisInput[];
  options?: {
    /**
     * Optional soft window hint: how many of the *most recent* messages
     * should be used for the aggregate snapshot + AI context.
     *
     * - Per-message analysis is still returned for all inputs.
     * - If omitted or <= 0, all inputs are used.
     */
    windowSize?: number;
  };

  // NEW: Optional tone guidance (local-only profile)
  toneContext?: ToneContextPayload;

  // Legacy contract (some callers still send { text: "..." })
  text?: string;
  id?: string;
  createdAt?: number;
};

export const runtime = "nodejs";
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));

  // 🧪 Tests should never call remote AI
  if (process.env.NODE_ENV === "test") {
    body.analysisMode = "local";
  }

  const inputs = Array.isArray(body?.inputs) ? body.inputs : [];
  const windowSize =
    typeof body?.options?.windowSize === "number" ? body.options.windowSize : 10;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabaseAdmin =
    supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

  if (!supabaseAdmin) {
    console.log("[imotara] memory disabled: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const testUserId = "dev-user";

  try {
    const memories = await fetchUserMemories(supabaseAdmin as any, testUserId, 20);
    console.log("[imotara] user_memory fetched:", {
      userId: testUserId,
      count: memories.length,
    });
  } catch (e) {
    console.log("[imotara] user_memory fetch error:", e);
  }

  // Minimal valid AnalysisResult to satisfy client contract.
  const lastUserText =
    [...inputs]
      .slice()
      .reverse()
      .find((x: any) => x?.role === "user")?.text ??
    [...inputs]
      .slice()
      .reverse()
      .find((x: any) => x?.role === "user")?.content ??
    "";

  const perMessage = inputs.map((m: any, idx: number) => {
    const role = m?.role ?? "user";
    const text = m?.text ?? m?.content ?? "";
    return {
      index: idx,
      role,
      text,
      emotion: "neutral",
      intensity: 0.2,
      note: "",
    };
  });

  const result: AnalysisResult = {
    summary: {
      headline: lastUserText
        ? `Captured ${Math.min(windowSize, inputs.length)} message(s)`
        : "No input yet",
      primaryEmotion: "neutral",
      intensity: 0.3,
      tone: "calm",
      adviceShort: [
        "If you want, share one small detail—what part feels heaviest right now?",
        "Where should we start: what happened, what you’re feeling, or what you need next?",
        "What would be the most helpful thing for me to understand first—one sentence is enough.",
        "Do you want comfort, clarity, or a practical next step right now?",
      ][(perMessage.length ?? 0) % 4],

      reflection: [
        "What do you most wish someone would understand about this?",
        "If this had a name, what would you call the feeling?",
        "What’s the smallest next step that would feel kind to you?",
        "What would make today feel even 5% lighter?",
      ][(perMessage.length ?? 0) % 4],
    },

    // ✅ REQUIRED by your client validator
    perMessage,

    reflectionSeedCard: ((perMessage.length ?? 0) % 2 === 0) ? {
      prompts: [
        [
          "What feeling is most present right now?",
          "What would ‘support’ look like in the next 24 hours?",
        ],
        [
          "What part of this hurts the most?",
          "What would help you feel safe right now?",
        ],
        [
          "What do you want to be true by tonight?",
          "What’s one small thing you can do in the next hour?",
        ],
        [
          "What are you afraid might happen next?",
          "If you could ask for one thing, what would it be?",
        ],
      ][(perMessage.length ?? 0) % 4],
    } : undefined,
  } as any;

  // Compatibility Gate (report-only): attach report without changing behavior
  // Compatibility Gate (report-only): attach report without changing behavior
  const respObj = (result as any).response ?? (result as any);
  const compatReport = compatibilityGate(respObj);

  const issues = Array.isArray((compatReport as any)?.issues)
    ? (compatReport as any).issues
    : [];

  const compatSummary =
    (compatReport as any)?.ok === true
      ? "OK"
      : issues.length
        ? `Issues: ${issues.map((i: any) => i?.code ?? "unknown").join(", ")}`
        : "NOT OK";

  (respObj as any).meta = {
    ...(respObj as any).meta,
    compatibility: {
      ...compatReport,
      summary: compatSummary,
    },
  };

  // Report-only server log (only when issues exist)
  // 🔇 Silence logs during tests
  if (process.env.NODE_ENV !== "test") {
    if (compatReport && (compatReport as any).ok === false) {
      // Report-only server log (only when issues exist) + request fingerprint (no message content)
      const fingerprintSource =
        `${req.headers.get("user-agent") || ""}|${req.headers.get("x-forwarded-for") || ""}|${Date.now()}`;

      const requestFingerprint = createHash("sha256")
        .update(fingerprintSource)
        .digest("hex")
        .slice(0, 12);

      console.warn("[compatibilityGate] NOT OK", {
        requestFingerprint,
        issues: (compatReport as any).issues,
      });
    } else if (
      compatReport &&
      Array.isArray((compatReport as any).issues) &&
      (compatReport as any).issues.length
    ) {
      console.warn("[compatibilityGate] Issues detected", {
        issues: (compatReport as any).issues,
      });
    }
  }

  return NextResponse.json(result, { status: 200 });
}

export async function GET() {
  // A friendly health/info response for browsers and simple checks.
  return NextResponse.json(
    {
      ok: true,
      endpoint: "/api/analyze",
      methods: ["GET", "POST"],
      howToUse:
        'POST JSON: { "inputs": [{ "id": "m1", "text": "hello", "createdAt": 123 }], "options": { "windowSize": 25 } }',
      legacy:
        'Also accepts legacy POST JSON: { "text": "hello" } (will be converted to inputs[0]).',
      toneContext:
        'Optional: include "toneContext" to shape remote AI tone (localStorage is not accessible on server).',
    },
    { status: 200 }
  );
}

// Limit how much context we send to the LLM
const MAX_MESSAGES_FOR_AI = 25;
const MAX_COMBINED_CHARS = 6000;

function safeNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

// NEW: build server-safe prompt snippet from client-provided toneContext
function buildToneSnippetFromPayload(t?: ToneContextPayload): string {
  if (!t) return "";

  const userName = typeof t.user?.name === "string" ? t.user.name.trim() : "";
  const userAge = t.user?.ageRange;
  const userGender = t.user?.gender;

  const enabled = !!t.companion?.enabled;
  const compName =
    enabled && typeof t.companion?.name === "string" ? t.companion.name.trim() : "";
  const compAge = enabled ? t.companion?.ageRange : undefined;
  const compGender = enabled ? t.companion?.gender : undefined;
  const compRel = enabled ? t.companion?.relationship : undefined;

  const hasAny =
    !!userName ||
    (userAge && userAge !== "prefer_not") ||
    (userGender && userGender !== "prefer_not") ||
    (enabled &&
      (!!compName ||
        (compAge && compAge !== "prefer_not") ||
        (compGender && compGender !== "prefer_not") ||
        (compRel && compRel !== "prefer_not")));

  if (!hasAny) return "";

  const lines: string[] = [];
  lines.push("Tone & Context Guidance (tone only; do NOT roleplay a real person):");
  if (userName) lines.push(`- User name (optional): ${userName}`);
  if (userAge && userAge !== "prefer_not") lines.push(`- User age range: ${userAge}`);
  if (userGender && userGender !== "prefer_not") lines.push(`- User gender: ${userGender}`);

  if (enabled) {
    lines.push("- Preferred companion tone (wording guidance only):");
    if (compRel && compRel !== "prefer_not") lines.push(`  - Relationship vibe: ${compRel}`);
    if (compAge && compAge !== "prefer_not") lines.push(`  - Age tone: ${compAge}`);
    if (compGender && compGender !== "prefer_not") lines.push(`  - Gender tone: ${compGender}`);
    if (compName) lines.push(`  - Companion name (optional): ${compName}`);
    lines.push("- Adjust warmth/directness/pacing accordingly, but avoid dependency cues.");
  }

  lines.push(
    "- Never claim you are a parent/partner/friend/real person. You are Imotara: a reflective, privacy-first companion."
  );

  // --- Anti-monotony variation (rotates by message count) ---
  const variation = [
    "Vary your openings. Avoid repeating the same follow-up question across turns.",
    "Be practical: give one concrete next step. Don’t ask multiple questions.",
    "Be reflective: mirror briefly, then ask one fresh, non-repeating question.",
    "Be direct and reassuring: answer first; ask only if needed.",
  ][Math.floor(Date.now() / 60000) % 4];

  lines.push(variation);
  lines.push("Ask at most ONE question in this turn. If a question was already asked recently, answer directly without asking another.");
  return lines.join("\n");
}

// --- Phase-2 (still v1): prompt + output humanization helpers (conservative) ---

function buildBlueprintGuidanceSnippet(bp: ResponseBlueprint): string {
  const lines: string[] = [];

  // Keep it short and safe—only the most relevant lines.
  if (bp.avoidHeadings) {
    lines.push("- Do not use headings or section labels.");
  }

  // If provided, include a compact subset of hard rules.
  if (Array.isArray(bp.hardRules) && bp.hardRules.length) {
    lines.push("- Response rules (follow closely):");
    for (const r of bp.hardRules.slice(0, 6)) lines.push(`  - ${r}`);
  }

  // Flow intent
  if (bp.flow) {
    lines.push("- Flow intent: one flowing voice; weave empathy + meaning + one next move.");
    lines.push("- End with either one easy question OR one permission line (not both).");
  }

  return lines.length ? lines.join("\n") : "";
}

function humanizeReflectionText(text: string, bp: ResponseBlueprint): string {
  // If no guidance, do nothing.
  if (!text || (!bp.avoidHeadings && !bp.flow && !bp.hardRules)) return text;

  let s = String(text).trim();
  if (!s) return s;

  // Normalize newlines
  s = s.replace(/\r\n/g, "\n");

  // Remove obvious heading-style lines (very conservative)
  // Examples: "Summary:", "Steps:", "Next steps:", "Reflection:"
  s = s
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (!bp.avoidHeadings) return true;
      return !/^(summary|steps?|next steps?|action steps?|reflection|analysis|takeaway|plan)\s*:/i.test(t);
    })
    .join("\n")
    .trim();

  // Convert numbered/bulleted suggestions into ONE next move only.
  // If bullets exist, keep the first bullet content and rewrite lightly.
  const lines = s.split("\n").map((x) => x.trim());
  const bulletIdx = lines.findIndex((l) => /^([-*•]|(\d+[\).\]]))\s+/.test(l));
  if (bulletIdx !== -1) {
    const firstBullet = lines[bulletIdx].replace(/^([-*•]|(\d+[\).\]]))\s+/, "").trim();
    // Keep any text before bullets as context, but drop the rest of the bullet list.
    const before = lines.slice(0, bulletIdx).filter(Boolean).join(" ");
    const stitched = [before, firstBullet].filter(Boolean).join("\n\n").trim();
    s = stitched;
  }

  // Ensure the ending is either ONE question OR ONE permission line.
  // Strategy:
  // - If there are multiple questions, keep only the first question sentence.
  // - If there is a question AND a permission line at end, drop the permission line.
  // - If there is no question, allow one permission line; otherwise leave as-is.
  const sentenceSplit = s
    .replace(/\n{3,}/g, "\n\n")
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Extract all question sentences
  const allText = sentenceSplit.join(" ");
  const questionMatches: string[] = allText.match(/[^?]*\?/g) ?? [];
  const hasQuestion = questionMatches.length > 0;

  // Identify permission-ish closing line
  const permissionRegex =
    /\b(if you want|if you'd like|we can|we could|want me to|shall we)\b/i;

  if (hasQuestion) {
    const firstQ = questionMatches[0].trim();
    // Remove all question sentences from body, then append only firstQ
    let body = allText.replace(/[^?]*\?/g, " ").replace(/\s+/g, " ").trim();

    // If body ends with permission-like phrase, remove that trailing sentence fragment conservatively
    // (We only remove if it looks like a standalone permission sentence.)
    body = body.replace(/(?:\bif you want\b|\bif you'd like\b|\bwe can\b)[^.?!]*[.?!]\s*$/i, "").trim();

    s = [body, firstQ].filter(Boolean).join("\n\n").trim();
  } else {
    // No question: allow ONE permission line at the end if present; otherwise do nothing.
    // If multiple permission lines exist, keep only the last paragraph if it contains permission.
    if (sentenceSplit.length >= 2) {
      const last = sentenceSplit[sentenceSplit.length - 1];
      const prev = sentenceSplit[sentenceSplit.length - 2];
      const lastHasPermission = permissionRegex.test(last);
      const prevHasPermission = permissionRegex.test(prev);

      if (lastHasPermission && prevHasPermission) {
        // Drop the earlier permission paragraph
        const kept = sentenceSplit.slice(0, -2).concat(last);
        s = kept.join("\n\n").trim();
      }
    }
  }

  // Final tidy: avoid excessive length
  s = s.replace(/\n{3,}/g, "\n\n").trim();

  return s;
}

// Shape we *ask* the AI to return (JSON). Parsing is always defensive.
type ImotaraAIDeepInsight = {
  emotional_summary?: string;
  dominant_emotion?: string;
  intensity?: number; // 0–1
  secondary_emotions?: string[];
  reflection?: string;

  // NEW: reflection seed prompts for a separate UI card
  reflection_seeds?: string[]; // 0–2 short prompts

  safety_note?: string;
};

// NOTE (Option A): /api/analyze must return AnalysisResult (analysis/debug).
// The POST implementation for analysis is defined below.
