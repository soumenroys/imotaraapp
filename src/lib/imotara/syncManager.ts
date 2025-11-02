// src/lib/imotara/syncManager.ts
// Self-contained sync manager with internal merge/conflict logic and localStorage helpers.
// No imports from "@/lib/imotara/history" or "@/lib/imotara/syncHistory" are required.

import type {
  EmotionRecord,
  SyncSummary,
  SyncResponse,
  SyncEnvelope,
  Conflict,
} from "@/types/history";

/* -----------------------------------------------------------
 * Internal merge + conflict detection
 * --------------------------------------------------------- */
function byId(list: EmotionRecord[]): Map<string, EmotionRecord> {
  const m = new Map<string, EmotionRecord>();
  for (const r of list) m.set(r.id, r);
  return m;
}

function shallowDifferent(a?: EmotionRecord, b?: EmotionRecord): boolean {
  if (!a || !b) return true;
  return (
    a.message !== b.message ||
    a.emotion !== b.emotion ||
    a.intensity !== b.intensity ||
    !!a.deleted !== !!b.deleted
  );
}

/**
 * Deterministic merge:
 * - Only in one side -> take it
 * - In both -> newer updatedAt wins
 * - Conflicts recorded when fields diverge or delete vs edit
 */
function mergeRecords(
  local: EmotionRecord[],
  remote: EmotionRecord[]
): { merged: EmotionRecord[]; conflicts: Conflict[] } {
  const L = byId(local);
  const R = byId(remote);
  const ids = new Set<string>([...L.keys(), ...R.keys()]);
  const merged: EmotionRecord[] = [];
  const conflicts: Conflict[] = [];

  for (const id of ids) {
    const l = L.get(id);
    const r = R.get(id);

    if (l && !r) {
      merged.push(l);
      continue;
    }
    if (!l && r) {
      merged.push(r);
      continue;
    }
    if (!l || !r) continue; // safety

    const newerIsLocal = (l.updatedAt ?? 0) >= (r.updatedAt ?? 0);
    const chosen = newerIsLocal ? l : r;

    const isDeleteVsEdit =
      (!!l.deleted && !r.deleted) || (!!r.deleted && !l.deleted);
    const isDivergent = shallowDifferent(l, r);

    if (isDeleteVsEdit || isDivergent) {
      conflicts.push({
        id,
        kind: isDeleteVsEdit ? "delete_vs_edit" : "concurrent_edit",
        local: l,
        remote: r,
        resolved: { ...chosen },
        chosen: newerIsLocal ? "local" : "remote",
      });
    }

    merged.push({ ...chosen });
  }

  merged.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return { merged, conflicts };
}

/* -----------------------------------------------------------
 * Local storage adapters (internal)
 * --------------------------------------------------------- */
const HISTORY_KEY = "imotara.history.v1";
const QUEUE_KEY = "imotara.syncQueue.v1";
const LAST_SYNC_KEY = "imotara.lastSyncAt.v1";

function lsRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function lsWrite<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function getLocalHistory(): EmotionRecord[] {
  return lsRead<EmotionRecord[]>(HISTORY_KEY, []);
}
function saveLocalHistory(records: EmotionRecord[]) {
  lsWrite(HISTORY_KEY, records);
}

function getQueue(): EmotionRecord[] {
  return lsRead<EmotionRecord[]>(QUEUE_KEY, []);
}
function clearQueue() {
  lsWrite(QUEUE_KEY, []);
}

function getLastSyncAt(): number | undefined {
  return lsRead<number | undefined>(LAST_SYNC_KEY, undefined);
}
function setLastSyncAt(ms: number) {
  lsWrite(LAST_SYNC_KEY, ms);
}

/* -----------------------------------------------------------
 * Server call
 * --------------------------------------------------------- */
async function callSync(
  envelope: SyncEnvelope,
  signal?: AbortSignal
): Promise<SyncResponse> {
  const res = await fetch("/api/history/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(envelope),
    signal,
  });
  if (!res.ok) {
    throw new Error(`Sync failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as SyncResponse;
}

/* -----------------------------------------------------------
 * Public API
 * --------------------------------------------------------- */
export async function runBidirectionalSync(
  setStatus?: (s: Partial<SyncSummary>) => void,
  opts?: { signal?: AbortSignal }
): Promise<SyncSummary> {
  const summary: SyncSummary = {
    phase: "syncing",
    queued: 0,
    pushed: 0,
    pulled: 0,
    conflicts: 0,
  };
  setStatus?.(summary);

  // 1) read local state + queue
  const local = getLocalHistory();
  const queue = getQueue();
  summary.queued = queue.length;
  setStatus?.(summary);

  // 2) push queue + pull server changes
  const envelope: SyncEnvelope = {
    clientSince: getLastSyncAt(),
    clientChanges: queue,
  };

  let serverChanges: EmotionRecord[] = [];
  try {
    const { serverChanges: pulled } = await callSync(envelope, opts?.signal);
    serverChanges = pulled ?? [];
  } catch (e: any) {
    summary.phase = navigator.onLine ? "error" : "offline";
    summary.lastError = String(e?.message ?? e);
    setStatus?.(summary);
    throw e;
  }

  summary.pulled = serverChanges.length;
  summary.pushed = queue.length;

  // 3) clear queue after successful push
  clearQueue();

  // 4) merge & persist
  const { merged, conflicts } = mergeRecords(local, serverChanges);
  summary.conflicts = conflicts.length;

  saveLocalHistory(merged);
  setLastSyncAt(Date.now());

  summary.lastSuccessAt = Date.now();
  summary.phase = conflicts.length ? "resolving" : "done";
  setStatus?.(summary);

  // final state
  summary.phase = "done";
  setStatus?.(summary);
  return summary;
}
