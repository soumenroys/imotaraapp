'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Plus, Send, Trash2 } from 'lucide-react';
import { useImotaraEngine } from '@/hooks/useImotara';
import EmotionTags from '@/components/imotara/EmotionTags';
import ToneReflection from '@/components/imotara/ToneReflection';

/* ────────────────────────────────────────────────────────────
   Types
────────────────────────────────────────────────────────────── */

type Role = 'user' | 'assistant' | 'system';

type MessageMeta = {
  sentiment?: 'positive' | 'neutral' | 'negative';
  emotions?: string[];
  tones?: string[];
  confidence?: number;
  reflection?: string; // short, generated line
};

type Message = { id: string; role: Role; content: string; createdAt: number; meta?: MessageMeta };
type Thread = { id: string; title: string; createdAt: number; messages: Message[] };

/* ────────────────────────────────────────────────────────────
   Consts & helpers
────────────────────────────────────────────────────────────── */

// bumped version to avoid conflicts with older structure if any
const STORAGE_KEY = 'imotara.chat.v2';
const TOGGLE_KEY = 'imotara.analysis.enabled';

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function prettyDate(ts: number) {
  return new Date(ts).toLocaleString();
}
function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/* ────────────────────────────────────────────────────────────
   Component
────────────────────────────────────────────────────────────── */

export default function ChatClient() {
  const { enrich } = useImotaraEngine();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [analysisEnabled, setAnalysisEnabled] = useState<boolean>(true);

  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Load from localStorage (once)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { threads: Thread[]; activeId?: string | null };
        setThreads(parsed.threads ?? []);
        setActiveId(parsed.activeId ?? parsed.threads?.[0]?.id ?? null);
      } else {
        const seed: Thread = {
          id: uid(),
          title: 'First conversation',
          createdAt: Date.now(),
          messages: [
            {
              id: uid(),
              role: 'assistant',
              content:
                "Hi, I'm Imotara — a quiet companion. This is a local-only demo (no backend). Try sending me a message!",
              createdAt: Date.now(),
            },
          ],
        };
        setThreads([seed]);
        setActiveId(seed.id);
      }
    } catch {
      /* ignore */
    }

    const rawToggle = localStorage.getItem(TOGGLE_KEY);
    if (rawToggle != null) setAnalysisEnabled(rawToggle === 'true');
  }, []);

  // Save threads to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ threads, activeId }));
  }, [threads, activeId]);

  // Save toggle to localStorage
  useEffect(() => {
    localStorage.setItem(TOGGLE_KEY, String(analysisEnabled));
  }, [analysisEnabled]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeId) ?? null,
    [threads, activeId]
  );

  // Auto-scroll when messages change
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [activeThread?.messages.length]);

  // Auto-size composer
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = Math.min(200, el.scrollHeight) + 'px';
  }, [draft]);

  function newThread() {
    const t: Thread = { id: uid(), title: 'New conversation', createdAt: Date.now(), messages: [] };
    setThreads((prev) => [t, ...prev]);
    setActiveId(t.id);
    setDraft('');
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
    if (!text || !activeThread) return;

    // analysis meta (optional based on toggle)
    const meta = analysisEnabled ? enrich(text) : undefined;

    const userMsg: Message = { id: uid(), role: 'user', content: text, createdAt: Date.now(), meta };

    // minimal local assistant reply
    const assistantMsg: Message = analysisEnabled
      ? {
          id: uid(),
          role: 'assistant',
          content:
            meta?.sentiment === 'negative'
              ? "Thanks for opening up. I’m here. Would you like a gentle next step, or just to be heard?"
              : meta?.sentiment === 'positive'
              ? 'Love that spark. Want to unpack what made this feel good so you can repeat it?'
              : 'Got it. Would a quick reflection help, or should we explore options?',
          createdAt: Date.now() + 1,
          meta: { reflection: meta?.reflection },
        }
      : {
          id: uid(),
          role: 'assistant',
          content:
            'Message received. (Analysis is off — turn it on using the toggle in the header to see tags and reflections.)',
          createdAt: Date.now() + 1,
        };

    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id
          ? {
              ...t,
              title:
                t.messages.length === 0
                  ? text.slice(0, 40) + (text.length > 40 ? '…' : '')
                  : t.title,
              messages: [...t.messages, userMsg, assistantMsg],
            }
          : t
      )
    );
    setDraft('');
    setTimeout(() => composerRef.current?.focus(), 0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-0px)] w-full max-w-7xl bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      {/* Sidebar */}
      <aside className="hidden w-72 flex-col border-r border-zinc-200 bg-white/60 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50 sm:flex">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">Conversations</h2>
          <button
            onClick={newThread}
            className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 px-2.5 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
            aria-label="New conversation"
          >
            <Plus className="h-4 w-4" /> New
          </button>
        </div>

        <div className="flex-1 space-y-1 overflow-auto pr-1">
          {threads.length === 0 && (
            <div className="select-none rounded-lg border border-dashed border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800">
              No conversations yet. Create one.
            </div>
          )}
          {threads.map((t) => {
            const isActive = t.id === activeId;
            return (
              <div
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveId(t.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveId(t.id);
                  }
                }}
                className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left ${
                  isActive ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
                    <input
                      className={`w-full truncate bg-transparent text-sm outline-none placeholder:text-zinc-400 ${
                        isActive ? 'font-medium' : ''
                      }`}
                      value={t.id === activeId ? (activeThread?.title ?? '') : t.title}
                      onChange={(e) => t.id === activeId && renameActive(e.target.value)}
                      placeholder="Untitled"
                    />
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{prettyDate(t.createdAt)}</p>
                </div>

                {/* inner delete button (no longer inside a button) */}
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
          })}
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/70 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 opacity-70" />
            <h1 className="truncate text-base font-semibold">{activeThread?.title ?? 'Conversation'}</h1>
          </div>

          {/* Analysis toggle */}
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="select-none">Emotion analysis</span>
            <button
              type="button"
              onClick={() => setAnalysisEnabled((v) => !v)}
              className={cn(
                'relative h-6 w-11 rounded-full border transition',
                analysisEnabled
                  ? 'border-emerald-300 bg-emerald-500/90'
                  : 'border-zinc-300 bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800'
              )}
              aria-pressed={analysisEnabled}
              aria-label="Toggle emotion analysis"
            >
              <span
                className={cn(
                  'absolute top-1/2 h-4 w-4 -translate-y-1/2 transform rounded-full bg-white transition',
                  analysisEnabled ? 'right-1' : 'left-1'
                )}
              />
            </button>
          </label>
        </header>

        {!analysisEnabled && (
          <div className="mx-auto mt-2 w-full max-w-3xl rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300">
            Analysis is off. Messages won’t be processed for sentiment or tags.
          </div>
        )}

        <div ref={listRef} className="flex-1 overflow-auto px-4 py-4 sm:px-6">
          {!activeThread || activeThread.messages.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {activeThread.messages.map((m) => (
                <div key={m.id} className="space-y-2">
                  <Bubble role={m.role} content={m.content} time={m.createdAt} />
                  {/* Show tags/reflection only when enabled and meta exists */}
                  {analysisEnabled && m.role === 'user' && m.meta && (
                    <>
                      <EmotionTags
                        className="mt-1"
                        emotions={m.meta.emotions ?? []}
                        sentiment={m.meta.sentiment ?? 'neutral'}
                        confidence={m.meta.confidence}
                      />
                      <ToneReflection text={m.meta.reflection ?? ''} />
                    </>
                  )}
                  {analysisEnabled && m.role === 'assistant' && m.meta?.reflection && (
                    <ToneReflection text={m.meta.reflection} />
                  )}
                </div>
              ))}
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
            <button
              onClick={sendMessage}
              disabled={!draft.trim() || !activeThread}
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

function Bubble({ role, content, time }: { role: Role; content: string; time: number }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[75%] ${
          isUser
            ? 'bg-zinc-900 text-zinc-100 dark:bg-white dark:text-zinc-900'
            : 'bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100'
        }`}
      >
        <div className="whitespace-pre-wrap">{content}</div>
        <div className={`mt-1 text-[11px] ${isUser ? 'text-zinc-300 dark:text-zinc-500' : 'text-zinc-500'}`}>
          {prettyDate(time)} · {isUser ? 'You' : role === 'assistant' ? 'Imotara' : 'System'}
        </div>
      </div>
    </div>
  );
}
