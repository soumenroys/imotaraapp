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
import { callImotaraAI } from "@/lib/imotara/aiClient";
import { buildToneContextPromptSnippet } from "@/lib/imotara/promptProfile";

// Response behavior blueprint (design hook)
import { getResponseBlueprint } from "@/lib/ai/response/getResponseBlueprint";
import type { ResponseBlueprint } from "@/lib/ai/response/responseBlueprint";

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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AnalyzeRequestBody | null;

    const now = Date.now();

    // Response blueprint (central behavior config)
    const responseBlueprint = getResponseBlueprint();

    // Soft structure hint (internal, prompt-only)
    const structureHint =
      responseBlueprint.structureLevel <= 2
        ? "Prefer a free-flowing, conversational style."
        : responseBlueprint.structureLevel >= 4
          ? "Prefer a gently structured response, but without headings."
          : "Balance natural flow with light internal structure.";

    // ---------------- Tone mapping (tone-only, no roleplay) ----------------
    function deriveToneHints(toneContext: any): string {
      const rel = String(toneContext?.companion?.relationship || "").toLowerCase();

      const base =
        "Tone shaping rules: Do not roleplay a real person. Do not claim identity or relationship. Do not encourage dependency. Adjust only warmth, pacing, directness, and wording.";

      const map: Record<string, string> = {
        mentor:
          "Vibe: mentor. Calm, wise, supportive. Gentle structure, reflective questions. Slightly formal but warm.",
        coach:
          "Vibe: coach. Clear, action-oriented, short steps. Encourage small wins. Direct but kind.",
        elder:
          "Vibe: elder. Slow pacing, reassuring, grounded. Emphasize perspective and patience.",
        friend:
          "Vibe: friend. Casual, warm, non-judgmental. Simple language. Avoid preachy tone.",
        sibling:
          "Vibe: sibling (younger/peer). Light, friendly, slightly playful but respectful.",
        junior_buddy:
          "Vibe: junior buddy (younger). Extra simple language, upbeat encouragement, short sentences.",
        parent_like:
          "Vibe: parent-like. Protective warmth, soothing reassurance. Avoid control.",
        partner_like:
          "Vibe: partner-like. Emotionally attuned and supportive. Avoid romantic or sexual language.",
      };

      const specific = map[rel];
      return specific ? `${base}\n${specific}` : base;
    }

    // NEW: Tone context (optional) + mapped hints
    const toneContext = body?.toneContext;
    const toneHints = deriveToneHints(toneContext);

    // -----------------------------
    // Inputs: support both contracts
    // -----------------------------
    const rawInputs = Array.isArray(body?.inputs) ? body!.inputs : [];
    let inputs: AnalysisInput[] = rawInputs.filter(Boolean);

    // Legacy: if inputs is empty but text exists, convert it to a single input
    if (inputs.length === 0) {
      const maybeText = typeof body?.text === "string" ? body.text.trim() : "";
      if (maybeText) {
        const legacyId =
          typeof body?.id === "string" && body.id.trim()
            ? body.id.trim()
            : `legacy-${now}`;
        const legacyCreatedAt =
          typeof body?.createdAt === "number" && Number.isFinite(body.createdAt)
            ? body.createdAt
            : now;

        // We keep this permissive to avoid breaking if AnalysisInput shape evolves.
        inputs = [
          {
            id: legacyId,
            // common field names used across the app
            text: maybeText,
            content: maybeText,
            createdAt: legacyCreatedAt,
          } as any as AnalysisInput,
        ];
      }
    }

    const neutralEmotion: Emotion = "neutral";

    const neutralTag = {
      emotion: neutralEmotion,
      intensity: 0.2,
      source: "model" as const,
    };

    // If there are no usable inputs at all, return a neutral baseline
    if (inputs.length === 0) {
      const result: AnalysisResult = {
        perMessage: [],
        snapshot: {
          window: { from: now, to: now },
          averages: { neutral: 0.2 },
          dominant: neutralEmotion,
        },
        summary: {
          headline: "Even and steady overall",
          details: "Remote analysis stub served by /api/analyze.",
        },
        reflections: [
          {
            text: "No messages were provided, so this is a neutral baseline.",
            createdAt: now,
            relatedIds: [],
          },
        ],
        computedAt: now,
      };

      return NextResponse.json(result, { status: 200 });
    }

    /**
     * windowInputs: the subset of inputs used for the aggregate snapshot
     * and AI context. If windowSize is provided (>0), we look at only the
     * most recent N; otherwise we use all inputs.
     *
     * Per-message analysis below still covers ALL inputs for backward
     * compatibility.
     */
    const rawWindowSize = body?.options?.windowSize;
    const windowSize =
      typeof rawWindowSize === "number" && Number.isFinite(rawWindowSize)
        ? Math.max(0, Math.floor(rawWindowSize))
        : 0;

    const windowInputs =
      windowSize > 0
        ? inputs.slice(-Math.min(windowSize, inputs.length))
        : inputs;

    const perMessage: PerMessageAnalysis[] = inputs.map((m) => ({
      id: (m as any).id,
      dominant: neutralTag,
      all: [neutralTag],
      heuristics: { polarity: 0 },
    }));

    // ------------------------------
    // Base (original) summary values
    // ------------------------------
    let summaryHeadline = "Even and steady overall";
    let summaryDetails = "Remote analysis stub served by /api/analyze.";
    let reflectionText =
      "Backend stub active. Replace logic here to run your real model.";

    // NEW: snapshot emotion fields, defaulting to neutral
    let snapshotDominant: Emotion = neutralEmotion;
    let snapshotAverages: Record<string, number> = { neutral: 0.2 };

    // ✅ reflection seeds in scope for `result`
    let reflectionSeeds: string[] = [];

    // Blueprint guidance snippet (prompt-only)
    const blueprintGuidance = buildBlueprintGuidanceSnippet(responseBlueprint);

    try {
      // Take only the most recent messages for AI context, within the
      // chosen window and capped by MAX_MESSAGES_FOR_AI.
      const recent = windowInputs.slice(-MAX_MESSAGES_FOR_AI);

      // Combine recent user-visible text into one prompt string,
      // while respecting a max character budget.
      let combinedText = recent
        .map((m) => {
          const maybeText =
            (m as any).text ?? (m as any).content ?? (m as any).message ?? "";
          const t = typeof maybeText === "string" ? maybeText.trim() : "";
          return t;
        })
        .filter(Boolean)
        .join("\n");

      if (combinedText.length > MAX_COMBINED_CHARS) {
        combinedText = combinedText.slice(-MAX_COMBINED_CHARS);
        combinedText = combinedText.slice(-MAX_COMBINED_CHARS);
      }

      if (!combinedText) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[/api/analyze] No usable text from inputs; skipping AI enrichment.");
        }
      } else {
        // ---- optional tone snippet (client-provided) ----
        // 1) Prefer request toneContext (server-safe)
        // 2) Fallback to buildToneContextPromptSnippet() (may be empty on server)
        const toneSnippet =
          buildToneSnippetFromPayload(body?.toneContext) ||
          buildToneContextPromptSnippet();

        // Ask the AI for a *structured* emotional profile.
        const prompt = [
          "You are Imotara, a calm, supportive emotional companion.",
          "You respond with warmth, validation, and gentle guidance.",
          "",
          ...(toneSnippet ? [toneSnippet, ""] : []),
          ...(blueprintGuidance ? [blueprintGuidance, ""] : []),
          "The following are recent messages from the user (most recent at the end):",
          "",
          combinedText,
          "",
          "Using ONLY the information above, analyse how the user is likely feeling.",
          "Return STRICT JSON with this shape (no extra keys, no comments, no markdown):",
          "",
          "{",
          '  "emotional_summary": string, // <= 18 words',
          '  "dominant_emotion": string, // e.g. "sad", "anxious", "hopeful", "angry", "mixed", "neutral"',
          '  "intensity": number,        // 0.0–1.0, how strong the feeling seems overall',
          '  "secondary_emotions": string[],',
          '  "reflection": string,       // 1–3 sentences, gentle supportive response',
          '  "reflection_seeds": string[], // 0–2 short prompts for a separate Reflection Seed Card',
          '  "safety_note": string       // empty string if no specific safety concern',
          "}",
          "",
          "Rules:",
          "- Do NOT include any text before or after the JSON.",
          "- Do NOT give medical or crisis advice.",
          "- Avoid clinical wording; sound like a kind, grounded friend.",
          "- Avoid explicit headings like 'Summary', 'Steps', 'Next steps'. Keep it natural.",
          "- Keep the reflection supportive and brief (1–3 sentences).",
          structureHint,
        ].join("\n");

        const finalPrompt = toneHints ? `${toneHints}\n\n${prompt}` : prompt;

        const ai = await callImotaraAI(finalPrompt, {
          maxTokens: 260,
          temperature: 0.7,
        });

        if (process.env.NODE_ENV !== "production") {
          try {
            console.log("[/api/analyze] AI meta:", ai?.meta);
          } catch {
            // ignore logging issues
          }
        }

        if (ai?.meta?.from === "openai" && ai.text) {
          // Try to parse the JSON. If it fails, we gracefully fall back
          // to using the raw text as a reflection.
          let parsed: ImotaraAIDeepInsight | null = null;

          try {
            parsed = JSON.parse(ai.text) as ImotaraAIDeepInsight;
          } catch (e) {
            if (process.env.NODE_ENV !== "production") {
              console.warn(
                "[/api/analyze] Failed to parse AI JSON; using raw text as reflection.",
                e
              );
            }
          }

          if (parsed) {
            const trimmedSummary =
              typeof parsed.emotional_summary === "string"
                ? parsed.emotional_summary.trim()
                : "";

            const trimmedReflection =
              typeof parsed.reflection === "string" ? parsed.reflection.trim() : "";

            const safetyNote =
              typeof parsed.safety_note === "string" ? parsed.safety_note.trim() : "";

            // ✅ ASSIGN to the outer variable (do NOT redeclare)
            reflectionSeeds =
              responseBlueprint.reflectionSeedCard.enabled &&
                Array.isArray(parsed.reflection_seeds)
                ? parsed.reflection_seeds
                  .filter((x) => typeof x === "string")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .slice(0, responseBlueprint.reflectionSeedCard.maxPrompts)
                : [];

            // Use AI summary if available; otherwise keep default headline.
            if (trimmedSummary) {
              summaryHeadline = trimmedSummary.slice(0, 140);
            } else {
              summaryHeadline = "AI emotional insight";
            }

            // Keep a concise details line; append safety note if present.
            summaryDetails =
              "This summary and reflection were enriched by Imotara's AI engine.";
            if (safetyNote) {
              summaryDetails += " Note: " + safetyNote;
            }

            // Use AI reflection if available; else fallback to raw AI text.
            if (trimmedReflection) {
              reflectionText = trimmedReflection;
            } else {
              reflectionText = ai.text;
            }

            // --- Phase-2 (still v1): humanize final reflection output ---
            reflectionText = humanizeReflectionText(reflectionText, responseBlueprint);

            // NEW: map dominant_emotion + intensity into snapshot.* if present
            const dominantRaw =
              typeof parsed.dominant_emotion === "string"
                ? parsed.dominant_emotion.trim().toLowerCase()
                : "";

            // Simple normalization map → Emotion
            const dominantMap: Record<string, Emotion> = {
              sad: "sad" as Emotion,
              sadness: "sad" as Emotion,
              anxious: "anxious" as Emotion,
              anxiety: "anxious" as Emotion,
              worried: "anxious" as Emotion,
              angry: "angry" as Emotion,
              anger: "angry" as Emotion,
              stressed: "stressed" as Emotion,
              overwhelm: "stressed" as Emotion,
              overwhelmed: "stressed" as Emotion,
              happy: "happy" as Emotion,
              joy: "happy" as Emotion,
              joyful: "happy" as Emotion,
              lonely: "lonely" as Emotion,
              isolation: "lonely" as Emotion,
              neutral: "neutral" as Emotion,
              mixed: "neutral" as Emotion,
              even: "neutral" as Emotion,
              balanced: "neutral" as Emotion,
            };

            const mappedDominant = dominantMap[dominantRaw] ?? neutralEmotion;
            snapshotDominant = mappedDominant;

            const rawIntensity = parsed.intensity;
            const intensity =
              typeof rawIntensity === "number"
                ? Math.min(1, Math.max(0, rawIntensity))
                : 0.4;

            // Build a simple averages map:
            snapshotAverages = { [snapshotDominant]: intensity };
            if (snapshotDominant !== "neutral") {
              snapshotAverages.neutral = Math.max(0, 1 - intensity);
            }
          } else {
            // Parsed JSON missing -> treat AI text as a direct reflection.
            summaryHeadline = "AI emotional insight";
            summaryDetails =
              "This summary and reflection were enriched by Imotara's AI engine.";
            reflectionText = humanizeReflectionText(ai.text, responseBlueprint);
          }
        } else if (process.env.NODE_ENV !== "production") {
          try {
            console.warn(
              "[/api/analyze] AI not used, falling back to stub. from=",
              ai?.meta?.from,
              "reason=",
              ai?.meta?.reason
            );
          } catch {
            // ignore logging issues
          }
        }
      }
    } catch (aiErr) {
      // We log errors, but never break the original behaviour.
      console.error("[/api/analyze] AI enrichment error:", aiErr);
    }

    const firstCreated = (windowInputs[0] as any)?.createdAt;
    const lastCreated = (windowInputs[windowInputs.length - 1] as any)?.createdAt;

    const result: AnalysisResult = {
      perMessage,
      snapshot: {
        window: {
          from: safeNumber(firstCreated, now),
          to: safeNumber(lastCreated, now),
        },
        averages: snapshotAverages,
        dominant: snapshotDominant,
      },
      summary: {
        headline: summaryHeadline,
        details: summaryDetails,
      },
      reflections: [
        {
          text: reflectionText,
          createdAt: now,
          // last message in the *full* list, to keep behaviour consistent
          relatedIds: perMessage.slice(-1).map((x) => x.id),
        },
      ],

      ...(reflectionSeeds.length > 0
        ? {
          reflectionSeedCard: {
            prompts: reflectionSeeds,
            createdAt: now,
            relatedIds: perMessage.slice(-1).map((x) => x.id),
          },
        }
        : {}),

      computedAt: now,
    };

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[/api/analyze] error:", err);
    return NextResponse.json(
      { error: "Invalid request payload" },
      { status: 400 }
    );
  }
}
