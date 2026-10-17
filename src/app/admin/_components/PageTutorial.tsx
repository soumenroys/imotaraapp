"use client";

// A numbered walkthrough at the top of an admin screen.
//
// 🔑 SHARED BY EVERY ADMIN SCREEN. It began under social/ and moved here when
// the rest of the panel needed the same thing. Each screen supplies its own
// steps; the behaviour — open once, remembered per browser, never lost when
// storage throws — is written once.
//
// 🔑 DIFFERENT FROM "HOW THIS WORKS", which explains the IDEA. This is the
// sequence: do this, then this, and here is what you will see. Somebody
// arriving on a screen for the first time wants the second one.
//
// ⚠️ OPEN THE FIRST TIME, SHUT AFTER THAT. A walkthrough that reappears every
// visit becomes the thing you close before you start working, and then nobody
// reads it on the one screen where they needed it.
//
// ⛔ The dismissal is a per-browser convenience, nothing more. It is wrapped in
// try/catch and the panel renders correctly when storage is unavailable — a
// private window, cleared site data, or a browser that throws on access. ⇒ The
// failure mode is "the tutorial shows again", which is harmless.

import { useEffect, useState } from "react";

export type Step = {
  /** What to do, as an instruction. */
  do: string;
  /** What happens, or what to look for. Optional. */
  then?: string;
};

const KEY = "imotara.admin.tutorial.";

export function PageTutorial({
  id,
  title,
  steps,
  footnote,
}: {
  id: string;
  title: string;
  steps: Step[];
  footnote?: string;
}) {
  // ⚠️ Starts CLOSED and opens on mount if nothing is stored. Starting open
  // and closing would flash the panel on every visit for people who dismissed
  // it, which is worse than a beat's delay the first time.
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(KEY + id) === "done";
    } catch {
      // Storage unavailable: show it. Harmless, and better than hiding help.
    }
    setOpen(!dismissed);
    setReady(true);
  }, [id]);

  function remember(next: boolean) {
    setOpen(next);
    try {
      if (next) window.localStorage.removeItem(KEY + id);
      else window.localStorage.setItem(KEY + id, "done");
    } catch {
      // The panel still opens and closes; it just will not be remembered.
    }
  }

  if (!ready) return null;

  return (
    <section className="rounded-xl border border-sky-900/60 bg-sky-950/20">
      <button
        type="button"
        onClick={() => remember(!open)}
        className="flex min-h-11 w-full items-center justify-between px-4 text-left text-sm font-semibold text-sky-100"
      >
        <span>{title}</span>
        <span className="text-xs font-normal text-sky-300/70">{open ? "Hide" : "Show the steps"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-sky-900/60 p-4">
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={s.do} className="flex gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-sky-900/70 text-[11px] font-semibold text-sky-100">
                  {i + 1}
                </span>
                <span className="space-y-0.5">
                  <span className="block text-sm text-zinc-100">{s.do}</span>
                  {s.then && <span className="block text-xs leading-relaxed text-zinc-400">{s.then}</span>}
                </span>
              </li>
            ))}
          </ol>
          {footnote && <p className="text-xs leading-relaxed text-sky-200/80">{footnote}</p>}
          <button
            type="button"
            onClick={() => remember(false)}
            className="min-h-11 text-xs text-sky-300 underline underline-offset-2 hover:text-sky-200"
          >
            Got it — do not show this again
          </button>
        </div>
      )}
    </section>
  );
}
