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
import { computePending } from "@/lib/imotara/pushLedger";

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
    const nextSyncToken = (data as any)?.nextSyncToken ?? syncToken ?? null;
    return { records, nextSyncToken };
  } catch {
    return { records: [], nextSyncToken: syncToken ?? null };
  }
}

/* ------------------------------------------------------------------ */
/*                       LOCAL APPLY / SHADOW HELPERS                  */
/* ------------------------------------------------------------------ */

/** Upsert remote records into local (keeps tombstones). */
function applyRemoteToLocal(local: EmotionRecord[], incoming: EmotionRecord[]): EmotionRecord[] {
  if (!incoming.length) return local;
  const map = new Map(local.map((r) => [r.id, r]));
  for (const rec of incoming) {
    const prev = map.get(rec.id);
    map.set(rec.id, { ...(prev ?? ({} as EmotionRecord)), ...rec });
  }
  return Array.from(map.values()).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
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

export async function syncHistoryStep(): Promise<{ plan: SyncPlan; local: EmotionRecord[] }> {
  const local0 = await getHistory();
  const sync0 = getSyncState();

  const { records: remoteDelta, nextSyncToken } = await fetchRemoteSince(sync0.syncToken);

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
/*                              PUSH HELPERS                           */
/* ------------------------------------------------------------------ */

type PushResult = { attempted: number; acceptedIds: string[]; rejected?: string[] };

/** Push only pending local records (detected via computePending). */
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

  const rejected: string[] | undefined = Array.isArray(data?.rejected) ? data.rejected : undefined;

  if (acceptedIds.length) {
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

/** Push ALL local records (debug/first-load helper). */
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

  const rejected: string[] | undefined = Array.isArray(data?.rejected) ? data.rejected : undefined;

  if (acceptedIds.length) {
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

/* ------------------------------------------------------------------ */
/*                       CONFLICT RESOLUTION API                       */
/* ------------------------------------------------------------------ */

/**
 * Minimal shape expected from the Conflict Review UI.
 * `keep` tells us which side to keep for a given `id`.
 */
export type ConflictDecision = {
  id: string;
  keep: "local" | "remote";
  local?: EmotionRecord | null;
  remote?: EmotionRecord | null;
};

/**
 * Apply the chosen conflict resolutions locally and advance the shadow so
 * these items stop appearing as conflicts/pending. This does NOT push to the
 * server; it’s purely a local reconciliation step. Push can happen later.
 */
export async function applyConflictResolution(
  decisions: ConflictDecision[]
): Promise<{ applied: number; local: EmotionRecord[] }> {
  if (!Array.isArray(decisions) || !decisions.length) {
    return { applied: 0, local: await getHistory() };
  }

  const local0 = await getHistory();
  const byId = new Map(local0.map((r) => [r.id, r]));
  const map = new Map(local0.map((r) => [r.id, r]));
  const applied: EmotionRecord[] = [];

  for (const d of decisions) {
    const chosen =
      d.keep === "local" ? (d.local ?? byId.get(d.id) ?? null) : (d.remote ?? null);
    if (!chosen) continue;

    // Upsert chosen record
    const prev = map.get(d.id);
    const merged: EmotionRecord = { ...(prev ?? ({} as EmotionRecord)), ...chosen };

    // Ensure timestamps/rev are sane
    if (typeof merged.updatedAt !== "number") merged.updatedAt = Date.now();
    if (typeof merged.rev !== "number") merged.rev = (prev?.rev ?? 0);

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

  return { applied: applied.length, local: local1 };
}
