// src/types/history.ts

export type Emotion =
  | "joy"
  | "sadness"
  | "anger"
  | "fear"
  | "disgust"
  | "surprise"
  | "neutral";

export type RecordSource = "local" | "remote" | "merged";

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
  source?: RecordSource;
  deleted?: boolean; // soft-delete flag for tombstones

  /** NEW: revision counter for 3-way merge (optional for backward compatibility) */
  rev?: number;
};

/** Minimal create/update payloads for queueing local changes */
export type UpsertPayload = Omit<EmotionRecord, "createdAt" | "updatedAt"> & {
  updatedAt: number;
  createdAt?: number;
};

export type ConflictKind = "field_divergence" | "concurrent_edit" | "delete_vs_edit";

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
