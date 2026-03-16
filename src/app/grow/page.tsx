// src/app/grow/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Download, Pencil, Check } from "lucide-react";
import Toast, { type ToastType } from "@/components/imotara/Toast";
import SkeletonLoader from "@/components/imotara/SkeletonLoader";

// ── Storage ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = "imotara.reflections.v1";
const HISTORY_KEY = "imotara:history:v1";
const FUTURE_LETTERS_KEY = "imotara.futureletters.v1";

// ── Future Letter ─────────────────────────────────────────────────────────────
type FutureLetter = {
  id: string;
  body: string;
  createdAt: number;
  unlockAt: number;
  unlocked: boolean;
};

function loadFutureLetters(): FutureLetter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FUTURE_LETTERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveFutureLetters(letters: FutureLetter[]) {
  try { window.localStorage.setItem(FUTURE_LETTERS_KEY, JSON.stringify(letters)); } catch { /* ignore */ }
}

function FutureLetterSection({ showToast }: { showToast: (msg: string, type?: any) => void }) {
  const [letters, setLetters] = useState<FutureLetter[]>([]);
  const [body, setBody] = useState("");
  const [days, setDays] = useState(30);
  const [showForm, setShowForm] = useState(false);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  // Capture render-time timestamp before any early return (hooks must be unconditional)
  const now = useMemo(() => Date.now(), []);

  useEffect(() => {
    setLetters(loadFutureLetters());
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Mark any newly unlocked letters
  const lettersWithStatus = letters.map((l) => ({
    ...l,
    unlocked: l.unlocked || l.unlockAt <= now,
  }));

  function saveLetter() {
    const text = body.trim();
    if (!text) return;
    const letter: FutureLetter = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      body: text,
      createdAt: now,
      unlockAt: now + days * 86_400_000,
      unlocked: false,
    };
    const updated = [letter, ...letters];
    setLetters(updated);
    saveFutureLetters(updated);
    setBody("");
    setShowForm(false);
    showToast(`Letter sealed — unlocks in ${days} day${days !== 1 ? "s" : ""} ✓`);
  }

  function deleteLetter(id: string) {
    const updated = letters.filter((l) => l.id !== id);
    setLetters(updated);
    saveFutureLetters(updated);
    showToast("Letter deleted", "info");
  }

  const unlocked = lettersWithStatus.filter((l) => l.unlocked);
  const locked = lettersWithStatus.filter((l) => !l.unlocked);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 shadow-sm backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Letter to future self</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Write a note that unlocks on a future date.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-zinc-300 transition hover:bg-white/10"
        >
          {showForm ? "Cancel" : "+ Write"}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 space-y-3 animate-fade-in">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Dear future me…"
            className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-white/25 focus:ring-1 focus:ring-white/10"
          />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-zinc-500">Unlock in</label>
              {[7, 30, 90, 180, 365].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={`rounded-full px-2.5 py-1 text-[10px] transition ${
                    days === d
                      ? "bg-indigo-500/40 text-indigo-200 border border-indigo-400/40"
                      : "border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                  }`}
                >
                  {d === 365 ? "1 yr" : `${d}d`}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={saveLetter}
              disabled={!body.trim()}
              className="ml-auto rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 px-4 py-1.5 text-xs font-medium text-black shadow transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Seal letter
            </button>
          </div>
        </div>
      )}

      {/* Unlocked letters — revealed with animation */}
      {unlocked.length > 0 && (
        <div className="mb-3 space-y-2">
          {unlocked.map((l) => (
            <div key={l.id} className="rounded-xl border border-emerald-400/25 bg-emerald-500/8 p-3">
              <p className="mb-1 text-[10px] font-semibold text-emerald-400">
                ✉ Unlocked · written {Math.round((now - l.createdAt) / 86_400_000)} days ago
              </p>
              {revealedId === l.id ? (
                <div className="animate-fade-in">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-100">{l.body}</p>
                  <button
                    type="button"
                    onClick={() => deleteLetter(l.id)}
                    className="mt-2 text-[10px] text-zinc-600 hover:text-red-400 transition"
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setRevealedId(l.id)}
                  className="text-xs text-indigo-400 underline underline-offset-2 hover:text-indigo-300 transition"
                >
                  Open letter →
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Locked letters */}
      {locked.length > 0 && (
        <div className="space-y-1.5">
          {locked.map((l) => {
            const daysLeft = Math.ceil((l.unlockAt - now) / 86_400_000);
            return (
              <div key={l.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div>
                  <p className="text-[11px] text-zinc-300">🔒 Sealed letter</p>
                  <p className="text-[10px] text-zinc-600">Unlocks in {daysLeft} day{daysLeft !== 1 ? "s" : ""}</p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteLetter(l.id)}
                  className="text-[10px] text-zinc-600 hover:text-red-400 transition"
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}

      {letters.length === 0 && !showForm && (
        <p className="text-[11px] text-zinc-600 italic">No letters yet — write one now.</p>
      )}
    </div>
  );
}

type ReflectionEntry = {
  id: string;
  prompt: string;
  response: string;
  createdAt: number;
};

function loadEntries(): ReflectionEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: ReflectionEntry[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore quota errors
  }
}

// ── Emotional arc ─────────────────────────────────────────────────────────────

type EmotionArc = {
  dominantEmotion: string | null;
  weekEmotions: string[]; // last 7 days, one per day (or "" if no data)
  trend: "lighter" | "heavier" | "steady" | null;
};

const EMOTION_EMOJI: Record<string, string> = {
  joy: "😊", happy: "😊", happiness: "😊",
  sad: "😔", sadness: "😔", lonely: "🌧️",
  angry: "😤", anger: "😤", frustrated: "😤",
  stressed: "😰", stress: "😰",
  anxious: "😟", anxiety: "😟", fear: "😟",
  neutral: "😐",
  surprise: "😮",
};

function emotionEmoji(e: string): string {
  const k = e.toLowerCase().trim();
  return EMOTION_EMOJI[k] ?? "💭";
}

// Human-readable label for canonical emotion names (e.g. "sadness" → "Sad")
const EMOTION_LABEL: Record<string, string> = {
  joy: "Joyful", happy: "Happy", happiness: "Happy",
  sad: "Sad", sadness: "Sad",
  angry: "Frustrated", anger: "Frustrated",
  stressed: "Stressed", stress: "Stressed",
  anxious: "Anxious", anxiety: "Anxious",
  fear: "Worried",
  lonely: "Lonely",
  hopeful: "Hopeful",
  confused: "Confused",
  neutral: "Neutral",
};

function emotionLabel(e: string): string {
  return EMOTION_LABEL[e.toLowerCase().trim()] ?? (e.charAt(0).toUpperCase() + e.slice(1).toLowerCase());
}

function loadEmotionArc(): EmotionArc {
  if (typeof window === "undefined") return { dominantEmotion: null, weekEmotions: [], trend: null };
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return { dominantEmotion: null, weekEmotions: [], trend: null };
    const all = JSON.parse(raw) as any[];
    if (!Array.isArray(all) || !all.length) return { dominantEmotion: null, weekEmotions: [], trend: null };

    const now = Date.now();
    const dayMs = 86_400_000;
    const relevant = all.filter((r) => !r.deleted && r.emotion && r.emotion !== "neutral");

    // Last 7 days: pick the most frequent emotion per day
    const weekEmotions: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = now - (i + 1) * dayMs;
      const dayEnd = now - i * dayMs;
      const dayRecords = relevant.filter((r) => {
        const ts = r.createdAt ?? 0;
        return ts >= dayStart && ts < dayEnd;
      });
      if (!dayRecords.length) {
        weekEmotions.push("");
        continue;
      }
      const freq: Record<string, number> = {};
      for (const r of dayRecords) freq[r.emotion] = (freq[r.emotion] ?? 0) + 1;
      const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
      weekEmotions.push(top);
    }

    // Dominant emotion over last 7 days
    const last7 = relevant.filter((r) => (r.createdAt ?? 0) >= now - 7 * dayMs);
    let dominantEmotion: string | null = null;
    if (last7.length) {
      const freq: Record<string, number> = {};
      for (const r of last7) freq[r.emotion] = (freq[r.emotion] ?? 0) + 1;
      dominantEmotion = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
    }

    // Trend: compare avg intensity of last 3 days vs days 4–7
    const last3 = relevant.filter((r) => (r.createdAt ?? 0) >= now - 3 * dayMs);
    const prev4 = relevant.filter((r) => {
      const ts = r.createdAt ?? 0;
      return ts >= now - 7 * dayMs && ts < now - 3 * dayMs;
    });
    let trend: EmotionArc["trend"] = null;
    if (last3.length >= 2 && prev4.length >= 2) {
      const avg = (arr: any[]) => arr.reduce((s, r) => s + (r.intensity ?? 0.5), 0) / arr.length;
      const diff = avg(last3) - avg(prev4);
      if (diff < -0.08) trend = "lighter";
      else if (diff > 0.08) trend = "heavier";
      else trend = "steady";
    }

    return { dominantEmotion, weekEmotions, trend };
  } catch {
    return { dominantEmotion: null, weekEmotions: [], trend: null };
  }
}

// ── Emotion analytics (heatmap + radar) ───────────────────────────────────────

type EmotionBucket = "joy" | "hopeful" | "sadness" | "stressed" | "anger" | "confused" | "neutral";

const EMOTION_BUCKET_MAP: Record<string, EmotionBucket> = {
  joy: "joy", happy: "joy", happiness: "joy",
  hopeful: "hopeful", grateful: "hopeful", gratitude: "hopeful",
  sad: "sadness", sadness: "sadness", lonely: "sadness",
  stressed: "stressed", stress: "stressed",
  anxious: "stressed", anxiety: "stressed", fear: "stressed",
  angry: "anger", anger: "anger", frustrated: "anger",
  confused: "confused",
  neutral: "neutral",
};

const EMOTION_BUCKET_META: Record<EmotionBucket, { color: string; label: string; emoji: string }> = {
  joy:      { color: "rgba(250,204,21,0.85)",  label: "Joy",      emoji: "😄" },
  hopeful:  { color: "rgba(5,150,105,0.75)",   label: "Hopeful",  emoji: "💚" },
  sadness:  { color: "rgba(37,99,235,0.75)",   label: "Sad",      emoji: "💙" },
  stressed: { color: "rgba(202,138,4,0.75)",   label: "Stressed", emoji: "💛" },
  anger:    { color: "rgba(220,38,38,0.75)",   label: "Angry",    emoji: "❤️" },
  confused: { color: "rgba(124,58,237,0.75)",  label: "Confused", emoji: "🟣" },
  neutral:  { color: "rgba(100,116,139,0.35)", label: "Neutral",  emoji: "⚪" },
};

type HeatmapCell = { dateKey: string; dominant: EmotionBucket; count: number };

type AnalyticsData = {
  heatmapWeeks: HeatmapCell[][];
  radarFreq: Partial<Record<EmotionBucket, number>>;
  radarMax: number;
};

function toBucketDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toEmotionBucket(raw: string): EmotionBucket {
  return EMOTION_BUCKET_MAP[raw.toLowerCase().trim()] ?? "neutral";
}

function loadAnalyticsData(): AnalyticsData {
  const empty: AnalyticsData = { heatmapWeeks: [], radarFreq: {}, radarMax: 1 };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return empty;
    const all = JSON.parse(raw) as any[];
    if (!Array.isArray(all)) return empty;

    const relevant = all.filter((r) => !r.deleted && r.emotion);
    const now = Date.now();
    const dayMs = 86_400_000;

    // ── Heatmap: 12 weeks (Mon-aligned, newest row last) ─────────────────────
    const byDay: Record<string, EmotionBucket[]> = {};
    for (const r of relevant) {
      const key = toBucketDateKey(r.createdAt ?? 0);
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(toEmotionBucket(r.emotion));
    }

    const NUM_WEEKS = 12;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDow = (today.getDay() + 6) % 7; // Mon=0
    const totalDays = NUM_WEEKS * 7;

    const cells: HeatmapCell[] = [];
    for (let i = totalDays - 1 - todayDow; i >= -todayDow; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = toBucketDateKey(d.getTime());
      const emotions = byDay[key] ?? [];
      const freq: Partial<Record<EmotionBucket, number>> = {};
      for (const e of emotions) freq[e] = (freq[e] ?? 0) + 1;
      const dominant = (
        Object.entries(freq).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] ?? "neutral"
      ) as EmotionBucket;
      cells.push({ dateKey: key, dominant, count: emotions.length });
    }
    const heatmapWeeks: HeatmapCell[][] = [];
    for (let w = 0; w < NUM_WEEKS; w++) heatmapWeeks.push(cells.slice(w * 7, w * 7 + 7));

    // ── Radar: last 7 days ────────────────────────────────────────────────────
    const last7 = relevant.filter((r) => (r.createdAt ?? 0) >= now - 7 * dayMs);
    const radarFreq: Partial<Record<EmotionBucket, number>> = {};
    for (const r of last7) {
      const b = toEmotionBucket(r.emotion);
      if (b !== "neutral") radarFreq[b] = (radarFreq[b] ?? 0) + 1;
    }
    const radarMax = Math.max(1, ...Object.values(radarFreq).map((v) => v ?? 0));

    return { heatmapWeeks, radarFreq, radarMax };
  } catch {
    return empty;
  }
}

// ── 12-week heatmap component ─────────────────────────────────────────────────
function MoodHeatmap({ weeks }: { weeks: HeatmapCell[][] }) {
  const hasData = weeks.some((w) => w.some((c) => c.count > 0));
  if (!hasData) return null;

  const maxCount = Math.max(1, ...weeks.flatMap((w) => w.map((c) => c.count)));

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 shadow-sm backdrop-blur-md">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        12-Week Mood Map
      </p>
      <div className="overflow-x-auto">
        {/* Day-of-week labels */}
        <div className="mb-1 flex gap-[3px]">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div key={i} className="w-[15px] shrink-0 text-center text-[8px] text-zinc-600">{d}</div>
          ))}
        </div>
        {/* Grid rows */}
        <div className="flex flex-col gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex gap-[3px]">
              {week.map((cell, di) => {
                const meta = EMOTION_BUCKET_META[cell.dominant];
                const opacity = cell.count === 0
                  ? 0
                  : Math.min(0.95, 0.28 + (cell.count / maxCount) * 0.67);
                const bg = cell.count === 0
                  ? "rgba(100,116,139,0.10)"
                  : meta.color.replace(/[\d.]+\)$/, `${opacity})`);
                return (
                  <div
                    key={di}
                    title={cell.count > 0 ? `${cell.dateKey}: ${meta.label} (${cell.count})` : cell.dateKey}
                    className="h-[15px] w-[15px] shrink-0 rounded-[3px] transition-opacity"
                    style={{ backgroundColor: bg }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {(["sadness", "stressed", "anger", "confused", "hopeful", "joy"] as EmotionBucket[]).map((e) => (
            <div key={e} className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: EMOTION_BUCKET_META[e].color }} />
              <span className="text-[8px] text-zinc-500">{EMOTION_BUCKET_META[e].label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Emotion radar chart (SVG) ─────────────────────────────────────────────────
const RADAR_AXES_WEB: { key: EmotionBucket; label: string; angleDeg: number }[] = [
  { key: "joy",      label: "Joy",      angleDeg: -90  },
  { key: "hopeful",  label: "Hopeful",  angleDeg: -30  },
  { key: "sadness",  label: "Sad",      angleDeg:  30  },
  { key: "stressed", label: "Stressed", angleDeg:  90  },
  { key: "anger",    label: "Angry",    angleDeg:  150 },
  { key: "confused", label: "Confused", angleDeg: -150 },
];

function EmotionRadarChart({
  radarFreq,
  radarMax,
}: {
  radarFreq: Partial<Record<EmotionBucket, number>>;
  radarMax: number;
}) {
  const hasData = Object.values(radarFreq).some((v) => (v ?? 0) > 0);
  if (!hasData) return null;

  const SIZE = 200;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const MAX_R = 70;

  const rad = (deg: number) => (deg * Math.PI) / 180;
  const toXY = (angleDeg: number, r: number) => ({
    x: CX + r * Math.cos(rad(angleDeg)),
    y: CY + r * Math.sin(rad(angleDeg)),
  });

  const dataPoints = RADAR_AXES_WEB.map(({ key, angleDeg }) => {
    const count = radarFreq[key] ?? 0;
    const v = Math.max(0.07, radarMax > 0 ? Math.min(1, count / radarMax) : 0.07);
    return { ...toXY(angleDeg, MAX_R * v), key };
  });

  const spokeEnds = RADAR_AXES_WEB.map(({ angleDeg }) => toXY(angleDeg, MAX_R));
  const polygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 shadow-sm backdrop-blur-md">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        Emotion Radar
      </p>
      <p className="mb-3 text-[10px] text-zinc-600">How your emotions spread this week</p>
      <div className="flex justify-center">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Concentric rings */}
          {[0.33, 0.66, 1.0].map((r, i) => (
            <circle key={i} cx={CX} cy={CY} r={MAX_R * r} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth={1} />
          ))}
          {/* Spokes */}
          {spokeEnds.map((end, i) => (
            <line key={i} x1={CX} y1={CY} x2={end.x} y2={end.y} stroke="rgba(148,163,184,0.18)" strokeWidth={1} />
          ))}
          {/* Data polygon */}
          <polygon
            points={polygonPoints}
            fill="rgba(99,102,241,0.12)"
            stroke="rgba(99,102,241,0.65)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          {/* Data dots */}
          {dataPoints.map((pt, i) => {
            const meta = EMOTION_BUCKET_META[pt.key];
            return (
              <circle key={i} cx={pt.x} cy={pt.y} r={4} fill={meta.color} stroke="white" strokeWidth={1.5} />
            );
          })}
          {/* Axis labels */}
          {RADAR_AXES_WEB.map(({ key, label, angleDeg }, i) => {
            const pos = toXY(angleDeg, MAX_R + 17);
            const meta = EMOTION_BUCKET_META[key];
            return (
              <text
                key={i}
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={9}
                fill="rgba(161,161,170,0.9)"
              >
                {meta.emoji} {label}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Quick emotion check-in ────────────────────────────────────────────────────

const FEEL_BUTTONS_WEB: {
  emotion: EmotionBucket;
  apiEmotion: string;
  emoji: string;
  label: string;
}[] = [
  { emotion: "joy",      apiEmotion: "joy",      emoji: "😄", label: "Joy" },
  { emotion: "hopeful",  apiEmotion: "hopeful",  emoji: "💚", label: "Hopeful" },
  { emotion: "hopeful",  apiEmotion: "grateful", emoji: "🙏", label: "Grateful" },
  { emotion: "sadness",  apiEmotion: "sadness",  emoji: "💙", label: "Sad" },
  { emotion: "stressed", apiEmotion: "stressed", emoji: "💛", label: "Stressed" },
  { emotion: "anger",    apiEmotion: "anger",    emoji: "❤️", label: "Angry" },
  { emotion: "confused", apiEmotion: "confused", emoji: "🟣", label: "Confused" },
  { emotion: "neutral",  apiEmotion: "neutral",  emoji: "⚪", label: "Neutral" },
];

function saveCheckinToHistory(apiEmotion: string, label: string, note: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY) ?? "[]";
    const all = JSON.parse(raw);
    const items = Array.isArray(all) ? all : [];
    items.push({
      id: `feel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: note.trim() || `Feeling ${label.toLowerCase()} right now.`,
      from: "user",
      emotion: apiEmotion,
      createdAt: Date.now(),
      intensity: 0.6,
    });
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch { /* ignore quota */ }
}

function WebFeelSection({ onCheckin }: { onCheckin: () => void }) {
  const [selected, setSelected] = useState<{ emotion: EmotionBucket; apiEmotion: string; label: string } | null>(null);
  const [note, setNote] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  function handleSave() {
    if (!selected) return;
    saveCheckinToHistory(selected.apiEmotion, selected.label, note);
    setSelected(null);
    setNote("");
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2200);
    onCheckin();
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 shadow-sm backdrop-blur-md">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        How are you feeling right now?
      </p>

      {/* Emotion buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        {FEEL_BUTTONS_WEB.map((btn) => {
          const isActive = selected?.label === btn.label;
          const meta = EMOTION_BUCKET_META[btn.emotion];
          return (
            <button
              key={btn.label}
              type="button"
              onClick={() => setSelected(isActive ? null : { emotion: btn.emotion, apiEmotion: btn.apiEmotion, label: btn.label })}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition"
              style={{
                borderColor: isActive ? meta.color : "rgba(255,255,255,0.12)",
                backgroundColor: isActive ? meta.color.replace(/[\d.]+\)$/, "0.18)") : "rgba(255,255,255,0.04)",
                color: isActive ? "#f1f5f9" : "#94a3b8",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <span>{btn.emoji}</span>
              <span>{btn.label}</span>
            </button>
          );
        })}
      </div>

      {/* Note + save — only when an emotion is selected */}
      {selected && (
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2 animate-fade-in">
          <p className="text-[11px] text-zinc-500">Add a note (optional)</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={`What's making you feel ${selected.label.toLowerCase()}?`}
            className="w-full resize-none rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-white/20"
          />
          <button
            type="button"
            onClick={handleSave}
            className="w-full rounded-full py-2 text-sm font-semibold text-white transition hover:brightness-110"
            style={{
              backgroundColor: EMOTION_BUCKET_META[selected.emotion].color.replace(/[\d.]+\)$/, "0.80)"),
            }}
          >
            Log check-in
          </button>
        </div>
      )}

      {justSaved && (
        <p className="mt-2 text-center text-[11px] text-zinc-500">✓ Check-in logged</p>
      )}
    </div>
  );
}

// ── Personalized prompts ───────────────────────────────────────────────────────

// Map canonical API emotion names → prompt bank keys
// Stored emotions: sadness, anger, joy, fear, neutral, stressed, anxious, lonely, hopeful, confused
// Prompt bank keys: sad, angry, happy, fear, anxious, stressed, lonely, hopeful, confused
const EMOTION_KEY_MAP: Record<string, string> = {
  sadness: "sad",
  anger: "angry",
  joy: "happy",
  happiness: "happy",
  anxious: "anxious",
  anxiety: "anxious",
  stress: "stressed",
  grateful: "hopeful",
  gratitude: "hopeful",
};

function toPromptKey(emotion: string): string {
  const e = emotion.toLowerCase().trim();
  return EMOTION_KEY_MAP[e] ?? e;
}

const EMOTION_PROMPTS: Record<string, string[]> = {
  stressed: [
    "What's taking the most energy from you right now?",
    "What would it feel like to let go of one thing on your plate today?",
    "What does rest actually look like for you right now?",
    "What boundary do you wish you'd held — or held better — this week?",
    "Which of your current worries are within your control — and which aren't?",
  ],
  anxious: [
    "What is the one thing you're most worried about — and what's actually in your control?",
    "What would you tell a close friend who was feeling exactly how you feel right now?",
    "What's quietly weighing on you right now?",
    "What small thing could make tomorrow feel a little less uncertain?",
    "What has helped you through anxious stretches before?",
  ],
  fear: [
    "What is the one thing you're most worried about — and what's actually in your control?",
    "What's quietly weighing on you right now?",
    "What would you tell a close friend who was feeling exactly how you feel right now?",
    "What's one small thing that feels safe and grounding right now?",
    "What would you need to feel even 10% safer right now?",
  ],
  sad: [
    "What would feel like a small act of kindness toward yourself today?",
    "Who in your life have you felt most connected to lately — and why?",
    "What are you grateful for that you haven't acknowledged in a while?",
    "Is there something you need to grieve or let go of?",
    "What does your body feel like carrying right now — heavy, tight, open?",
  ],
  lonely: [
    "Who in your life have you felt most connected to lately — and why?",
    "What kind of connection are you craving right now?",
    "What would you say to yourself if you were your own closest friend?",
    "What's one small way you could reach out to someone this week?",
    "What does 'feeling seen' look like for you — and when did you last experience it?",
  ],
  angry: [
    "What is underneath the frustration you're feeling?",
    "What boundary feels like it's been crossed — and what would you say if you could speak freely?",
    "What would need to change for this situation to feel fair?",
    "What's one thing you can do today to release some tension?",
    "Where does this anger live in your body — and what does it need?",
  ],
  happy: [
    "What's one thing that went well today, even if it was small?",
    "What created this feeling of lightness — and how can you keep more of it?",
    "What are you grateful for that you haven't acknowledged in a while?",
    "Describe one moment today where you felt like yourself.",
    "What would you want to bottle up from right now to open on a harder day?",
  ],
  hopeful: [
    "What possibility are you most looking forward to right now?",
    "What would need to happen for this hope to become real?",
    "What's one small step you could take toward what you're hoping for?",
    "What does it feel like in your body when you imagine things going well?",
    "What would you want your future self to remember about how you feel right now?",
  ],
  confused: [
    "What feels most unclear to you right now — and what would help you see it better?",
    "Is there a decision you've been avoiding? What makes it hard?",
    "What would you tell someone else who felt this lost or uncertain?",
    "What's the one question you most wish you had an answer to?",
    "What do you already know, even if the bigger picture isn't clear yet?",
  ],
};

/** Pick a prompt index personalised to current emotional arc. Returns null if no relevant arc. */
function getPersonalisedPromptIndex(arc: EmotionArc): number | null {
  const key = toPromptKey(arc.dominantEmotion ?? "");
  const bank = EMOTION_PROMPTS[key];
  if (!bank?.length) return null;
  const dayOffset = new Date().getDay();
  return -(bank.length + 1 + dayOffset); // sentinel: negative = personalized bank
}

// ── Prompts ───────────────────────────────────────────────────────────────────
const PROMPTS = [
  "What's one thing that went well today, even if it was small?",
  "What's quietly weighing on you right now?",
  "What would make tomorrow feel a little lighter?",
  "Describe one moment today where you felt like yourself.",
  "What emotion has been most present today, and what do you think triggered it?",
  "What are you grateful for that you haven't acknowledged in a while?",
  "Is there something you're avoiding? What would it feel like to face it?",
  "Who in your life have you felt most connected to lately — and why?",
  "What would you tell a close friend who was feeling exactly how you feel right now?",
  "What does your body need today that your mind keeps ignoring?",
  "What's one small step you could take tomorrow toward something that matters to you?",
  "What has surprised you about yourself recently?",
  "What boundary do you wish you'd held — or held better — this week?",
  "What does 'rest' actually look like for you right now?",
  "If today had a theme, what word would it be?",
];

function getDailyPromptIndex(): number {
  return Math.floor(Date.now() / 86_400_000) % PROMPTS.length;
}

// ── Profile lang helper ───────────────────────────────────────────────────────
function getProfileLang(): string {
  if (typeof window === "undefined") return "en";
  try {
    const raw = window.localStorage.getItem("imotara.profile.v1");
    if (!raw) return "en";
    const p = JSON.parse(raw);
    return (typeof p?.user?.preferredLang === "string" ? p.user.preferredLang : "") || "en";
  } catch { return "en"; }
}

// ── Localised general prompts ─────────────────────────────────────────────────
// #13: Translated versions of the 15 general prompts + emotion-specific banks
const PROMPTS_BY_LANG: Record<string, string[]> = {
  hi: [
    "आज कोई एक छोटी सी बात जो अच्छी लगी, वो क्या थी?",
    "अभी चुपचाप क्या बोझ आप पर है?",
    "कल को थोड़ा हल्का बनाने के लिए क्या होना चाहिए?",
    "आज एक ऐसा पल बताइए जब आप खुद जैसा महसूस किया।",
    "आज कौन सी भावना सबसे ज़्यादा रही, और उसकी वजह क्या लगती है?",
    "किसी ऐसी चीज़ के लिए शुक्रगुज़ार हैं जिसे काफी वक्त से नहीं माना?",
    "कोई बात है जिससे आप बच रहे हैं? उसका सामना करने पर कैसा लगेगा?",
    "हाल में किस व्यक्ति से सबसे ज़्यादा जुड़ाव महसूस हुआ — और क्यों?",
    "जो आप अभी महसूस कर रहे हैं, वही महसूस कर रहे किसी करीबी दोस्त को आप क्या कहते?",
    "आपका शरीर आज क्या चाहता है जिसे मन अनदेखा कर रहा है?",
    "कल किसी ज़रूरी काम की तरफ एक छोटा कदम क्या हो सकता है?",
    "हाल में अपने बारे में कौन सी बात ने आपको हैरान किया?",
    "इस हफ्ते कोई हद जो आप चाहते थे लेकिन नहीं लगा पाए?",
    "अभी आपके लिए 'आराम' का मतलब क्या है?",
    "अगर आज के दिन का एक शब्द होता, तो वो क्या होता?",
  ],
  mr: [
    "आज एक छोटी गोष्ट जी चांगली वाटली, ती कोणती?",
    "आत्ता मनात शांतपणे काय जड वाटतंय?",
    "उद्या थोडं हलकं वाटण्यासाठी काय व्हायला हवं?",
    "आज एक क्षण सांगा जेव्हा तुम्ही स्वतःसारखं वाटलं।",
    "आज कोणती भावना सर्वाधिक होती, आणि ती का आली असेल?",
    "एखाद्या गोष्टीबद्दल कृतज्ञता आहे जी खूप दिवसांत व्यक्त केली नाही?",
    "एखादी गोष्ट आहे जी तुम्ही टाळत आहात? तिला सामोरं गेल्यावर कसं वाटेल?",
    "अलीकडे कोणाशी सर्वाधिक जोडलेलं वाटलं — आणि का?",
    "तुम्हाला जे वाटतंय तेच वाटणाऱ्या जवळच्या मित्राला तुम्ही काय सांगाल?",
    "तुमच्या शरीराला आज काय हवं आहे जे मन दुर्लक्षित करतंय?",
    "उद्या महत्त्वाच्या गोष्टीकडे एक लहान पाऊल कोणतं असेल?",
    "अलीकडे स्वतःबद्दल कशामुळे आश्चर्य वाटलं?",
    "या आठवड्यात कोणती मर्यादा घालायची होती पण घातली नाही?",
    "सध्या तुमच्यासाठी 'विश्रांती' म्हणजे काय?",
    "आजच्या दिवसाला एक शब्द द्यायचा तर तो कोणता असेल?",
  ],
  bn: [
    "আজকে একটা ছোট জিনিস যা ভালো লেগেছে, সেটা কী?",
    "এখন চুপচাপ কী ভার বয়ে চলেছ?",
    "কাল একটু হালকা অনুভব করতে হলে কী হওয়া দরকার?",
    "আজকের একটা মুহূর্ত বলো যখন নিজের মতো মনে হয়েছিল।",
    "আজ কোন অনুভূতি সবচেয়ে বেশি ছিল, আর কেন বলে মনে হয়?",
    "এমন কিছুর জন্য কৃতজ্ঞ যা অনেকদিন স্বীকার করা হয়নি?",
    "কোনো কিছু কি এড়িয়ে যাচ্ছ? সেটার মুখোমুখি হলে কেমন লাগবে?",
    "সম্প্রতি কার সাথে সবচেয়ে বেশি সংযুক্ত মনে হয়েছে — আর কেন?",
    "তুমি এখন যা অনুভব করছ, সেটাই অনুভব করছে এমন কোনো বন্ধুকে কী বলতে?",
    "তোমার শরীর আজ কী চাইছে যা মন উপেক্ষা করছে?",
    "আগামীকাল গুরুত্বপূর্ণ কিছুর দিকে একটা ছোট পদক্ষেপ কী হতে পারে?",
    "সম্প্রতি নিজের সম্পর্কে কোনটা তোমাকে অবাক করেছে?",
    "এই সপ্তাহে কোন সীমা রাখতে চেয়েছিলে কিন্তু পারোনি?",
    "এখন তোমার কাছে 'বিশ্রাম' মানে কী?",
    "আজকের দিনটার একটা শব্দ হলে সেটা কী হত?",
  ],
  ta: [
    "இன்று ஒரு சிறிய நல்ல விஷயம் என்ன?",
    "இப்போது மனதில் அமைதியாக என்ன சுமை இருக்கிறது?",
    "நாளை கொஞ்சம் இலகுவாக இருக்க என்ன நடக்க வேண்டும்?",
    "இன்று உங்களைப் போல் உணர்ந்த ஒரு தருணம் சொல்லுங்கள்.",
    "இன்று எந்த உணர்வு அதிகமாக இருந்தது, அதற்கு என்ன காரணம்?",
    "நீண்ட நாளாக ஒப்புக்கொள்ளாத ஒன்றிற்கு நன்றியாக இருக்கிறீர்களா?",
    "தவிர்க்கும் ஒன்று உள்ளதா? அதை எதிர்கொண்டால் எப்படி இருக்கும்?",
    "சமீபத்தில் யாருடன் அதிகமாக இணைந்ததாக உணர்ந்தீர்கள் — ஏன்?",
    "நீங்கள் உணர்வதையே உணரும் நெருங்கிய நண்பருக்கு என்ன சொல்வீர்கள்?",
    "உங்கள் உடல் இன்று என்ன வேண்டும் என்று கேட்கிறது, மனம் புறக்கணிக்கிறது?",
    "நாளை முக்கியமான ஒன்றை நோக்கி ஒரு சிறிய அடி எது?",
    "சமீபத்தில் உங்களைப் பற்றி என்ன ஆச்சரியப்படுத்தியது?",
    "இந்த வாரம் வைக்க நினைத்த எல்லை எது, வைக்கவில்லை?",
    "இப்போது உங்களுக்கு 'ஓய்வு' என்பது எப்படி இருக்கும்?",
    "இன்றைய நாளுக்கு ஒரே ஒரு வார்த்தை என்னவாக இருக்கும்?",
  ],
  te: [
    "ఈరోజు ఒక చిన్న మంచి విషయం ఏమిటి?",
    "ఇప్పుడు మనసులో నిశ్శబ్దంగా ఏ బాధ ఉంది?",
    "రేపు కొంచెం తేలిగ్గా అనిపించేందుకు ఏం జరగాలి?",
    "ఈరోజు మీరు మీలాగే అనిపించిన ఒక క్షణం చెప్పండి.",
    "ఈరోజు ఏ భావన ఎక్కువగా ఉంది, దానికి కారణం ఏమిటి?",
    "చాలా కాలంగా గుర్తించని ఏదైనా విషయానికి కృతజ్ఞతగా ఉన్నారా?",
    "మీరు తప్పించుకుంటున్న ఏదైనా ఉందా? దానిని ఎదుర్కొంటే ఎలా అనిపిస్తుంది?",
    "ఇటీవల ఎవరితో అత్యధికంగా అనుసంధానంగా అనిపించారు — ఎందుకు?",
    "మీరు ఇప్పుడు ఎలా అనిపిస్తున్నారో అదే అనిపించే ఒక స్నేహితుడికి ఏం చెప్తారు?",
    "మీ శరీరానికి ఈరోజు ఏం కావాలి, మనసు విస్మరిస్తోంది?",
    "రేపు ముఖ్యమైన దాని వైపు ఒక చిన్న అడుగు ఏమిటి?",
    "ఇటీవల మీ గురించి మీకు ఏది ఆశ్చర్యం కలిగించింది?",
    "ఈ వారం పెట్టుకోవాలనుకున్న హద్దు ఏమిటి, పెట్టుకోలేదు?",
    "ఇప్పుడు మీకు 'విశ్రాంతి' ఎలా కనిపిస్తుంది?",
    "ఈరోజుకు ఒక్క మాట ఏమిటి?",
  ],
};

// #13: Localised emotion-specific prompt banks (hi + mr for now — most spoken)
const EMOTION_PROMPTS_BY_LANG: Record<string, Record<string, string[]>> = {
  hi: {
    stressed: [
      "अभी आप पर सबसे ज़्यादा ऊर्जा क्या ले रहा है?",
      "आज अपनी ज़िम्मेदारियों में से एक छोड़ दें तो कैसा लगेगा?",
      "अभी आपके लिए 'आराम' का सही मतलब क्या है?",
      "इस हफ्ते कोई हद जो आप चाहते थे लेकिन नहीं लगा पाए?",
    ],
    anxious: [
      "जिस एक चीज़ की सबसे ज़्यादा चिंता है — उसमें से आपके हाथ में क्या है?",
      "जो आप अभी महसूस कर रहे हैं वो महसूस करने वाले किसी दोस्त को क्या कहते?",
      "अभी चुपचाप क्या बोझ आप पर है?",
      "कल को थोड़ा कम अनिश्चित बनाने के लिए एक छोटी बात क्या हो सकती है?",
    ],
    sad: [
      "आज खुद के प्रति एक छोटा दयालु काम क्या हो सकता है?",
      "हाल में किस व्यक्ति से सबसे ज़्यादा जुड़ाव महसूस हुआ — और क्यों?",
      "किसी ऐसी चीज़ के लिए शुक्रगुज़ार हैं जिसे काफी वक्त से नहीं माना?",
      "कोई ऐसी बात है जिसे जाने देने की ज़रूरत है?",
    ],
    lonely: [
      "हाल में किस व्यक्ति से सबसे ज़्यादा जुड़ाव महसूस हुआ — और क्यों?",
      "अभी आप किस तरह का जुड़ाव चाहते हैं?",
      "अगर आप अपने सबसे अच्छे दोस्त होते तो खुद से क्या कहते?",
      "इस हफ्ते किसी से एक छोटे से तरीके से जुड़ सकते हैं?",
    ],
    angry: [
      "इस चिड़चिड़ाहट के नीचे असल में क्या है?",
      "कौन सी हद टूटी हुई लगती है — अगर खुलकर बोल सकते तो क्या कहते?",
      "यह स्थिति सही लगने के लिए क्या बदलना चाहिए?",
      "आज इस तनाव को थोड़ा कम करने के लिए एक काम?",
    ],
    happy: [
      "आज कोई एक छोटी सी बात जो अच्छी लगी, वो क्या थी?",
      "यह हल्कापन किस वजह से है — और इसे ज़्यादा कैसे रख सकते हैं?",
      "किसी ऐसी चीज़ के लिए शुक्रगुज़ार हैं जिसे काफी वक्त से नहीं माना?",
      "आज एक ऐसा पल बताइए जब आप खुद जैसा महसूस किया।",
    ],
  },
  mr: {
    stressed: [
      "आत्ता सर्वाधिक ऊर्जा कशावर जाते आहे?",
      "आजच्या जबाबदाऱ्यांपैकी एक सोडली तर कसं वाटेल?",
      "सध्या तुमच्यासाठी 'विश्रांती' म्हणजे काय?",
      "या आठवड्यात कोणती मर्यादा घालायची होती पण घातली नाही?",
    ],
    anxious: [
      "सर्वाधिक काळजी वाटणाऱ्या गोष्टीत तुमच्या हातात काय आहे?",
      "तुम्हाला जे वाटतंय तेच वाटणाऱ्या मित्राला काय सांगाल?",
      "आत्ता मनात शांतपणे काय जड वाटतंय?",
      "उद्या थोडं कमी अनिश्चित वाटण्यासाठी एक छोटी गोष्ट काय?",
    ],
    sad: [
      "आज स्वतःशी एक छोटी दयाळू गोष्ट कोणती असेल?",
      "अलीकडे कोणाशी सर्वाधिक जोडलेलं वाटलं — आणि का?",
      "एखाद्या गोष्टीबद्दल कृतज्ञता आहे जी खूप दिवसांत व्यक्त केली नाही?",
      "कुठली गोष्ट सोडून देण्याची गरज आहे?",
    ],
    lonely: [
      "अलीकडे कोणाशी सर्वाधिक जोडलेलं वाटलं — आणि का?",
      "आत्ता कोणत्या प्रकारचा संपर्क हवा आहे?",
      "जर स्वतःचे सर्वोत्तम मित्र असतात तर काय म्हणालात?",
      "या आठवड्यात कोणाशी एका छोट्या मार्गाने जोडता येईल?",
    ],
    angry: [
      "या रागाखाली नक्की काय आहे?",
      "कोणती मर्यादा ओलांडली गेल्यासारखी वाटते?",
      "ही परिस्थिती योग्य वाटण्यासाठी काय बदलायला हवं?",
      "आज हा तणाव थोडा कमी करण्यासाठी एक गोष्ट?",
    ],
    happy: [
      "आज एक छोटी गोष्ट जी चांगली वाटली, ती कोणती?",
      "हे हलकेपण कशामुळे आहे — आणि ते जास्त कसं ठेवता येईल?",
      "एखाद्या गोष्टीबद्दल कृतज्ञता आहे जी खूप दिवसांत व्यक्त केली नाही?",
      "आज एक क्षण सांगा जेव्हा तुम्ही स्वतःसारखं वाटलं।",
    ],
  },
};

// ── Streak helper ─────────────────────────────────────────────────────────────
// #15: Quality streak — only count days with a substantive response (> 30 chars)
const MIN_QUALITY_CHARS = 30;

function loadChatActiveDays(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return new Set();
    const all = JSON.parse(raw) as any[];
    if (!Array.isArray(all)) return new Set();
    return new Set(
      all
        .filter((r) => !r.deleted && r.from === "user" && r.createdAt)
        .map((r) => new Date(r.createdAt as number).toDateString()),
    );
  } catch { return new Set(); }
}

function computeStreak(entries: ReflectionEntry[]): number {
  const chatDays = loadChatActiveDays();

  const days = new Set([
    ...entries
      .filter((e) => (e.response ?? "").trim().length >= MIN_QUALITY_CHARS)
      .map((e) => new Date(e.createdAt).toDateString()),
    ...chatDays,
  ]);

  // #7: Allow 1 grace day so a single missed day doesn't break the streak
  let streak = 0;
  let graceUsed = false;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (days.has(d.toDateString())) {
      streak++;
    } else if (!graceUsed && (streak > 0 || i === 0)) {
      // Grace: today not yet logged, or one gap in the middle of an active streak
      graceUsed = true;
    } else {
      break;
    }
  }
  return streak;
}

// ── Reflection theme detection ─────────────────────────────────────────────────
// #2/#3: Find recurring words across past reflections (appears ≥ 2 times)
const THEME_STOP_WORDS = new Set([
  "i","me","my","the","a","an","and","or","but","in","on","at","to","for",
  "of","with","is","are","was","were","it","this","that","have","had","has",
  "do","did","be","been","so","am","not","no","you","we","they","he","she",
  "what","when","how","why","if","can","will","just","more","about","there",
  "from","than","like","your","its","their","really","very","much","still",
  "even","feel","feels","felt","feeling","time","day","days","week","know",
  "think","want","need","get","got","make","made","could","would","should",
  "im","its","ive","dont","cant","wont","thats","theres","heres","going",
]);

function computeThemes(entries: ReflectionEntry[]): string[] {
  if (entries.length < 3) return [];
  const wordCount: Record<string, number> = {};
  for (const entry of entries) {
    const words = entry.response.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];
    for (const w of words) {
      if (!THEME_STOP_WORDS.has(w)) wordCount[w] = (wordCount[w] ?? 0) + 1;
    }
  }
  return Object.entries(wordCount)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);
}

// ── Export reflections ─────────────────────────────────────────────────────────
// #14: Export all reflections as a plain-text file
function exportReflections(entries: ReflectionEntry[]) {
  if (!entries.length) return;
  const lines = entries
    .map((e) =>
      `${new Date(e.createdAt).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\nPrompt: ${e.prompt}\n\n${e.response}`,
    )
    .join("\n\n────────────────────────\n\n");
  const blob = new Blob([lines], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `imotara_reflections_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function GrowPage() {
  const [mounted, setMounted] = useState(false);
  const [entries, setEntries] = useState<ReflectionEntry[]>([]);
  const [promptIndex, setPromptIndex] = useState(getDailyPromptIndex);
  const [arc, setArc] = useState<EmotionArc>({ dominantEmotion: null, weekEmotions: [], trend: null });
  const [analytics, setAnalytics] = useState<AnalyticsData>({ heatmapWeeks: [], radarFreq: {}, radarMax: 1 });
  const [usePersonalised, setUsePersonalised] = useState(false);
  const [lang, setLang] = useState("en");
  const [response, setResponse] = useState("");
  const [saved, setSaved] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [themes, setThemes] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const editRef = useRef<HTMLTextAreaElement>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type?: ToastType } | null>(null);
  function showToast(message: string, type: ToastType = "success") {
    setToast({ message, type });
  }

  useEffect(() => {
    const loaded = loadEntries();
    setEntries(loaded);
    setThemes(computeThemes(loaded));
    const loadedArc = loadEmotionArc();
    setArc(loadedArc);
    setAnalytics(loadAnalyticsData());
    const pidx = getPersonalisedPromptIndex(loadedArc);
    if (pidx !== null) setUsePersonalised(true);
    setLang(getProfileLang());
    setMounted(true);
  }, []);

  // Active general prompt bank: localised if available, English fallback
  const generalBank = PROMPTS_BY_LANG[lang] ?? PROMPTS;

  // Active emotion-specific bank: normalise canonical names (sadness→sad, anger→angry, joy→happy, etc.)
  const emotionKey = toPromptKey(arc.dominantEmotion ?? "");
  const personalisedBank = usePersonalised
    ? (EMOTION_PROMPTS_BY_LANG[lang]?.[emotionKey] ?? EMOTION_PROMPTS[emotionKey] ?? null)
    : null;

  const prompt = personalisedBank
    ? personalisedBank[promptIndex % personalisedBank.length]
    : generalBank[promptIndex % generalBank.length];

  function handleCheckin() {
    setAnalytics(loadAnalyticsData());
    setArc(loadEmotionArc());
  }

  function handleTryAnother() {
    setUsePersonalised(false);
    setPromptIndex((i) => (i + 1) % generalBank.length);
    setResponse("");
    setSaved(false);
  }

  function handleSave() {
    const text = response.trim();
    if (!text) return;

    const entry: ReflectionEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      prompt,
      response: text,
      createdAt: Date.now(),
    };

    const updated = [entry, ...entries];
    setEntries(updated);
    saveEntries(updated);
    setThemes(computeThemes(updated));
    setResponse("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    showToast("Reflection saved ✓");
  }

  function handleSaveEdit(id: string) {
    const text = editText.trim();
    if (!text) return;
    const updated = entries.map((e) => e.id === id ? { ...e, response: text } : e);
    setEntries(updated);
    saveEntries(updated);
    setThemes(computeThemes(updated));
    setEditingId(null);
    showToast("Reflection updated ✓");
  }

  // #15: Ctrl/Cmd+Enter to save reflection
  function onReflectionKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  }

  function handleDelete(id: string) {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    saveEntries(updated);
    setThemes(computeThemes(updated));
    showToast("Reflection deleted", "info");
  }

  function handleExport() {
    exportReflections(entries);
    if (entries.length > 0) showToast("Reflections downloaded ✓");
  }

  if (!mounted) return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
      <SkeletonLoader rows={1} variant="card" />
      <SkeletonLoader rows={3} variant="list" />
    </div>
  );

  const todayStr = new Date().toDateString();
  const todayEntries = useMemo(
    () => entries.filter((e) => new Date(e.createdAt).toDateString() === todayStr),
    [entries, todayStr],
  );
  const alreadyAnsweredToday = useMemo(
    () => todayEntries.some((e) => e.prompt === prompt),
    [todayEntries, prompt],
  );
  const streak = useMemo(() => computeStreak(entries), [entries]);

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 text-lg shadow-[0_8px_24px_rgba(15,23,42,0.5)]">
            🌱
          </div>
          <div>
            <h1 className="text-base font-semibold text-zinc-50">Daily Reflection</h1>
            <p className="text-[11px] text-zinc-500">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Streak badge + Export */}
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <div
              className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300"
              title={`${streak}-day reflection streak`}
            >
              <span>🔥</span>
              <span>{streak} day{streak !== 1 ? "s" : ""}</span>
            </div>
          )}
          {/* #14: Export reflections as plain text */}
          {entries.length > 0 && (
            <button
              type="button"
              onClick={handleExport}
              title="Export all reflections as plain text"
              className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
            >
              <Download className="h-3 w-3" />
              Export
            </button>
          )}
        </div>
      </div>

      {/* #4: Emotional arc card — shown when history data exists */}
      {arc.weekEmotions.some(Boolean) && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-sm backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Your week
            </p>
            {arc.trend && (
              <span className={`text-[10px] font-medium ${
                arc.trend === "lighter" ? "text-emerald-400" :
                arc.trend === "heavier" ? "text-amber-400" : "text-zinc-400"
              }`}>
                {arc.trend === "lighter" ? "Feeling lighter ↓" :
                 arc.trend === "heavier" ? "Feeling heavier ↑" : "Steady"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {arc.weekEmotions.map((e, i) => (
              <div
                key={i}
                title={e || "No data"}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-base transition ${
                  e ? "bg-white/10" : "bg-white/5 opacity-30"
                }`}
              >
                {e ? emotionEmoji(e) : "·"}
              </div>
            ))}
            {arc.dominantEmotion && (
              <span className="ml-2 text-[11px] text-zinc-400">
                mostly {emotionLabel(arc.dominantEmotion)}
              </span>
            )}
          </div>
          {/* #14: Chat-to-Grow bridge — link back to chat when emotion data comes from chat history */}
          {arc.dominantEmotion && (
            <p className="mt-2 text-[10px] text-zinc-500">
              Based on your recent chats.{" "}
              <a href="/chat" className="text-indigo-400/80 underline underline-offset-2 hover:text-indigo-300 transition">
                Continue in chat →
              </a>
            </p>
          )}
          {usePersonalised && personalisedBank && (
            <p className="mt-1 text-[10px] text-indigo-400/80">
              Today&apos;s prompt is tailored to how you&apos;ve been feeling.{" "}
              <button
                type="button"
                onClick={() => { setUsePersonalised(false); setPromptIndex(getDailyPromptIndex()); }}
                className="underline underline-offset-2 hover:text-indigo-300 transition"
              >
                Use general instead
              </button>
            </p>
          )}
        </div>
      )}

      {/* Quick emotion check-in */}
      <WebFeelSection onCheckin={handleCheckin} />

      {/* Emotion radar chart */}
      <EmotionRadarChart radarFreq={analytics.radarFreq} radarMax={analytics.radarMax} />

      {/* 12-week mood heatmap */}
      <MoodHeatmap weeks={analytics.heatmapWeeks} />

      {/* First-time nudge — shown when no emotion history yet */}
      {!arc.weekEmotions.some(Boolean) && entries.length === 0 && (
        <div className="rounded-2xl border border-indigo-400/15 bg-indigo-500/5 px-4 py-3 text-[11px] text-zinc-400">
          <span className="mr-1">💬</span>
          Chat with Imotara first — your reflection prompts will be personalised to how you&apos;ve been feeling.{" "}
          <a href="/chat" className="text-indigo-400/80 underline underline-offset-2 hover:text-indigo-300 transition">
            Start a chat →
          </a>
        </div>
      )}

      {/* Today's prompt card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur-md">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Today&apos;s prompt
          </p>
          {!alreadyAnsweredToday && (
            <button
              type="button"
              onClick={handleTryAnother}
              className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
              title="See a different prompt"
            >
              <span>↻</span> Try another
            </button>
          )}
        </div>
        <p className="text-sm leading-relaxed text-zinc-100">{prompt}</p>
      </div>

      {/* Response area */}
      {alreadyAnsweredToday ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          ✓ You&apos;ve already reflected on today&apos;s prompt. Come back tomorrow for a new one.
          <button
            type="button"
            onClick={handleTryAnother}
            className="ml-3 text-[11px] underline underline-offset-2 opacity-70 hover:opacity-100"
          >
            Try a different prompt anyway
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            ref={textareaRef}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            onKeyDown={onReflectionKeyDown}
            rows={5}
            placeholder="Write what comes to mind — there's no wrong answer…"
            className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-white/25 focus:ring-1 focus:ring-white/10"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-zinc-600">Saved locally — never shared.</span>
              {/* Keyboard shortcut pill */}
              <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500 font-mono select-none">
                ⌘↵
              </span>
              {/* Char count */}
              <span className={`text-[11px] tabular-nums transition-colors ${
                response.trim().length >= MIN_QUALITY_CHARS ? "text-emerald-400/80" : "text-zinc-600"
              }`}>
                {response.length}{response.trim().length >= MIN_QUALITY_CHARS
                  ? " ✓"
                  : response.length > 0 ? ` / ${MIN_QUALITY_CHARS}` : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={!response.trim()}
              className="rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 px-5 py-2 text-sm font-medium text-black shadow transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saved ? "Saved ✓" : "Save reflection"}
            </button>
          </div>
        </div>
      )}

      {/* #2/#3: Recurring themes from past reflections */}
      {themes.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-sm backdrop-blur-md">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Themes I notice in your reflections
          </p>
          <div className="flex flex-wrap gap-1.5">
            {themes.map((theme) => (
              <span
                key={theme}
                className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-2.5 py-1 text-[11px] capitalize text-indigo-300"
              >
                {theme}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-zinc-600">
            Words that appear often across your reflections.
          </p>
        </div>
      )}

      {/* Letter to future self */}
      <FutureLetterSection showToast={showToast} />

      {/* Toast notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Past reflections */}
      {entries.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition"
          >
            <span>{showHistory ? "▲" : "▼"}</span>
            Past reflections ({entries.length})
          </button>

          {showHistory && (
            <ul className="space-y-3">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm"
                >
                  <p className="mb-1 text-[10px] text-zinc-500">
                    {new Date(entry.createdAt).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <p className="mb-2 text-[11px] italic text-zinc-400 leading-snug">
                    {entry.prompt}
                  </p>

                  {editingId === entry.id ? (
                    <div className="space-y-2">
                      <textarea
                        ref={editRef}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                            e.preventDefault();
                            handleSaveEdit(entry.id);
                          }
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        rows={4}
                        autoFocus
                        className="w-full resize-none rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-500/40"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(entry.id)}
                          disabled={!editText.trim()}
                          className="inline-flex items-center gap-1 rounded-full bg-indigo-500/80 px-3 py-1 text-[11px] font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
                        >
                          <Check className="h-3 w-3" /> Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-[11px] text-zinc-500 hover:text-zinc-300 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                      {entry.response}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-3">
                    {editingId !== entry.id && (
                      <button
                        type="button"
                        onClick={() => { setEditingId(entry.id); setEditText(entry.response); }}
                        className="inline-flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-300 transition"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      className="text-[10px] text-zinc-600 hover:text-red-400 transition"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
