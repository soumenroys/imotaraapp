"use client";

// The panel that says what the numbers mean and what to do next.
//
// ⚠️ IT SITS ABOVE THE CHARTS ON PURPOSE. The charts were already there and
// the owner could already read them — what was missing was the sentence that
// turns "8 of 37" into "and here is the next thing to look at". Putting the
// interpretation under the evidence makes the reader do the work twice.
//
// ⛔ Each card shows its own working. An insight whose number you cannot see
// is a thing you either believe or ignore, and both are bad.

import { type Insight, type Severity } from "@/lib/admin/insights";

const TONE: Record<Severity, { ring: string; chip: string; word: string }> = {
  act:   { ring: "border-rose-400/30 bg-rose-500/5",      chip: "bg-rose-500/15 text-rose-300",       word: "Worth acting on" },
  watch: { ring: "border-amber-400/25 bg-amber-500/5",    chip: "bg-amber-500/15 text-amber-300",     word: "Worth watching" },
  info:  { ring: "border-white/10 bg-white/5",            chip: "bg-white/10 text-zinc-400",          word: "Context" },
  good:  { ring: "border-emerald-400/25 bg-emerald-500/5",chip: "bg-emerald-500/15 text-emerald-300", word: "Working" },
};

export function Insights({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;
  const needsDoing = insights.filter((i) => i.severity === "act").length;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-200">What this is telling you</h2>
        <p className="text-xs text-zinc-500">
          {needsDoing > 0
            ? `${needsDoing} ${needsDoing === 1 ? "thing is" : "things are"} worth acting on.`
            : "Nothing here needs a decision today."}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {insights.map((i) => {
          const t = TONE[i.severity];
          return (
            <article key={i.id} className={`rounded-2xl border p-4 ${t.ring}`}>
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${t.chip}`}>
                {t.word}
              </span>
              <h3 className="mt-2 text-sm font-semibold leading-snug text-zinc-100">{i.headline}</h3>
              {/* 🔑 The working, so the reader can disagree with the headline. */}
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{i.evidence}</p>
              <p className="mt-2 border-t border-white/8 pt-2 text-xs leading-relaxed text-zinc-300">
                <span className="font-semibold text-zinc-400">Do next: </span>
                {i.action}
              </p>
            </article>
          );
        })}
      </div>

      <p className="text-[11px] leading-relaxed text-zinc-600">
        ⛔ These read the same numbers you can see below — nothing else. usage_events holds no message
        text, no screen and no referrer, so none of this can tell you <em>why</em> somebody did or did not
        come back. Where a cause would be a guess, the card says which narrower number to look at instead.
      </p>
    </section>
  );
}
