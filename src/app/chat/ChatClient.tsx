// src/app/chat/ChatClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Plus, Send, Trash2, Download, Eraser, RefreshCw } from "lucide-react";
import MoodSummaryCard from "@/components/imotara/MoodSummaryCard";
import type { AppMessage } from "@/lib/imotara/useAnalysis";
// ❌ removed: import { syncHistory } from "@/lib/imotara/syncHistory";
import ConflictReviewButton from "@/components/imotara/ConflictReviewButton";

type Role = "user" | "assistant" | "system";
type Message = {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  meta?: unknown;

  // Parity with mobile (optional metadata; UI can render later)
  moodHint?: string;
  source?: "local" | "cloud";
  isSynced?: boolean;
  isPending?: boolean;
};
type Thread = { id: string; title: string; createdAt: number; messages: Message[] };

const STORAGE_KEY = "imotara.chat.v1";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Narrow Message → AppMessage by excluding 'system'
function isAppMessage(m: Message): m is AppMessage {
  return m.role === "user" || m.role === "assistant";
}

/** Client-only date text to avoid SSR/client locale & TZ mismatches (pure via useMemo) */
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

async function fetchRemoteHistory(): Promise<unknown[]> {
  try {
    const res = await fetch("/api/history", { method: "GET" });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object" && Array.isArray((data as { items?: unknown[] }).items)) {
      return (data as { items: unknown[] }).items;
    }
    return [];
  } catch {
    return [];
  }
}

async function persistMergedHistory(merged: unknown): Promise<void> {
  try {
    const mod: Record<string, unknown> = await import("@/lib/imotara/history");
    const setHistory = mod.setHistory as ((items: unknown) => Promise<void> | void) | undefined;
    const saveLocalHistory = mod.saveLocalHistory as
      | ((items: unknown) => Promise<void> | void)
      | undefined;
    const saveHistory = mod.saveHistory as
      | ((items: unknown) => Promise<void> | void)
      | undefined;

    if (typeof setHistory === "function") {
      await setHistory(merged);
      return;
    }
    if (typeof saveLocalHistory === "function") {
      await saveLocalHistory(merged);
      return;
    }
    if (typeof saveHistory === "function") {
      await saveHistory(merged);
      return;
    }
  } catch {
    // ignore
  }
}

/**
 * Local shim for history sync.
 * For now we just pass remote data through unchanged.
 * This keeps Chat sync behavior working without depending on an external
 * syncHistory export that no longer exists.
 */
async function syncHistory(remoteRaw: unknown[]): Promise<unknown> {
  return remoteRaw;
}

export default function ChatClient() {
  // Mount flag for any client-only UI decisions (no SSR mismatch)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize threads/activeId deterministically from localStorage (no setState in effect)
  const [{ initialThreads, initialActiveId }] = useState(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as { threads: Thread[]; activeId?: string | null };
        const t = Array.isArray(parsed.threads) ? parsed.threads : [];
        const a = parsed.activeId ?? (t[0]?.id ?? null);
        return { initialThreads: t, initialActiveId: a };
      }
    } catch {
      // ignore
    }
    // seed if nothing in storage
    const seed: Thread = {
      id: uid(),
      title: "First conversation",
      createdAt: Date.now(),
      messages: [
        {
          id: uid(),
          role: "assistant",
          content:
            "Hi, I'm Imotara — a quiet companion. This is a local-only demo (no backend). Try sending me a message!",
          createdAt: Date.now(),
        },
      ],
    };
    return { initialThreads: [seed], initialActiveId: seed.id };
  });

  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [activeId, setActiveId] = useState<string | null>(initialActiveId);
  const [draft, setDraft] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // --- Sync state ---
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncedCount, setSyncedCount] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Keep activeId valid (runs on client after mount)
  useEffect(() => {
    if (!mounted) return;
    const found = threads.find((t) => t.id === activeId);
    if (!found && threads.length > 0) setActiveId(threads[0].id);
  }, [mounted, threads, activeId]);

  // Persist to localStorage (client only)
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ threads, activeId }));
    } catch {
      // ignore
    }
  }, [mounted, threads, activeId]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeId) ?? null,
    [threads, activeId]
  );

  // Messages prepared for analysis (exclude 'system')
  const appMessages: AppMessage[] = useMemo(() => {
    const msgs = activeThread?.messages ?? [];
    return msgs.filter(isAppMessage);
  }, [activeThread?.messages]);

  // Scroll to bottom when messages change (client only)
  useEffect(() => {
    if (!mounted) return;
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [mounted, activeThread?.messages?.length]);

  // Auto-size composer (client only)
  useEffect(() => {
    if (!mounted) return;
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(200, el.scrollHeight) + "px";
  }, [mounted, draft]);

  // Initial sync (client only)
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

  function newThread() {
    const t: Thread = { id: uid(), title: "New conversation", createdAt: Date.now(), messages: [] };
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
    setThreads((prev) => prev.map((t) => (t.id === activeThread.id ? { ...t, title } : t)));
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    setIsTyping(true);
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

    const userMsg: Message = {
      id: uid(),
      role: "user",
      content: text,
      createdAt: Date.now(),
    };
    const assistantMsg: Message = {
      id: uid(),
      role: "assistant",
      content:
        "I hear you. I’m here with you — take your time. If you’d like, tell me a little more about what’s making it feel this way.",
      createdAt: Date.now() + 1,
    };

    setThreads((prev) =>
      prev.map((t) =>
        t.id === targetId
          ? {
            ...t,
            title:
              t.messages.length === 0
                ? text.slice(0, 40) + (text.length > 40 ? "…" : "")
                : t.title,
            messages: [...t.messages, userMsg, assistantMsg],
          }
          : t
      )
    );
    setIsTyping(false);
    setDraft("");
    setTimeout(() => composerRef.current?.focus(), 0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  /** Clear messages in the current thread */
  function clearChat() {
    if (!activeThread) return;
    if (!confirm("Clear all messages in this conversation?")) return;
    setThreads((prev) =>
      prev.map((t) => (t.id === activeThread.id ? { ...t, messages: [] } : t))
    );
  }

  /** Download all chats as JSON */
  function exportJSON() {
    const blob = new Blob([JSON.stringify({ threads }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `imotara_chat_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-0px)] w-full max-w-7xl bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      {/* Sidebar */}
      <aside className="hidden w-72 flex-col border-r border-zinc-200 bg-white/60 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50 sm:flex">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
            Conversations
          </h2>
          <button
            onClick={newThread}
            className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 px-2.5 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
            aria-label="New conversation"
          >
            <Plus className="h-4 w-4" /> New
          </button>
        </div>

        <div className="flex-1 space-y-1 overflow-auto pr-1">
          {!mounted ? (
            <div
              className="select-none rounded-lg border border-dashed border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800"
              suppressHydrationWarning
            >
              Loading…
            </div>
          ) : threads.length === 0 ? (
            <div className="select-none rounded-lg border border-dashed border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800">
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
                  className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left ${isActive
                    ? "bg-zinc-100 dark:bg-zinc-800"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
                      <input
                        className={`w-full truncate bg-transparent text-sm outline-none placeholder:text-zinc-400 ${isActive ? "font-medium" : ""
                          }`}
                        value={t.id === activeId ? (activeThread?.title ?? "") : t.title}
                        onChange={(e) => t.id === activeId && renameActive(e.target.value)}
                        placeholder="Untitled"
                      />
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
                      <DateText ts={t.createdAt} />
                    </p>
                  </div>
                  <button
                    className="ml-2 hidden rounded-lg p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 group-hover:block"
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
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/70 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 opacity-70" />
            <h1 className="truncate text-base font-semibold">
              <span suppressHydrationWarning>
                {mounted ? (activeThread?.title ?? "Conversation") : ""}
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden text-xs text-zinc-500 sm:block">
              {syncing ? "Syncing…" : lastSyncAt ? `Synced ${syncedCount ?? 0}` : "Not synced yet"}
              {syncError ? ` · ${syncError}` : ""}
            </div>
            <button
              onClick={runSync}
              disabled={syncing}
              className="inline-flex items-center gap-1 rounded-xl border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              title="Sync local ↔ remote history"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> Sync Now
            </button>

            <ConflictReviewButton />

            <button
              onClick={clearChat}
              className="inline-flex items-center gap-1 rounded-xl border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              title="Clear current conversation"
            >
              <Eraser className="h-4 w-4" /> Clear
            </button>
            <button
              onClick={exportJSON}
              className="inline-flex items-center gap-1 rounded-xl border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              title="Download all conversations as JSON"
            >
              <Download className="h-4 w-4" /> Export
            </button>
            <button
              onClick={newThread}
              className="inline-flex items-center gap-1 rounded-2xl border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              <Plus className="h-4 w-4" /> New
            </button>
          </div>
        </header>

        <div ref={listRef} className="flex-1 overflow-auto px-4 py-4 sm:px-6">
          {!mounted ? (
            <div className="mx-auto max-w-3xl">
              <div
                className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700"
                suppressHydrationWarning
              >
                Loading…
              </div>
            </div>
          ) : !activeThread || activeThread.messages.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {/* Mood summary for the last 10 messages (system messages excluded) */}
              <MoodSummaryCard messages={appMessages} windowSize={10} mode="local" />
              {activeThread.messages.map((m) => (
                <Bubble
                  key={m.id}
                  role={m.role}
                  content={m.content}
                  time={m.createdAt}
                  moodHint={(m as any).moodHint}
                  source={(m as any).source}
                  isPending={Boolean((m as any).isPending)}
                />
              ))}
              {isTyping ? (
                <div className="flex justify-start">
                  <div className="max-w-[82%] animate-pulse rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                    Imotara is thinking…
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="border-t border-zinc-200 bg-white/70 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <textarea
              ref={composerRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type your message… (Enter to send, Shift+Enter for newline)"
              rows={1}
              className="max-h-[200px] flex-1 resize-none rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-600"
            />
            {/* Send button */}
            <button
              onClick={sendMessage}
              disabled={!draft.trim()}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
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
      <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <p className="text-base font-medium">Start a conversation</p>
        <p className="mt-1 text-sm text-zinc-500">
          This is a local demo of Imotara’s chat UI. Messages are saved only in your browser.
        </p>
      </div>
    </div>
  );
}

function Bubble({
  role,
  content,
  time,
  moodHint,
  source,
  isPending,
}: {
  role: Role;
  content: string;
  time: number;
  moodHint?: string;
  source?: "local" | "cloud";
  isPending?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[82%] ${isPending
          ? "border border-dashed border-zinc-300 dark:border-zinc-700"
          : ""
          } ${isUser
            ? "bg-zinc-900 text-zinc-100 dark:bg-white dark:text-zinc-900"
            : "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
          }`}
      >
        <div className="whitespace-pre-wrap">{content}</div>
        {moodHint ? (
          <div className="mt-1 inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
            {moodHint}
          </div>
        ) : null}
        <div
          className={`mt-1 text-[11px] opacity-80 ${isUser
            ? "text-zinc-200 dark:text-zinc-400"
            : "text-zinc-500 dark:text-zinc-400"
            }`}
        >
          <DateText ts={time} /> ·{" "}
          {isUser
            ? "You"
            : role === "assistant"
              ? `Imotara${moodHint ? "" : ""}${moodHint ? "" : ""}${
              // Source icon parity with mobile
              (typeof (arguments as any)?.[0]?.source === "string"
                ? (arguments as any)[0].source
                : undefined) === "cloud"
                ? " ☁️"
                : (typeof (arguments as any)?.[0]?.source === "string"
                  ? (arguments as any)[0].source
                  : undefined) === "local"
                  ? " 🌙"
                  : ""
              }`
              : "System"}
        </div>
        <DateText ts={time} /> ·{" "}
        {isUser
          ? `You${isPending ? " · Syncing…" : ""}`
          : role === "assistant"
            ? `Imotara${source === "cloud" ? " ☁️" : source === "local" ? " 🌙" : ""}`
            : "System"}
      </div>
    </div>
  );
}
