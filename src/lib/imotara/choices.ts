// src/lib/imotara/choices.ts
//
// Pure, deterministic helpers for applying a Choice to an EmotionRecord.
// No side effects. Safe to unit-test.
//
// Usage idea (later):
//   const updated = applyChoice(record, choice, { now: Date.now() });
//

import type { EmotionRecord, Emotion } from "@/types/history";
import type { Choice } from "@/types/choice";
import { ChoiceAction } from "@/types/choice";

// ---------- small utilities (pure) ----------

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function dedupe<T>(arr: T[] = []): T[] {
  return Array.from(new Set(arr));
}

function union<T>(a: T[] | undefined, b: T[] | undefined): T[] {
  return dedupe([...(a ?? []), ...(b ?? [])]);
}

function addApplied(record: EmotionRecord, choiceId: string): string[] {
  const prev = record.appliedChoices ?? [];
  if (prev.includes(choiceId)) return prev;
  return [...prev, choiceId];
}

// build a deterministic id for created follow-ups if one is not provided
// avoid randomness to keep SSR hydration stable.
// If caller supplies opts.now, we can use that for determinism.
function buildFollowUpId(base: string, now?: number): string {
  const suffix = typeof now === "number" ? String(now) : "1";
  return `${base}:${suffix}`;
}

// ---------- core pure function ----------

/**
 * Apply a Choice to an EmotionRecord and return a NEW record.
 *
 * This function is pure and deterministic. It does not mutate inputs.
 * It also avoids Date.now() internally; pass `opts.now` for a stable timestamp.
 */
export function applyChoice(
  record: EmotionRecord,
  choice: Choice,
  opts?: { now?: number }
): EmotionRecord {
  const now = opts?.now; // may be undefined; we won't call Date.now() internally

  let next: EmotionRecord = { ...record };
  const payload = choice.payload ?? {};

  switch (choice.action) {
    case ChoiceAction.SetEmotion: {
      const emotion = String(payload.emotion ?? "").trim() as Emotion;
      if (emotion) {
        next = {
          ...next,
          emotion,
        };
      }
      break;
    }

    case ChoiceAction.SetIntensity: {
      const raw = Number(payload.intensity);
      const intensity = clamp01(raw);
      if (!Number.isNaN(intensity)) {
        next = {
          ...next,
          intensity,
        };
      }
      break;
    }

    case ChoiceAction.TagTopic: {
      const tag = String(payload.tag ?? "").trim();
      if (tag) {
        next = {
          ...next,
          topicTags: union(next.topicTags, [tag]),
        };
      }
      break;
    }

    case ChoiceAction.MarkImportant: {
      next = {
        ...next,
        important: true,
      };
      break;
    }

    case ChoiceAction.CreateFollowUp: {
      const text = String(payload.text ?? "").trim();
      if (text) {
        const fuId = String(payload.id ?? buildFollowUpId(choice.id, now));
        const createdAt =
          typeof payload.createdAt === "number" ? payload.createdAt : (now ?? (next.updatedAt + 1));
        const followUp = { id: fuId, text, createdAt };
        next = {
          ...next,
          followUps: union(next.followUps, [followUp]),
        };
      }
      break;
    }

    case ChoiceAction.SaveReflection: {
      // We don’t have a dedicated "reflection" field on EmotionRecord.
      // To preserve types without changing the model again, we’ll store
      // reflections as follow-ups with a "[Reflection]" prefix.
      const text = String(payload.text ?? "").trim();
      if (text) {
        const fuId = String(payload.id ?? buildFollowUpId(`${choice.id}-reflection`, now));
        const createdAt =
          typeof payload.createdAt === "number" ? payload.createdAt : (now ?? (next.updatedAt + 1));
        const followUp = { id: fuId, text: `[Reflection] ${text}`, createdAt };
        next = {
          ...next,
          followUps: union(next.followUps, [followUp]),
        };
      }
      break;
    }

    case ChoiceAction.Dismiss: {
      // Intentionally a no-op on data; we still mark the choice as applied below.
      break;
    }

    case ChoiceAction.Custom: {
      // Leave as a no-op by default; your app can handle custom actions elsewhere.
      break;
    }

    default: {
      // Unknown action -> no-op
      break;
    }
  }

  // Mark as applied (idempotent)
  next = {
    ...next,
    appliedChoices: addApplied(next, choice.id),
    // bump updatedAt deterministically without using Date.now():
    // if caller provided `now`, use it; otherwise, minimally bump by +1 to maintain "newer wins"
    updatedAt: typeof now === "number" ? now : next.updatedAt + 1,
    // keep a tiny local undo snapshot if you want (optional usage later)
    _appliedChoiceHistory: [
      ...(next._appliedChoiceHistory ?? []).slice(-4), // keep last 4 (ring-like)
      {
        choiceId: choice.id,
        // store only fields we might want to undo later
        prevSnapshot: {
          emotion: record.emotion,
          intensity: record.intensity,
          topicTags: record.topicTags,
          important: record.important,
          followUps: record.followUps,
        },
        appliedAt: typeof now === "number" ? now : next.updatedAt,
      },
    ],
  };

  return next;
}
