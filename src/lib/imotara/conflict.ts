// src/lib/imotara/conflict.ts
import type { EmotionRecord } from "@/types/history";
import type { SyncPlan, SyncState, Conflict, ConflictReason } from "@/types/sync";

/** Helper: map by id for quick lookup */
function byId(records: EmotionRecord[]): Record<string, EmotionRecord> {
  const m: Record<string, EmotionRecord> = {};
  for (const r of records) m[r.id] = r;
  return m;
}

/** Defensive rev getter: works even if older records lack `rev`. */
function getRev(r?: EmotionRecord | null): number {
  // If rev missing, treat as 0 for compatibility.
  return r?.rev ?? 0;
}

/** True if record changed since the base (shadow) rev. */
function changedSinceBase(rec: EmotionRecord | undefined, baseRev?: number): boolean {
  if (!rec) return false;
  // Deletions are also “changes”.
  const recRev = getRev(rec);
  if (typeof baseRev === "number") return recRev !== baseRev;
  // If no base, any existing record is considered a change.
  return true;
}

/** Classify a conflict reason with a few simple rules. */
function classifyConflict(
  local: EmotionRecord | undefined,
  remote: EmotionRecord | undefined
): ConflictReason {
  const lDel = !!local?.deleted;
  const rDel = !!remote?.deleted;

  if (lDel && rDel) return "both-deleted";
  if (lDel !== rDel) return "delete-edit";

  // If both exist and both edited, decide a label that’s useful for UI.
  const lu = local?.updatedAt ?? 0;
  const ru = remote?.updatedAt ?? 0;
  if (lu > ru) return "newer-local";
  if (ru > lu) return "newer-remote";

  // Same timestamp but contents differ → let UI decide.
  return "same-updatedAt-diff-content";
}

/**
 * Detect conflicts via a simple 3-way check using shadow revs.
 * Shadow holds the rev we last synced for that id.
 */
export function detectConflicts(
  local: EmotionRecord[],
  remote: EmotionRecord[],
  shadow: SyncState["shadow"]
): Conflict[] {
  const L = byId(local);
  const R = byId(remote);

  const ids = new Set<string>([
    ...Object.keys(L),
    ...Object.keys(R),
    ...Object.keys(shadow),
  ]);

  const conflicts: Conflict[] = [];

  for (const id of ids) {
    const lv = L[id];
    const rv = R[id];
    const baseRev = shadow[id];

    const localChanged = changedSinceBase(lv, baseRev);
    const remoteChanged = changedSinceBase(rv, baseRev);

    // Conflict only when BOTH sides changed compared to base.
    if (localChanged && remoteChanged) {
      conflicts.push({
        id,
        baseRev,
        reason: classifyConflict(lv, rv),
        local: lv ?? null,
        remote: rv ?? null,
      });
    }
  }

  return conflicts;
}

/**
 * Build a conservative plan:
 * - Moves only SAFE, non-conflicting changes.
 * - Leaves conflicts for UI to resolve later.
 */
export function buildPlanMarkConflicts(
  local: EmotionRecord[],
  remote: EmotionRecord[],
  state: SyncState
): SyncPlan {
  const L = byId(local);
  const R = byId(remote);
  const { shadow } = state;

  const ids = new Set<string>([
    ...Object.keys(L),
    ...Object.keys(R),
    ...Object.keys(shadow),
  ]);

  const conflicts = detectConflicts(local, remote, shadow);
  const conflictIds = new Set(conflicts.map((c) => c.id));

  const applyLocal: EmotionRecord[] = [];   // push to server
  const applyRemote: EmotionRecord[] = [];  // pull to local

  for (const id of ids) {
    if (conflictIds.has(id)) continue; // hold for UI

    const lv = L[id];
    const rv = R[id];
    const baseRev = shadow[id];

    const localChanged = changedSinceBase(lv, baseRev);
    const remoteChanged = changedSinceBase(rv, baseRev);

    // Only one side changed → safe to apply that side.
    if (localChanged && !remoteChanged && lv) {
      applyLocal.push(lv);
    } else if (remoteChanged && !localChanged && rv) {
      applyRemote.push(rv);
    } else if (!lv && rv && remoteChanged && rv.deleted) {
      // Remote-only deletion → propagate down
      applyRemote.push(rv);
    } else if (!rv && lv && localChanged && lv.deleted) {
      // Local-only deletion → propagate up
      applyLocal.push(lv);
    }
  }

  return { applyLocal, applyRemote, conflicts };
}
