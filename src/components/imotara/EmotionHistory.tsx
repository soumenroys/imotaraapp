// src/components/imotara/EmotionHistory.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import type { EmotionRecord } from "@/types/history";
import { getHistory } from "@/lib/imotara/history";
import { saveHistory } from "@/lib/imotara/historyPersist";
import SyncStatusChip from "@/components/imotara/SyncStatusChip";
import { pushAllLocalToApi, pushPendingToApi } from "@/lib/imotara/syncHistory";
import { computePending } from "@/lib/imotara/pushLedger";

// ⬇️ imports for summary card
import EmotionSummaryCard from "@/components/imotara/EmotionSummaryCard";
import { computeEmotionSummary } from "@/lib/imotara/summary";

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

type ConflictItem = {
  id: string;
  localTs: number;
  serverTs: number;
  newer: "server" | "local" | "same";
  local?: EmotionRecord | null;
  server?: EmotionRecord | null;
};

export default function EmotionHistory() {
  const [items, setItems] = useState<EmotionRecord[]>([]);
  const [pushInfo, setPushInfo] = useState<string>("");
  const [apiInfo, setApiInfo] = useState<string>("");
  const [pendingCount, setPendingCount] = useState<number>(0);

  // manual sync state
  const [state, setState] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // guarantee the green tick after a successful sync
  const [justSynced, setJustSynced] = useState(false);

  // keep computed summary here
  const [summary, setSummary] =
    useState<ReturnType<typeof computeEmotionSummary> | null>(null);

  // track and scroll to the last-added item
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const lastAddedRef = useRef<HTMLLIElement | null>(null);

  // conflict counter (server has a newer version than local for same id)
  const [conflicts, setConflicts] = useState<number>(0);

  // persist + highlight recent conflicts (~10s)
  const [lastConflictAt, setLastConflictAt] = useState<number | null>(null);
  const [conflictFresh, setConflictFresh] = useState(false);

  // show “Pulled just now” for 2s after pulling server updates
  const [pulledNow, setPulledNow] = useState(false);

  // conflict review modal visibility
  const [showConflictModal, setShowConflictModal] = useState(false);

  // detailed conflict list (server newer than local)
  const [conflictItems, setConflictItems] = useState<ConflictItem[]>([]);

  // ⬇️ single-level undo snapshot (20s window)
  const [undoSnapshot, setUndoSnapshot] = useState<EmotionRecord[] | null>(null);
  const [undoLabel, setUndoLabel] = useState<string | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  function clearUndoTimer() {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }

  function offerUndo(prevItems: EmotionRecord[], label: string) {
    setUndoSnapshot(prevItems);
    setUndoLabel(label);
    clearUndoTimer();
    undoTimerRef.current = window.setTimeout(() => {
      setUndoSnapshot(null);
      setUndoLabel(null);
      undoTimerRef.current = null;
    }, 20_000);
  }

  function performUndo() {
    if (!undoSnapshot) return;
    const prev = undoSnapshot;
    setItems(prev);
    setSummary(computeEmotionSummary(prev.filter((r) => !r.deleted)));
    saveHistory(prev);
    setPendingCount(computePending(prev).length);
    setUndoSnapshot(null);
    setUndoLabel(null);
    clearUndoTimer();
    // NOTE: we do not automatically restore conflictItems; the user can re-sync to re-evaluate
  }

  // Load lastConflictAt from localStorage once
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("imotara:lastConflictAt") : null;
      if (raw) {
        const ts = Number(raw);
        if (Number.isFinite(ts)) setLastConflictAt(ts);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // helper to adapt summary shape for the card (which accepts string-indexed frequency)
  function toCardSummary(s: ReturnType<typeof computeEmotionSummary> | null) {
    if (!s) return null;
    return {
      total: s.total,
      avgIntensity: s.avgIntensity,
      dominantEmotion: s.dominantEmotion ?? null,
      frequency: s.frequency as unknown as Record<string, number>,
      last7dAvgIntensity: s.last7dAvgIntensity,
      last7dSeries: s.last7dSeries,
    };
  }

  // Initial load of local store (async)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const local = await getHistory();
        const list = Array.isArray(local) ? local : [];
        if (!cancelled) {
          setItems(list);
          setSummary(computeEmotionSummary(list.filter((r) => !r.deleted)));
        }
      } catch (err) {
        if (!cancelled) {
          setItems([]);
          setSummary(computeEmotionSummary([]));
        }
        // eslint-disable-next-line no-console
        console.error("[EmotionHistory] getHistory failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Recompute pending & summary whenever items change
  useEffect(() => {
    try {
      setPendingCount(Array.isArray(items) ? computePending(items).length : 0);
    } catch {
      setPendingCount(0);
    }
    try {
      const base = Array.isArray(items) ? items : [];
      setSummary(computeEmotionSummary(base.filter((r) => !r.deleted)));
    } catch {
      // no-op; keep previous summary
    }
  }, [items]);

  // after items update, if we have a "lastAdded" item, scroll to it smoothly
  useEffect(() => {
    if (lastAddedId && lastAddedRef.current) {
      lastAddedRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      const t = setTimeout(() => setLastAddedId(null), 600);
      return () => clearTimeout(t);
    }
  }, [items, lastAddedId]);

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
        Array.isArray(json) ? json : Array.isArray(json?.records) ? json.records : [];

      // compute conflicts (server newer than local for same id) + collect details
      const latestLocal = await getHistory();
      const localList = Array.isArray(latestLocal) ? latestLocal : [];
      const localMap = new Map(localList.map(r => [r.id, r]));
      let serverNewer = 0;
      const details: ConflictItem[] = [];

      for (const rec of incoming) {
        const loc = localMap.get(rec.id);
        if (!loc) continue;
        const locTs = loc.updatedAt ?? loc.createdAt ?? 0;
        const srvTs = rec.updatedAt ?? rec.createdAt ?? 0;

        let newer: ConflictItem["newer"] = "same";
        if (srvTs > locTs) newer = "server";
        else if (locTs > srvTs) newer = "local";

        if (newer === "server") {
          serverNewer += 1;
          details.push({
            id: rec.id,
            localTs: locTs,
            serverTs: srvTs,
            newer,
            local: loc,
            server: rec,
          });
        }
      }
      setConflicts(serverNewer);
      setConflictItems(details.sort((a, b) => b.serverTs - a.serverTs));

      // if conflicts found, persist timestamp + flash for ~10s
      if (serverNewer > 0) {
        const now = Date.now();
        setLastConflictAt(now);
        try {
          if (typeof window !== "undefined") {
            localStorage.setItem("imotara:lastConflictAt", String(now));
          }
        } catch {
          /* ignore */
        }
        setConflictFresh(true);
        setTimeout(() => setConflictFresh(false), 10_000);
      } else {
        setConflictFresh(false);
      }

      const merged = mergeRemote(localList, incoming);
      await saveHistory(merged);
      setItems(merged);
      setSummary(computeEmotionSummary(merged.filter((r) => !r.deleted)));

      // if we actually pulled newer server updates, show “Pulled just now” for 2s
      if (serverNewer > 0) {
        setPulledNow(true);
        setTimeout(() => setPulledNow(false), 2000);
      }

      // Make pending reflect the merged truth
      const pending = computePending(merged).length;
      setPendingCount(pending);

      setState("synced");
      setLastSyncedAt(Date.now());

      // Force a visible “✅ All changes synced”
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 2500);
    } catch (err: any) {
      setState("error");
      setLastError(String(err?.message ?? err));
    }
  }

  // Auto-sync every 5 minutes when the tab is visible
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void manualSync();
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleDelete(id: string) {
    const ok = typeof window !== "undefined" ? window.confirm("Delete this entry?") : true;
    if (!ok) return;

    const prev = items;
    const next = Array.isArray(prev) ? prev.filter((r) => r.id !== id) : [];
    setItems(next);
    setSummary(computeEmotionSummary(next.filter((r) => !r.deleted)));
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
      setSummary(computeEmotionSummary(prev.filter((r) => !r.deleted))); // rollback
      await saveHistory(prev);
      setPushInfo(`Delete failed: ${String(err?.message ?? err)}`);
    }
  }

  // Add demo record helper (for quick testing)
  function addDemo() {
    const now = Date.now();
    const rec: EmotionRecord = {
      id: `demo-${now}`,
      message: "Quick demo entry",
      emotion: "neutral",
      intensity: 0.3,
      createdAt: now,
      updatedAt: now,
    };
    const base = Array.isArray(items) ? items : [];
    const next = [rec, ...base];
    setItems(next);
    setSummary(computeEmotionSummary(next.filter((r) => !r.deleted)));
    setLastAddedId(rec.id); // mark for scroll
    saveHistory(next);
    setPendingCount(computePending(next).length);
  }

  // ⬇️ helpers to apply server choice (with Undo)
  async function applyServerVersion(id: string, serverRec: EmotionRecord) {
    const prevItems = Array.isArray(items) ? items : [];
    const idx = prevItems.findIndex((r) => r.id === id);
    let next: EmotionRecord[];
    if (idx >= 0) {
      next = [...prevItems];
      next[idx] = serverRec;
    } else {
      next = [serverRec, ...prevItems];
    }
    setItems(next);
    setSummary(computeEmotionSummary(next.filter((r) => !r.deleted)));
    await saveHistory(next);
    setPendingCount(computePending(next).length);

    // remove resolved conflict from the modal list
    setConflictItems((list) => list.filter((c) => c.id !== id));
    setConflicts((n) => Math.max(0, n - 1));

    // offer undo
    offerUndo(prevItems, "Replaced with server version");
  }

  async function applyServerVersionForAll() {
    const prevItems = Array.isArray(items) ? items : [];
    const serverRecs = conflictItems
      .map((c) => c.server)
      .filter((r): r is EmotionRecord => !!r);

    if (serverRecs.length === 0) return;

    // update/insert each server rec
    const map = new Map(prevItems.map((r) => [r.id, r]));
    for (const rec of serverRecs) {
      map.set(rec.id, rec);
    }
    const next = Array.from(map.values()).sort(
      (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
    );

    setItems(next);
    setSummary(computeEmotionSummary(next.filter((r) => !r.deleted)));
    await saveHistory(next);
    setPendingCount(computePending(next).length);

    // clear conflicts
    setConflictItems([]);
    setConflicts(0);

    // offer undo
    offerUndo(prevItems, "Replaced all with server versions");
  }

  // ⬇️ Inline modal component (now lists conflict details + actions)
  function ConflictModal({
    open,
    onClose,
    conflicts,
    lastConflictAt,
    items,
  }: {
    open: boolean;
    onClose: () => void;
    conflicts: number;
    lastConflictAt: number | null;
    items: ConflictItem[];
  }) {
    if (!open) return null;

    const fmt = (ts: number) => (ts ? new Date(ts).toLocaleString() : "—");
    const preview = (s?: string) =>
      s ? (s.length > 60 ? `${s.slice(0, 60)}…` : s) : "(no message)";

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
      >
        {/* backdrop */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* panel */}
        <div className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Server updates available
          </h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            We detected <strong>{conflicts}</strong> newer update{conflicts === 1 ? "" : "s"} on the server
            {lastConflictAt
              ? ` (since ${new Date(lastConflictAt).toLocaleString()})`
              : ""}.
          </p>

          <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
            {items.length === 0 ? (
              <div className="p-3 text-xs text-zinc-500 dark:text-zinc-400">
                No per-record details found.
              </div>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {items.map((it) => (
                  <li key={it.id} className="p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {it.server?.emotion ?? it.local?.emotion ?? "unknown"}{" "}
                          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                            • id: {it.id}
                          </span>
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                          <div>
                            <div className="uppercase tracking-wide text-[10px] text-zinc-400 dark:text-zinc-500">
                              Server
                            </div>
                            <div>{fmt(it.serverTs)}</div>
                            <div className="mt-0.5 italic">
                              {preview(it.server?.message)}
                            </div>
                          </div>
                          <div>
                            <div className="uppercase tracking-wide text-[10px] text-zinc-400 dark:text-zinc-500">
                              Local
                            </div>
                            <div>{fmt(it.localTs)}</div>
                            <div className="mt-0.5 italic">
                              {preview(it.local?.message)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-600/60 dark:bg-amber-900/30 dark:text-amber-300">
                          server newer
                        </span>
                        <button
                          onClick={() => {
                            if (it.server) void applyServerVersion(it.id, it.server);
                          }}
                          className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                          title="Replace local copy with the server version"
                        >
                          Use server version
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {items.length > 0 ? "You can apply one-by-one or all at once." : "Nothing to review."}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded-xl border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Close
              </button>
              <button
                onClick={async () => {
                  await manualSync();
                  onClose();
                }}
                className="rounded-xl border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                title="Pull and merge from server"
              >
                Pull all
              </button>
              <button
                onClick={async () => {
                  await applyServerVersionForAll();
                  onClose();
                }}
                className="rounded-xl border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                title="Replace local copies with server versions for all listed items"
              >
                Use server for all
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const safeItems: EmotionRecord[] = Array.isArray(items) ? items : [];
  // ⬇️ Only show non-deleted items in the UI
  const visibleItems = safeItems.filter((r) => !r.deleted);

  return (
    <section className="w-full">
      {state === "error" && lastError && (
        <div className="mb-3 rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
          Sync error: {lastError}
        </div>
      )}

      {/* Undo bar */}
      {undoSnapshot && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
          <span>{undoLabel ?? "Change applied."}</span>
          <button
            onClick={performUndo}
            className="rounded-lg border border-emerald-300 px-2 py-1 text-xs font-medium hover:bg-emerald-100 dark:border-emerald-700 dark:hover:bg-emerald-800"
            title="Revert the last change"
          >
            Undo
          </button>
        </div>
      )}

      {/* Header with status chip and manual controls */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SyncStatusChip
            state={state === "syncing" ? "syncing" : state === "error" ? "error" : "synced"}
            lastSyncedAt={lastSyncedAt}
            pendingCount={pendingCount}
            conflictsCount={conflicts}
          />
          <span
            className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-2"
            aria-live="polite"
          >
            <span>{subtitle}</span>
            {(state === "synced") && (Number(pendingCount) <= 0 || justSynced) && (
              <span className="text-green-600 dark:text-green-400 text-sm">✅ All changes synced</span>
            )}

            {/* tiny orange conflict pill (fresh ones pulse for ~10s) */}
            {conflicts > 0 && (
              <>
                <button
                  onClick={manualSync}
                  className={[
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    "border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200",
                    "dark:border-amber-600/60 dark:bg-amber-900/30 dark:text-amber-300",
                    conflictFresh ? "ring-2 ring-amber-400/70 animate-pulse" : ""
                  ].join(" ")}
                  title={
                    lastConflictAt
                      ? `Server has newer versions (since ${new Date(lastConflictAt).toLocaleTimeString()}). Click to pull & merge.`
                      : "Server has newer versions for some items. Click to pull & merge."
                  }
                >
                  {conflicts} update{conflicts > 1 ? "s" : ""} on server — Pull
                </button>

                {/* open the review modal */}
                <button
                  onClick={() => setShowConflictModal(true)}
                  className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  title="Review conflicts"
                >
                  Review
                </button>
              </>
            )}

            {/* microcopy after successful conflict pull */}
            {pulledNow && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Pulled just now
              </span>
            )}
          </span>
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
                const accepted =
                  Array.isArray(res?.acceptedIds)
                    ? res.acceptedIds.length
                    : Number(res?.accepted ?? res?.acceptedCount ?? 0);
                const rejected =
                  Array.isArray(res?.rejected)
                    ? res.rejected.length
                    : Number(res?.rejected ?? res?.rejectedCount ?? 0);

                setPushInfo(
                  `Pending push: attempted ${attempted}; accepted ${accepted}${
                    rejected ? `, rejected ${rejected}` : ""
                  }`
                );

                const latest = await getHistory();
                setPendingCount(computePending(latest).length);

                // ensure UI reflects server state immediately
                await manualSync();
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
                const accepted = Array.isArray(res?.acceptedIds)
                  ? res.acceptedIds.length
                  : Number(res?.accepted ?? 0);
                const rejectedLen = Array.isArray(res?.rejected)
                  ? res.rejected.length
                  : Number(res?.rejected ?? 0);

                setPushInfo(
                  `Pushed ${attempted}; accepted ${accepted}${
                    rejectedLen ? `, rejected ${rejectedLen}` : ""
                  }`
                );

                const latest = await getHistory();
                setPendingCount(computePending(latest).length);

                // ensure UI reflects server state immediately
                await manualSync();
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
                  const recs = Array.isArray((json as any).records)
                    ? (json as any).records
                    : [];
                  setApiInfo(
                    `GET /api/history envelope: records=${recs.length}, serverTs=${
                      (json as any).serverTs ?? "—"
                    }`
                  );
                } else {
                  setApiInfo(
                    `GET /api/history unexpected shape: ${JSON.stringify(json).slice(
                      0,
                      200
                    )}…`
                  );
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

          {/* quick local test record */}
          <button
            onClick={addDemo}
            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
            title="Insert one local record for testing"
          >
            Add demo
          </button>

          {/* subtle link to seed page */}
          <span className="text-zinc-300 dark:text-zinc-700">•</span>
          <a
            href="/dev/seed"
            className="text-xs text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
            title="Open the developer seeding page"
          >
            Seed demo data
          </a>
        </div>
      </div>

      {/* Debug + operation result lines */}
      <div className="mb-3 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <div>{debugLine}</div>
        {pushInfo && <div>{pushInfo}</div>}
        {apiInfo && <div>{apiInfo}</div>}
      </div>

      {/* Emotion Summary Card */}
      <div className="mb-4">
        <EmotionSummaryCard summary={toCardSummary(summary)} />
      </div>

      {/* Simple list of history items */}
      <ul className="space-y-3">
        {visibleItems.map((r) => {
          const ts =
            typeof r.updatedAt === "number" ? r.updatedAt : r.createdAt;
          const when = ts ? new Date(ts).toLocaleString() : "—";
          const intensity =
            typeof r.intensity === "number" ? r.intensity.toFixed(2) : "—";

          // attach ref to the last-added item for smooth scroll (callback returns void)
          const liRef =
            r.id === lastAddedId
              ? (el: HTMLLIElement | null) => { lastAddedRef.current = el; }
              : undefined;

          return (
            <li
              ref={liRef}
              key={r.id}
              className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  {when}
                </div>
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

        {/* Empty-state with CTA */}
        {visibleItems.length === 0 && (
          <li className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            <div>No history yet.</div>
            <button
              onClick={addDemo}
              className="mt-3 inline-flex items-center justify-center rounded-xl border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              title="Insert one neutral sample entry"
            >
              Add a sample entry
            </button>
            <div className="mt-2 text-xs">
              or{" "}
              <a
                href="/dev/seed"
                className="underline underline-offset-2 hover:no-underline"
                title="Open the developer seeding page"
              >
                seed demo data
              </a>
            </div>
          </li>
        )}
      </ul>

      {/* ⬇️ Render the conflict review modal */}
      <ConflictModal
        open={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        conflicts={conflicts}
        lastConflictAt={lastConflictAt}
        items={conflictItems}
      />
    </section>
  );
}
