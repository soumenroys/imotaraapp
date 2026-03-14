// src/components/imotara/GlobalSearch.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type ResultKind = "chat" | "history" | "reflection" | "checkin" | "letter";

type SearchResult = {
  id: string;
  kind: ResultKind;
  title: string;
  snippet: string;
  href: string;
  emotion?: string;
};

const KIND_LABEL: Record<ResultKind, string> = {
  chat:       "Chat",
  history:    "History",
  reflection: "Reflect",
  checkin:    "Feel",
  letter:     "Letter",
};

const KIND_EMOJI: Record<ResultKind, string> = {
  chat:       "💬",
  history:    "📖",
  reflection: "🌱",
  checkin:    "😊",
  letter:     "✉️",
};

function excerpt(text: string, query: string, maxLen = 80): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, maxLen);
  const start = Math.max(0, idx - 20);
  const end = Math.min(text.length, idx + query.length + 40);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

function searchStorage(query: string): SearchResult[] {
  if (typeof window === "undefined" || query.trim().length < 2) return [];
  const q = query.trim().toLowerCase();
  const results: SearchResult[] = [];

  // ── Chat threads ──────────────────────────────────────────────────
  try {
    const raw = localStorage.getItem("imotara.chat.v1");
    const threads: any[] = raw ? JSON.parse(raw) : [];
    for (const thread of threads) {
      for (const msg of thread.messages ?? []) {
        if (msg.role !== "user" && msg.role !== "assistant") continue;
        const content: string = msg.content ?? "";
        if (!content.toLowerCase().includes(q)) continue;
        results.push({
          id: `chat-${thread.id}-${msg.id ?? Math.random()}`,
          kind: "chat",
          title: thread.title || "Chat thread",
          snippet: excerpt(content, query),
          href: "/chat",
        });
        if (results.filter((r) => r.kind === "chat").length >= 5) break;
      }
      if (results.filter((r) => r.kind === "chat").length >= 5) break;
    }
  } catch { /* ignore */ }

  // ── History entries ───────────────────────────────────────────────
  try {
    const raw = localStorage.getItem("imotara:history:v1");
    const entries: any[] = raw ? JSON.parse(raw) : [];
    for (const e of entries) {
      const text: string = e.message ?? e.note ?? "";
      const emotion: string = e.emotion ?? "";
      if (!text.toLowerCase().includes(q) && !emotion.toLowerCase().includes(q)) continue;
      const kind: ResultKind = e.entryKind === "checkin" ? "checkin" : "history";
      results.push({
        id: `hist-${e.id ?? Math.random()}`,
        kind,
        title: emotion ? `Feeling ${emotion}` : "Entry",
        snippet: excerpt(text, query),
        href: kind === "checkin" ? "/feel" : "/history",
        emotion,
      });
      if (results.filter((r) => r.kind === "history" || r.kind === "checkin").length >= 6) break;
    }
  } catch { /* ignore */ }

  // ── Reflections (grow page) ────────────────────────────────────────
  try {
    const raw = localStorage.getItem("imotara.reflections.v1");
    const items: any[] = raw ? JSON.parse(raw) : [];
    for (const r of items) {
      const text: string = r.text ?? r.content ?? r.answer ?? "";
      if (!text.toLowerCase().includes(q)) continue;
      results.push({
        id: `refl-${r.id ?? Math.random()}`,
        kind: "reflection",
        title: r.prompt ?? "Reflection",
        snippet: excerpt(text, query),
        href: "/grow",
      });
      if (results.filter((x) => x.kind === "reflection").length >= 4) break;
    }
  } catch { /* ignore */ }

  // ── Future letters ────────────────────────────────────────────────
  try {
    const raw = localStorage.getItem("imotara.futureletters.v1");
    const letters: any[] = raw ? JSON.parse(raw) : [];
    for (const l of letters) {
      const text: string = l.text ?? "";
      if (!text.toLowerCase().includes(q)) continue;
      results.push({
        id: `letter-${l.id ?? Math.random()}`,
        kind: "letter",
        title: "Letter to future self",
        snippet: excerpt(text, query),
        href: "/grow",
      });
      if (results.filter((x) => x.kind === "letter").length >= 3) break;
    }
  } catch { /* ignore */ }

  return results.slice(0, 18);
}

export default function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      setResults(searchStorage(query));
      setActiveIdx(0);
    }, 120);
    return () => clearTimeout(id);
  }, [query]);

  const navigate = useCallback((href: string) => {
    onClose();
    router.push(href);
  }, [onClose, router]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[activeIdx]) navigate(results[activeIdx].href);
    if (e.key === "Escape") onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-lg animate-fade-in overflow-hidden rounded-2xl border border-white/15 bg-zinc-950/95 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <span className="text-zinc-500" aria-hidden>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search your memories, chats, reflections…"
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none"
            aria-label="Search"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="text-zinc-500 hover:text-zinc-300 text-xs transition">
              Clear
            </button>
          )}
          <kbd className="hidden rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-600 sm:block">Esc</kbd>
        </div>

        {/* Results */}
        {query.trim().length >= 2 && (
          <div className="max-h-[60vh] overflow-y-auto py-1">
            {results.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-zinc-500">No results for &ldquo;{query}&rdquo;</p>
            ) : (
              <ul>
                {results.map((r, i) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => navigate(r.href)}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition ${
                        i === activeIdx ? "bg-white/8" : "hover:bg-white/5"
                      }`}
                    >
                      <span className="mt-0.5 shrink-0 text-base" aria-hidden>{KIND_EMOJI[r.kind]}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-zinc-100 truncate">{r.title}</span>
                          <span className="shrink-0 rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                            {KIND_LABEL[r.kind]}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-zinc-500">{r.snippet}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Empty / idle state */}
        {query.trim().length < 2 && (
          <div className="px-4 py-5 text-center text-xs text-zinc-600">
            Type to search chats, history, reflections, and letters
          </div>
        )}

        {/* Footer hint */}
        <div className="border-t border-white/8 px-4 py-2 flex items-center gap-3 text-[10px] text-zinc-700">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span><kbd className="font-mono">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
