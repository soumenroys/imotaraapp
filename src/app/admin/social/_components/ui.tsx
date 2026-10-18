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
import { AdminShell, useAdminRole } from "@/app/admin/_components/ui";

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
  approved:         { label: "Ready to go",      tone: "amber",  means: "You approved it. It goes out at its time, on a connected channel — and not at all while posting is paused." },
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

// ⚠️ White-alpha surfaces, the same family the rest of the admin panel uses.
// These were zinc-950/40 fills, which read as a different product beside
// /admin — and zinc backgrounds invert under the consumer light theme, which
// is a trap the admin layout now closes but which there is no reason to court.
const TONES: Record<Tone, string> = {
  zinc:   "border-white/10 bg-white/5 text-zinc-300",
  green:  "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  amber:  "border-amber-500/30 bg-amber-500/10 text-amber-300",
  rose:   "border-rose-500/30 bg-rose-500/10 text-rose-300",
  indigo: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
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
      <summary className="cursor-pointer list-none text-xs text-indigo-400 underline underline-offset-2 hover:text-indigo-300">
        {q}
      </summary>
      <div className="mt-2 space-y-2 border-l border-white/10 pl-3 text-xs leading-relaxed text-zinc-400">
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
  // 🔑 Added 18 Oct. The daily capture was recording figures nothing displayed
  // — a database nobody reads is not analytics.
  { href: "/admin/social/stats", label: "Is it working?" },
];

/**
 * ⚠️ ONE PLACE TO SEE WHERE YOU ARE. The first version had three screens that
 * linked to each other in different ways from different corners, so there was
 * no way to tell what the section even contained without visiting all of it.
 */
export function SocialNav({ here, waiting }: { here: string; waiting?: number }) {
  return (
    <nav aria-label="Social screens" className="flex flex-wrap gap-1 rounded-xl border border-white/8 bg-white/5 p-1">
      {TABS.map((t) => (
        <a
          key={t.href}
          href={t.href}
          className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm ${
            here === t.href ? "bg-white/10 font-semibold text-zinc-100" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
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
    <section className="rounded-2xl border border-white/8 bg-white/5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-between px-4 text-left text-sm font-semibold"
      >
        How this works
        <span className="text-xs font-normal text-zinc-500">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <ol className="space-y-3 border-t border-white/8 p-4">
          {steps.map(([title, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-white/15 text-[11px] text-zinc-400">
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
  const role = useAdminRole();
  return (
    /**
     * 🔴 THIS USED TO PAINT ITS OWN `bg-black/30` FULL-SCREEN BACKGROUND, carry
     * its own header with no Imotara mark, set its title two sizes larger than
     * every other admin screen, and show only a back-link to /admin. Walking
     * from Licences into Social felt like leaving the product, which is
     * precisely what the owner reported.
     *
     * ⇒ The same shell as the rest of the panel, with the five social screens
     * as a SUB-nav underneath the main one. Nothing is lost: Today still shows
     * its waiting count, and the actions slot still takes "New schedule".
     */
    <AdminShell title={title} lede={lede} current="social" role={role} actions={actions}>
      <SocialNav here={here} waiting={waiting} />
      <div className="mt-6 space-y-6">{children}</div>
    </AdminShell>
  );
}
