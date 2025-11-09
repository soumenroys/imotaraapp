// src/components/imotara/EmotionHistory.tsx
'use client';

import { useEffect, useMemo, useState } from "react";
import type { EmotionRecord } from "@/types/history";
import { getHistory } from "@/lib/imotara/history";
import { saveHistory } from "@/lib/imotara/historyPersist";
import SyncStatusChip from "@/components/imotara/SyncStatusChip";
import { pushAllLocalToApi, pushPendingToApi } from "@/lib/imotara/syncHistory";
import { computePending } from "@/lib/imotara/pushLedger";

// simple upsert merge (remote -> local)
function mergeRemote(local: EmotionRecord[], incoming: EmotionRecord[]): EmotionRecord[] {
  if (!Array.isArray(incoming) || incoming.length === 0) return local;
  const map = new Map(local.map((r) => [r.id, r]));
  for (const rec of incoming) {
    const prev = map.get(rec.id);
    map.set(rec.id, { ...(prev ?? ({} as EmotionRecord)), ...rec });
  }
  return Array.from(map.values()).sort(
    (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
  );
}

export default function EmotionHistory() {
  const [items, setItems] = useState<EmotionRecord[]>([]);
  const [pushInfo, setPushInfo] = useState<string>("");
  const [apiInfo, setApiInfo] = useState<string>("");
  const [pendingCount, setPendingCount] = useState<number>(0);

  // manual sync state
  const [state, setState] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Initial load of local store (async)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const local = await getHistory();
        if (!cancelled) setItems(Array.isArray(local) ? local : []);
      } catch (err) {
        if (!cancelled) setItems([]);
        // eslint-disable-next-line no-console
        console.error("[EmotionHistory] getHistory failed:", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Recompute pending whenever items change
  useEffect(() => {
    try {
      setPendingCount(Array.isArray(items) ? computePending(items).length : 0);
    } catch {
      setPendingCount(0);
    }
  }, [items]);

  const subtitle = useMemo(() => {
    if (state === "synced" && lastSyncedAt) {
      const d = new Date(lastSyncedAt);
      return `Last synced ${d.toLocaleTimeString()}`;
    }
    if (state === "syncing") return "Syncing…";
    if (state === "error" && lastError) return `Error: ${lastError}`;
    return "Idle";
  }, [state, lastSyncedAt, lastError]);

  const debugLine = useMemo(() => {
    const t = lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : "—";
    return `state=${state} | lastSyncedAt=${t}`;
  }, [state, lastSyncedAt]);

  // Manual “Sync now”
  async function manualSync() {
    try {
      setState("syncing");
      setLastError(null);

      const res = await fetch("/api/history", { method: "GET" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`GET /api/history ${res.status} ${res.statusText} — ${text}`);
      }
      const json: any = await res.json().catch(() => ({}));
      const incoming: EmotionRecord[] =
        Array.isArray(json) ? json :
        Array.isArray(json?.records) ? json.records : [];

      const latestLocal = await getHistory();
      const merged = mergeRemote(Array.isArray(latestLocal) ? latestLocal : [], incoming);
      await saveHistory(merged);
      setItems(merged);
      setState("synced");
      setLastSyncedAt(Date.now());
    } catch (err: any) {
      setState("error");
      setLastError(String(err?.message ?? err));
    }
  }

  // 👉 Auto-sync every 5 minutes when the tab is visible
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void manualSync();
      }
    }, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  async function handleDelete(id: string) {
    const ok = typeof window !== "undefined" ? window.confirm("Delete this entry?") : true;
    if (!ok) return;

    const prev = items;
    const next = Array.isArray(prev) ? prev.filter((r) => r.id !== id) : [];
    setItems(next);
    await saveHistory(next);

    try {
      const res = await fetch("/api/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id], updatedAt: Date.now() }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`DELETE failed: ${res.status} ${res.statusText} — ${text}`);
      }
      const json = await res.json().catch(() => ({}));
      const deletedCount = Array.isArray(json?.deletedIds) ? json.deletedIds.length : 0;
      setPushInfo(`Deleted ${deletedCount} item(s).`);
      await manualSync();
    } catch (err: any) {
      setItems(prev);
      await saveHistory(prev);
      setPushInfo(`Delete failed: ${String(err?.message ?? err)}`);
    }
  }

  const safeItems: EmotionRecord[] = Array.isArray(items) ? items : [];

  return (
    <section className="w-full">
      {state === "error" && lastError && (
        <div className="mb-3 rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          Sync error: {lastError}
        </div>
      )}

      {/* Header with status chip and manual controls */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SyncStatusChip
            state={state === "syncing" ? "syncing" : state === "error" ? "error" : "synced"}
            lastSyncedAt={lastSyncedAt}
            pendingCount={pendingCount}
            conflictsCount={0}
          />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={manualSync}
            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
            title="Force pull & merge now"
          >
            Sync now
          </button>

          <button
            onClick={async () => {
              try {
                setPushInfo("Pushing pending…");
                const res: any = await pushPendingToApi();
                const attempted = Number(res?.attempted ?? 0);
                const accepted = Number(res?.accepted ?? res?.acceptedCount ?? 0);
                const rejected = Number(res?.rejected ?? res?.rejectedCount ?? 0);
                setPushInfo(
                  `Pending push: attempted ${attempted}; accepted ${accepted}${rejected ? `, rejected ${rejected}` : ""}`
                );
                const latest = await getHistory();
                setPendingCount(computePending(latest).length);
              } catch (err: any) {
                setPushInfo(`Push pending failed: ${String(err?.message ?? err)}`);
              }
            }}
            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
            title="Push only changed/new records"
          >
            {`Push pending${pendingCount ? ` (${pendingCount})` : ""}`}
          </button>

          <button
            onClick={async () => {
              try {
                setPushInfo("Pushing all…");
                const res: any = await pushAllLocalToApi();
                const attempted = Number(res?.attempted ?? 0);
                const accepted = Array.isArray(res?.acceptedIds) ? res.acceptedIds.length : Number(res?.accepted ?? 0);
                const rejectedLen =
                  Array.isArray(res?.rejected) ? res.rejected.length : Number(res?.rejected ?? 0);
                setPushInfo(
                  `Pushed ${attempted}; accepted ${accepted}${rejectedLen ? `, rejected ${rejectedLen}` : ""}`
                );
                const latest = await getHistory();
                setPendingCount(computePending(latest).length);
              } catch (err: any) {
                setPushInfo(`Push all failed: ${String(err?.message ?? err)}`);
              }
            }}
            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
            title="Push all local records to server"
          >
            Push all
          </button>

          <button
            onClick={async () => {
              try {
                setApiInfo("Checking…");
                const res = await fetch("/api/history", { method: "GET" });
                const json = await res.json().catch(() => ({}));
                if (Array.isArray(json)) {
                  setApiInfo(`GET /api/history returned array: length=${json.length}`);
                } else if (json && typeof json === "object" && "records" in json) {
                  const recs = Array.isArray((json as any).records) ? (json as any).records : [];
                  setApiInfo(
                    `GET /api/history envelope: records=${recs.length}, serverTs=${(json as any).serverTs ?? "—"}`
                  );
                } else {
                  setApiInfo(`GET /api/history unexpected shape: ${JSON.stringify(json).slice(0, 200)}…`);
                }
              } catch (err: any) {
                setApiInfo(`API check failed: ${String(err?.message ?? err)}`);
              }
            }}
            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
            title="Ping GET /api/history to verify API shape/availability"
          >
            Check API
          </button>
        </div>
      </div>

      {/* Debug + operation result lines */}
      <div className="mb-3 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <div>{debugLine}</div>
        {pushInfo && <div>{pushInfo}</div>}
        {apiInfo && <div>{apiInfo}</div>}
      </div>

      {/* Simple list of history items */}
      <ul className="space-y-3">
        {safeItems.map((r) => {
          const ts = typeof r.updatedAt === "number" ? r.updatedAt : r.createdAt;
          const when = ts ? new Date(ts).toLocaleString() : "—";
          const intensity = typeof r.intensity === "number" ? r.intensity.toFixed(2) : "—";

          return (
            <li key={r.id} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-500 dark:text-zinc-400">{when}</div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                    {r.emotion} • {intensity}
                  </span>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="rounded-lg border border-zinc-200 px-2 py-0.5 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                    title="Soft-delete this entry"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-800 dark:text-zinc-100">
                {r.message || <span className="opacity-60">(no message)</span>}
              </div>
            </li>
          );
        })}
        {safeItems.length === 0 && (
          <li className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No history yet.
          </li>
        )}
      </ul>
    </section>
  );
}
