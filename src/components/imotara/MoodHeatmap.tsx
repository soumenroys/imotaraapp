// src/components/imotara/MoodHeatmap.tsx
// Renders a 12-week calendar heatmap of emotion intensity from history.
"use client";

import { useEffect, useState } from "react";

const HISTORY_KEY = "imotara:history:v1";
const WEEKS = 12;
const DAYS = 7;

const EMOTION_COLOR: Record<string, string> = {
  joy: "#34d399",     happy: "#34d399",   happiness: "#34d399",
  sad: "#818cf8",     sadness: "#818cf8", lonely: "#a78bfa",
  angry: "#f87171",   anger: "#f87171",
  stressed: "#fb923c", stress: "#fb923c",
  anxious: "#fbbf24",  anxiety: "#fbbf24", fear: "#fbbf24",
  neutral: "#6b7280",  surprise: "#38bdf8",
};

function getEmotionColor(emotion: string, intensity: number): string {
  const base = EMOTION_COLOR[emotion?.toLowerCase()] ?? "#6b7280";
  const alpha = Math.round(Math.max(0.15, Math.min(1, intensity)) * 255).toString(16).padStart(2, "0");
  return `${base}${alpha}`;
}

type DayData = { date: string; emotion: string; intensity: number; count: number } | null;

export default function MoodHeatmap() {
  const [grid, setGrid] = useState<DayData[][]>([]);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const all: any[] = raw ? JSON.parse(raw) : [];

      // Build day-keyed map
      const dayMap: Record<string, { emotions: string[]; intensities: number[] }> = {};
      for (const r of all) {
        if (r.deleted || !r.createdAt) continue;
        const key = new Date(r.createdAt).toDateString();
        if (!dayMap[key]) dayMap[key] = { emotions: [], intensities: [] };
        if (r.emotion) dayMap[key].emotions.push(r.emotion.toLowerCase());
        if (typeof r.intensity === "number") dayMap[key].intensities.push(r.intensity);
      }

      // Build 12×7 grid ending today
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const totalDays = WEEKS * DAYS;
      const start = new Date(today);
      start.setDate(today.getDate() - totalDays + 1);

      const flat: DayData[] = [];
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = d.toDateString();
        const data = dayMap[key];
        if (!data || data.emotions.length === 0) {
          flat.push(null);
        } else {
          const freq: Record<string, number> = {};
          for (const e of data.emotions) freq[e] = (freq[e] ?? 0) + 1;
          const emotion = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
          const intensity = data.intensities.length
            ? data.intensities.reduce((a, b) => a + b, 0) / data.intensities.length
            : 0.5;
          flat.push({ date: key, emotion, intensity, count: data.emotions.length });
        }
      }

      // Chunk into weeks (columns)
      const weeks: DayData[][] = [];
      for (let w = 0; w < WEEKS; w++) {
        weeks.push(flat.slice(w * DAYS, w * DAYS + DAYS));
      }
      setGrid(weeks);
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }, []);

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-md">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        12-week mood heatmap
      </p>

      {!loaded ? (
        <div className="h-24 skeleton rounded-xl" />
      ) : (
        <div className="relative overflow-x-auto pb-1">
          <div className="flex gap-1">
            {/* Day labels */}
            <div className="flex shrink-0 flex-col gap-1 pr-1">
              {dayLabels.map((d) => (
                <div key={d} className="flex h-4 items-center text-[9px] text-zinc-600">
                  {d}
                </div>
              ))}
            </div>

            {/* Week columns */}
            {grid.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className="h-4 w-4 rounded-sm cursor-default transition-transform hover:scale-125"
                    style={{
                      backgroundColor: day
                        ? getEmotionColor(day.emotion, day.intensity)
                        : "rgba(255,255,255,0.05)",
                    }}
                    onMouseEnter={(e) => {
                      if (!day) return;
                      const rect = (e.target as HTMLElement).getBoundingClientRect();
                      setTooltip({
                        text: `${day.date}: ${day.emotion} (${day.count} entries)`,
                        x: rect.left,
                        y: rect.top,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-xl border border-white/15 bg-black/90 px-3 py-1.5 text-[11px] text-zinc-200 shadow-xl backdrop-blur-sm"
          style={{ left: tooltip.x + 8, top: tooltip.y - 32 }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-2">
        {[
          { label: "Joy",    color: "#34d399" },
          { label: "Sad",    color: "#818cf8" },
          { label: "Anxious",color: "#fbbf24" },
          { label: "Angry",  color: "#f87171" },
          { label: "Stressed",color:"#fb923c" },
        ].map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1 text-[10px] text-zinc-500">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1 text-[10px] text-zinc-500">
          <span className="h-2.5 w-2.5 rounded-sm bg-white/10" />
          No data
        </span>
      </div>
    </div>
  );
}
