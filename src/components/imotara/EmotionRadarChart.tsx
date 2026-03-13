// src/components/imotara/EmotionRadarChart.tsx
"use client";

import { useEffect, useState } from "react";

const AXES = [
  { key: "joy",      label: "Joy",     keys: ["joy","happy","happiness"] },
  { key: "calm",     label: "Calm",    keys: ["neutral","calm","content"] },
  { key: "surprise", label: "Surprise",keys: ["surprise","gratitude"] },
  { key: "stress",   label: "Stress",  keys: ["stressed","stress"] },
  { key: "anxiety",  label: "Anxiety", keys: ["anxious","anxiety","fear"] },
  { key: "sadness",  label: "Sadness", keys: ["sad","sadness","lonely","isolation"] },
  { key: "anger",    label: "Anger",   keys: ["angry","anger","disgust"] },
] as const;

const AXIS_COLORS: Record<string, string> = {
  joy:      "#fbbf24",
  calm:     "#34d399",
  surprise: "#f0abfc",
  stress:   "#fb923c",
  anxiety:  "#facc15",
  sadness:  "#38bdf8",
  anger:    "#f87171",
};

type RadarPoint = { key: string; value: number }; // 0..1

function computeRadar(): RadarPoint[] {
  try {
    const raw = localStorage.getItem("imotara:history:v1");
    if (!raw) return AXES.map(a => ({ key: a.key, value: 0 }));

    const all = JSON.parse(raw) as any[];
    const active = all.filter(r => !r.deleted && r.emotion);

    if (!active.length) return AXES.map(a => ({ key: a.key, value: 0 }));

    const counts: Record<string, number> = {};
    for (const r of active) {
      const e = (r.emotion ?? "").toLowerCase();
      for (const ax of AXES) {
        if ((ax.keys as readonly string[]).includes(e)) {
          counts[ax.key] = (counts[ax.key] ?? 0) + 1;
          break;
        }
      }
    }

    const max = Math.max(1, ...Object.values(counts));
    return AXES.map(a => ({ key: a.key, value: (counts[a.key] ?? 0) / max }));
  } catch {
    return AXES.map(a => ({ key: a.key, value: 0 }));
  }
}

// Polar → Cartesian
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function pointsToPath(pts: { x: number; y: number }[]): string {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ") + " Z";
}

export default function EmotionRadarChart() {
  const [data, setData] = useState<RadarPoint[] | null>(null);

  useEffect(() => {
    setData(computeRadar());
  }, []);

  if (!data) return null;

  const hasAny = data.some(d => d.value > 0);
  if (!hasAny) return null;

  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 82;
  const n = AXES.length;
  const step = 360 / n;

  // Ring levels
  const rings = [0.25, 0.5, 0.75, 1.0];

  // Axis endpoints
  const axisPoints = AXES.map((_, i) => polar(cx, cy, maxR, i * step));

  // Data polygon
  const dataPoints = data.map((d, i) => polar(cx, cy, d.value * maxR, i * step));

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 shadow-sm backdrop-blur-md">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        Emotion distribution
      </p>

      <div className="flex items-center justify-center gap-6 flex-wrap">
        {/* SVG Radar */}
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          aria-label="Emotion radar chart"
          className="shrink-0"
        >
          {/* Ring levels */}
          {rings.map((r) => {
            const rpts = AXES.map((_, i) => polar(cx, cy, r * maxR, i * step));
            return (
              <path
                key={r}
                d={pointsToPath(rpts)}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />
            );
          })}

          {/* Axis lines */}
          {axisPoints.map((p, i) => (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth="1"
            />
          ))}

          {/* Data fill */}
          <path
            d={pointsToPath(dataPoints)}
            fill="rgba(99,102,241,0.18)"
            stroke="rgba(99,102,241,0.6)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />

          {/* Data dots */}
          {dataPoints.map((p, i) => (
            data[i].value > 0 && (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={3}
                fill={AXIS_COLORS[data[i].key] ?? "#6366f1"}
              />
            )
          ))}

          {/* Axis labels */}
          {AXES.map((ax, i) => {
            const labelPt = polar(cx, cy, maxR + 14, i * step);
            // Nudge based on quadrant
            const textAnchor =
              labelPt.x < cx - 5 ? "end" : labelPt.x > cx + 5 ? "start" : "middle";
            const dy = labelPt.y < cy - 5 ? -3 : labelPt.y > cy + 5 ? 10 : 5;
            return (
              <text
                key={ax.key}
                x={labelPt.x}
                y={labelPt.y + dy}
                textAnchor={textAnchor}
                fontSize="9"
                fill={AXIS_COLORS[ax.key]}
                fontWeight="500"
                className="font-sans"
              >
                {ax.label}
              </text>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="flex flex-col gap-1.5">
          {data
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 5)
            .map(d => {
              const ax = AXES.find(a => a.key === d.key)!;
              return (
                <div key={d.key} className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ background: AXIS_COLORS[d.key] }}
                  />
                  <span className="text-[11px] capitalize text-zinc-300">{ax.label}</span>
                  <span className="ml-auto text-[10px] text-zinc-500 tabular-nums">
                    {Math.round(d.value * 100)}%
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      <p className="mt-3 text-[10px] text-zinc-600">
        Based on all your logged emotion moments.
      </p>
    </div>
  );
}
