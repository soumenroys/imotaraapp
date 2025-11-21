// src/components/imotara/EmotionHistory.tsx
"use client";

import Link from "next/link";
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { EmotionRecord } from "@/types/history";
import { getHistory } from "@/lib/imotara/history";
import { saveHistory } from "@/lib/imotara/historyPersist";
import SyncStatusChip from "@/components/imotara/SyncStatusChip";
import {
  pushAllLocalToApi,
  pushPendingToApi,
  enqueueConflicts,
  retryQueuedConflicts,
} from "@/lib/imotara/syncHistory";
import { computePending } from "@/lib/imotara/pushLedger";

// ⬇️ imports for summary card
import EmotionSummaryCard from "@/components/imotara/EmotionSummaryCard";
import { computeEmotionSummary } from "@/lib/imotara/summary";

// ⬇️ Step 14-C-10: mini timeline visualization
import EmotionMiniTimeline from "@/components/imotara/EmotionMiniTimeline";

// ⬇️ Step 14-C-4: conflict preview imports
import { detectConflicts } from "@/lib/imotara/conflictDetect";
import type { ConflictPreview } from "@/lib/imotara/syncHistory";

// ⬇️ Consent hook (read-only indicator)
import { useAnalysisConsent } from "@/hooks/useAnalysisConsent";

// simple upsert merge (remote -> local)
function mergeRemote(
  local: EmotionRecord[],
  incoming: EmotionRecord[]
): EmotionRecord[] {
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
  const [state, setState] = useState<"idle" | "syncing" | "synced" | "error">(
    "idle"
  );
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

  // ⬇️ Step 14-C-4: read-only conflict previews for UI use later
  const [conflictPreviews, setConflictPreviews] = useState<ConflictPreview[]>(
    []
  );

  // ⬇️ single-level undo snapshot (20s window)
  const [undoSnapshot, setUndoSnapshot] = useState<EmotionRecord[] | null>(
    null
  );
  const [undoLabel, setUndoLabel] = useState<string | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  // ⬇️ NEW: session-aware filter (from chat sessions)
  const searchParams = useSearchParams();
  const urlSessionId = (searchParams?.get("sessionId") ?? "").trim();
  const urlMessageId = (searchParams?.get("messageId") ?? "").trim();
  const [sessionFilter, setSessionFilter] = useState<string>(urlSessionId);

  // NEW — Step 17.9: hint when landing with messageId deep link
  const [showDeepLinkHint, setShowDeepLinkHint] = useState(false);

  // show the hint only on first load when messageId present
  useEffect(() => {
    if (!urlMessageId) return;
    setShowDeepLinkHint(true);
    const t = setTimeout(() => setShowDeepLinkHint(false), 5000);
    return () => clearTimeout(t);
  }, [urlMessageId]);

  // ⬇️ NEW (Step 17.2): track if user manually changed the filter, and
  // whether we've already auto-scrolled for the initial URL sessionId.
  const [sessionFilterTouched, setSessionFilterTouched] = useState(false);
  const [initialSessionScrollDone, setInitialSessionScrollDone] =
    useState(false);

  // ⬇️ NEW (Step 17.4): soft highlight state for the input
  const highlightSessionInput =
    !!urlSessionId &&
    sessionFilter === urlSessionId &&
    !sessionFilterTouched;

  // ⬇️ NEW (Step 17.2): ref to the first filtered list item for auto-scroll
  const firstFilteredRef = useRef<HTMLLIElement | null>(null);

  // ⬇️ NEW (Step 17.5): ref to the session filter input for auto-focus
  const sessionFilterInputRef = useRef<HTMLInputElement | null>(null);

  // ⬇️ NEW: deep-link to a specific messageId (from Chat → History)
  const [highlightedMessageId, setHighlightedMessageId] =
    useState<string | null>(null);
  const messageTargetRef = useRef<HTMLLIElement | null>(null);
  const usedMessageIdRef = useRef<string | null>(null);

  // ⬇️ Consent mode (read-only indicator in header)
  const { mode: consentMode } = useAnalysisConsent();
  const consentLabel =
    consentMode === "allow-remote"
      ? "Remote analysis allowed"
      : consentMode === "local-only"
        ? "On-device only"
        : "Analysis mode: unknown";

  const consentClass =
    consentMode === "allow-remote"
      ? "border-emerald-300 bg-emerald-50/80 text-emerald-700 dark:border-emerald-600/60 dark:bg-emerald-900/40 dark:text-emerald-300"
      : consentMode === "local-only"
        ? "border-zinc-300 bg-zinc-50/80 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300"
        : "border-zinc-200 bg-zinc-50/80 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400";

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
    setSummary(
      computeEmotionSummary(prev.filter((r) => !(r as any).deleted))
    );
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
      const raw =
        typeof window !== "undefined"
          ? localStorage.getItem("imotara:lastConflictAt")
          : null;
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
          setSummary(
            computeEmotionSummary(
              list.filter((r) => !(r as any).deleted)
            )
          );
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
      setSummary(
        computeEmotionSummary(base.filter((r) => !(r as any).deleted))
      );
    } catch {
      // no-op; keep previous summary
    }
  }, [items]);

  // Step 17.7 — Reapply deep-link filter after sync/updates
  useEffect(() => {
    if (!urlSessionId) return;
    if (sessionFilterTouched) return;

    // Ensure sessionFilter stays locked to URL sessionId
    if (sessionFilter !== urlSessionId) {
      setSessionFilter(urlSessionId);
    }
  }, [items, urlSessionId, sessionFilterTouched, sessionFilter]);

  // after items update, if we have a "lastAdded" item, scroll to it smoothly
  useEffect(() => {
    if (lastAddedId && lastAddedRef.current) {
      lastAddedRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
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

  // ⬇️ Step 14-C-6: smarter tooltip for Review button (handles string | {field: string})
  const reviewTooltip = useMemo(() => {
    if (!conflictPreviews?.length) return "Review conflicts";

    const seen = new Set<string>();
    const extractField = (d: unknown): string | null => {
      if (typeof d === "string") return d;
      if (d && typeof d === "object" && "field" in (d as any)) {
        return String((d as any).field);
      }
      return null;
    };
    for (const p of conflictPreviews) {
      for (const d of p.diffs ?? []) {
        const key = extractField(d);
        if (key) {
          seen.add(key);
          if (seen.size >= 2) break;
        }
      }
      if (seen.size >= 2) break;
    }
    const keys = Array.from(seen);
    return keys.length
      ? `Review conflicts — e.g., ${keys.join(", ")} changed`
      : "Review conflicts";
  }, [conflictPreviews]);

  // ⬇️ Step 14-C-7: compact hint line based on conflictPreviews (first 3 unique fields)
  const previewHint = useMemo(() => {
    if (!conflictPreviews?.length) return "";
    const seen = new Set<string>();
    const pick = (d: unknown) =>
      typeof d === "string"
        ? d
        : d && typeof d === "object" && "field" in (d as any)
          ? String((d as any).field)
          : null;

    for (const p of conflictPreviews) {
      for (const d of p.diffs ?? []) {
        const k = pick(d);
        if (k) {
          seen.add(k);
          if (seen.size >= 3) break;
        }
      }
      if (seen.size >= 3) break;
    }
    const list = Array.from(seen);
    return list.length ? `Detected changes: ${list.join(", ")}` : "";
  }, [conflictPreviews]);

  // Manual “Sync now”
  async function manualSync() {
    try {
      setState("syncing");
      setLastError(null);

      const res = await fetch("/api/history", { method: "GET" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `GET /api/history ${res.status} ${res.statusText} — ${text}`
        );
      }
      const json: any = await res.json().catch(() => ({}));
      const incoming: EmotionRecord[] = Array.isArray(json)
        ? json
        : Array.isArray(json?.records)
          ? json.records
          : [];

      // compute conflicts (server newer than local for same id) + collect details
      const latestLocal = await getHistory();
      const localList = Array.isArray(latestLocal) ? latestLocal : [];
      const localMap = new Map(localList.map((r) => [r.id, r]));
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

      // ⬇️ Step 14-C-4: compute read-only conflict previews for future UI
      if (details.length > 0) {
        const previews: ConflictPreview[] = [];
        for (const it of details) {
          if (it.local && it.server) {
            const { diffs, summary } = detectConflicts(it.local, it.server);
            if (Array.isArray(diffs) ? diffs.length > 0 : !!diffs) {
              // normalize to { id, diffs, summary, local, remote }
              const normalized: ConflictPreview = {
                id: it.id,
                diffs: Array.isArray(diffs)
                  ? (diffs as any[]).map((d) =>
                    typeof d === "string"
                      ? d
                      : d?.field
                        ? String(d.field)
                        : String(d)
                  )
                  : [String(diffs)],
                summary,
                local: it.local,
                remote: it.server,
              };
              previews.push(normalized);
            }
          }
        }
        setConflictPreviews(previews);

        // ⬇️ NEW: persist into the conflict queue so it survives reloads
        try {
          enqueueConflicts(previews);
        } catch {
          /* ignore queue errors */
        }

        // optional debug
        if (previews.length) {
          // eslint-disable-next-line no-console
          console.debug("[Imotara] Conflict previews:", previews);
        }
      } else {
        setConflictPreviews([]);
      }

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
      setSummary(
        computeEmotionSummary(merged.filter((r) => !(r as any).deleted))
      );

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
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        void manualSync();
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleDelete(id: string) {
    const ok =
      typeof window !== "undefined"
        ? window.confirm("Delete this entry?")
        : true;
    if (!ok) return;

    const prev = items;
    const next = Array.isArray(prev) ? prev.filter((r) => r.id !== id) : [];
    setItems(next);
    setSummary(
      computeEmotionSummary(next.filter((r) => !(r as any).deleted))
    );
    await saveHistory(next);

    try {
      const res = await fetch("/api/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id], updatedAt: Date.now() }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `DELETE failed: ${res.status} ${res.statusText} — ${text}`
        );
      }
      const json = await res.json().catch(() => ({}));
      const deletedCount = Array.isArray(json?.deletedIds)
        ? json.deletedIds.length
        : 0;
      setPushInfo(`Deleted ${deletedCount} item(s).`);
      await manualSync();
    } catch (err: any) {
      setItems(prev);
      setSummary(
        computeEmotionSummary(prev.filter((r) => !(r as any).deleted))
      ); // rollback
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
    setSummary(
      computeEmotionSummary(next.filter((r) => !(r as any).deleted))
    );
    setLastAddedId(rec.id); // mark for scroll
    saveHistory(next);
    setPendingCount(computePending(next).length);
  }

  // ⬇️ helpers to apply server / local choice (with Undo)

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
    setSummary(
      computeEmotionSummary(next.filter((r) => !(r as any).deleted))
    );
    await saveHistory(next);
    setPendingCount(computePending(next).length);

    // remove resolved conflict from the modal list
    setConflictItems((list) => list.filter((c) => c.id !== id));
    setConflicts((n) => Math.max(0, n - 1));

    // offer undo
    offerUndo(prevItems, "Replaced with server version");
  }

  async function applyLocalVersion(id: string, localRec?: EmotionRecord | null) {
    const prevItems = Array.isArray(items) ? items : [];
    let next = prevItems;

    if (localRec) {
      const idx = prevItems.findIndex((r) => r.id === id);
      if (idx >= 0) {
        next = [...prevItems];
        next[idx] = localRec;
      } else {
        next = [localRec, ...prevItems];
      }
    }

    if (next !== prevItems) {
      setItems(next);
      setSummary(
        computeEmotionSummary(next.filter((r) => !(r as any).deleted))
      );
      await saveHistory(next);
      setPendingCount(computePending(next).length);
    }

    setConflictItems((list) => list.filter((c) => c.id !== id));
    setConflicts((n) => Math.max(0, n - 1));

    offerUndo(prevItems, "Kept local version");
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
    setSummary(
      computeEmotionSummary(next.filter((r) => !(r as any).deleted))
    );
    await saveHistory(next);
    setPendingCount(computePending(next).length);

    // clear conflicts
    setConflictItems([]);
    setConflicts(0);

    // offer undo
    offerUndo(prevItems, "Replaced all with server versions");
  }

  function keepLocalForAll() {
    const prevItems = Array.isArray(items) ? items : [];
    // we intentionally do not change items; we only mark all conflicts as resolved
    setConflictItems([]);
    setConflicts(0);
    offerUndo(prevItems, "Kept local versions for all conflicts");
  }

  // ⬇️ small helper to trigger downloads for export
  function downloadFile(filename: string, mime: string, content: string) {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ⬇️ Inline modal component (now lists conflict details + actions)
  function ConflictModal({
    onClose,
    conflicts,
    lastConflictAt,
    items,
  }: {
    onClose: () => void;
    conflicts: number;
    lastConflictAt: number | null;
    items: ConflictItem[];
  }) {
    const fmt = (ts: number) => (ts ? new Date(ts).toLocaleString() : "—");
    const previewMsg = (s?: string) =>
      s ? (s.length > 60 ? `${s.slice(0, 60)}…` : s) : "(no message)";

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
      >
        {/* backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* panel */}
        <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900/80 p-5 shadow-2xl backdrop-blur-md">
          <h3 className="text-base font-semibold text-zinc-50">
            Server updates available
          </h3>
          <p className="mt-2 text-sm text-zinc-300">
            We detected <strong>{conflicts}</strong> newer update
            {conflicts === 1 ? "" : "s"} on the server
            {lastConflictAt
              ? ` (since ${new Date(lastConflictAt).toLocaleString()})`
              : ""}{" "}
            .
          </p>

          <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-white/10 bg-zinc-900/40">
            {items.length === 0 ? (
              <div className="p-3 text-xs text-zinc-400">
                No per-record details found.
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {items.map((it) => {
                  const previewForItem = conflictPreviews.find(
                    (p) => p.id === it.id
                  );

                  return (
                    <li key={it.id} className="p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-zinc-50">
                            {it.server?.emotion ??
                              it.local?.emotion ??
                              "unknown"}{" "}
                            <span className="text-xs font-normal text-zinc-400">
                              • id: {it.id}
                            </span>
                          </div>
                          <div className="mt-1 grid grid-cols-2 gap-3 text-xs text-zinc-300">
                            <div>
                              <div className="uppercase tracking-wide text-[10px] text-zinc-500">
                                Server
                              </div>
                              <div>{fmt(it.serverTs)}</div>
                              <div className="mt-0.5 italic text-zinc-400">
                                {previewMsg(it.server?.message)}
                              </div>
                            </div>
                            <div>
                              <div className="uppercase tracking-wide text-[10px] text-zinc-500">
                                Local
                              </div>
                              <div>{fmt(it.localTs)}</div>
                              <div className="mt-0.5 italic text-zinc-400">
                                {previewMsg(it.local?.message)}
                              </div>
                            </div>
                          </div>

                          {previewForItem &&
                            previewForItem.diffs &&
                            previewForItem.diffs.length > 0 && (
                              <div className="mt-2 text-[11px] text-zinc-400">
                                Changed fields:{" "}
                                {previewForItem.diffs.join(", ")}
                              </div>
                            )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span className="rounded-full border border-amber-500/70 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                            server newer
                          </span>
                          <button
                            onClick={() => {
                              void applyLocalVersion(it.id, it.local ?? null);
                            }}
                            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-100 hover:bg-white/10"
                            title="Keep your local copy and dismiss this conflict"
                          >
                            Keep local
                          </button>
                          <button
                            onClick={() => {
                              if (it.server)
                                void applyServerVersion(it.id, it.server);
                            }}
                            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-100 hover:bg-white/10"
                            title="Replace local copy with the server version"
                          >
                            Use server
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-300">
            <div>
              {items.length > 0
                ? "You can apply one-by-one or resolve all at once."
                : "Nothing to review."}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-100 hover:bg-white/10"
              >
                Close
              </button>
              <button
                onClick={() => {
                  keepLocalForAll();
                  onClose();
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-100 hover:bg-white/10"
                title="Keep all local copies and mark conflicts as resolved"
              >
                Keep local for all
              </button>
              <button
                onClick={async () => {
                  await manualSync();
                  onClose();
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-100 hover:bg-white/10"
                title="Pull and merge from server"
              >
                Pull all
              </button>
              <button
                onClick={async () => {
                  await applyServerVersionForAll();
                  onClose();
                }}
                className="rounded-xl border border-emerald-400/60 bg-emerald-500/20 px-3 py-1.5 text-sm font-medium text-emerald-50 hover:bg-emerald-500/30"
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
  const visibleItems = safeItems.filter((r) => !(r as any).deleted);

  // ⬇️ Session-based filtered view: when a filter is set, we show only records
  // whose sessionId contains that text (case-insensitive).
  const filteredItems = useMemo(() => {
    const q = sessionFilter.trim().toLowerCase();
    if (!q) return visibleItems;
    return visibleItems.filter((r) =>
      (r.sessionId ?? "").toLowerCase().includes(q)
    );
  }, [visibleItems, sessionFilter]);

  // ⬇️ NEW: deep-linked scroll + highlight for a specific messageId
  useEffect(() => {
    if (!urlMessageId) return;
    if (usedMessageIdRef.current === urlMessageId) return;

    const exists = visibleItems.some(
      (r: any) => r.messageId === urlMessageId
    );
    if (!exists) return;

    usedMessageIdRef.current = urlMessageId;
    setHighlightedMessageId(urlMessageId);

    setTimeout(() => {
      const el = messageTargetRef.current;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);
  }, [urlMessageId, visibleItems]);

  // auto-clear message highlight after a few seconds
  useEffect(() => {
    if (!highlightedMessageId) return;
    const t = window.setTimeout(() => setHighlightedMessageId(null), 4000);
    return () => window.clearTimeout(t);
  }, [highlightedMessageId]);

  // ⬇️ NEW (Step 17.2): auto-scroll when arriving via /history?sessionId=...
  // If a specific messageId is present, we let the message-based scroll win
  useEffect(() => {
    if (!urlSessionId) return;
    if (urlMessageId) return; // message-specific deep-link takes priority
    if (sessionFilterTouched) return;
    if (initialSessionScrollDone) return;
    if (!filteredItems.length) return;

    if (firstFilteredRef.current) {
      firstFilteredRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setInitialSessionScrollDone(true);
    }
  }, [
    urlSessionId,
    urlMessageId,
    sessionFilterTouched,
    initialSessionScrollDone,
    filteredItems,
  ]);

  // ⬇️ NEW (Step 17.5): auto-focus the session filter input
  useEffect(() => {
    if (!urlSessionId) return;
    if (sessionFilterTouched) return;
    if (!sessionFilterInputRef.current) return;
    sessionFilterInputRef.current.focus();
  }, [urlSessionId, sessionFilterTouched]);

  // ⬇️ NEW (Step 17.6): ESC clears the filter & blurs input when focused
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc") {
        if (!sessionFilter) return;
        if (document.activeElement === sessionFilterInputRef.current) {
          event.preventDefault();
          setSessionFilter("");
          setSessionFilterTouched(true);
          // stop future auto-scroll for this deep link
          setInitialSessionScrollDone(true);
          sessionFilterInputRef.current?.blur();
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sessionFilter]);

  // ⬇️ Derived flags for pending + conflict (used by mini timeline)
  const pendingList = computePending(safeItems);
  const pendingSet = new Set(pendingList.map((p: any) => p.id));
  const conflictSet = new Set(conflictItems.map((c) => c.id));

  // For the mini-timeline: show the filtered slice if a sessionFilter is active,
  // otherwise show the full visible list.
  const baseForTimeline = sessionFilter.trim() ? filteredItems : visibleItems;
  const timelineItems = baseForTimeline.map((r) => ({
    ...r,
    pending: pendingSet.has(r.id),
    conflict: conflictSet.has(r.id),
  }));

  return (
    <section className="w-full space-y-3 text-sm text-zinc-900 dark:text-zinc-100">
      {state === "error" && lastError && (
        <div className="mb-3 rounded-xl border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm text-red-100 shadow-sm backdrop-blur-sm">
          Sync error: {lastError}
        </div>
      )}

      {/* Undo bar */}
      {undoSnapshot && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-emerald-400/70 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-50 shadow-sm backdrop-blur-sm">
          <span>{undoLabel ?? "Change applied."}</span>
          <button
            onClick={performUndo}
            className="rounded-lg border border-emerald-300/70 bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-50 hover:bg-emerald-500/30"
            title="Revert the last change"
          >
            Undo
          </button>
        </div>
      )}

      {/* Header with status chip, consent indicator and manual controls */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 shadow-sm backdrop-blur-md dark:bg-white/10">
        <div className="flex flex-wrap items-center gap-2">
          <SyncStatusChip
            state={
              state === "syncing"
                ? "syncing"
                : state === "error"
                  ? "error"
                  : "synced"
            }
            lastSyncedAt={lastSyncedAt}
            pendingCount={pendingCount}
            conflictsCount={conflicts}
          />
          <span
            className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300"
            aria-live="polite"
          >
            <span>{subtitle}</span>
            {state === "synced" && (Number(pendingCount) <= 0 || justSynced) && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                ✅ All changes synced
              </span>
            )}

            {/* tiny orange conflict pill (fresh ones pulse for ~10s) */}
            {conflicts > 0 && (
              <>
                <button
                  onClick={manualSync}
                  className={[
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm",
                    "border-amber-300 bg-amber-500/15 text-amber-900 hover:bg-amber-500/25",
                    "dark:border-amber-500/70 dark:bg-amber-500/15 dark:text-amber-50 dark:hover:bg-amber-500/25",
                    conflictFresh ? "ring-2 ring-amber-400/70 animate-pulse" : "",
                  ].join(" ")}
                  title={
                    lastConflictAt
                      ? `Server has newer versions (since ${new Date(
                        lastConflictAt
                      ).toLocaleTimeString()}). Click to pull & merge.`
                      : "Server has newer versions for some items. Click to pull & merge."
                  }
                >
                  {conflicts} update{conflicts > 1 ? "s" : ""} on server — Pull
                </button>

                {/* open the review modal (now with count pill + smart tooltip) */}
                <button
                  onClick={() => setShowConflictModal(true)}
                  className="relative rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs text-zinc-800 shadow-sm backdrop-blur-sm hover:bg-white/20 dark:text-zinc-100"
                  title={reviewTooltip}
                >
                  Review
                  {/* tiny count pill */}
                  <span className="ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded-full border border-amber-300 bg-amber-400/90 px-1.5 text-[10px] font-medium text-amber-900 dark:bg-amber-500 dark:text-zinc-900">
                    {Math.max(conflictPreviews.length || 0, conflicts)}
                  </span>
                </button>
              </>
            )}

            {/* microcopy after successful conflict pull */}
            {pulledNow && (
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                Pulled just now
              </span>
            )}
          </span>

          {/* NEW: tiny read-only consent indicator */}
          <span
            className={[
              "hidden sm:inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] backdrop-blur-sm",
              consentClass,
            ].join(" ")}
            title="Current emotion analysis mode for this browser"
          >
            {consentLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <button
            onClick={manualSync}
            className="rounded-2xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm backdrop-blur-sm hover:bg-white/20 dark:text-zinc-100"
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
                const accepted = Array.isArray(res?.acceptedIds)
                  ? res.acceptedIds.length
                  : Number(
                    res?.accepted ?? res?.acceptedCount ?? 0
                  );
                const rejected = Array.isArray(res?.rejected)
                  ? res.rejected.length
                  : Number(res?.rejected ?? res?.rejectedCount ?? 0);

                setPushInfo(
                  `Pending push: attempted ${attempted}; accepted ${accepted}${rejected ? `, rejected ${rejected}` : ""
                  }`
                );

                const latest = await getHistory();
                setPendingCount(computePending(latest).length);

                // ensure UI reflects server state immediately
                await manualSync();
              } catch (err: any) {
                setPushInfo(
                  `Push pending failed: ${String(err?.message ?? err)}`
                );
              }
            }}
            className="rounded-2xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm backdrop-blur-sm hover:bg-white/20 dark:text-zinc-100"
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
                  `Pushed ${attempted}; accepted ${accepted}${rejectedLen ? `, rejected ${rejectedLen}` : ""
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
            className="rounded-2xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm backdrop-blur-sm hover:bg-white/20 dark:text-zinc-100"
            title="Push all local records to server"
          >
            Push all
          </button>

          {/* NEW: Retry queued conflicts (default prefers remote) */}
          <button
            onClick={async () => {
              try {
                const { applied, remaining } = await retryQueuedConflicts(
                  "prefer-remote"
                );
                setPushInfo(
                  `Conflict retry: applied ${applied}${remaining ? `; remaining ${remaining}` : ""
                  }`
                );
                await manualSync();
              } catch (err: any) {
                setPushInfo(
                  `Retry queued failed: ${String(err?.message ?? err)}`
                );
              }
            }}
            className="rounded-2xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm backdrop-blur-sm hover:bg-white/20 dark:text-zinc-100"
            title="Apply queued conflict resolutions (prefer remote)"
          >
            Retry queued
          </button>

          <button
            onClick={async () => {
              try {
                setApiInfo("Checking…");
                const res = await fetch("/api/history", { method: "GET" });
                const json = await res.json().catch(() => ({}));
                if (Array.isArray(json)) {
                  setApiInfo(
                    `GET /api/history returned array: length=${json.length}`
                  );
                } else if (
                  json &&
                  typeof json === "object" &&
                  "records" in json
                ) {
                  const recs = Array.isArray((json as any).records)
                    ? (json as any).records
                    : [];
                  setApiInfo(
                    `GET /api/history envelope: records=${recs.length}, serverTs=${(json as any).serverTs ?? "—"
                    }`
                  );
                } else {
                  setApiInfo(
                    `GET /api/history unexpected shape: ${JSON.stringify(
                      json
                    ).slice(0, 200)}…`
                  );
                }
              } catch (err: any) {
                setApiInfo(`API check failed: ${String(err?.message ?? err)}`);
              }
            }}
            className="rounded-2xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm backdrop-blur-sm hover:bg-white/20 dark:text-zinc-100"
            title="Ping GET /api/history to verify API shape/availability"
          >
            Check API
          </button>

          {/* NEW: Export buttons (JSON + CSV) for current filtered list */}
          <button
            onClick={() => {
              const data = filteredItems;
              const payload = JSON.stringify(data, null, 2);
              const today = new Date().toISOString().slice(0, 10);
              downloadFile(
                `imotara-history-${today}.json`,
                "application/json",
                payload
              );
            }}
            className="rounded-2xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm backdrop-blur-sm hover:bg-white/20 dark:text-zinc-100"
            title="Download the currently visible history as JSON"
          >
            Export JSON
          </button>

          <button
            onClick={() => {
              const escapeCsv = (val: unknown): string => {
                if (val === null || val === undefined) return "";
                const s = String(val).replace(/"/g, '""');
                if (s.includes(",") || s.includes("\n") || s.includes('"')) {
                  return `"${s}"`;
                }
                return s;
              };

              const headers = [
                "id",
                "createdAt",
                "updatedAt",
                "emotion",
                "intensity",
                "message",
                "sessionId",
                "source",
                "messageId",
              ];
              const rows: string[] = [];
              rows.push(headers.join(","));

              filteredItems.forEach((r) => {
                const created =
                  typeof r.createdAt === "number"
                    ? new Date(r.createdAt).toISOString()
                    : "";
                const updated =
                  typeof r.updatedAt === "number"
                    ? new Date(r.updatedAt).toISOString()
                    : "";
                const cols = [
                  escapeCsv(r.id),
                  escapeCsv(created),
                  escapeCsv(updated),
                  escapeCsv(r.emotion),
                  escapeCsv(
                    typeof r.intensity === "number"
                      ? r.intensity.toFixed(3)
                      : ""
                  ),
                  escapeCsv(r.message ?? ""),
                  escapeCsv(r.sessionId ?? ""),
                  escapeCsv(r.source ?? ""),
                  escapeCsv((r as any).messageId ?? ""),
                ];
                rows.push(cols.join(","));
              });

              const csv = rows.join("\n");
              const today = new Date().toISOString().slice(0, 10);
              downloadFile(
                `imotara-history-${today}.csv`,
                "text/csv",
                csv
              );
            }}
            className="rounded-2xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm backdrop-blur-sm hover:bg-white/20 dark:text-zinc-100"
            title="Download the currently visible history as CSV"
          >
            Export CSV
          </button>

          {/* quick local test record */}
          <button
            onClick={addDemo}
            className="rounded-2xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm backdrop-blur-sm hover:bg-white/20 dark:text-zinc-100"
            title="Insert one local record for testing"
          >
            Add demo
          </button>

          {/* subtle link to seed page */}
          <span className="text-zinc-300/70 dark:text-zinc-700">•</span>
          <a
            href="/dev/seed"
            className="text-xs text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
            title="Open the developer seeding page"
          >
            Seed demo data
          </a>
        </div>
      </div>

      {/* Debug + operation result lines */}
      <div className="mb-3 space-y-1 rounded-2xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-zinc-600 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
        <div>{debugLine}</div>
        {previewHint && (
          <div className="text-[11px] opacity-80">{previewHint}</div>
        )}
        {pushInfo && <div>{pushInfo}</div>}
        {apiInfo && <div>{apiInfo}</div>}
      </div>

      {/* Session filter — links Emotion History to chat sessions via sessionId */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-zinc-600 shadow-sm backdrop-blur-md dark:bg-white/5 dark:text-zinc-300">
        <label className="min-w-[200px] flex-1">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Filter by chat session ID{" "}
            <span className="opacity-70 normal-case font-normal">
              (optional)
            </span>
          </div>
          <input
            ref={sessionFilterInputRef}
            value={sessionFilter}
            onChange={(e) => {
              setSessionFilter(e.target.value);
              setSessionFilterTouched(true); // user manually changed
            }}
            placeholder="Paste or type a session id from chat…"
            className={[
              "w-full rounded-lg px-2 py-1 text-xs",
              "bg-white/80 text-zinc-800 placeholder:text-zinc-400",
              "dark:bg-zinc-900/80 dark:text-zinc-100 dark:placeholder:text-zinc-500",
              highlightSessionInput
                ? "border border-indigo-400 ring-2 ring-indigo-300/40 dark:border-indigo-500 dark:ring-indigo-400/30"
                : "border border-white/20 dark:border-white/15",
              "focus:outline-none focus:ring-2 focus:ring-zinc-300/80 focus:border-zinc-400",
              "dark:focus:ring-zinc-600/80 dark:focus:border-zinc-500",
            ].join(" ")}
          />
          {/* soft hint when deep-linked and filter untouched */}
          {urlSessionId &&
            sessionFilter === urlSessionId &&
            !sessionFilterTouched && (
              <div className="mt-1 text-[11px] text-indigo-500 dark:text-indigo-300">
                Showing records linked to session{" "}
                <span className="break-all font-semibold">{urlSessionId}</span>
              </div>
            )}
        </label>

        <div className="flex items-center gap-2">
          {urlSessionId && (
            <Link
              href={`/chat?sessionId=${encodeURIComponent(urlSessionId)}`}
              className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs text-zinc-800 shadow-sm backdrop-blur-sm hover:bg-white/20 dark:text-zinc-100"
              title="Open this session in chat"
            >
              ← Back to chat
            </Link>
          )}

          {sessionFilter && (
            <button
              type="button"
              onClick={() => {
                setSessionFilter("");
                setSessionFilterTouched(true); // user action, so don't auto-scroll anymore
              }}
              className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs text-zinc-800 shadow-sm backdrop-blur-sm hover:bg-white/20 dark:text-zinc-100"
              title="Clear session filter"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Step 17.9 — Deep link hint */}
      {showDeepLinkHint && (
        <div className="mb-3 rounded-xl border border-amber-400/70 bg-amber-500/15 px-3 py-2 text-sm text-amber-50 shadow-sm backdrop-blur-sm animate-pulse">
          Jumped here from chat — highlighted message below.
        </div>
      )}

      {/* Emotion Summary Card */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-3 shadow-sm backdrop-blur-md dark:bg-white/5">
        <EmotionSummaryCard summary={toCardSummary(summary)} />
      </div>

      {/* Mini timeline visualization (uses flagged records) */}
      {timelineItems.length > 0 && (
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-3 shadow-sm backdrop-blur-md dark:bg-white/5">
          <EmotionMiniTimeline records={timelineItems} />
        </div>
      )}

      {/* Simple list of history items */}
      <ul className="space-y-3">
        {filteredItems.map((r, index) => {
          const ts =
            typeof r.updatedAt === "number" ? r.updatedAt : r.createdAt;
          const when = ts ? new Date(ts).toLocaleString() : "—";
          const intensity =
            typeof r.intensity === "number" ? r.intensity.toFixed(2) : "—";

          const isMessageTarget =
            !!urlMessageId && r.messageId === urlMessageId;
          const highlightedByMessage =
            !!highlightedMessageId && r.messageId === highlightedMessageId;

          // attach ref to the last-added item for smooth scroll,
          // or to the first filtered item when coming from /history?sessionId=...,
          // or to the specific deep-linked messageId target
          const liRef =
            isMessageTarget
              ? (el: HTMLLIElement | null) => {
                messageTargetRef.current = el;
              }
              : r.id === lastAddedId
                ? (el: HTMLLIElement | null) => {
                  lastAddedRef.current = el;
                }
                : sessionFilter.trim() && index === 0
                  ? (el: HTMLLIElement | null) => {
                    firstFilteredRef.current = el;
                  }
                  : undefined;

          // human-readable source badge; default to Local if missing
          const rawSource = r.source ?? "local";
          const sourceLabel =
            rawSource === "local"
              ? "Local"
              : rawSource === "remote"
                ? "Remote"
                : rawSource === "merged"
                  ? "Merged"
                  : String(rawSource);

          const hasChatLink = !!(r.sessionId && r.messageId);

          return (
            <li
              ref={liRef}
              key={r.id}
              className={[
                "rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur-md dark:bg-white/5",
                highlightedByMessage
                  ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-transparent animate-pulse"
                  : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-zinc-600 dark:text-zinc-300">
                  {when}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  {sourceLabel && (
                    <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-zinc-700 shadow-sm backdrop-blur-sm dark:text-zinc-100">
                      {sourceLabel}
                    </span>
                  )}
                  {r.sessionId && (
                    <span
                      className="inline-flex items-center rounded-full border border-indigo-300/70 bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-100 shadow-sm backdrop-blur-sm"
                      title={`Linked to chat session: ${r.sessionId}`}
                    >
                      Chat session
                    </span>
                  )}
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-zinc-700 shadow-sm backdrop-blur-sm dark:text-zinc-100">
                    {r.emotion} • {intensity}
                  </span>
                  {hasChatLink && (
                    <Link
                      href={`/chat?sessionId=${encodeURIComponent(
                        r.sessionId as string
                      )}&messageId=${encodeURIComponent(
                        r.messageId as string
                      )}`}
                      className="rounded-lg border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] text-zinc-800 shadow-sm backdrop-blur-sm hover:bg-white/20 dark:text-zinc-100"
                      title="Open this moment in chat"
                    >
                      View in chat
                    </Link>
                  )}
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="rounded-lg border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] text-zinc-800 shadow-sm backdrop-blur-sm hover:bg-white/20 dark:text-zinc-100"
                    title="Soft-delete this entry"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-800 dark:text-zinc-50">
                {r.message || (
                  <span className="opacity-70">(no message)</span>
                )}
              </div>
            </li>
          );
        })}

        {/* Global empty-state (no history at all) */}
        {visibleItems.length === 0 && (
          <li className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-center text-zinc-700 shadow-sm backdrop-blur-md dark:border-zinc-700 dark:bg-white/5 dark:text-zinc-300">
            <div>No history yet.</div>
            <button
              onClick={addDemo}
              className="mt-3 inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm backdrop-blur-sm hover:bg-white/20 dark:text-zinc-100"
              title="Insert one neutral sample entry"
            >
              Add a sample entry
            </button>
            <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
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

        {/* Filtered empty-state: there is history, but none for this session filter */}
        {visibleItems.length > 0 &&
          sessionFilter.trim() &&
          filteredItems.length === 0 && (
            <li className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-center text-zinc-700 shadow-sm backdrop-blur-md dark:border-zinc-700 dark:bg-white/5 dark:text-zinc-300">
              <div>No entries match this chat session filter.</div>
              <div className="mt-1 text-xs opacity-80">
                Try clearing the filter to see all records.
              </div>
            </li>
          )}
      </ul>

      {/* ⬇️ Render the conflict review modal */}
      {showConflictModal && (
        <ConflictModal
          onClose={() => setShowConflictModal(false)}
          conflicts={conflicts}
          lastConflictAt={lastConflictAt}
          items={conflictItems}
        />
      )}
    </section>
  );
}
