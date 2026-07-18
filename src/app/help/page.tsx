"use client";

// src/app/help/page.tsx
// Public help assistant: ask anything about Imotara, answered from the
// sanitized help knowledge base via /api/help-chat. No sign-in required.

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Turn = { role: "user" | "assistant"; content: string; sources?: string[] };

type Category = { id: string; emoji: string; title: string; questions: string[] };

// One category per help doc (src/content/help/*.md), with real, representative
// questions drawn from each doc's actual content — not invented.
const CATEGORIES: Category[] = [
  {
    id: "getting-started",
    emoji: "🌱",
    title: "Getting Started",
    questions: [
      "How do I use Imotara without creating an account?",
      "How do I create an account?",
      "How do I set up my companion's name and personality?",
      "How do breathing exercises work?",
    ],
  },
  {
    id: "languages-and-voice",
    emoji: "🌐",
    title: "Languages & Voice",
    questions: [
      "How do I make Imotara reply in a specific language?",
      "How does read-aloud (voice) work?",
      "The voice isn't working on my Android phone — how do I fix it?",
      "Can I change the voice speed and pitch?",
    ],
  },
  {
    id: "mood-history-insights",
    emoji: "📈",
    title: "Mood, History & Insights",
    questions: [
      "How do mood check-ins work?",
      "How long is my history kept?",
      "What is the Companion's Letter?",
      "How do I write a letter to my future self?",
    ],
  },
  {
    id: "sync-privacy-account",
    emoji: "🔒",
    title: "Sync, Privacy & Account",
    questions: [
      "How do I sync my chats across devices?",
      "What data does Imotara store, and where?",
      "How do I export my data?",
      "How do I delete my account?",
    ],
  },
  {
    id: "plans-and-payments",
    emoji: "💳",
    title: "Plans & Payments",
    questions: [
      "What plans does Imotara offer?",
      "How do I cancel my subscription?",
      "I paid but nothing happened — what do I do?",
      "What are token packs / message credits?",
    ],
  },
  {
    id: "organizations",
    emoji: "🏢",
    title: "Organizations",
    questions: [
      "How do I create an organisation account for my school or NGO?",
      "How do I invite members to my organisation?",
      "How does my organisation's plan get assigned to members?",
      "How do I delete my organisation?",
    ],
  },
  {
    id: "connect",
    emoji: "🤝",
    title: "Imotara Connect",
    questions: [
      "What is Imotara Connect?",
      "How does per-minute billing work in Connect?",
      "How do refunds work in Imotara Connect?",
      "How do I become a companion?",
    ],
  },
  {
    id: "safety-and-crisis",
    emoji: "💙",
    title: "Safety & Crisis Support",
    questions: [
      "Is Imotara a replacement for therapy?",
      "What happens if I'm in crisis?",
      "What crisis helplines are available?",
      "Is Imotara Connect safe to use?",
    ],
  },
  {
    id: "troubleshooting",
    emoji: "🛠️",
    title: "Troubleshooting",
    questions: [
      "I can't sign in — what do I do?",
      "My chats aren't syncing between devices",
      "Voice / read-aloud is silent",
      "The app crashed",
    ],
  },
];

export default function HelpPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(["getting-started"]));
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);

  function toggleCategory(id: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function ask(questionRaw: string) {
    const question = questionRaw.trim();
    if (!question || busy) return;
    setError(null);
    setBusy(true);
    setInput("");
    const nextTurns: Turn[] = [...turns, { role: "user", content: question }];
    setTurns(nextTurns);
    // On narrow screens the tree sits above the chat — bring the chat into view.
    chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

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
    <main className="mx-auto flex w-full max-w-5xl flex-col px-4 py-8 sm:py-10">
      <header className="mb-8 flex flex-col items-center text-center">
        <div className="relative mb-3 h-20 w-20 overflow-hidden rounded-full bg-white shadow-[0_0_40px_rgba(99,102,241,0.35)] sm:h-24 sm:w-24">
          <Image src="/Imotara Soft Glow.png" alt="" fill sizes="96px" className="object-contain p-2" priority />
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">Imotara Help</h1>
        <p className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
          Ask anything about using Imotara — accounts, languages, voice, plans, organisations, or
          Imotara Connect. Answers come from the official Imotara help guides. Browse a category on
          the left, or just type your own question.
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-start">
        {/* Category tree — browse readymade questions */}
        <aside className="w-full flex-shrink-0 lg:w-72">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900/40 lg:sticky lg:top-6">
            <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Browse by topic
            </p>
            <ul>
              {CATEGORIES.map((cat) => {
                const open = openCategories.has(cat.id);
                return (
                  <li key={cat.id} className="mb-0.5">
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      aria-expanded={open}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <span
                        className={`text-xs text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}
                        aria-hidden
                      >
                        ▶
                      </span>
                      <span aria-hidden>{cat.emoji}</span>
                      <span>{cat.title}</span>
                    </button>
                    {open && (
                      <ul className="ml-6 mb-1 space-y-0.5 border-l border-gray-200 pl-3 dark:border-gray-700">
                        {cat.questions.map((q) => (
                          <li key={q}>
                            <button
                              type="button"
                              onClick={() => void ask(q)}
                              className="block w-full rounded-lg px-2 py-1.5 text-left text-xs text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                            >
                              {q}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* Chat panel */}
        <div ref={chatRef} className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 space-y-4">
            {turns.length === 0 && (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-200 px-6 py-10 text-center dark:border-gray-700">
                <span className="text-3xl" aria-hidden>💬</span>
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  Pick a question from a topic on the left, or type your own below.
                </p>
              </div>
            )}
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
        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-gray-400">
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
