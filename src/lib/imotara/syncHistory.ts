// src/lib/imotara/syncHistory.ts
import { v4 as uuidv4 } from "uuid";
import type { EmotionRecord, RecordSource } from "@/types/history";
import { getHistory } from "@/lib/imotara/history";
import type { HistoryConflict, ConflictList, ConflictReason } from "@/types/sync";
import { upsertConflicts } from "@/lib/imotara/conflictsStore";
import type { Emotion } from "@/types/analysis";
import { computePending, markPushed } from "@/lib/imotara/pushLedger";

/* -----------------------------------------------------------------------------
 * API envelope (lean) + fetch helpers
 * ---------------------------------------------------------------------------*/

export type HistoryEnvelope = {
  records: unknown[];
  syncToken?: string;
  serverTs?: number;
};

type FetchHistoryParams = {
  syncToken?: string;
  since?: number;
  baseUrl?: string;
  signal?: AbortSignal;
};

export async function fetchRemoteHistory(params: FetchHistoryParams = {}): Promise<{
  records: EmotionRecord[];
  syncToken?: string;
  raw: unknown;
}> {
  const { syncToken, since, baseUrl = "/api/history", signal } = params;

  const qs = new URLSearchParams();
  if (syncToken) qs.set("syncToken", syncToken);
  if (typeof since === "number") qs.set("since", String(since));

  const url = qs.toString() ? `${baseUrl}?${qs.toString()}` : baseUrl;

  const res = await fetch(url, { method: "GET", signal });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetchRemoteHistory: ${res.status} ${res.statusText} — ${text}`);
  }

  const json = (await res.json()) as unknown;

  let rawList: unknown[] = [];
  let token: string | undefined;

  if (Array.isArray(json)) {
    rawList = json;
  } else if (json && typeof json === "object" && "records" in (json as any)) {
    const env = json as HistoryEnvelope;
    rawList = Array.isArray(env.records) ? env.records : [];
    token = env.syncToken;
  }

  const records = normalizeIncoming(rawList);
  return { records, syncToken: token, raw: json };
}

/* -----------------------------------------------------------------------------
 * Normalization helpers
 * ---------------------------------------------------------------------------*/

function safeCastEmotion(val: unknown): Emotion {
  return typeof val === "string" ? (val as Emotion) : ("neutral" as Emotion);
}

function safeCastSource(val: unknown): RecordSource | undefined {
  return typeof val === "string" ? (val as RecordSource) : undefined;
}

function normalizeRecord(input: unknown): EmotionRecord {
  const obj = (input ?? {}) as Record<string, unknown>;

  const updatedAt: number =
    typeof obj.updatedAt === "number"
      ? (obj.updatedAt as number)
      : typeof obj.timestamp === "number"
      ? (obj.timestamp as number)
      : Date.now();

  const createdAt: number =
    typeof obj.createdAt === "number" ? (obj.createdAt as number) : updatedAt;

  const id: string =
    typeof obj.id === "string" && (obj.id as string).length > 0
      ? (obj.id as string)
      : uuidv4();

  const emotion: Emotion = safeCastEmotion(obj.emotion);
  const intensity: number =
    typeof obj.intensity === "number" ? (obj.intensity as number) : 0;

  const source: RecordSource | undefined = safeCastSource(obj.source);
  const message: string = typeof obj.message === "string" ? (obj.message as string) : "";

  const record: EmotionRecord = {
    id,
    message,
    emotion,
    intensity,
    ...(source ? { source } : {}),
    createdAt,
    updatedAt,
  };

  if (typeof (obj as any).deleted === "boolean") {
    (record as any).deleted = Boolean((obj as any).deleted);
  }

  return record;
}

export function normalizeIncoming(list: unknown[]): EmotionRecord[] {
  if (!Array.isArray(list)) return [];
  return list.map((item) => normalizeRecord(item));
}

/* -----------------------------------------------------------------------------
 * Conflict detection
 * ---------------------------------------------------------------------------*/

function isContentDifferent(a: EmotionRecord, b: EmotionRecord): boolean {
  const ignore = new Set(["id", "createdAt", "updatedAt"]);
  const aObj = a as unknown as Record<string, unknown>;
  const bObj = b as unknown as Record<string, unknown>;

  const keys = new Set<string>([...Object.keys(aObj), ...Object.keys(bObj)]);
  for (const k of keys) {
    if (ignore.has(k)) continue;
    const va = JSON.stringify(aObj[k] ?? null);
    const vb = JSON.stringify(bObj[k] ?? null);
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

export function detectConflicts(local: EmotionRecord[], remote: EmotionRecord[]): ConflictList {
  const byIdLocal = new Map<string, EmotionRecord>(local.map((r) => [r.id, r]));
  const byIdRemote = new Map<string, EmotionRecord>(remote.map((r) => [r.id, r]));

  const conflicts: ConflictList = [];

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
      if (isContentDifferent(lrec, rrec)) {
        conflicts.push(makeConflict(id, lrec, rrec, reason));
      }
    }
  }

  for (const id of findDuplicateIds(local)) {
    conflicts.push(makeConflict(id, byIdLocal.get(id) ?? null, byIdRemote.get(id) ?? null, "duplicate-id"));
  }
  for (const id of findDuplicateIds(remote)) {
    conflicts.push(makeConflict(id, byIdLocal.get(id) ?? null, byIdRemote.get(id) ?? null, "duplicate-id"));
  }

  const unique = new Map<string, HistoryConflict>(
    conflicts.map((c) => [`${c.recordId}::${c.reason}`, c])
  );
  return Array.from(unique.values());
}

/* -----------------------------------------------------------------------------
 * Merge + conflict surfacing
 * ---------------------------------------------------------------------------*/

export function mergeWithConflicts(local: EmotionRecord[], remoteRaw: unknown[]): EmotionRecord[] {
  const remote = normalizeIncoming(remoteRaw);

  const conflicts = detectConflicts(local, remote);
  if (conflicts.length) upsertConflicts(conflicts);

  // LWW; if equal, prefer remote (convergence)
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
    else if (rt === lt) {
      if (isContentDifferent(existing, r)) {
        // conflict already surfaced; still converge to remote
      }
      byId.set(r.id, r);
    }
  }
  return Array.from(byId.values()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

/* -----------------------------------------------------------------------------
 * Apply manual conflict resolution
 * ---------------------------------------------------------------------------*/

export async function applyConflictResolution(
  conflict: HistoryConflict,
  decision: "kept-local" | "kept-remote" | "merged",
  mergedRecord?: EmotionRecord
): Promise<EmotionRecord[]> {
  const local = getHistory();
  const idx = local.findIndex((r) => r.id === conflict.recordId);

  const normalizedLocal = conflict.local ? normalizeRecord(conflict.local) : null;
  const normalizedRemote = conflict.remote ? normalizeRecord(conflict.remote) : null;
  const normalizedMerged = mergedRecord ? normalizeRecord(mergedRecord) : null;

  let replacement: EmotionRecord | null = null;
  if (decision === "kept-local") {
    replacement = normalizedLocal;
  } else if (decision === "kept-remote") {
    replacement = normalizedRemote;
  } else {
    replacement = normalizedMerged ?? normalizedLocal ?? normalizedRemote ?? null;
  }

  const next = [...local];
  if (replacement) {
    if (idx >= 0) next[idx] = replacement;
    else next.push(replacement);
  } else if (idx >= 0) {
    next.splice(idx, 1);
  }

  return next;
}

/* -----------------------------------------------------------------------------
 * Pull helpers
 * ---------------------------------------------------------------------------*/

export async function syncHistory(remoteRaw: unknown[]): Promise<EmotionRecord[]> {
  const local = getHistory();
  const merged = mergeWithConflicts(local, remoteRaw);
  return merged;
}

export async function pullAndMergeFromApi(params: FetchHistoryParams = {}): Promise<{
  merged: EmotionRecord[];
  remoteCount: number;
  syncToken?: string;
}> {
  const local = getHistory();
  const { records: remote, syncToken } = await fetchRemoteHistory(params);
  const merged = mergeWithConflicts(local, remote);
  return { merged, remoteCount: remote.length, syncToken };
}

/* -----------------------------------------------------------------------------
 * PUSH helpers (MVP)
 * ---------------------------------------------------------------------------*/

type PostResult = {
  acceptedIds: string[];
  rejected?: { id?: string; reason: string }[];
};

async function postHistory(
  records: EmotionRecord[],
  baseUrl: string = "/api/history",
  signal?: AbortSignal
): Promise<PostResult> {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Preferred envelope; server stays back-compat with raw arrays as well
    body: JSON.stringify({ records }),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`postHistory failed: ${res.status} ${res.statusText} — ${text}`);
  }
  const json = (await res.json()) as any;
  return {
    acceptedIds: Array.isArray(json?.acceptedIds) ? json.acceptedIds : [],
    rejected: Array.isArray(json?.rejected) ? json.rejected : undefined,
  };
}

/**
 * MVP: push everything we have to the server.
 * Server-side LWW will ignore older copies and accept newer ones.
 * Later, you can replace this with a "pending-only" queue push.
 */
export async function pushAllLocalToApi(params?: {
  baseUrl?: string;
  signal?: AbortSignal;
}): Promise<PostResult & { attempted: number }> {
  const { baseUrl = "/api/history", signal } = params ?? {};
  const all = getHistory();
  const result = await postHistory(all, baseUrl, signal);
  return { ...result, attempted: all.length };
}

/**
 * Optional: push a subset (e.g., only edited/dirty) when you add local status flags.
 */
export async function pushSubsetToApi(
  subset: EmotionRecord[],
  params?: { baseUrl?: string; signal?: AbortSignal }
): Promise<PostResult & { attempted: number }> {
  const { baseUrl = "/api/history", signal } = params ?? {};
  const result = await postHistory(subset, baseUrl, signal);
  return { ...result, attempted: subset.length };
}

/* -----------------------------------------------------------------------------
 * Pending-only push (uses local ledger)
 * ---------------------------------------------------------------------------*/

/**
 * Push only records whose local updatedAt is newer than what we've pushed before.
 * Uses the push ledger to compute the subset and to remember successful pushes.
 */
export async function pushPendingToApi(params?: {
  baseUrl?: string;
  signal?: AbortSignal;
}): Promise<{ attempted: number; accepted: number; rejected: number }> {
  const { baseUrl = "/api/history", signal } = params ?? {};
  const all = getHistory();
  const pending = computePending(all);

  if (pending.length === 0) {
    return { attempted: 0, accepted: 0, rejected: 0 };
  }

  const res = await postHistory(pending, baseUrl, signal);
  const accepted = res.acceptedIds?.length ?? 0;
  const rejected = res.rejected?.length ?? 0;

  // update ledger only for accepted ids
  markPushed(res.acceptedIds ?? [], all);

  return { attempted: pending.length, accepted, rejected };
}
