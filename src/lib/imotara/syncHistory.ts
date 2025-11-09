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

/**
 * (Stub) Incremental remote fetch. Replace with your real API later.
 * If you already have /api/history, wire it here.
 */
async function fetchRemoteSince(
  syncToken?: string | null
): Promise<{
  records: EmotionRecord[];
  nextSyncToken?: string | null;
}> {
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
    // Network error → treat as no delta (retry next time)
    return { records: [], nextSyncToken: syncToken ?? null };
  }
}

/** Apply an array of remote records to the local list (upsert + tombstones). */
function applyRemoteToLocal(
  local: EmotionRecord[],
  incoming: EmotionRecord[]
): EmotionRecord[] {
  if (!incoming.length) return local;

  const map = new Map(local.map((r) => [r.id, r]));
  for (const rec of incoming) {
    // Keep tombstones so deleted items don’t reappear
    const prev = map.get(rec.id);
    map.set(rec.id, { ...(prev ?? ({} as EmotionRecord)), ...rec });
  }

  // Optional: newest first for UI
  return Array.from(map.values()).sort(
    (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
  );
}

/** Update shadow revs for records we successfully reconciled this step. */
function updateShadow(
  shadow: SyncState["shadow"],
  applied: EmotionRecord[]
): SyncState["shadow"] {
  if (!applied.length) return shadow;
  const next = { ...shadow };
  for (const r of applied) {
    // If r.rev is missing, treat as 0 to stay consistent with conflict.ts defaults
    next[r.id] = r.rev ?? 0;
  }
  return next;
}

/**
 * Run one conservative sync step:
 * - Pull remote delta (incremental)
 * - Plan safe changes vs conflicts
 * - Apply only non-conflicting changes locally
 * - Persist updated local history + sync state
 */
export async function syncHistoryStep(): Promise<{
  plan: SyncPlan;
  local: EmotionRecord[];
}> {
  const local0 = getHistory();
  const sync0 = getSyncState();

  // 1) Pull remote delta (since last token)
  const { records: remoteDelta, nextSyncToken } = await fetchRemoteSince(
    sync0.syncToken
  );

  // 2) Build plan that marks conflicts (no auto-merge)
  const plan = buildPlanMarkConflicts(local0, remoteDelta, sync0);

  // 3) Apply safe remote changes to local
  const local1 = applyRemoteToLocal(local0, plan.applyRemote);

  // (Optional push) If you already have POST /api/history, you can push plan.applyLocal here later.

  // 4) Persist local history if changed
  if (local1 !== local0) saveHistory(local1);

  // 5) Advance shadow for applied records (both directions)
  const advancedShadow = updateShadow(sync0.shadow, [
    ...plan.applyRemote,
    ...plan.applyLocal,
  ]);

  // 6) Save sync state (advance token only if fetch worked)
  saveSyncState({
    shadow: advancedShadow,
    syncToken: nextSyncToken ?? sync0.syncToken ?? null,
    lastSyncedAt: Date.now(),
  });

  return { plan, local: getHistory() };
}

/* ------------------------------------------------------------------ */
/* Compatibility helpers for UI components                             */
/* ------------------------------------------------------------------ */

/**
 * Apply user-approved conflict resolutions.
 * Merges the chosen records into local, advances shadow, and persists.
 * (When you add server push, call it here too.)
 */
export async function applyConflictResolution(resolved: EmotionRecord[]): Promise<void> {
  if (!Array.isArray(resolved) || resolved.length === 0) return;

  // Upsert chosen versions locally
  const local0 = getHistory();
  const local1 = applyRemoteToLocal(local0, resolved);
  if (local1 !== local0) saveHistory(local1);

  // Advance shadow for these records so they no longer appear as conflicts
  const sync0 = getSyncState();
  const shadow1 = updateShadow(sync0.shadow, resolved);
  saveSyncState({
    ...sync0,
    shadow: shadow1,
    lastSyncedAt: Date.now(),
  });
}

/**
 * TEMP compatibility stubs for older components.
 * Keep EmotionHistory.tsx compiling; wire real push logic later.
 */
export async function pushAllLocalToApi(): Promise<void> {
  // TODO: implement full push-all flow (local → API)
  return;
}

export async function pushPendingToApi(): Promise<void> {
  // TODO: implement push-pending flow using a ledger
  return;
}
