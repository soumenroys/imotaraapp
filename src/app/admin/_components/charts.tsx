"use client";

// Inline SVG charts for the admin panel.
//
// 🔑 NO CHARTING LIBRARY, which was the Activity page's own decision before
// this and is kept: a dashboard only a handful of people will ever open is not
// worth 80 KB on the bundle, and these shapes are path arithmetic.
//
// ⚠️ Every chart here also states its numbers in text somewhere on the page.
// A chart is a way of seeing a shape faster, never the only copy of a fact —
// an admin reading this on a phone in sunlight needs the number.

import React from "react";

export type Line = { label: string; color: string; points: number[] };

/**
 * A line chart with a grid and end labels.
 *
 * ⚠️ The y-axis starts at zero and always will. A chart that crops the axis to
 * make a 3% wobble look like a cliff is the commonest way a dashboard lies to
 * the person who built it.
 */
export function LineChart({
  lines,
  xFirst,
  xLast,
  height = 160,
}: {
  lines: Line[];
  xFirst?: string;
  xLast?: string;
  height?: number;
}) {
  const w = 720;
  const padX = 8;
  const padY = 10;
  const n = Math.max(...lines.map((l) => l.points.length), 0);
  const max = Math.max(1, ...lines.flatMap((l) => l.points));
  const step = n > 1 ? (w - padX * 2) / (n - 1) : 0;
  const y = (v: number) => height - padY - (v / max) * (height - padY * 2);

  if (n === 0) return <p className="text-sm text-zinc-500">Nothing in this period.</p>;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img"
        aria-label={`${lines.map((l) => l.label).join(" and ")} over time`}>
        {/* Grid — four lines, quietly, so the eye can judge a height */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={padX} x2={w - padX} y1={y(max * f)} y2={y(max * f)}
            stroke="currentColor" className="text-white/8" strokeWidth="1" />
        ))}
        {lines.map((l) => {
          const xy = l.points.map((v, i) => [padX + i * step, y(v)] as const);
          const path = xy.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
          return (
            <g key={l.label}>
              <path d={`${path} L${(padX + (n - 1) * step).toFixed(1)},${height - padY} L${padX},${height - padY} Z`}
                fill={l.color} opacity="0.12" />
              <path d={path} fill="none" stroke={l.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
        <span>{xFirst}</span>
        <span className="flex gap-3">
          {lines.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </span>
        <span>{xLast}</span>
      </div>
      <p className="mt-1 text-[11px] text-zinc-600">Peak {max.toLocaleString()} in a day.</p>
    </div>
  );
}

/**
 * A ring, for a split of a whole.
 *
 * ⚠️ Only ever for parts of ONE total. A ring whose segments do not add up to
 * the thing in the middle is the chart type that most reliably misleads.
 */
export function Donut({
  slices,
  centreLabel,
  centreValue,
}: {
  slices: { label: string; value: number; color: string }[];
  centreLabel: string;
  centreValue: string;
}) {
  const total = slices.reduce((a, b) => a + b.value, 0);
  const r = 54;
  const c = 2 * Math.PI * r;

  if (total === 0) return <p className="text-sm text-zinc-500">Nothing in this period.</p>;

  // ⚠️ Each arc's start is worked out UP FRONT rather than by advancing a
  // counter inside the map. The React Compiler is on for this project and
  // rejects a variable reassigned during render — correctly: a render that
  // mutates as it goes is one that gives a different answer when React replays
  // it, which it is free to do.
  const arcs = slices.map((slice, i) => ({
    slice,
    length: (slice.value / total) * c,
    start: (slices.slice(0, i).reduce((a, b) => a + b.value, 0) / total) * c,
  }));

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-32 w-32 shrink-0" role="img" aria-label={centreLabel}>
        <g transform="rotate(-90 70 70)">
          <circle cx="70" cy="70" r={r} fill="none" stroke="currentColor" className="text-white/8" strokeWidth="16" />
          {arcs.map(({ slice, length, start }) => (
            <circle key={slice.label} cx="70" cy="70" r={r} fill="none" stroke={slice.color} strokeWidth="16"
              strokeDasharray={`${length} ${c - length}`} strokeDashoffset={-start} />
          ))}
        </g>
        <text x="70" y="66" textAnchor="middle" className="fill-zinc-100 text-[18px] font-semibold">{centreValue}</text>
        <text x="70" y="82" textAnchor="middle" className="fill-zinc-500 text-[9px] uppercase tracking-wider">{centreLabel}</text>
      </svg>
      <ul className="min-w-[9rem] space-y-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-zinc-300">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="tabular-nums text-zinc-400">
              {s.value.toLocaleString()}
              <span className="ml-1 text-zinc-600">{Math.round((s.value / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One bar split into parts, for two or three numbers that make a whole. */
export function SplitBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((a, b) => a + b.value, 0);
  if (total === 0) return <p className="text-sm text-zinc-500">Nobody in this period.</p>;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-white/8">
        {parts.map((p) => (
          <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5 text-zinc-300">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
            {p.label}
            <span className="tabular-nums text-zinc-500">
              {p.value.toLocaleString()} · {Math.round((p.value / total) * 100)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The retention curve: of the people who arrived, how many were still there.
 *
 * 🔑 Drawn as a curve because that is the shape people recognise, and the drop
 * from day 1 to day 7 is the part worth seeing rather than reading.
 */
export function RetentionCurve({ points }: { points: { day: string; pct: number | null }[] }) {
  const known = points.filter((p) => p.pct !== null) as { day: string; pct: number }[];
  if (known.length === 0) return <p className="text-sm text-zinc-500">No group is old enough to answer yet.</p>;

  const w = 420, h = 150, padX = 34, padY = 18;
  const step = known.length > 1 ? (w - padX * 2) / (known.length - 1) : 0;
  const y = (v: number) => h - padY - (v / 100) * (h - padY * 2);
  const xy = known.map((p, i) => [padX + i * step, y(p.pct)] as const);
  const path = xy.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-md" role="img" aria-label="Retention curve">
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={padX} x2={w - padX / 2} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-white/8" />
          <text x={padX - 6} y={y(v) + 3} textAnchor="end" className="fill-zinc-600 text-[9px]">{v}%</text>
        </g>
      ))}
      <path d={path} fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {xy.map(([px, py], i) => (
        <g key={known[i].day}>
          <circle cx={px} cy={py} r="4" fill="#818cf8" />
          <text x={px} y={py - 10} textAnchor="middle" className="fill-zinc-300 text-[10px] font-semibold">
            {known[i].pct}%
          </text>
          <text x={px} y={h - 4} textAnchor="middle" className="fill-zinc-500 text-[10px]">{known[i].day}</text>
        </g>
      ))}
    </svg>
  );
}

/**
 * Horizontal bars, for comparing a handful of named things.
 *
 * 🔑 WHY BARS AND NOT A LINE for breakdowns. A line implies an order and a
 * continuity between its points; "by angle" and "by language" have neither.
 * Drawing categories as a line invites somebody to read a slope that does not
 * exist.
 *
 * ⛔ A null value draws NO BAR and prints "—". Rendering it as a zero-width
 * bar would be indistinguishable from a real zero, which is the distinction
 * this whole screen is built on.
 *
 * ⚠️ The scale is the largest value present, and it is SAID, because a bar
 * chart with no axis invites comparison against an imagined hundred.
 */
export function Bars({
  rows,
  unit,
  color = "#818CF8",
}: {
  rows: { label: string; value: number | null; note?: string }[];
  unit?: string;
  color?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value ?? 0));
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[9rem_1fr_4.5rem] items-center gap-2 text-xs">
          <span className="truncate text-zinc-300" title={r.label}>{r.label}</span>
          <span className="h-2 rounded-full bg-white/8">
            {r.value !== null && (
              <span
                className="block h-2 rounded-full"
                style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color }}
              />
            )}
          </span>
          <span className="text-right tabular-nums text-zinc-400">
            {r.value === null ? "—" : r.value.toLocaleString()}
            {r.note && <span className="ml-1 text-zinc-600">{r.note}</span>}
          </span>
        </div>
      ))}
      <p className="pt-1 text-[11px] text-zinc-600">
        Longest bar = {max.toLocaleString()}{unit ? ` ${unit}` : ""}. ⛔ “—” means not measured, not zero.
      </p>
    </div>
  );
}

/**
 * One figure as a share of another — reach inside an audience, say.
 *
 * 🔴 IT HANDLES OVER 100% ON PURPOSE. Reach can exceed followers when people
 * who do not follow the page are shown a post, and that is the single most
 * interesting thing this product's analytics can report. A bar that silently
 * clamped at full would hide exactly the day worth celebrating.
 */
export function Proportion({
  value,
  of,
  label,
  color = "#4ADE80",
}: {
  value: number | null;
  of: number | null;
  label: string;
  color?: string;
}) {
  if (value === null || of === null || of === 0) {
    return <p className="text-xs text-zinc-500">{label}: — (not measured)</p>;
  }
  const pct = (value / of) * 100;
  const over = pct > 100;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-zinc-300">{label}</span>
        <span className="tabular-nums text-zinc-400">
          {value.toLocaleString()} of {of.toLocaleString()} · {pct.toFixed(pct < 10 ? 1 : 0)}%
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-2.5 rounded-full"
          style={{ width: `${Math.min(100, pct)}%`, background: over ? "#38BDF8" : color }}
        />
      </div>
      {over && (
        <p className="text-[11px] text-sky-300">
          ⬆️ Past the whole audience — people who do not follow the page saw this.
        </p>
      )}
    </div>
  );
}
