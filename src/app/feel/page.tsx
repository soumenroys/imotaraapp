// src/app/feel/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/imotara/TopBar";
import Toast, { type ToastType } from "@/components/imotara/Toast";
import { hapticTap, hapticSuccess } from "@/lib/imotara/haptic";

const HISTORY_KEY = "imotara:history:v1";

const MOODS = [
  { emoji: "😊", label: "Joyful",    emotion: "joy",      bg: "from-amber-400/20 to-amber-500/10",    border: "border-amber-400/40",    text: "text-amber-200" },
  { emoji: "😌", label: "Calm",      emotion: "neutral",  bg: "from-emerald-400/20 to-emerald-500/10", border: "border-emerald-400/40",  text: "text-emerald-200" },
  { emoji: "😔", label: "Sad",       emotion: "sad",      bg: "from-sky-400/20 to-sky-500/10",        border: "border-sky-400/40",      text: "text-sky-200" },
  { emoji: "😟", label: "Anxious",   emotion: "anxious",  bg: "from-violet-400/20 to-violet-500/10",  border: "border-violet-400/40",   text: "text-violet-200" },
  { emoji: "😰", label: "Stressed",  emotion: "stressed", bg: "from-orange-400/20 to-orange-500/10",  border: "border-orange-400/40",   text: "text-orange-200" },
  { emoji: "😤", label: "Angry",     emotion: "angry",    bg: "from-rose-400/20 to-rose-500/10",      border: "border-rose-400/40",     text: "text-rose-200" },
  { emoji: "🌧️", label: "Lonely",   emotion: "lonely",   bg: "from-indigo-400/20 to-indigo-500/10",  border: "border-indigo-400/40",   text: "text-indigo-200" },
  { emoji: "😮", label: "Surprised", emotion: "surprise", bg: "from-fuchsia-400/20 to-fuchsia-500/10",border: "border-fuchsia-400/40",  text: "text-fuchsia-200" },
] as const;

type MoodEmotion = typeof MOODS[number]["emotion"];

type CheckIn = {
  id: string;
  emotion: MoodEmotion;
  note: string;
  createdAt: number;
};

function loadCheckIns(): CheckIn[] {
  try {
    const raw = localStorage.getItem("imotara.feelcheckins.v1");
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}

function saveCheckIns(list: CheckIn[]) {
  try { localStorage.setItem("imotara.feelcheckins.v1", JSON.stringify(list)); } catch { /* ignore */ }
}

function logToHistory(c: CheckIn) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const all: any[] = raw ? JSON.parse(raw) : [];
    all.unshift({
      id: c.id,
      emotion: c.emotion,
      message: c.note || `Quick check-in: feeling ${c.emotion}`,
      intensity: 0.5,
      source: "local",
      entryKind: "checkin",
      createdAt: c.createdAt,
      updatedAt: c.createdAt,
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

function timeAgo(ms: number): string {
  const d = Date.now() - ms;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function FeelPage() {
  const [mounted, setMounted] = useState(false);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [selected, setSelected] = useState<MoodEmotion | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type?: ToastType } | null>(null);

  useEffect(() => {
    setCheckins(loadCheckIns());
    setMounted(true);
  }, []);

  function pick(emotion: MoodEmotion) {
    hapticTap();
    setSelected(emotion);
  }

  function save() {
    if (!selected) return;
    setSaving(true);
    hapticSuccess();
    const checkin: CheckIn = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      emotion: selected,
      note: note.trim(),
      createdAt: Date.now(),
    };
    const updated = [checkin, ...checkins];
    setCheckins(updated);
    saveCheckIns(updated);
    logToHistory(checkin);
    setSelected(null);
    setNote("");
    setSaving(false);
    setToast({ message: "Check-in logged ✓" });
  }

  const selectedMood = MOODS.find((m) => m.emotion === selected);

  const streak = (() => {
    if (!checkins.length) return 0;
    const days = new Set(checkins.map((c) => new Date(c.createdAt).toDateString()));
    let n = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      if (days.has(d.toDateString())) n++;
      else if (i > 0) break;
    }
    return n;
  })();

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      <div className="mx-auto w-full max-w-7xl px-3 pt-3 sm:px-4">
        <TopBar title="Feel" />
      </div>

      <main className="mx-auto max-w-lg space-y-5 px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-zinc-100">How are you feeling?</h1>
            <p className="text-[11px] text-zinc-500">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          {streak >= 1 && (
            <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300">
              🔥 {streak} day{streak !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Mood grid */}
        <div className="grid grid-cols-4 gap-2">
          {MOODS.map((m) => (
            <button
              key={m.emotion}
              type="button"
              onClick={() => pick(m.emotion)}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition duration-150 hover:scale-105 active:scale-95 ${
                selected === m.emotion
                  ? `bg-gradient-to-br ${m.bg} ${m.border} ${m.text} shadow-lg scale-105`
                  : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:bg-white/8"
              }`}
            >
              <span className="text-2xl leading-none" aria-hidden>{m.emoji}</span>
              <span className="text-[10px] font-medium leading-tight">{m.label}</span>
            </button>
          ))}
        </div>

        {/* Note + save */}
        {selected && (
          <div className="animate-fade-in space-y-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{selectedMood?.emoji}</span>
              <div>
                <p className="text-sm font-medium text-zinc-100">Feeling {selectedMood?.label}</p>
                <p className="text-[11px] text-zinc-500">Add a short note (optional)</p>
              </div>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="What's on your mind right now…"
              className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-white/25"
            />
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => { setSelected(null); setNote(""); }} className="text-xs text-zinc-500 hover:text-zinc-300 transition">
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="im-cta-bg rounded-full px-5 py-2 text-sm font-medium text-black shadow transition hover:brightness-110 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Log check-in"}
              </button>
            </div>
          </div>
        )}

        {/* Recent check-ins */}
        {mounted && checkins.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Recent</p>
            <ul className="space-y-1.5">
              {checkins.slice(0, 7).map((c) => {
                const mood = MOODS.find((m) => m.emotion === c.emotion);
                return (
                  <li key={c.id} className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/5 px-3 py-2.5">
                    <span className="mt-0.5 text-lg leading-none">{mood?.emoji ?? "💭"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-medium capitalize ${mood?.text ?? "text-zinc-300"}`}>
                          {mood?.label ?? c.emotion}
                        </span>
                        <span className="shrink-0 text-[10px] text-zinc-600">{timeAgo(c.createdAt)}</span>
                      </div>
                      {c.note && (
                        <p className="mt-0.5 truncate text-[11px] leading-snug text-zinc-500">{c.note}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Empty state */}
        {mounted && checkins.length === 0 && !selected && (
          <div className="rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center">
            <p className="text-sm text-zinc-400">Tap a mood above to log your first check-in.</p>
            <p className="mt-1 text-[11px] text-zinc-600">
              Or go deeper in{" "}
              <Link href="/chat" className="underline decoration-indigo-400/60 hover:text-indigo-300">Chat</Link>
              {" "}or{" "}
              <Link href="/grow" className="underline decoration-indigo-400/60 hover:text-indigo-300">Grow</Link>.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
