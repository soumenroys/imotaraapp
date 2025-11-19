// src/lib/imotara/syncHistory.ts
import type { EmotionRecord } from "@/types/history";
import type { SyncPlan, SyncState } from "@/types/sync";

import {
  getHistory,
  saveHistory,
  getSyncState,
  saveSyncState,
} from "@/lib/imotara/historyPersist";
import { buildPlanMarkConflicts } from "@/lib/imotara/conflict";
import { computePending, markPushed } from "@/lib/imotara/pushLedger";
import { detectConflicts } from "@/lib/imotara/conflictDetect";

/* ------------------------------------------------------------------ */
/*                        CONFLICT QUEUE (persistent)                  */
/* ------------------------------------------------------------------ */

export type ConflictPreview = {
  id: string;
  diffs: string[]; // normalized to strings
  summary: string;
  local?: EmotionRecord | null;
  remote?: EmotionRecord | null;
};

type QueuedConflict = ConflictPreview & { queuedAt: number };

const CONFLICT_Q_KEY = "imotara:conflictQueue:v1";

function lsAvailable() {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function loadConflictQueue(): QueuedConflict[] {
  if (!lsAvailable()) return [];
  try {
    const raw = localStorage.getItem(CONFLICT_Q_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveConflictQueue(list: QueuedConflict[]) {
  if (!lsAvailable()) return;
  try {
    localStorage.setItem(CONFLICT_Q_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function clearConflictQueue() {
  if (!lsAvailable()) return;
  try {
    localStorage.removeItem(CONFLICT_Q_KEY);
  } catch {
    // ignore
  }
}

export function getConflictQueue(): QueuedConflict[] {
  return loadConflictQueue();
}

/** Merge/replace queue from a fresh set of previews (e.g., from a new plan). */
export function setConflictQueueFromPreviews(previews: ConflictPreview[]) {
  const now = Date.now();
  const map = new Map<string, QueuedConflict>();
  for (const p of previews) {
    if (!p?.id) continue;
    map.set(p.id, { ...p, queuedAt: now });
  }
  saveConflictQueue(Array.from(map.values()));
}

/** Add (or update) conflicts into the queue. */
export function enqueueConflicts(previews: ConflictPreview[]): number {
  if (!Array.isArray(previews) || previews.length === 0) return 0;
  const existing = loadConflictQueue();
  const byId = new Map(existing.map((c) => [c.id, c]));
  const now = Date.now();

  for (const p of previews) {
    if (!p?.id) continue;
    const prev = byId.get(p.id);
    if (!prev) {
      byId.set(p.id, { ...p, queuedAt: now });
    } else {
      // update diffs/summary/local/remote but preserve earliest queuedAt
      byId.set(p.id, {
        ...prev,
        diffs: Array.isArray(p.diffs) ? p.diffs : prev.diffs,
        summary: p.summary ?? prev.summary,
        local: p.local ?? prev.local,
        remote: p.remote ?? prev.remote,
      });
    }
  }
  const merged = Array.from(byId.values());
  saveConflictQueue(merged);
  return merged.length;
}

/** Remove a set of ids from the queue (after resolving). */
export function dequeueConflicts(ids: string[]) {
  if (!ids?.length) return;
  const cur = loadConflictQueue();
  const drop = new Set(ids);
  const next = cur.filter((c) => !drop.has(c.id));
  saveConflictQueue(next);
}

/* ------------------------------------------------------------------ */
/*                      DECISION QUEUE (persistent)                    */
/* ------------------------------------------------------------------ */

export type ConflictDecision = {
  id: string;
  keep: "local" | "remote";
  local?: EmotionRecord | null;
  remote?: EmotionRecord | null;
};

type QueuedDecision = ConflictDecision & { queuedAt: number };

const DECISION_Q_KEY = "imotara:decisionQueue:v1";

function loadDecisionQueue(): QueuedDecision[] {
  if (!lsAvailable()) return [];
  try {
    const raw = localStorage.getItem(DECISION_Q_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDecisionQueue(list: QueuedDecision[]) {
  if (!lsAvailable()) return;
  try {
    localStorage.setItem(DECISION_Q_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function getDecisionQueue(): QueuedDecision[] {
  return loadDecisionQueue();
}

export function clearDecisionQueue() {
  if (!lsAvailable()) return;
  try {
    localStorage.removeItem(DECISION_Q_KEY);
  } catch {
    // ignore
  }
}

export function dequeueConflictDecisions(ids: string[]) {
  if (!ids?.length) return;
  const cur = loadDecisionQueue();
  const drop = new Set(ids);
  const next = cur.filter((c) => !drop.has(c.id));
  saveDecisionQueue(next);
}

/**
 * Public API used by the UI to queue exact user choices from the Review modal.
 * Merges by id; latest `keep/local/remote` wins; preserves the earliest queuedAt.
 * Returns the total queue length after merge.
 */
export function queueConflictDecisions(decisions: ConflictDecision[]): number {
  if (!Array.isArray(decisions) || decisions.length === 0)
    return getDecisionQueue().length;

  const existing = loadDecisionQueue();
  const byId = new Map(existing.map((d) => [d.id, d]));
  const now = Date.now();

  for (const d of decisions) {
    if (!d?.id || (d.keep !== "local" && d.keep !== "remote")) continue;
    const prev = byId.get(d.id);
    if (!prev) {
      byId.set(d.id, {
        id: d.id,
        keep: d.keep,
        local: d.local ?? null,
        remote: d.remote ?? null,
        queuedAt: now,
      });
    } else {
      byId.set(d.id, {
        id: d.id,
        keep: d.keep ?? prev.keep,
        local: d.local ?? prev.local ?? null,
        remote: d.remote ?? prev.remote ?? null,
        queuedAt: prev.queuedAt, // keep original timestamp
      });
    }
  }

  const merged = Array.from(byId.values());
  saveDecisionQueue(merged);
  return merged.length;
}

/* ------------------------------------------------------------------ */
/*                         FETCH (incremental)                         */
/* ------------------------------------------------------------------ */

/**
 * Incremental remote fetch. Replace with your real API later.
 */
async function fetchRemoteSince(
  syncToken?: string | null
): Promise<{ records: EmotionRecord[]; nextSyncToken?: string | null }> {
  try {
    const res = await fetch(
      "/api/history?since=" + encodeURIComponent(syncToken ?? ""),
      { method: "GET", headers: { "Content-Type": "application/json" } }
    );
    if (!res.ok) return { records: [], nextSyncToken: syncToken ?? null };

    const data = await res.json().catch(() => ({} as any));
    const records = Array.isArray((data as any)?.records)
      ? ((data as any).records as EmotionRecord[])
      : [];

    // 🔹 IMPORTANT:
    // Prefer `data.syncToken` from the API, fall back to `data.nextSyncToken`,
    // and finally to the previous syncToken if neither is present.
    const nextSyncToken =
      (data as any)?.syncToken ??
      (data as any)?.nextSyncToken ??
      syncToken ??
      null;

    return { records, nextSyncToken };
  } catch {
    return { records: [], nextSyncToken: syncToken ?? null };
  }
}

/* ------------------------------------------------------------------ */
/*                       LOCAL APPLY / SHADOW HELPERS                  */
/* ------------------------------------------------------------------ */

/** Upsert remote records into local (keeps tombstones). */
function applyRemoteToLocal(
  local: EmotionRecord[],
  incoming: EmotionRecord[]
): EmotionRecord[] {
  if (!incoming.length) return local;
  const map = new Map(local.map((r) => [r.id, r]));
  for (const rec of incoming) {
    const prev = map.get(rec.id);
    map.set(rec.id, { ...(prev ?? ({} as EmotionRecord)), ...rec });
  }
  return Array.from(map.values()).sort(
    (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
  );
}

/** Advance shadow revs for records we reconciled. */
function updateShadow(
  shadow: SyncState["shadow"],
  applied: EmotionRecord[]
): SyncState["shadow"] {
  if (!applied.length) return shadow;
  const next = { ...shadow };
  for (const r of applied) next[r.id] = r.rev ?? 0;
  return next;
}

/* ------------------------------------------------------------------ */
/*                               SYNC STEP                             */
/* ------------------------------------------------------------------ */

export async function syncHistoryStep(): Promise<{
  plan: SyncPlan;
  local: EmotionRecord[];
}> {
  const local0 = await getHistory();
  const sync0 = getSyncState();

  const { records: remoteDelta, nextSyncToken } = await fetchRemoteSince(
    sync0.syncToken
  );

  const plan = buildPlanMarkConflicts(local0, remoteDelta, sync0);

  const local1 = applyRemoteToLocal(local0, plan.applyRemote);

  if (local1 !== local0) await saveHistory(local1);

  const advancedShadow = updateShadow(sync0.shadow, [
    ...plan.applyRemote,
    ...plan.applyLocal,
  ]);

  saveSyncState({
    shadow: advancedShadow,
    syncToken: nextSyncToken ?? sync0.syncToken ?? null,
    lastSyncedAt: Date.now(),
  });

  return { plan, local: await getHistory() };
}

/* ------------------------------------------------------------------ */
/*                       CONFLICT PREVIEW (read-only)                  */
/* ------------------------------------------------------------------ */

/**
 * Preview differences between two versions of the same record.
 * No write/merge is performed; safe for UI usage.
 */
export function previewRecordConflict(
  local: EmotionRecord,
  remote: EmotionRecord
) {
  return detectConflicts(local, remote);
}

/**
 * Read-only extractor that turns conflicts inside a SyncPlan
 * into UI-friendly previews using detectConflicts.
 * Safe to call after syncHistoryStep() returns a plan.
 */
export function summarizePlanConflicts(plan: SyncPlan): ConflictPreview[] {
  const raw = (plan as any)?.conflicts;
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const previews: ConflictPreview[] = [];
  for (const item of raw) {
    const id: string =
      (item?.id as string) ??
      (item?.local?.id as string) ??
      (item?.remote?.id as string) ??
      "";

    const local = (item?.local ?? null) as EmotionRecord | null;
    const remote = (item?.remote ?? null) as EmotionRecord | null;

    // Only preview "two-sided" conflicts where both versions exist.
    if (!id || !local || !remote) continue;

    const { diffs, summary } = detectConflicts(local, remote);
    if ((Array.isArray(diffs) ? diffs.length : !!diffs ? 1 : 0) === 0) continue;

    // normalize diffs to string[]
    const dnorm: string[] = Array.isArray(diffs)
      ? diffs.map((d: any) =>
        typeof d === "string"
          ? d
          : d?.field
            ? String(d.field)
            : String(d)
      )
      : [String(diffs)];

    previews.push({ id, diffs: dnorm, summary, local, remote });
  }
  return previews;
}

/** Helper: refresh queue directly from a plan. */
export function queueConflictsFromPlan(plan: SyncPlan): number {
  const previews = summarizePlanConflicts(plan);
  setConflictQueueFromPreviews(previews);
  return previews.length;
}

/* ------------------------------------------------------------------ */
/*                       CONFLICT RESOLUTION API                       */
/* ------------------------------------------------------------------ */

/**
 * Apply the chosen conflict resolutions locally and advance the shadow so
 * these items stop appearing as conflicts/pending. This does NOT push to the
 * server; it’s purely a local reconciliation step. Push can happen later.
 */
export async function applyConflictResolution(
  decisions: ConflictDecision[]
): Promise<{ applied: number; local: EmotionRecord[] }> {
  if (!Array.isArray(decisions) || decisions.length === 0) {
    return { applied: 0, local: await getHistory() };
  }

  const local0 = await getHistory();
  const byId = new Map(local0.map((r) => [r.id, r]));
  const map = new Map(local0.map((r) => [r.id, r]));
  const applied: EmotionRecord[] = [];

  for (const d of decisions) {
    const chosen =
      d.keep === "local"
        ? (d.local ?? byId.get(d.id) ?? null)
        : (d.remote ?? null);
    if (!chosen) continue;

    // Upsert chosen record
    const prev = map.get(d.id);
    const merged: EmotionRecord = {
      ...(prev ?? ({} as EmotionRecord)),
      ...chosen,
    };

    // Ensure timestamps/rev are sane
    if (typeof merged.updatedAt !== "number") merged.updatedAt = Date.now();
    if (typeof merged.rev !== "number") merged.rev = prev?.rev ?? 0;

    map.set(d.id, merged);
    applied.push(merged);
  }

  const local1 = Array.from(map.values()).sort(
    (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
  );
  await saveHistory(local1);

  // Advance shadow for all applied records so they no longer show as conflicts
  const sync = getSyncState();
  const shadow = updateShadow(sync.shadow, applied);
  saveSyncState({ ...sync, shadow, lastSyncedAt: Date.now() });

  // dequeue any explicit decisions we just applied
  dequeueConflictDecisions(decisions.map((d) => d.id));
  // also drop from preview queue if present
  dequeueConflicts(decisions.map((d) => d.id));

  return { applied: applied.length, local: local1 };
}

/**
 * Retry any queued conflicts automatically.
 * 1) If there are explicit queued decisions, apply those first.
 * 2) Otherwise, use the preview queue with a simple policy (prefer-remote/local).
 */
export async function retryQueuedConflicts(
  policy: "prefer-remote" | "prefer-local" = "prefer-remote"
): Promise<{ applied: number; remaining: number }> {
  // Step 1: apply explicit decisions first
  const decisionsQ = loadDecisionQueue();
  if (decisionsQ.length) {
    const decisions: ConflictDecision[] = decisionsQ.map((q) => ({
      id: q.id,
      keep: q.keep,
      local: q.local ?? undefined,
      remote: q.remote ?? undefined,
    }));
    const { applied } = await applyConflictResolution(decisions);
    // remaining = decisions still in queue + previews
    const remaining = loadDecisionQueue().length + loadConflictQueue().length;
    return { applied, remaining };
  }

  // Step 2: fall back to preview queue + policy
  const previews = loadConflictQueue();
  if (!previews.length) return { applied: 0, remaining: 0 };

  const decisions: ConflictDecision[] = previews.map((q) => ({
    id: q.id,
    keep: policy === "prefer-remote" ? "remote" : "local",
    local: q.local ?? undefined,
    remote: q.remote ?? undefined,
  }));

  const { applied } = await applyConflictResolution(decisions);
  const remaining = loadDecisionQueue().length + loadConflictQueue().length;
  return { applied, remaining };
}

/* ------------------------------------------------------------------ */
/*                              PUSH HELPERS                           */
/* ------------------------------------------------------------------ */

type PushResult = {
  attempted: number;
  acceptedIds: string[];
  rejected?: string[];
};

/**
 * Push only pending local records (detected via computePending).
 * All `acceptedIds` from the server are effectively "server-confirmed"
 * writes: we record that fact in the push ledger + shadow so future
 * sync steps and UI can treat them as fully reconciled.
 */
export async function pushPendingToApi(): Promise<PushResult> {
  const local = await getHistory();
  const toSend = computePending(local);
  if (!toSend.length) return { attempted: 0, acceptedIds: [] };

  const res = await fetch("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records: toSend }),
  });

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }

  const acceptedIds: string[] = Array.isArray(data?.acceptedIds)
    ? data.acceptedIds
    : Array.isArray(data?.accepted)
      ? data.accepted
      : res.ok
        ? toSend.map((r) => r.id)
        : [];

  const rejected: string[] | undefined = Array.isArray(data?.rejected)
    ? data.rejected
    : undefined;

  if (acceptedIds.length) {
    // 1) mark pushed in the ledger so computePending() drops them
    //    (this is where we conceptually mark them as "server-confirmed").
    markPushed(acceptedIds, local);

    // 2) advance shadow revs for accepted records
    const byId = new Map(local.map((r) => [r.id, r]));
    const sync = getSyncState();
    const shadow = { ...sync.shadow };
    for (const id of acceptedIds) {
      const rec = byId.get(id);
      if (rec) shadow[id] = rec.rev ?? 0;
    }
    saveSyncState({ ...sync, shadow, lastSyncedAt: Date.now() });
  }

  return { attempted: toSend.length, acceptedIds, rejected };
}

/**
 * Push ALL local records (debug/first-load helper).
 * Same semantics as pushPendingToApi: acceptedIds are treated as
 * fully "server-confirmed" and written into the ledger+shadow.
 */
export async function pushAllLocalToApi(): Promise<PushResult> {
  const local = await getHistory();

  const res = await fetch("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records: local }),
  });

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }

  const acceptedIds: string[] = Array.isArray(data?.acceptedIds)
    ? data.acceptedIds
    : Array.isArray(data?.accepted)
      ? data.accepted
      : res.ok
        ? local.map((r) => r.id)
        : [];

  const rejected: string[] | undefined = Array.isArray(data?.rejected)
    ? data.rejected
    : undefined;

  if (acceptedIds.length) {
    // 1) mark pushed in ledger for all accepted records
    markPushed(acceptedIds, local);

    // 2) advance shadow revs for accepted records
    const byId = new Map(local.map((r) => [r.id, r]));
    const sync = getSyncState();
    const shadow = { ...sync.shadow };
    for (const id of acceptedIds) {
      const rec = byId.get(id);
      if (rec) shadow[id] = rec.rev ?? 0;
    }
    saveSyncState({ ...sync, shadow, lastSyncedAt: Date.now() });
  }

  return { attempted: local.length, acceptedIds, rejected };
}
