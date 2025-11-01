"use client";

import * as React from "react";
import { useImotaraEngine } from "@/hooks/useImotara";
import EmotionTags from "@/components/imotara/EmotionTags";
import ToneReflection from "@/components/imotara/ToneReflection";

/* ────────────────────────────────────────────────────────────
   Types (kept here so you don't have to refactor right now)
   If you later move them to src/types/chat.ts, just import.
────────────────────────────────────────────────────────────── */

export type MessageRole = "user" | "assistant" | "system";

export type MessageMeta = {
  sentiment?: "positive" | "neutral" | "negative";
  emotions?: string[];
  tones?: string[];
  confidence?: number;
  reflection?: string; // short, generated line
};

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  meta?: MessageMeta;
};

/* ────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ────────────────────────────────────────────────────────────
   Component
────────────────────────────────────────────────────────────── */

export default function Chat() {
  const { enrich } = useImotaraEngine();

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");

  // Optional: basic local persistence (reads once)
  React.useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("imotara.chat.messages") : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as ChatMessage[];
        setMessages(parsed);
      } catch {
        // ignore
      }
    }
  }, []);

  // Optional: basic local persistence (writes on change)
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("imotara.chat.messages", JSON.stringify(messages));
    }
  }, [messages]);

  function handleSend(text: string) {
    const cleaned = text.trim();
    if (!cleaned) return;

    const meta = enrich(cleaned);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: cleaned,
      createdAt: Date.now(),
      meta,
    };

    setMessages((prev) => [...prev, userMsg]);

    // Minimal local assistant simulation (no external calls):
    const assistantReply: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        meta.sentiment === "negative"
          ? "Thanks for opening up. I’m here. Would you like a gentle next step, or just to be heard?"
          : meta.sentiment === "positive"
          ? "Love that spark. Want to unpack what made this feel good so you can repeat it?"
          : "Got it. Would a quick reflection help, or should we explore options?",
      createdAt: Date.now() + 1,
      meta: { reflection: meta.reflection },
    };

    setMessages((prev) => [...prev, assistantReply]);
    setInput("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* Messages list */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-sm text-zinc-500 dark:text-zinc-400">
            <div>
              <div className="text-base font-medium text-zinc-700 dark:text-zinc-300">Welcome to Imotara</div>
              <div className="mt-1">Type a message below to begin. Press <kbd className="rounded border px-1">Enter</kbd> to send.</div>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl">
            {messages.map((m) => (
              <div key={m.id} className="mb-4">
                <div className={m.role === "user" ? "text-right" : "text-left"}>
                  <div
                    className={cn(
                      "inline-block max-w-[75%] rounded-2xl px-4 py-2 align-top",
                      m.role === "user"
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black"
                        : "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                    )}
                  >
                    {m.content}
                  </div>
                </div>

                {/* Emotion tags + reflection for USER messages */}
                {m.role === "user" && m.meta && (
                  <>
                    <EmotionTags
                      className="mt-2"
                      emotions={m.meta.emotions ?? []}
                      sentiment={m.meta.sentiment ?? "neutral"}
                      confidence={m.meta.confidence}
                    />
                    <ToneReflection text={m.meta.reflection ?? ""} />
                  </>
                )}

                {/* Reflection panel for ASSISTANT if present */}
                {m.role === "assistant" && m.meta?.reflection && (
                  <div className="mt-2">
                    <ToneReflection text={m.meta.reflection} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-black">
        <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
          <textarea
            className="min-h-[44px] w-full flex-1 resize-none rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none ring-0 focus:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500"
            placeholder="Type your message…"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            onClick={() => handleSend(input)}
            className="inline-flex h-[44px] items-center justify-center rounded-xl border border-zinc-200 px-4 text-sm font-medium text-zinc-900 transition active:scale-[0.99] disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-100"
            disabled={!input.trim()}
            type="button"
            aria-label="Send message"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
