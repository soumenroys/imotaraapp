'use client';

import { useEffect, useMemo, useState } from "react";
import type { EmotionRecord } from "@/types/history";
import { getHistory } from "@/lib/imotara/history";
import { saveHistory } from "@/lib/imotara/historyPersist";
import useSyncHistory from "@/hooks/useSyncHistory";
import SyncStatusChip from "@/components/imotara/SyncStatusChip";
import { pushAllLocalToApi, pushPendingToApi } from "@/lib/imotara/syncHistory";
import { computePending } from "@/lib/imotara/pushLedger";

export default function EmotionHistory() {
  const [items, setItems] = useState<EmotionRecord[]>([]);
  const [pushInfo, setPushInfo] = useState<string>("");
  const [apiInfo, setApiInfo] = useState<string>("");
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Initial load of local store
  useEffect(() => {
    try {
      const local = getHistory();
      setItems(local);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[EmotionHistory] getHistory failed:", err);
    }
  }, []);

  // Recompute pending count whenever items change
  useEffect(() => {
    try {
      setPendingCount(computePending(items).length);
    } catch {
      setPendingCount(0);
    }
  }, [items]);

  const sync = useSyncHistory({
    // Reflect merged records in UI, and persist them too.
    onPersist: async (merged) => {
      try {
        setItems(merged);
        saveHistory(merged); // ✅ persist to localStorage
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[EmotionHistory] onPersist failed:", err);
      }
    },
    intervalMs: 60_000, // 60s periodic pull
  });

  const subtitle = useMemo(() => {
    if (sync.state === "synced" && sync.lastSyncedAt) {
      const d = new Date(sync.lastSyncedAt);
      return `Last synced ${d.toLocaleTimeString()}`;
    }
    if (sync.state === "offline") return "Offline — will retry when online";
    if (sync.state === "error" && sync.lastError) return `Error: ${sync.lastError}`;
    if (sync.state === "syncing") return "Syncing…";
    return "";
  }, [sync.state, sync.lastSyncedAt, sync.lastError]);

  const debugLine = useMemo(() => {
    const t = sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleString() : "—";
    return `state=${sync.state} | lastSyncedAt=${t}`;
  }, [sync.state, sync.lastSyncedAt]);

  async function handleDelete(id: string) {
    const ok = typeof window !== "undefined" ? window.confirm("Delete this entry?") : true;
    if (!ok) return;

    // Optimistic UI: hide immediately
    const prev = items;
    const next = prev.filter((r) => r.id !== id);
    setItems(next);
    saveHistory(next); // persist optimistic change

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
      const json = await res.json();
      setPushInfo(`Deleted ${Array.isArray(json?.deletedIds) ? json.deletedIds.length : 0} item(s).`);
      // Pull to reconcile (server may have different state)
      await sync.manualSync();
    } catch (err: any) {
      // Roll back UI and persistence
      setItems(prev);
      saveHistory(prev);
      setPushInfo(`Delete failed: ${String(err?.message ?? err)}`);
    }
  }

  return (
    <section className="w-full">
      {/* Error banner if sync lastError present */}
      {sync.state === "error" && sync.lastError && (
        <div className="mb-3 rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          Sync error: {sync.lastError}
        </div>
      )}

      {/* Header with status chip and manual controls */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SyncStatusChip
            state={sync.state}
            lastSyncedAt={sync.lastSyncedAt}
            pendingCount={pendingCount}  // ✅ now wired
            conflictCount={0}            // TODO: wire from conflicts store
          />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                await sync.manualSync();
              } catch (err: any) {
                console.error("[EmotionHistory] manualSync failed:", err);
              }
            }}
            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
            title="Force pull & merge now"
          >
            Sync now
          </button>

          <button
            onClick={async () => {
              try {
                setPushInfo("Pushing pending…");
                const res = await pushPendingToApi();
                setPushInfo(
                  `Pending push: attempted ${res.attempted}; accepted ${res.accepted}${
                    res.rejected ? `, rejected ${res.rejected}` : ""
                  }`
                );
                // Refresh pending count after push using the latest local store
                setPendingCount(computePending(getHistory()).length);
              } catch (err: any) {
                setPushInfo(`Push pending failed: ${String(err?.message ?? err)}`);
              }
            }}
            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
            title="Push only changed/new records"
          >
            {`Push pending${pendingCount ? ` (${pendingCount})` : ""}`}
          </button>

          {/* Optional: keep full push for testing */}
          <button
            onClick={async () => {
              try {
                setPushInfo("Pushing all…");
                const res = await pushAllLocalToApi();
                setPushInfo(
                  `Pushed ${res.attempted}; accepted ${res.acceptedIds.length}${
                    res.rejected?.length ? `, rejected ${res.rejected.length}` : ""
                  }`
                );
                setPendingCount(computePending(getHistory()).length);
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
                const json = await res.json();
                if (Array.isArray(json)) {
                  setApiInfo(`GET /api/history returned array: length=${json.length}`);
                } else if (json && typeof json === "object" && "records" in json) {
                  const recs = Array.isArray(json.records) ? json.records : [];
                  setApiInfo(
                    `GET /api/history envelope: records=${recs.length}, serverTs=${json.serverTs ?? "—"}`
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
        {items.map((r) => {
          const ts = typeof r.updatedAt === "number" ? r.updatedAt : r.createdAt;
          const when = ts ? new Date(ts).toLocaleString() : "—";
          const intensity =
            typeof r.intensity === "number" ? r.intensity.toFixed(2) : "—";

          return (
            <li
              key={r.id}
              className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
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
        {items.length === 0 && (
          <li className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No history yet.
          </li>
        )}
      </ul>
    </section>
  );
}
