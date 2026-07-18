"use client";

// src/app/help/page.tsx
// Public help assistant: ask anything about Imotara, answered from the
// sanitized help knowledge base via /api/help-chat. No sign-in required.

import { useRef, useState } from "react";
import Link from "next/link";

type Turn = { role: "user" | "assistant"; content: string; sources?: string[] };

const SUGGESTIONS = [
  "How do I make Imotara reply in Hindi?",
  "How do I sync my chats to a second phone?",
  "How does my school create an organisation account?",
  "The voice isn't working on my Android phone",
  "How do I cancel my subscription?",
  "How do refunds work in Imotara Connect?",
];

export default function HelpPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function ask(questionRaw: string) {
    const question = questionRaw.trim();
    if (!question || busy) return;
    setError(null);
    setBusy(true);
    setInput("");
    const nextTurns: Turn[] = [...turns, { role: "user", content: question }];
    setTurns(nextTurns);

    try {
      const res = await fetch("/api/help-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history: nextTurns.slice(-6).map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        answer?: string;
        sources?: string[];
        error?: string;
      };
      if (data.ok && data.answer) {
        setTurns((t) => [...t, { role: "assistant", content: data.answer!, sources: data.sources }]);
      } else {
        setError(data.error ?? "Something went wrong — please try again.");
      }
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setBusy(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Imotara Help</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ask anything about using Imotara — accounts, languages, voice, plans, organisations, or
          Imotara Connect. Answers come from the official Imotara help guides.
        </p>
      </header>

      {turns.length === 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void ask(s)}
              className="rounded-full border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 space-y-4">
        {turns.map((turn, i) => (
          <div key={i} className={turn.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                turn.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-sky-600 px-4 py-2.5 text-sm text-white"
                  : "max-w-[85%] rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2.5 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100"
              }
            >
              <p className="whitespace-pre-wrap">{turn.content}</p>
              {turn.role === "assistant" && turn.sources && turn.sources.length > 0 && (
                <p className="mt-2 text-xs text-gray-400">From: {turn.sources.join(" · ")}</p>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2.5 text-sm text-gray-400 dark:bg-gray-800">
              Thinking…
            </div>
          </div>
        )}
        {error && <p className="text-sm text-rose-500">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={600}
          placeholder="Type your question…"
          className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-sky-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-40"
        >
          Ask
        </button>
      </form>

      <footer className="mt-4 text-center text-xs text-gray-400">
        Can&apos;t find your answer? Email{" "}
        <a href="mailto:info@imotara.com" className="underline">
          info@imotara.com
        </a>
        . Imotara is a wellness companion, not a therapy replacement — in a crisis, please use the
        helplines shown in the app or contact local emergency services.{" "}
        <Link href="/guide" className="underline">
          Full guide
        </Link>
      </footer>
    </main>
  );
}
