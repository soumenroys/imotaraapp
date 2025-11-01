"use client";

import { useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi, I’m Imotara. What would you like to share today?",
    },
  ]);
  const [input, setInput] = useState("");

  function send() {
    if (!input.trim()) return;
    const userMsg: Message = { role: "user", content: input.trim() };

    // Simple reflection logic; will be replaced with API route later
    const reply: Message = {
      role: "assistant",
      content:
        "I hear you. Let’s take a breath together. What feels most important about that?",
    };

    setMessages((m) => [...m, userMsg, reply]);
    setInput("");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col px-6 py-16 text-zinc-900 dark:text-zinc-100">
      <h1 className="text-3xl font-semibold tracking-tight">Chat</h1>

      <div className="mt-6 flex-1 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <div className="h-[50vh] w-full overflow-y-auto bg-white p-4 dark:bg-zinc-950">
          <ul className="space-y-3">
            {messages.map((m, i) => (
              <li
                key={i}
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-6 ${
                  m.role === "user"
                    ? "ml-auto bg-zinc-100 dark:bg-zinc-900"
                    : "bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800"
                }`}
              >
                {m.content}
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type something you’re feeling…"
              className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900"
            />
            <button
              onClick={send}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
        Private by design. Replace this demo logic with your API route later.
      </p>
    </main>
  );
}
