// src/app/chat/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Download,
  Eraser,
  RefreshCw,
} from "lucide-react";
import MoodSummaryCard from "@/components/imotara/MoodSummaryCard";
import type { AppMessage } from "@/lib/imotara/useAnalysis";
import { syncHistory } from "@/lib/imotara/syncHistoryAdapter";
import ConflictReviewButton from "@/components/imotara/ConflictReviewButton";
// ⬇️ analysis-consent toggle UI
import AnalysisConsentToggle from "@/components/imotara/AnalysisConsentToggle";
// ⬇️ NEW: read current consent mode from shared hook
import { useAnalysisConsent } from "@/hooks/useAnalysisConsent";

// 👇 analysis imports
import type { AnalysisResult } from "@/types/analysis";
import { runLocalAnalysis } from "@/lib/imotara/runLocalAnalysis";
import { runAnalysisWithConsent } from "@/lib/imotara/runAnalysisWithConsent";

// 👇 history import for Chat → History linkage
import { saveSample } from "@/lib/imotara/history";
import type { Emotion } from "@/types/history";

type Role = "user" | "assistant" | "system";
type Message = {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  /** ID of the chat session / thread this message belongs to */
  sessionId?: string;
};
type Thread = {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
};

const STORAGE_KEY = "imotara.chat.v1";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Pure, client-only date text (no setState in effect) */
function DateText({ ts }: { ts: number }) {
  const text = useMemo(() => {
    try {
      const fmt = new Intl.DateTimeFormat("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "UTC",
      });
      return fmt.format(new Date(ts));
    } catch {
      return "";
    }
  }, [ts]);
  return <span suppressHydrationWarning>{text}</span>;
}

function isAppMessage(m: Message): m is AppMessage {
  return m.role === "user" || m.role === "assistant";
}

async function fetchRemoteHistory(): Promise<unknown[]> {
  try {
    const res = await fetch("/api/history", { method: "GET" });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (Array.isArray(data)) return data;
    if (
      data &&
      typeof data === "object" &&
      Array.isArray((data as { items?: unknown[] }).items)
    ) {
      return (data as { items: unknown[] }).items;
    }
    return [];
  } catch {
    return [];
  }
}

async function persistMergedHistory(merged: unknown): Promise<void> {
  try {
    const mod: Record<string, unknown> = await import(
      "@/lib/imotara/history"
    );
    const setHistory = mod.setHistory as
      | ((items: unknown) => Promise<void> | void)
      | undefined;
    const saveLocalHistory = mod.saveLocalHistory as
      | ((items: unknown) => Promise<void> | void)
      | undefined;
    const saveHistory = mod.saveHistory as
      | ((items: unknown) => Promise<void> | void)
      | undefined;

    if (typeof setHistory === "function") return void (await setHistory(merged));
    if (typeof saveLocalHistory === "function")
      return void (await saveLocalHistory(merged));
    if (typeof saveHistory === "function")
      return void (await saveHistory(merged));
  } catch {
    // ignore
  }
}

// 👇 options for emotion-aware logging
type HistoryEmotionOptions = {
  emotion?: Emotion;
  intensity?: number;
};

// 👇 helper to log a user chat message into Emotion History
// Tries to derive emotion & intensity using runLocalAnalysis when opts not provided.
// Falls back safely to neutral / 0.3 if anything is missing.
async function logUserMessageToHistory(
  msg: Message,
  opts?: HistoryEmotionOptions
): Promise<void> {
  try {
    const text = msg.content.trim();
    if (!text) return;

    let emotion: Emotion = opts?.emotion ?? "neutral";
    let intensity: number =
      typeof opts?.intensity === "number" ? opts.intensity : 0.3;

    // If caller didn't specify emotion/intensity, try to infer from local analysis
    if (!opts) {
      try {
        const res = (await runLocalAnalysis([msg] as any, 1)) as any;
        const summary = res?.summary;

        const inferredEmotion =
          summary?.primaryEmotion ??
          summary?.emotion ??
          summary?.tag ??
          null;

        const inferredIntensity =
          typeof summary?.intensity === "number"
            ? summary.intensity
            : null;

        if (inferredEmotion) {
          emotion = inferredEmotion as Emotion;
        }
        if (inferredIntensity !== null) {
          intensity = inferredIntensity;
        }
      } catch (e) {
        console.warn(
          "[imotara] local analysis for history logging failed, using neutral:",
          e
        );
      }
    }

    // Build payload separately and cast to any so we can include
    // the new linking fields without fighting older saveSample typings.
    const payload: any = {
      message: text,
      emotion,
      intensity,
      // keep as "local" to match current RecordSource union
      source: "local",
      createdAt: msg.createdAt,
      updatedAt: msg.createdAt,
      // 🔗 session linkage into EmotionRecord
      sessionId: msg.sessionId,
      messageId: msg.id,
    };

    await saveSample(payload);
  } catch (err) {
    console.error(
      "[imotara] failed to log chat message to history:",
      err
    );
  }
}

export default function ChatPage() {
  const searchParams = useSearchParams();
  const urlSessionId = (searchParams?.get("sessionId") ?? "").trim();
  const urlMessageId = (searchParams?.get("messageId") ?? "").trim();

  // Avoid SSR/client mismatches for localStorage-driven UI
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ✅ Hydration-safe initial state (no Date.now/Math.random on server)
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // ⬇️ NEW: for deep-link scroll + highlight
  const messageTargetRef = useRef<HTMLDivElement | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] =
    useState<string | null>(null);
  const usedMessageIdRef = useRef<string | null>(null);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncedCount, setSyncedCount] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // analysis state
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false); // spinner flag

  // ⬇️ NEW: read current analysis consent mode (shared with EmotionHistory)
  const { mode } = useAnalysisConsent();
  const consentLabel =
    mode === "allow-remote"
      ? "Remote analysis allowed"
      : "On-device only";

  // ✅ Load threads from localStorage or seed AFTER mount (client only)
  useEffect(() => {
    if (!mounted) return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          threads: Thread[];
          activeId?: string | null;
        };
        const t = Array.isArray(parsed.threads) ? parsed.threads : [];
        const a = parsed.activeId ?? (t[0]?.id ?? null);
        setThreads(t);
        setActiveId(a);
        return;
      }
    } catch {
      // ignore parse/storage errors
    }

    // Seed a first conversation if nothing in storage
    const seedId = uid();
    const now = Date.now();
    const seed: Thread = {
      id: seedId,
      title: "First conversation",
      createdAt: now,
      messages: [
        {
          id: uid(),
          role: "assistant",
          content:
            "Hi, I'm Imotara — a quiet companion. This is a local-only demo (no backend). Try sending me a message!",
          createdAt: now,
          sessionId: seedId,
        },
      ],
    };
    setThreads([seed]);
    setActiveId(seedId);
  }, [mounted]);

  // Keep activeId valid after mount
  useEffect(() => {
    if (!mounted) return;
    const found = threads.find((t) => t.id === activeId);
    if (!found && threads.length > 0) setActiveId(threads[0].id);
  }, [mounted, threads, activeId]);

  // Respect sessionId from URL on first mounts/changes
  useEffect(() => {
    if (!mounted) return;
    if (!urlSessionId) return;
    const match = threads.find((t) => t.id === urlSessionId);
    if (match && match.id !== activeId) {
      setActiveId(match.id);
    }
  }, [mounted, urlSessionId, threads, activeId]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeId) ?? null,
    [threads, activeId]
  );

  // ⬇️ NEW: when messageId is present in URL, scroll & highlight that bubble once
  useEffect(() => {
    if (!mounted) return;
    if (!urlMessageId) return;
    if (!activeThread) return;

    // avoid re-running for the same messageId
    if (usedMessageIdRef.current === urlMessageId) return;

    const exists = activeThread.messages.some((m) => m.id === urlMessageId);
    if (!exists) return;

    usedMessageIdRef.current = urlMessageId;
    setHighlightedMessageId(urlMessageId);

    // let the ref settle, then scroll
    setTimeout(() => {
      const el = messageTargetRef.current;
      if (el && listRef.current) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);
  }, [mounted, urlMessageId, activeThread]);

  // ⬇️ NEW: auto-clear highlight after a few seconds
  useEffect(() => {
    if (!highlightedMessageId) return;
    const t = window.setTimeout(() => setHighlightedMessageId(null), 4000);
    return () => window.clearTimeout(t);
  }, [highlightedMessageId]);

  // Persist to localStorage on client
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ threads, activeId })
      );
    } catch {
      // ignore
    }
  }, [mounted, threads, activeId]);

  const appMessages: AppMessage[] = useMemo(() => {
    const msgs = activeThread?.messages ?? [];
    return msgs.filter(isAppMessage);
  }, [activeThread?.messages]);

  // run analysis whenever messages change (console-only, consent-aware)
  useEffect(() => {
    if (!mounted) return;
    const msgs = activeThread?.messages ?? [];
    if (msgs.length === 0) {
      setAnalysis(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await runAnalysisWithConsent(msgs, 10);
        if (!cancelled) {
          setAnalysis(res);
          console.log("[imotara] analysis:", res.summary.headline, res);
        }
      } catch (err) {
        console.error("[imotara] analysis failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mounted, activeThread?.messages]);

  // Scroll on message change (generic bottom scroll)
  useEffect(() => {
    if (!mounted) return;
    if (listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [mounted, activeThread?.messages?.length]);

  // Auto-size composer
  useEffect(() => {
    if (!mounted) return;
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(200, el.scrollHeight) + "px";
  }, [mounted, draft]);

  // Initial sync
  const runSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const remoteRaw = await fetchRemoteHistory();
      const merged = await syncHistory(remoteRaw);
      await persistMergedHistory(merged);
      setSyncedCount(Array.isArray(merged) ? merged.length : null);
      setLastSyncAt(Date.now());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      setSyncError(msg);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (mounted) void runSync();
  }, [mounted, runSync]);

  // manual re-analyze helper
  async function triggerAnalyze() {
    if (!activeThread?.messages?.length) return;
    setAnalyzing(true);
    try {
      const res = await runAnalysisWithConsent(activeThread.messages, 10);
      setAnalysis(res);
      console.log("[imotara] manual analysis:", res.summary.headline, res);
    } catch (err) {
      console.error("[imotara] manual analysis failed:", err);
    } finally {
      setAnalyzing(false);
    }
  }

  function newThread() {
    const t: Thread = {
      id: uid(),
      title: "New conversation",
      createdAt: Date.now(),
      messages: [],
    };
    setThreads((prev) => [t, ...prev]);
    setActiveId(t.id);
    setDraft("");
    setTimeout(() => composerRef.current?.focus(), 0);
  }

  function deleteThread(id: string) {
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (activeId === id) {
      const remaining = threads.filter((t) => t.id !== id);
      setActiveId(remaining[0]?.id ?? null);
    }
  }

  function renameActive(title: string) {
    if (!activeThread) return;
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id ? { ...t, title } : t
      )
    );
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;

    let targetId = activeId;
    if (!targetId) {
      const t: Thread = {
        id: uid(),
        title: "New conversation",
        createdAt: Date.now(),
        messages: [],
      };
      setThreads((prev) => [t, ...prev]);
      setActiveId(t.id);
      targetId = t.id;
    }

    const now = Date.now();

    const userMsg: Message = {
      id: uid(),
      role: "user",
      content: text,
      createdAt: now,
      sessionId: targetId,
    };
    const assistantMsg: Message = {
      id: uid(),
      role: "assistant",
      content:
        "I hear you. In the real app, I'd respond with empathy and context. For now, this is a local preview 😊",
      createdAt: now + 1,
      sessionId: targetId,
    };

    setThreads((prev) =>
      prev.map((t) =>
        t.id === targetId
          ? {
            ...t,
            title:
              t.messages.length === 0
                ? text.slice(0, 40) +
                (text.length > 40 ? "…" : "")
                : t.title,
            messages: [...t.messages, userMsg, assistantMsg],
          }
          : t
      )
    );

    // Fire-and-forget: log this user message into Emotion History.
    void logUserMessageToHistory(userMsg);

    setDraft("");
    setTimeout(() => composerRef.current?.focus(), 0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    if (!activeThread) return;
    if (!confirm("Clear all messages in this conversation?")) return;
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id ? { ...t, messages: [] } : t
      )
    );
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ threads }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `imotara_chat_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-0px)] w-full max-w-7xl px-3 text-zinc-100 sm:px-4">
      {/* Sidebar */}
      <aside className="hidden w-72 flex-col gap-3 p-4 sm:flex imotara-glass-card">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Conversations
          </h2>
          <button
            onClick={newThread}
            className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-100 shadow-sm transition hover:bg-white/10"
            aria-label="New conversation"
          >
            <Plus className="h-4 w-4" /> New
          </button>
        </div>

        {/* NEW: tiny consent indicator in the sidebar */}
        <div className="mb-2 hidden text-[11px] text-zinc-400 sm:block">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-zinc-300 backdrop-blur-sm">
            <span
              className={`h-1.5 w-1.5 rounded-full ${mode === "allow-remote" ? "bg-emerald-400" : "bg-zinc-500"
                }`}
            />
            {consentLabel}
          </span>
        </div>

        <div className="flex-1 space-y-1 overflow-auto pr-1">
          {!mounted ? (
            <div
              className="select-none rounded-xl border border-dashed border-white/20 bg-white/5 p-4 text-sm text-zinc-400"
              suppressHydrationWarning
            >
              Loading…
            </div>
          ) : threads.length === 0 ? (
            <div className="select-none rounded-xl border border-dashed border-white/20 bg-white/5 p-4 text-sm text-zinc-400">
              No conversations yet. Create one.
            </div>
          ) : (
            threads.map((t) => {
              const isActive = t.id === activeId;
              return (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveId(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveId(t.id);
                    }
                  }}
                  className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${isActive
                    ? "bg-white/10 shadow-md"
                    : "hover:bg-white/5"
                    }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 shrink-0 text-zinc-400" />
                      <input
                        className={`w-full truncate bg-transparent text-sm outline-none placeholder:text-zinc-500 ${isActive ? "font-semibold text-zinc-100" : "text-zinc-200"
                          }`}
                        value={
                          t.id === activeId
                            ? activeThread?.title ?? ""
                            : t.title
                        }
                        onChange={(e) =>
                          t.id === activeId &&
                          renameActive(e.target.value)
                        }
                        placeholder="Untitled"
                      />
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
                      <DateText ts={t.createdAt} />
                    </p>
                  </div>
                  <button
                    className="ml-2 hidden rounded-lg p-1 text-zinc-400 hover:bg-white/10 group-hover:block"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteThread(t.id);
                    }}
                    aria-label="Delete"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col">
        {/* HEADER: wrapped in glass card */}
        <header className="sticky top-0 z-10 px-3 pt-3 sm:px-4">
          <div className="imotara-glass-card px-3 py-3">
            <div className="flex flex-col gap-2">
              {/* Row 1: title + sync */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                {/* Left: icon + title */}
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 text-white shadow-[0_10px_30px_rgba(15,23,42,0.8)]">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-50">
                      <span suppressHydrationWarning>
                        {mounted
                          ? activeThread?.title ?? "Conversation"
                          : ""}
                      </span>
                    </p>
                    <p className="text-xs text-zinc-400">
                      Private local preview of Imotara&apos;s chat.
                    </p>
                  </div>
                </div>

                {/* Right: sync status + buttons + consent indicator */}
                <div className="flex flex-wrap items-center justify-start gap-2 text-[11px] sm:justify-end">
                  {/* Sync status chip */}
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2 py-1 text-[11px] text-zinc-200 backdrop-blur-sm">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${syncing
                        ? "bg-amber-400"
                        : syncError
                          ? "bg-red-500"
                          : lastSyncAt
                            ? "bg-emerald-400"
                            : "bg-zinc-500"
                        }`}
                    />
                    {syncing
                      ? "Syncing…"
                      : lastSyncAt
                        ? `Synced ${syncedCount ?? 0}`
                        : "Not synced yet"}
                  </span>
                  {syncError ? (
                    <span className="text-[11px] text-red-400">
                      {syncError}
                    </span>
                  ) : null}

                  {/* Sync button */}
                  <button
                    onClick={runSync}
                    disabled={syncing}
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 shadow-sm transition hover:bg-white/10 disabled:opacity-60"
                    title="Sync local ↔ remote history"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${syncing ? "animate-spin" : ""
                        }`}
                    />
                    Sync now
                  </button>

                  {/* Conflicts entrypoint – now routes to History page */}
                  <Link
                    href="/history"
                    className="inline-flex"
                    title="Open Emotion History to review conflicts"
                  >
                    <ConflictReviewButton />
                  </Link>

                  {/* NEW: tiny read-only consent indicator in header */}
                  <span
                    className={[
                      "hidden sm:inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] backdrop-blur-sm",
                      mode === "allow-remote"
                        ? "border-emerald-300/70 bg-emerald-500/10 text-emerald-200"
                        : "border-zinc-500/70 bg-black/40 text-zinc-300",
                    ].join(" ")}
                    title="Current emotion analysis mode"
                  >
                    <span
                      className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${mode === "allow-remote"
                        ? "bg-emerald-400"
                        : "bg-zinc-500"
                        }`}
                    />
                    {consentLabel}
                  </span>
                </div>
              </div>

              {/* Row 2: analysis + consent + actions */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {/* Left: analysis & consent */}
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-medium text-zinc-400">
                    Emotion analysis mode
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* analysis headline pill */}
                    {analysis?.summary?.headline ? (
                      <span
                        className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-xs text-zinc-100 backdrop-blur-sm"
                        title="Emotion snapshot for this conversation"
                      >
                        {analysis.summary.headline}
                      </span>
                    ) : (
                      <span className="rounded-full border border-dashed border-white/20 bg-black/30 px-2 py-1 text-xs text-zinc-400">
                        No analysis yet
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <AnalysisConsentToggle />
                    <span className="text-[11px] text-zinc-400">
                      {consentLabel}
                    </span>
                  </div>

                  <p className="mt-1 max-w-xs text-[11px] text-zinc-500">
                    Use the toggle to switch between local-only and remote
                    analysis. Your words stay on-device unless you explicitly
                    allow remote.
                  </p>
                </div>

                {/* Right: actions */}
                <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
                  {/* View this session in Emotion History */}
                  <Link
                    href={
                      activeThread
                        ? `/history?sessionId=${encodeURIComponent(
                          activeThread.id
                        )}${urlMessageId
                          ? `&messageId=${encodeURIComponent(
                            urlMessageId
                          )}`
                          : ""
                        }`
                        : "/history"
                    }
                    className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-100 shadow-sm transition hover:bg-white/10 sm:text-sm"
                    title="Open Emotion History filtered to this chat session"
                  >
                    History
                  </Link>

                  {/* Re-analyze button with spinner */}
                  <button
                    onClick={triggerAnalyze}
                    disabled={
                      analyzing || !(activeThread?.messages?.length)
                    }
                    aria-busy={analyzing ? true : undefined}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-100 shadow-sm transition hover:bg-white/10 disabled:opacity-60 sm:text-sm"
                    title="Run emotion analysis now (respects your consent setting)"
                  >
                    {analyzing ? (
                      <RefreshCw className="h-3 w-3 animate-spin sm:h-4 sm:w-4" />
                    ) : null}
                    Re-analyze
                  </button>

                  {/* Clear / Export / New */}
                  <button
                    onClick={clearChat}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-100 shadow-sm transition hover:bg-white/10 disabled:opacity-60 sm:text-sm"
                    title="Clear current conversation"
                  >
                    <Eraser className="h-3 w-3 sm:h-4 sm:w-4" /> Clear
                  </button>
                  <button
                    onClick={exportJSON}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-zinc-100 shadow-sm transition hover:bg-white/10 disabled:opacity-60 sm:text-sm"
                    title="Download all conversations as JSON"
                  >
                    <Download className="h-3 w-3 sm:h-4 sm:w-4" /> Export
                  </button>
                  <button
                    onClick={newThread}
                    className="inline-flex items-center gap-1 rounded-2xl border border-white/15 bg-gradient-to-r from-indigo-500/70 via-sky-500/70 to-emerald-400/80 px-3 py-1.5 text-xs font-medium text-white shadow-md transition hover:brightness-110 sm:text-sm"
                  >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4" /> New
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div
          ref={listRef}
          className="flex-1 overflow-auto px-4 py-4 sm:px-6"
        >
          {!mounted ? (
            <div className="mx-auto max-w-3xl">
              <div
                className="mt-8 rounded-2xl border border-dashed border-white/20 bg-black/30 p-8 text-center text-zinc-400"
                suppressHydrationWarning
              >
                Loading…
              </div>
            </div>
          ) : !activeThread || activeThread.messages.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              <div className="imotara-glass-card p-4">
                <MoodSummaryCard
                  messages={appMessages}
                  windowSize={10}
                  mode="local"
                />
              </div>
              {activeThread.messages.map((m) => (
                <Bubble
                  key={m.id}
                  id={m.id}
                  role={m.role}
                  content={m.content}
                  time={m.createdAt}
                  highlighted={m.id === highlightedMessageId}
                  sessionId={m.sessionId ?? activeThread.id}
                  attachRef={
                    m.id === urlMessageId
                      ? (el) => {
                        if (el) {
                          messageTargetRef.current = el;
                        }
                      }
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 px-3 pb-3 pt-2 sm:px-4">
          {/* NEW: tiny consent mode indicator above composer */}
          <div className="mx-auto mb-1 flex max-w-3xl justify-end">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[11px] text-zinc-200 backdrop-blur-sm">
              <span
                className={`h-1.5 w-1.5 rounded-full ${mode === "allow-remote" ? "bg-emerald-400" : "bg-zinc-500"
                  }`}
              />
              {consentLabel}
            </span>
          </div>

          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <textarea
              ref={composerRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type your message… (Enter to send, Shift+Enter for newline)"
              rows={1}
              className="max-h-[200px] flex-1 resize-none rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-indigo-400/70 focus:ring-1 focus:ring-indigo-500/60"
            />
            <button
              onClick={sendMessage}
              disabled={!draft.trim()}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/15 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-4 text-sm font-medium text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> Send
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mt-8 rounded-2xl border border-dashed border-white/20 bg-black/30 p-8 text-center text-zinc-200">
        <p className="text-base font-medium">Start a conversation</p>
        <p className="mt-1 text-sm text-zinc-400">
          This is a local demo of Imotara’s chat UI. Messages are saved only in
          your browser.
        </p>
      </div>
    </div>
  );
}

function Bubble({
  id,
  role,
  content,
  time,
  highlighted,
  attachRef,
  sessionId,
}: {
  id: string;
  role: Role;
  content: string;
  time: number;
  highlighted?: boolean;
  attachRef?: (el: HTMLDivElement | null) => void;
  sessionId?: string;
}) {
  const isUser = role === "user";

  const bubbleClass = [
    "max-w-[85%] rounded-2xl px-4 py-3 text-sm sm:max-w-[75%] transition-all",
    isUser
      ? "bg-gradient-to-br from-indigo-500/80 via-sky-500/80 to-emerald-400/80 text-white shadow-[0_18px_40px_rgba(15,23,42,0.85)]"
      : "bg-white/10 text-zinc-100 border border-white/15 backdrop-blur-md shadow-md",
    highlighted
      ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-black/40 animate-pulse"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={attachRef}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={bubbleClass}>
        <div className="whitespace-pre-wrap">{content}</div>
        <div
          className={`mt-1 text-[11px] ${isUser ? "text-zinc-100/80" : "text-zinc-300"
            }`}
        >
          <DateText ts={time} /> ·{" "}
          {isUser ? "You" : role === "assistant" ? "Imotara" : "System"}
          {isUser && sessionId ? (
            <>
              {" · "}
              <Link
                href={`/history?sessionId=${encodeURIComponent(
                  sessionId
                )}&messageId=${encodeURIComponent(id)}`}
                className="underline decoration-amber-300/70 underline-offset-2 hover:text-amber-300"
              >
                View in History →
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
