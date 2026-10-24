"use client";

// The boxes and arrows the admin "how it works" diagrams are drawn with —
// shared by the calling console (voice/CallFlow) and social posting
// (social/_components/PostFlow), so the two read the same way.
//
// Plain HTML boxes, not an SVG drawing: they reflow from a row on a wide screen
// to a column on a phone, and the text stays selectable and translatable.

export type Tone = "gate" | "step" | "wait" | "good" | "stop" | "person";

const TONE: Record<Tone, string> = {
  gate: "border-amber-400/50 bg-amber-500/10",
  step: "border-zinc-600 bg-zinc-900",
  wait: "border-sky-400/40 bg-sky-500/10",
  good: "border-emerald-400/50 bg-emerald-500/10",
  stop: "border-red-400/40 bg-red-500/10",
  person: "border-violet-400/50 bg-violet-500/10",
};

export function Box({ tone = "step", title, children }: { tone?: Tone; title: string; children?: React.ReactNode }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${TONE[tone]}`}>
      <div className="font-semibold">{title}</div>
      {children && <div className="mt-0.5 text-xs leading-relaxed text-zinc-300">{children}</div>}
    </div>
  );
}

/** ↓ on a phone, → beside it on a wide screen. */
export function Arrow({ label, side = false }: { label?: string; side?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-1 text-xs text-zinc-400 ${side ? "md:flex-col" : ""}`} aria-hidden>
      <span className={side ? "md:hidden" : ""}>↓</span>
      {side && <span className="hidden md:inline">→</span>}
      {label && <span>{label}</span>}
    </div>
  );
}

export function Lane({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 space-y-2 rounded-2xl border border-zinc-800 p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-zinc-400">{title}</div>
      {children}
    </div>
  );
}


/** The colour key every diagram ends with. */
export function ToneKey() {
  return (
    <p className="pt-1 text-xs text-zinc-500">
      Colours: <span className="text-amber-300">switch</span> · <span className="text-sky-300">waiting</span> ·{" "}
      <span className="text-emerald-300">goes out / done</span> · <span className="text-red-300">stopped</span> ·{" "}
      <span className="text-violet-300">a person acts</span>
    </p>
  );
}

/** The collapsible frame: open by default, the title hides it. */
export function FlowFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details open className="rounded-2xl border border-zinc-700 p-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="cursor-pointer select-none font-semibold">
        {title} <span className="font-normal text-zinc-400">(click to hide)</span>
      </summary>
      <div className="mt-4 space-y-2 text-sm">{children}</div>
    </details>
  );
}
