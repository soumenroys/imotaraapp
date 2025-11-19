// src/types/history.ts

import type { Choice, FollowUp } from "./choice";

export type Emotion =
  | "joy"
  | "sadness"
  | "anger"
  | "fear"
  | "disgust"
  | "surprise"
  | "neutral";

/**
 * RecordSource:
 * - local: created/owned locally
 * - remote: came from server
 * - merged: result of conflict merge
 * - chat: originated from chat UI
 */
export type RecordSource = "local" | "remote" | "merged" | "chat";

/**
 * Canonical record persisted locally and remotely.
 * `id`: stable UUID across local/remote
 * `updatedAt`: numeric epoch ms; drives conflict resolution (newer wins)
 */
export type EmotionRecord = {
  id: string;
  message: string;
  emotion: Emotion;
  intensity: number; // 0..1
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms

  // ✅ NOW ALLOWS "chat"
  source?: RecordSource;

  deleted?: boolean; // soft-delete flag for tombstones

  /** NEW: revision counter for 3-way merge (optional for backward compatibility) */
  rev?: number;

  // -----------------------------
  // Sync metadata (local-only helpers)
  // -----------------------------
  /**
   * Mark that this record exists only locally (has never been pushed).
   * Used by the pending/push ledger & UI pills.
   */
  localOnly?: boolean;

  /**
   * Mark that this record is queued for push to the server.
   * Often derived from the push ledger rather than stored permanently.
   */
  pending?: boolean;

  /**
   * Optional flag indicating that this record is currently involved
   * in a conflict (local vs remote divergence). The conflict engine
   * may also keep richer state separately.
   */
  conflict?: boolean;

  /**
   * Optional flag indicating that this record has been confirmed
   * by the server (i.e., part of an acceptedIds set in a push).
   * This is a convenience for UI only; servers can ignore it.
   */
  serverConfirmed?: boolean;

  // -----------------------------
  // Chat / session linking
  // -----------------------------
  /** ID of the chat session / thread this record belongs to (e.g. chatId). */
  sessionId?: string;

  /** ID of the specific chat message that produced this record (legacy field). */
  messageId?: string;

  /**
   * Canonical chat-message ID for linking records back to the chat UI.
   * New code should prefer this over `messageId` where possible.
   */
  chatMessageId?: string;

  // -----------------------------
  // Choice-driven metadata (optional)
  // -----------------------------
  /** Dedupbed topic tags for this record (e.g., ["sleep", "work"]). */
  topicTags?: string[];

  /** Mark this record as important/starred. */
  important?: boolean;

  /** Lightweight follow-ups associated with this record. */
  followUps?: FollowUp[];

  // -----------------------------
  // Choice UI state (optional)
  // -----------------------------
  /** Choices that the UI can render as pills/buttons for this record. */
  choices?: Choice[];

  /** Choice IDs that have already been applied (for idempotence). */
  appliedChoices?: string[];

  /**
   * Optional local helper for Undo:
   * ring buffer of recent applications with minimal snapshots.
   * This is local-only; servers can ignore it.
   */
  _appliedChoiceHistory?: Array<{
    choiceId: string;
    prevSnapshot: Partial<EmotionRecord>;
    appliedAt: number; // epoch ms
  }>;
};

/** Minimal create/update payloads for queueing local changes */
export type UpsertPayload = Omit<EmotionRecord, "createdAt" | "updatedAt"> & {
  updatedAt: number;
  createdAt?: number;
};

export type ConflictKind =
  | "field_divergence"
  | "concurrent_edit"
  | "delete_vs_edit";

export type Conflict = {
  id: string;
  kind: ConflictKind;
  local: EmotionRecord | undefined;
  remote: EmotionRecord | undefined;
  resolved: EmotionRecord; // result chosen by resolver
  chosen: "local" | "remote"; // which side won
};

export type MergeResult = {
  merged: EmotionRecord[];
  conflicts: Conflict[];
};

export type SyncDirection = "push" | "pull" | "bidirectional";

export type SyncPhase =
  | "idle"
  | "queueing"
  | "syncing"
  | "resolving"
  | "done"
  | "error"
  | "offline";

export type SyncSummary = {
  phase: SyncPhase;
  lastSuccessAt?: number;
  lastError?: string;
  queued: number;
  pushed: number;
  pulled: number;
  conflicts: number;
};

export type SyncEnvelope = {
  // client → server
  clientSince?: number; // ms epoch
  clientChanges: EmotionRecord[]; // upserts + tombstones
  // server → client
  serverSince?: number; // server will echo its since cutoff
};

export type SyncResponse = {
  serverChanges: EmotionRecord[]; // authoritative changes since serverSince
};
