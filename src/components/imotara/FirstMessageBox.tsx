// src/components/imotara/FirstMessageBox.tsx — #130 D (11 Nov 2026)
// A message box right on the landing page: say the first thing here, press send, and the
// chat opens with those words already in its box. ⇒ lib/imotara/landingDraft.ts
//
// ⛔ The words never go in the URL — sessionStorage only (read once by the chat page).
// ⛔ Nothing is sent from here: the chat page's own consent screen and send button still apply.
//
// 12 Nov 2026 (owner, option A): the home page had THREE ways in stacked up (this box + three
// openers, the mood row, a big "Start talking"). Now the box is the one way in; on the home page
// the moods sit under it. And the words are kept AS THEY TYPE, so every way into the chat —
// Send, Enter, a mood, the Chat menu — carries them (only Send did, and the rest lost them).
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LANDING_CHAT_URL, LANDING_DRAFT_MAX, LANDING_OPENERS, keepLandingDraft, saveLandingDraft } from "@/lib/imotara/landingDraft";
import { HOME_MOODS } from "@/lib/imotara/homeMoods";
import { tallyFunnel } from "@/lib/analytics/visitTallyClient";
import { gaEvent } from "@/lib/analytics/gaEvent";

export default function FirstMessageBox({ from, openers = true, moods = false }: { from: string; openers?: boolean; moods?: boolean }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const ready = text.trim().length > 0;

  function go() {
    if (!saveLandingDraft(text)) return;
    tallyFunnel("landing_send"); // anonymous count, never the words
    gaEvent("landing_first_message", { from });
    router.push(LANDING_CHAT_URL);
  }

  /** A mood: their own words win if they typed any; otherwise the chat writes the mood's first line in their language. */
  function pickMood(key: string) {
    gaEvent("home_mood", { mood: key });
    if (ready) { go(); return; }
    router.push(`/chat?mood=${key}`);
  }

  function change(v: string) {
    setText(v);
    keepLandingDraft(v);
  }

  return (
    <form
      className="mt-7"
      onSubmit={(e) => { e.preventDefault(); go(); }}
      aria-label="Say the first thing"
    >
      <label htmlFor={`first-message-${from}`} className="text-sm font-medium text-zinc-200">
        What&apos;s on your mind?
      </label>
      <div className="mt-3 flex items-end gap-2 rounded-2xl border border-white/15 bg-white/5 p-2 focus-within:ring-2 focus-within:ring-sky-400/60">
        <textarea
          id={`first-message-${from}`}
          ref={ref}
          rows={2}
          maxLength={LANDING_DRAFT_MAX}
          value={text}
          onChange={(e) => change(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); go(); }
          }}
          placeholder="Type it the way you'd say it…"
          className="min-h-[3rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-base text-zinc-50 placeholder:text-zinc-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!ready}
          className="shrink-0 rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-4 py-2 text-sm font-medium text-white shadow transition hover:brightness-110 disabled:opacity-40"
        >
          Send
        </button>
      </div>
      {openers && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Or start with one of these">
          {LANDING_OPENERS.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => { change(o); ref.current?.focus(); }}
              className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm text-zinc-200 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
            >
              {o}
            </button>
          ))}
        </div>
      )}
      {moods && (
        <div className="mt-4">
          <p className="text-xs text-zinc-400">Or start with how you feel:</p>
          <div className="mt-2 flex flex-wrap gap-2" role="list" aria-label="Pick how you feel to start talking">
            {HOME_MOODS.map((m) => (
              <button
                key={m.key}
                type="button"
                role="listitem"
                onClick={() => pickMood(m.key)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-sm text-zinc-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
              >
                <span aria-hidden="true">{m.emoji}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-zinc-400">Free · no sign-up · you&apos;ll see it in the chat before it&apos;s sent.</p>
    </form>
  );
}
