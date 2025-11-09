// src/lib/imotara/patchHistory.ts
//
// Minimal local optimistic patch for a single EmotionRecord by id.
// Loads your local history, applies a shallow patch, and saves it back.
// We trust the caller to provide an updatedAt that is >= previous updatedAt.
// If not provided, we bump by +1 to keep "newer-wins" stable.

import type { EmotionRecord } from "@/types/history";
import { getHistory } from "@/lib/imotara/history";
import { saveHistory } from "@/lib/imotara/historyPersist";

export async function patchHistoryItem(
  id: string,
  patch: Partial<EmotionRecord>
): Promise<EmotionRecord | null> {
  const list = await getHistory();
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  const current = list[idx];

  // Ensure updatedAt never goes backwards
  const nextUpdatedAt =
    typeof patch.updatedAt === "number"
      ? Math.max(patch.updatedAt, current.updatedAt + 1)
      : current.updatedAt + 1;

  const next: EmotionRecord = {
    ...current,
    ...patch,
    updatedAt: nextUpdatedAt,
  };

  const nextList = [...list];
  nextList[idx] = next;

  await saveHistory(nextList);

  return next;
}
