// src/types/sync.ts
import type { EmotionRecord } from "@/types/history";

/**
 * Tracks what revision we last synced for each record id.
 * Key: EmotionRecord.id, Value: last successfully synced rev for that id.
 * Used for 3-way merge (base vs local vs remote).
 */
export type SyncShadow = Record<string, number>;

/**
 * Persistent sync state (incremental sync + conflict detection).
 * - syncToken: server-issued token to fetch only deltas
 * - shadow: last-synced rev per record for 3-way merge base
 * - lastSyncedAt: for diagnostics / UI
 */
export type SyncState = {
  syncToken?: string | null;
  shadow: SyncShadow;
  lastSyncedAt?: number | null;
};

/**
 * Why a conflict happened.
 *
 * Your existing reasons are preserved:
 *  - "newer-remote" / "newer-local": one side is strictly newer
 *  - "same-updatedAt-diff-content": timestamps equal but content differs
 *  - "duplicate-id": both created different records with same id
 *
 * Added reasons for classic 3-way merge scenarios:
 *  - "both-edited": both sides changed since base (non-delete)
 *  - "delete-edit": one deleted while the other edited
 *  - "both-deleted": both sides deleted independently
 */
export type ConflictReason =
  | "newer-remote"
  | "newer-local"
  | "same-updatedAt-diff-content"
  | "duplicate-id"
  | "both-edited"
  | "delete-edit"
  | "both-deleted";

/**
 * One conflict item with full audit fields (your existing UI-friendly shape).
 * Kept intact for backward compatibility.
 */
export interface HistoryConflict {
  id: string; // stable conflict id (separate from record id)
  recordId: string; // EmotionRecord.id that's in conflict
  reason: ConflictReason;
  local?: EmotionRecord | null;
  remote?: EmotionRecord | null;
  createdAt: number; // when we detected the conflict
  resolvedAt?: number; // when user resolved it
  resolution?: "kept-local" | "kept-remote" | "merged";
  mergedRecord?: EmotionRecord; // if resolution === "merged"
}

/**
 * Minimal conflict payload used by the planner (lighter than HistoryConflict).
 * Useful when computing a SyncPlan without UI/audit fields.
 */
export type Conflict = {
  id: string; // record id (EmotionRecord.id)
  baseRev?: number; // shadow rev at last sync (3-way base)
  reason: ConflictReason;
  local: EmotionRecord | null;
  remote: EmotionRecord | null;
};

/** List form aliases (both kept for convenience). */
export type ConflictList = HistoryConflict[];
export type ConflictArray = Conflict[];

/**
 * A plan that a sync step proposes:
 * - applyLocal: changes safe to push to server
 * - applyRemote: changes safe to apply to local
 * - conflicts: items requiring user choice (no auto-merge yet)
 */
export type SyncPlan = {
  applyLocal: EmotionRecord[];
  applyRemote: EmotionRecord[];
  conflicts: Conflict[];
};

/**
 * Optional strategy for “Resolve All” actions in UI.
 */
export type AutoResolutionStrategy =
  | "prefer-newest"
  | "prefer-remote"
  | "prefer-local";

/**
 * (For Step 14.2) The user's per-conflict decision payload
 * when calling a resolveConflicts() function in the hook.
 */
export type ConflictResolutionChoice = {
  recordId: string; // EmotionRecord.id
  keep: "local" | "remote" | "merged";
  mergedRecord?: EmotionRecord; // required if keep === "merged"
};
