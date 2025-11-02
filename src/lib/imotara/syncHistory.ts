// src/lib/imotara/syncHistory.ts
import { v4 as uuidv4 } from "uuid";
import type { EmotionRecord, RecordSource } from "@/types/history";
import { getHistory } from "@/lib/imotara/history";
import type { HistoryConflict, ConflictList, ConflictReason } from "@/types/sync";
import { upsertConflicts } from "@/lib/imotara/conflictsStore";
import type { Emotion } from "@/types/analysis";

/* -----------------------------------------------------------------------------
 * Normalization helpers
 * ---------------------------------------------------------------------------*/

/**
 * Coerce unknown/string to your Emotion union.
 * If not a string, fall back to "neutral".
 */
function safeCastEmotion(val: unknown): Emotion {
  return typeof val === "string" ? (val as Emotion) : ("neutral" as Emotion);
}

/**
 * Coerce unknown/string to your RecordSource union or leave undefined.
 */
function safeCastSource(val: unknown): RecordSource | undefined {
  return typeof val === "string" ? (val as RecordSource) : undefined;
}

/**
 * Normalize a loose object into a strict EmotionRecord:
 * - map `timestamp` -> `updatedAt`
 * - ensure `createdAt` is ALWAYS a number
 * - coerce `emotion` to Emotion
 * - ensure `intensity` is a number (default 0)
 */
function normalizeRecord(input: unknown): EmotionRecord {
  const obj = (input ?? {}) as Record<string, unknown>;

  const updatedAt: number =
    typeof obj.updatedAt === "number"
      ? (obj.updatedAt as number)
      : typeof obj.timestamp === "number"
      ? (obj.timestamp as number)
      : Date.now();

  // createdAt MUST be present per EmotionRecord type
  const createdAt: number =
    typeof obj.createdAt === "number" ? (obj.createdAt as number) : updatedAt;

  const id: string =
    typeof obj.id === "string" && (obj.id as string).length > 0 ? (obj.id as string) : uuidv4();

  const emotion: Emotion = safeCastEmotion(obj.emotion);
  const intensity: number =
    typeof obj.intensity === "number" ? (obj.intensity as number) : 0;

  const source: RecordSource | undefined = safeCastSource(obj.source);
  const message: string = typeof obj.message === "string" ? (obj.message as string) : "";

  // Construct strictly with fields defined on EmotionRecord
  const record: EmotionRecord = {
    id,
    message,
    emotion,
    intensity,
    ...(source ? { source } : {}),
    createdAt,
    updatedAt,
  };

  return record;
}

/**
 * Normalize a list which may contain partially typed objects (e.g., remote payloads).
 */
export function normalizeIncoming(list: unknown[]): EmotionRecord[] {
  if (!Array.isArray(list)) return [];
  return list.map((item) => normalizeRecord(item));
}

/* -----------------------------------------------------------------------------
 * Conflict detection
 * ---------------------------------------------------------------------------*/

/**
 * Compare two records for "content difference", ignoring id/createdAt/updatedAt.
 */
function isContentDifferent(a: EmotionRecord, b: EmotionRecord): boolean {
  const ignore = new Set(["id", "createdAt", "updatedAt"]);
  const keys = new Set<string>([...Object.keys(a as object), ...Object.keys(b as object)]);
  for (const k of keys) {
    if (ignore.has(k)) continue;
    const va = JSON.stringify((a as any)[k] ?? null);
    const vb = JSON.stringify((b as any)[k] ?? null);
    if (va !== vb) return true;
  }
  return false;
}

function findDuplicateIds(records: EmotionRecord[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const r of records) {
    if (seen.has(r.id)) dup.add(r.id);
    else seen.add(r.id);
  }
  return Array.from(dup);
}

function makeConflict(
  recordId: string,
  local: EmotionRecord | null,
  remote: EmotionRecord | null,
  reason: ConflictReason
): HistoryConflict {
  return {
    id: uuidv4(),
    recordId,
    reason,
    local: local ?? undefined,
    remote: remote ?? undefined,
    createdAt: Date.now(),
  };
}

/**
 * Detect conflicts between local and remote arrays.
 */
export function detectConflicts(local: EmotionRecord[], remote: EmotionRecord[]): ConflictList {
  const byIdLocal = new Map<string, EmotionRecord>(local.map((r) => [r.id, r]));
  const byIdRemote = new Map<string, EmotionRecord>(remote.map((r) => [r.id, r]));

  const conflicts: ConflictList = [];

  // Same id on both sides
  for (const [id, lrec] of byIdLocal.entries()) {
    const rrec = byIdRemote.get(id);
    if (!rrec) continue;

    const lt = lrec.updatedAt ?? 0;
    const rt = rrec.updatedAt ?? 0;

    if (lt === rt) {
      if (isContentDifferent(lrec, rrec)) {
        conflicts.push(makeConflict(id, lrec, rrec, "same-updatedAt-diff-content"));
      }
    } else {
      const reason: ConflictReason = lt > rt ? "newer-local" : "newer-remote";
      // Surface only if the actual content differs
      if (isContentDifferent(lrec, rrec)) {
        conflicts.push(makeConflict(id, lrec, rrec, reason));
      }
    }
  }

  // Duplicate ids within each side
  for (const id of findDuplicateIds(local)) {
    conflicts.push(makeConflict(id, byIdLocal.get(id) ?? null, byIdRemote.get(id) ?? null, "duplicate-id"));
  }
  for (const id of findDuplicateIds(remote)) {
    conflicts.push(makeConflict(id, byIdLocal.get(id) ?? null, byIdRemote.get(id) ?? null, "duplicate-id"));
  }

  // Deduplicate by recordId + reason
  const unique = new Map<string, HistoryConflict>(
    conflicts.map((c) => [c.recordId + "::" + c.reason, c])
  );
  return Array.from(unique.values());
}

/* -----------------------------------------------------------------------------
 * Merge + conflict surfacing
 * ---------------------------------------------------------------------------*/

/**
 * Merge with auto policy (newer updatedAt wins), while surfacing conflicts
 * for the Manual Conflict Review UI.
 *
 * Pass raw remote items (they’ll be normalized here).
 */
export function mergeWithConflicts(
  local: EmotionRecord[],
  remoteRaw: unknown[]
): EmotionRecord[] {
  const remote = normalizeIncoming(remoteRaw);

  const conflicts = detectConflicts(local, remote);
  if (conflicts.length) upsertConflicts(conflicts);

  // Auto-merge: newer updatedAt wins; if equal, keep local to avoid churn
  const byId = new Map<string, EmotionRecord>();
  for (const r of local) byId.set(r.id, r);
  for (const r of remote) {
    const existing = byId.get(r.id);
    if (!existing) {
      byId.set(r.id, r);
      continue;
    }
    const lt = existing.updatedAt ?? 0;
    const rt = r.updatedAt ?? 0;
    if (rt > lt) byId.set(r.id, r);
  }
  return Array.from(byId.values()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

/* -----------------------------------------------------------------------------
 * Apply manual conflict resolution
 * ---------------------------------------------------------------------------*/

/**
 * Apply a single conflict resolution and return the updated array.
 * NOTE: This function no longer persists. Persist the returned array
 * using whatever setter your history module exposes.
 */
export async function applyConflictResolution(
  conflict: HistoryConflict,
  decision: "kept-local" | "kept-remote" | "merged",
  mergedRecord?: EmotionRecord
): Promise<EmotionRecord[]> {
  const local = await getHistory();
  const idx = local.findIndex((r) => r.id === conflict.recordId);

  // Normalize inbound objects just to be safe
  const normalizedLocal = conflict.local ? normalizeRecord(conflict.local) : null;
  const normalizedRemote = conflict.remote ? normalizeRecord(conflict.remote) : null;
  const normalizedMerged = mergedRecord ? normalizeRecord(mergedRecord) : null;

  let replacement: EmotionRecord | null = null;
  if (decision === "kept-local") {
    replacement = normalizedLocal;
  } else if (decision === "kept-remote") {
    replacement = normalizedRemote;
  } else {
    // merged — if user didn't edit, prefer local then remote
    replacement = normalizedMerged ?? normalizedLocal ?? normalizedRemote ?? null;
  }

  let next = [...local];
  if (replacement) {
    if (idx >= 0) next[idx] = replacement;
    else next.push(replacement);
  } else if (idx >= 0) {
    // If replacement is null, remove the record (edge case)
    next.splice(idx, 1);
  }

  // IMPORTANT: caller must persist `next` via your own history setter.
  return next;
}

/* -----------------------------------------------------------------------------
 * Public high-level helper
 * ---------------------------------------------------------------------------*/

/**
 * High-level sync you can call from UI:
 *
 * const remoteRaw = await fetchRemoteHistory(); // server payload
 * const merged = await syncHistory(remoteRaw);
 * await setHistory(merged); // <-- persist using your history module
 */
export async function syncHistory(remoteRaw: unknown[]): Promise<EmotionRecord[]> {
  const local = await getHistory();
  const merged = mergeWithConflicts(local, remoteRaw);
  // IMPORTANT: caller must persist `merged` via your own history setter.
  return merged;
}
