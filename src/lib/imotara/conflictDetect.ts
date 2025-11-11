// src/lib/imotara/conflictDetect.ts
import type { EmotionRecord } from "@/types/history";

/**
 * Compare local and remote copies of the same record.
 * Returns a list of changed fields and a summary string.
 */
export function detectConflicts(
  local: EmotionRecord,
  remote: EmotionRecord
): { hasConflict: boolean; diffs: string[]; summary: string } {
  const diffs: string[] = [];

  // Compare important fields
  if (local.message !== remote.message) diffs.push("message");
  if (local.emotion !== remote.emotion) diffs.push("emotion");
  if (local.intensity !== remote.intensity) diffs.push("intensity");
  if (local.updatedAt !== remote.updatedAt) diffs.push("updatedAt");

  const hasConflict = diffs.length > 0;

  const summary = hasConflict
    ? `Conflict in ${diffs.join(", ")}`
    : "No conflict";

  return { hasConflict, diffs, summary };
}
