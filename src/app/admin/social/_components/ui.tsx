"use client";

// The shared furniture for the social screens.
//
// 🔴 WHY THIS FILE EXISTS. The first version of these screens explained its
// reasoning in prose beside every control. On the channels page that came to
// ~1,800 words, and the SAME 40-word paragraph appeared NINETEEN TIMES — once
// per language that nobody here reads.
//
// ⚠️ The reasoning was right and the placement was wrong. An explanation that
// cannot be skipped is not thorough, it is noise: it buries the one line that
// changes what somebody does today, and after a week nobody reads any of it.
//
// ⇒ Nothing is deleted. Everything moves either into <Explain>, which folds it
// away behind a question somebody can ask when they want it, or into the code
// comments, where the next person to edit this will actually be reading.

import { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Words a person uses, not the words the database uses
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔑 THE DATABASE'S VOCABULARY IS NOT THE ADMIN'S. "needs_review",
 * "rejected_by_gate" and "pending" are precise and they are not English. Every
 * status is shown as a plain label with its meaning one line below, so nobody
 * has to learn a private dialect to use this.
 */
export const POST_STATUS: Record<string, { label: string; tone: Tone; means: string }> = {
  drafting:         { label: "Being written",    tone: "zinc",   means: "The words are being written now." },
  generating:       { label: "Being written",    tone: "zinc",   means: "The words are being written now." },
  needs_review:     { label: "Waiting for you",  tone: "indigo", means: "Read it, then approve or change it. Nothing happens until you do." },
  approved:         { label: "Ready to go",      tone: "amber",  means: "You approved it. It posts at its time — once a channel is connected." },
  publishing:       { label: "Sending",          tone: "amber",  means: "Going out now." },
  published:        { label: "Posted",           tone: "green",  means: "It is live on the channel." },
  failed:           { label: "Didn't send",      tone: "rose",   means: "The channel refused it. The reason is below." },
  rejected_by_gate: { label: "Blocked",          tone: "rose",   means: "It used a word this product must never use, so it was thrown away and rewritten." },
  skipped:          { label: "Skipped",          tone: "zinc",   means: "You passed on this one. Its subject stays used, so it will not come round again." },
};

export const CHANNEL_STATUS: Record<string, { label: string; tone: Tone; means: string }> = {
  pending:  { label: "Not checked yet", tone: "zinc",  means: "The token is saved. Nothing has asked the platform whether it works." },
  ok:       { label: "Working",         tone: "green", means: "Checked, and the platform accepted it." },
  expiring: { label: "Expires soon",    tone: "amber", means: "Generate a new token before it runs out." },
  dead:     { label: "Needs you",       tone: "rose",  means: "It stopped working. Generate a new token and paste it in." },
};

type Tone = "zinc" | "green" | "amber" | "rose" | "indigo";

const TONES: Record<Tone, string> = {
  zinc:   "border-zinc-700 text-zinc-300",
  green:  "border-emerald-800 bg-emerald-950/40 text-emerald-300",
  amber:  "border-amber-800 bg-amber-950/40 text-amber-300",
  rose:   "border-rose-900 bg-rose-950/40 text-rose-300",
  indigo: "border-indigo-700 bg-indigo-950/50 text-indigo-200",
};

export function Chip({ children, tone = "zinc", title }: { children: React.ReactNode; tone?: Tone; title?: string }) {
  return (
    <span title={title} className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * The reasoning, folded away.
 *
 * ⚠️ A real <details>, not a div with a click handler: it is keyboard
 * reachable, it is findable by the browser's own in-page search even while
 * closed, and it needs no state.
 */
export function Explain({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-[11px] text-zinc-500 underline decoration-dotted underline-offset-2 hover:text-zinc-300">
        {q}
      </summary>
      <div className="mt-2 space-y-2 border-l border-zinc-800 pl-3 text-[11px] leading-relaxed text-zinc-400">
        {children}
      </div>
    </details>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { href: "/admin/social", label: "Today" },
  { href: "/admin/social/schedules", label: "Schedules" },
  { href: "/admin/social/compose", label: "Write a post" },
  { href: "/admin/social/channels", label: "Channels" },
  { href: "/admin/social/languages", label: "Languages" },
];

/**
 * ⚠️ ONE PLACE TO SEE WHERE YOU ARE. The first version had three screens that
 * linked to each other in different ways from different corners, so there was
 * no way to tell what the section even contained without visiting all of it.
 */
export function SocialNav({ here, waiting }: { here: string; waiting?: number }) {
  return (
    <nav className="flex flex-wrap gap-1 rounded-xl border border-zinc-800 bg-zinc-900/40 p-1">
      {TABS.map((t) => (
        <a
          key={t.href}
          href={t.href}
          className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm ${
            here === t.href ? "bg-zinc-800 font-semibold text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {t.label}
          {t.href === "/admin/social" && waiting ? (
            <span className="rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold text-white">{waiting}</span>
          ) : null}
        </a>
      ))}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Five steps, shut by default after the first visit.
 *
 * 🔑 Somebody arriving here has no idea whether this writes posts, schedules
 * them, or publishes them — and the answer is "the first two". That is the one
 * thing worth saying before anything else, so it is said once, here, instead of
 * in a sentence attached to every control.
 */
export function HowItWorks() {
  const [open, setOpen] = useState(false);
  const steps = [
    ["A schedule decides when", "What it writes about, for which channel, in which languages, and at what time."],
    ["It writes a post", "Two hours before the slot, so a draft is ready with time to spare."],
    ["It checks the words", "Against three lists: clinical claims, abuse, and careless language. A hit throws the draft away and writes another."],
    ["It makes the picture", "From your words, in a style that never repeats, with the logo and a QR code."],
    ["You read it and approve", "Nothing reaches a timeline until you do — unless you turn that off, schedule by schedule."],
  ];
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-between px-4 text-left text-sm font-semibold"
      >
        How this works
        <span className="text-xs font-normal text-zinc-500">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <ol className="space-y-3 border-t border-zinc-800 p-4">
          {steps.map(([title, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-zinc-700 text-[11px] text-zinc-400">
                {i + 1}
              </span>
              <span>
                <span className="block text-sm font-medium text-zinc-200">{title}</span>
                <span className="block text-xs leading-relaxed text-zinc-500">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** The page shell, so every screen has the same head and the same nav. */
export function SocialPage({
  here,
  title,
  lede,
  waiting,
  actions,
  children,
}: {
  here: string;
  title: string;
  lede?: string;
  waiting?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-3">
          <a href="/admin" className="text-xs text-zinc-500 hover:text-zinc-300">← Admin</a>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {lede && <p className="max-w-2xl text-sm text-zinc-400">{lede}</p>}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>
        </header>
        <SocialNav here={here} waiting={waiting} />
        {children}
      </div>
    </main>
  );
}
