// src/components/imotara/EmotionalFingerprint.tsx
// Compact "emotional fingerprint" card — shown on Settings page.
// Reads localStorage directly (client-only). Returns null if no data.
"use client";

import { useEffect, useState } from "react";

const HISTORY_KEY = "imotara:history:v1";

const EMOTION_EMOJI: Record<string, string> = {
    joy: "😊", happy: "😊", happiness: "😊",
    sad: "😔", sadness: "😔", lonely: "🌧️",
    angry: "😤", anger: "😤", frustrated: "😤",
    stressed: "😰", stress: "😰",
    anxious: "😟", anxiety: "😟", fear: "😟",
    neutral: "😐", surprise: "😮",
    hopeful: "🌱", confused: "🤔", gratitude: "🙏",
};

const EMOTION_COLOR: Record<string, string> = {
    joy: "#34d399", happy: "#34d399", happiness: "#34d399",
    sad: "#60a5fa", sadness: "#60a5fa", lonely: "#60a5fa",
    angry: "#f87171", anger: "#f87171", frustrated: "#f87171",
    stressed: "#fb923c", stress: "#fb923c",
    anxious: "#c084fc", anxiety: "#c084fc", fear: "#c084fc",
    hopeful: "#4ade80", confused: "#facc15",
    neutral: "#9ca3af",
};

function emoji(e: string) { return EMOTION_EMOJI[e?.toLowerCase()] ?? "💭"; }
function color(e: string) { return EMOTION_COLOR[e?.toLowerCase()] ?? "#6366f1"; }
function label(e: string) {
    const k = e?.toLowerCase()?.trim() ?? "";
    const MAP: Record<string, string> = {
        joy: "Joyful", happy: "Happy", happiness: "Happy",
        sad: "Sad", sadness: "Sad", lonely: "Lonely",
        angry: "Frustrated", anger: "Frustrated",
        stressed: "Stressed", stress: "Stressed",
        anxious: "Anxious", anxiety: "Anxious", fear: "Worried",
        hopeful: "Hopeful", confused: "Confused", gratitude: "Grateful",
        neutral: "Neutral",
    };
    return MAP[k] ?? (e.charAt(0).toUpperCase() + e.slice(1).toLowerCase());
}

type FingerprintData = {
    topEmotions: { emotion: string; count: number; pct: number }[];
    weekDots: string[]; // 7 entries: today is last
    trend: "lighter" | "heavier" | "steady" | null;
    totalRecords: number;
    spanDays: number;
};

function computeFingerprint(): FingerprintData | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(HISTORY_KEY);
        if (!raw) return null;
        const all = JSON.parse(raw) as any[];
        if (!Array.isArray(all) || !all.length) return null;

        const now = Date.now();
        const dayMs = 86_400_000;
        const relevant = all.filter((r) => !r.deleted && r.emotion && r.emotion !== "neutral");
        if (relevant.length < 3) return null;

        // Emotion frequency (last 30 days)
        const last30 = relevant.filter((r) => (r.createdAt ?? 0) >= now - 30 * dayMs);
        const freq: Record<string, number> = {};
        for (const r of last30) freq[r.emotion] = (freq[r.emotion] ?? 0) + 1;
        const total = Object.values(freq).reduce((s, n) => s + n, 0);
        const topEmotions = Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([e, c]) => ({ emotion: e, count: c, pct: total > 0 ? Math.round((c / total) * 100) : 0 }));

        // 7-day dots
        const weekDots: string[] = [];
        for (let i = 6; i >= 0; i--) {
            const dayStart = now - (i + 1) * dayMs;
            const dayEnd = now - i * dayMs;
            const dayRecs = relevant.filter((r) => {
                const ts = r.createdAt ?? 0;
                return ts >= dayStart && ts < dayEnd;
            });
            if (!dayRecs.length) { weekDots.push(""); continue; }
            const f: Record<string, number> = {};
            for (const r of dayRecs) f[r.emotion] = (f[r.emotion] ?? 0) + 1;
            weekDots.push(Object.entries(f).sort((a, b) => b[1] - a[1])[0][0]);
        }

        // Trend
        const last3 = relevant.filter((r) => (r.createdAt ?? 0) >= now - 3 * dayMs);
        const prev4 = relevant.filter((r) => {
            const ts = r.createdAt ?? 0;
            return ts >= now - 7 * dayMs && ts < now - 3 * dayMs;
        });
        let trend: FingerprintData["trend"] = null;
        if (last3.length >= 2 && prev4.length >= 2) {
            const avg = (arr: any[]) => arr.reduce((s, r) => s + (r.intensity ?? 0.5), 0) / arr.length;
            const diff = avg(last3) - avg(prev4);
            trend = diff < -0.08 ? "lighter" : diff > 0.08 ? "heavier" : "steady";
        }

        // Oldest record span
        const oldest = relevant.reduce((min, r) => Math.min(min, r.createdAt ?? now), now);
        const spanDays = Math.max(1, Math.round((now - oldest) / dayMs));

        return { topEmotions, weekDots, trend, totalRecords: relevant.length, spanDays };
    } catch {
        return null;
    }
}

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function EmotionalFingerprint() {
    const [data, setData] = useState<FingerprintData | null>(null);

    useEffect(() => {
        setData(computeFingerprint());
    }, []);

    if (!data) return null;

    const todayIndex = new Date().getDay();
    const weekDayLabels = Array.from({ length: 7 }, (_, i) => {
        const daysBack = 6 - i;
        const d = new Date(Date.now() - daysBack * 86_400_000);
        return DAYS_SHORT[d.getDay()];
    });

    return (
        <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">Your emotional fingerprint</h2>
                    <p className="mt-0.5 text-xs text-zinc-500">
                        Patterns across {data.totalRecords} moments
                        {data.spanDays > 1 ? ` over ${data.spanDays < 30 ? data.spanDays + " days" : Math.round(data.spanDays / 30) + " months"}` : " today"}.
                    </p>
                </div>
                {data.trend && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                        data.trend === "lighter"
                            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                            : data.trend === "heavier"
                            ? "border-amber-400/40 bg-amber-500/10 text-amber-300"
                            : "border-zinc-500/40 bg-zinc-800/40 text-zinc-400"
                    }`}>
                        {data.trend === "lighter" ? "Easing ↓" : data.trend === "heavier" ? "Intensifying ↑" : "Steady →"}
                    </span>
                )}
            </div>

            {/* 7-day week dots */}
            <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-widest text-zinc-600">This week</p>
                <div className="flex gap-1.5">
                    {data.weekDots.map((e, i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                            <div
                                className="flex h-7 w-7 items-center justify-center rounded-full text-sm"
                                style={{
                                    backgroundColor: e ? `${color(e)}22` : "rgba(255,255,255,0.04)",
                                    border: `1px solid ${e ? `${color(e)}55` : "rgba(255,255,255,0.08)"}`,
                                }}
                                title={e ? label(e) : "No data"}
                            >
                                {e ? emoji(e) : <span className="text-[10px] text-zinc-600">–</span>}
                            </div>
                            <span className="text-[9px] text-zinc-600">{weekDayLabels[i]}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Top emotions bar chart */}
            {data.topEmotions.length > 0 && (
                <div>
                    <p className="mb-2 text-[10px] uppercase tracking-widest text-zinc-600">Most frequent (30 days)</p>
                    <div className="space-y-1.5">
                        {data.topEmotions.map(({ emotion, pct }) => (
                            <div key={emotion} className="flex items-center gap-2">
                                <span className="w-14 shrink-0 text-[11px] text-zinc-400">{label(emotion)}</span>
                                <div className="relative h-1.5 flex-1 rounded-full bg-white/8">
                                    <div
                                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                                        style={{ width: `${pct}%`, backgroundColor: color(emotion) }}
                                    />
                                </div>
                                <span className="w-7 shrink-0 text-right text-[10px] text-zinc-500">{pct}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
