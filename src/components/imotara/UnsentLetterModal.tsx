// src/components/imotara/UnsentLetterModal.tsx
// P4 — Unsent Letter / Shadow Voice: user writes a letter to someone they
// can't or won't send to; Imotara responds in that recipient's voice.

"use client";

import { useState } from "react";
import { X, Pencil } from "lucide-react";

export type UnsentLetterSetup = {
  recipientName: string;
  relationship: string;
  context: string;
};

export function buildUnsentLetterSystemPrompt(setup: UnsentLetterSetup): string {
  return [
    `You are now responding AS ${setup.recipientName}, the user's ${setup.relationship}.`,
    setup.context ? `Context about this person and relationship: ${setup.context}` : "",
    `The user has written you a letter. Respond in first person as ${setup.recipientName}.`,
    `Draw on everything the user has shared in their message about your relationship.`,
    `Be emotionally honest, warm, and human. Do NOT break character or refer to yourself as an AI.`,
    `Your response is what ${setup.recipientName} might truly have said — with the love, pain, regret, or pride they carried.`,
    `Keep your response to 2–4 paragraphs. No greetings like "Dear..." — just speak directly.`,
  ].filter(Boolean).join(" ");
}

const RELATIONSHIP_OPTIONS = [
  "parent", "sibling", "partner", "ex-partner", "friend",
  "colleague", "child", "past self", "future self", "other",
];

type Props = {
  visible: boolean;
  onStart: (setup: UnsentLetterSetup) => void;
  onCancel: () => void;
};

export default function UnsentLetterModal({ visible, onStart, onCancel }: Props) {
  const [recipientName, setRecipientName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [context, setContext] = useState("");

  if (!visible) return null;

  function handleStart() {
    if (!recipientName.trim()) return;
    onStart({
      recipientName: recipientName.trim(),
      relationship: relationship || "someone close",
      context: context.trim(),
    });
    setRecipientName("");
    setRelationship("");
    setContext("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-lg rounded-t-2xl border border-white/10 bg-slate-950 p-6 sm:rounded-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center gap-2">
          <Pencil className="h-4 w-4 text-violet-400" />
          <h2 className="text-base font-semibold text-zinc-100">Write an unsent letter</h2>
          <button onClick={onCancel} className="ml-auto text-zinc-500 hover:text-zinc-300 transition">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-5 text-xs leading-relaxed text-zinc-500">
          Write to someone you can't or won't send to. Imotara will respond in their voice.{" "}
          Stored locally — never synced unless you choose to.
        </p>

        {/* Recipient */}
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Who is this letter to?
        </label>
        <input
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          placeholder="e.g. Mom, my younger self, Alex..."
          className="mb-4 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20"
        />

        {/* Relationship chips */}
        <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Relationship
        </label>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {RELATIONSHIP_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRelationship(r)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                relationship === r
                  ? "border-violet-500/50 bg-violet-500/15 text-violet-300"
                  : "border-white/10 bg-white/5 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Context */}
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Any context? (optional)
        </label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="e.g. They passed away last year. We never got to say goodbye."
          rows={2}
          className="mb-5 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20"
        />

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={!recipientName.trim()}
          className="w-full rounded-xl border border-violet-500/40 bg-violet-500/15 py-3 text-sm font-semibold text-violet-300 transition hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Begin writing
        </button>
      </div>
    </div>
  );
}
