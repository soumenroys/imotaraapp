// src/components/imotara/BreathingWidget.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { hapticBreath } from "@/lib/imotara/haptic";

type Phase = "inhale" | "hold" | "exhale" | "rest";

type Pattern = {
  label: string;
  inhale: number;
  hold: number;
  exhale: number;
  rest: number;
};

const PATTERNS: Pattern[] = [
  { label: "Box (4-4-4-4)",    inhale: 4, hold: 4, exhale: 4, rest: 4 },
  { label: "4-7-8 Calming",    inhale: 4, hold: 7, exhale: 8, rest: 1 },
  { label: "Simple (4-0-6-0)", inhale: 4, hold: 0, exhale: 6, rest: 0 },
];

const PHASE_LABEL: Record<Phase, string> = {
  inhale: "Breathe in…",
  hold:   "Hold…",
  exhale: "Breathe out…",
  rest:   "Rest…",
};

const PHASE_COLOR: Record<Phase, string> = {
  inhale: "from-indigo-500 via-sky-400 to-emerald-400",
  hold:   "from-sky-400 via-indigo-400 to-indigo-500",
  exhale: "from-emerald-400 via-sky-400 to-indigo-500",
  rest:   "from-zinc-600 via-zinc-500 to-zinc-600",
};

type MusicTrack = "none" | "bowl" | "rain" | "ocean";

const MUSIC_OPTIONS: { id: MusicTrack; label: string; emoji: string }[] = [
  { id: "none",  label: "Silent", emoji: "🔇" },
  { id: "bowl",  label: "Bowl",   emoji: "🔔" },
  { id: "rain",  label: "Rain",   emoji: "🌧" },
  { id: "ocean", label: "Ocean",  emoji: "🌊" },
];

// ── Lotus mandala SVG ─────────────────────────────────────────────────────────
function LotusMandala() {
  return (
    <div className="relative w-full overflow-hidden rounded-t-2xl" style={{ height: 110, background: "linear-gradient(160deg,#1a0a38 0%,#0f172a 100%)" }}>
      {/* Starfield */}
      {[
        [8,12],[22,6],[40,18],[60,8],[80,22],[102,5],[120,15],[145,9],
        [165,20],[180,7],[200,16],[218,11],[235,22],[250,6],[270,18],
        [290,12],[310,8],[330,20],[350,14],[370,6],[48,28],[90,35],
        [135,30],[200,32],[260,28],[320,35],[155,42],[85,50],[230,45],
      ].map(([x, y], i) => (
        <div key={i} style={{
          position: "absolute", left: x, top: y,
          width: i % 4 === 0 ? 2 : 1.5, height: i % 4 === 0 ? 2 : 1.5,
          borderRadius: "50%",
          background: `rgba(255,255,255,${0.25 + 0.5 * ((i * 7) % 10) / 10})`,
        }} />
      ))}

      {/* SVG mandala centred */}
      <svg
        viewBox="-80 -80 160 160"
        width={100} height={100}
        style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-55%)" }}
      >
        <style>{`
          @keyframes spin-slow  { from { transform: rotate(0deg);   } to { transform: rotate(360deg);  } }
          @keyframes spin-rev   { from { transform: rotate(0deg);   } to { transform: rotate(-360deg); } }
          @keyframes glow-pulse { 0%,100% { opacity:.35; r:10; } 50% { opacity:.80; r:13; } }
          .outer-ring { animation: spin-slow 30s linear infinite; transform-origin: 0 0; }
          .inner-ring { animation: spin-rev  20s linear infinite; transform-origin: 0 0; }
          .jewel      { animation: glow-pulse 4s ease-in-out infinite; }
        `}</style>

        {/* Outer glow halo */}
        <circle cx="0" cy="0" r="58" fill="rgba(167,139,250,0.07)" />

        {/* Outer petals × 8 */}
        <g className="outer-ring">
          {Array.from({ length: 8 }, (_, i) => (
            <ellipse
              key={i}
              cx="0" cy="-44" rx="8" ry="18"
              fill="rgba(167,139,250,0.18)"
              stroke="rgba(167,139,250,0.55)"
              strokeWidth="0.7"
              transform={`rotate(${i * 45})`}
            />
          ))}
        </g>

        {/* Mid petals × 8 (offset 22.5°) */}
        <g className="inner-ring">
          {Array.from({ length: 8 }, (_, i) => (
            <ellipse
              key={i}
              cx="0" cy="-28" rx="5" ry="12"
              fill="rgba(56,189,248,0.22)"
              stroke="rgba(56,189,248,0.55)"
              strokeWidth="0.6"
              transform={`rotate(${i * 45 + 22.5})`}
            />
          ))}
        </g>

        {/* Inner ring of dots */}
        {Array.from({ length: 12 }, (_, i) => (
          <circle
            key={i}
            cx={Math.cos((i * 30 - 90) * Math.PI / 180) * 18}
            cy={Math.sin((i * 30 - 90) * Math.PI / 180) * 18}
            r="1.5"
            fill="rgba(251,191,36,0.60)"
          />
        ))}

        {/* Centre jewel */}
        <circle cx="0" cy="0" r="10" fill="rgba(251,191,36,0.22)" stroke="rgba(251,191,36,0.80)" strokeWidth="1.2" className="jewel" />
        <circle cx="0" cy="0" r="4"  fill="rgba(251,191,36,0.60)" />
      </svg>

      {/* Label */}
      <div style={{ position: "absolute", bottom: 10, width: "100%", textAlign: "center" }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.2em", color: "rgba(196,181,253,0.70)" }}>
          BREATHE &amp; BE
        </span>
      </div>
    </div>
  );
}

export default function BreathingWidget({ onClose }: { onClose?: () => void }) {
  const [patternIdx, setPatternIdx] = useState(0);
  const [running, setRunning]       = useState(false);
  const [phase, setPhase]           = useState<Phase>("inhale");
  const [remaining, setRemaining]   = useState(0);
  const [cycles, setCycles]         = useState(0);
  const [musicTrack, setMusicTrack] = useState<MusicTrack>("bowl");

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const seqRef    = useRef<{ phase: Phase; secs: number }[]>([]);
  const stepRef   = useRef(0);
  const secRef    = useRef(0);
  const audioRef  = useRef<HTMLAudioElement | null>(null);

  const pattern = PATTERNS[patternIdx];

  // ── Music helpers ──────────────────────────────────────────────────────────
  const stopMusic = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  const startMusic = useCallback((track: MusicTrack) => {
    stopMusic();
    if (track === "none") return;
    const audio = new Audio(`/sounds/${track}.wav`);
    audio.loop   = true;
    audio.volume = 0.35;
    audio.play().catch(() => {});
    audioRef.current = audio;
  }, [stopMusic]);

  // ── Breathing logic ────────────────────────────────────────────────────────
  function buildSeq(p: Pattern) {
    const seq: { phase: Phase; secs: number }[] = [];
    if (p.inhale > 0) seq.push({ phase: "inhale", secs: p.inhale });
    if (p.hold   > 0) seq.push({ phase: "hold",   secs: p.hold });
    if (p.exhale > 0) seq.push({ phase: "exhale", secs: p.exhale });
    if (p.rest   > 0) seq.push({ phase: "rest",   secs: p.rest });
    return seq;
  }

  function start() {
    const seq = buildSeq(pattern);
    seqRef.current  = seq;
    stepRef.current = 0;
    secRef.current  = seq[0].secs;
    setPhase(seq[0].phase);
    setRemaining(seq[0].secs);
    setCycles(0);
    setRunning(true);
    startMusic(musicTrack);
  }

  function stop() {
    setRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    stopMusic();
  }

  useEffect(() => {
    if (!running) return;
    timerRef.current = setInterval(() => {
      secRef.current -= 1;
      setRemaining(secRef.current);
      if (secRef.current <= 0) {
        const seq      = seqRef.current;
        const nextStep = (stepRef.current + 1) % seq.length;
        stepRef.current = nextStep;
        if (nextStep === 0) setCycles((c) => c + 1);
        secRef.current = seq[nextStep].secs;
        setPhase(seq[nextStep].phase);
        setRemaining(seq[nextStep].secs);
        hapticBreath();
      }
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running]);

  // Stop music on unmount
  useEffect(() => () => stopMusic(), [stopMusic]);

  const dur = running
    ? (phase === "inhale" ? pattern.inhale : phase === "hold" ? pattern.hold : phase === "exhale" ? pattern.exhale : pattern.rest)
    : 4;

  return (
    <div className="relative rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl shadow-xl animate-fade-in overflow-hidden">

      {/* Lotus mandala header */}
      <LotusMandala />

      {/* Close button overlaid */}
      {onClose && (
        <button
          type="button"
          onClick={() => { stop(); onClose(); }}
          className="absolute top-3 right-3 z-10 rounded-full bg-black/40 p-1.5 text-white/70 hover:text-white transition"
          style={{ lineHeight: 1 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
      )}

      <div className="px-5 py-3 relative">
        {/* Title */}
        <div className="mb-3">
          <p className="text-sm font-semibold text-zinc-100">Breathing Exercise</p>
          <p className="text-[11px] text-zinc-500">Ground yourself with a few slow breaths</p>
        </div>

        {/* Pattern selector */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PATTERNS.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { stop(); setPatternIdx(i); }}
              className={`rounded-full px-3 py-1 text-[11px] border transition ${i === patternIdx ? "bg-indigo-500/20 border-indigo-400/50 text-indigo-200" : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Music selector — compact pill row */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[10px] font-semibold tracking-widest text-zinc-500 shrink-0">SOUND</span>
          <div className="flex gap-1.5">
            {MUSIC_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setMusicTrack(opt.id);
                  if (running) startMusic(opt.id);
                }}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${
                  musicTrack === opt.id
                    ? "border-violet-400/50 bg-violet-500/15 text-violet-300"
                    : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
                }`}
              >
                <span>{opt.emoji}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Circle */}
        <div className="relative mx-auto mb-3 flex h-28 w-28 items-center justify-center">
          {running && (
            <div
              className={`absolute inset-0 rounded-full bg-gradient-to-br ${PHASE_COLOR[phase]} animate-breath-ring opacity-30`}
              style={{ "--breath-dur": `${dur}s` } as React.CSSProperties}
            />
          )}
          <div
            className={`h-24 w-24 rounded-full bg-gradient-to-br ${running ? PHASE_COLOR[phase] : "from-zinc-700 to-zinc-800"} shadow-[0_0_40px_rgba(99,102,241,0.3)] flex items-center justify-center transition-all duration-500 ${running ? "animate-breath-expand" : ""}`}
            style={{ "--breath-dur": `${dur}s` } as React.CSSProperties}
          >
            <div className="text-center">
              {running ? (
                <>
                  <p className="text-2xl font-bold text-white">{remaining}</p>
                  <p className="text-[10px] text-white/70">{PHASE_LABEL[phase]}</p>
                </>
              ) : (
                <p className="text-[11px] text-zinc-400">Ready</p>
              )}
            </div>
          </div>
        </div>

        {/* Cycles */}
        {running && (
          <p className="mb-3 text-center text-[11px] text-zinc-500">
            Cycle {cycles + 1}
          </p>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-3">
          {!running ? (
            <button
              type="button"
              onClick={start}
              className="im-cta-bg rounded-full px-6 py-2 text-sm font-medium text-black shadow transition hover:brightness-110"
            >
              Start
            </button>
          ) : (
            <button
              type="button"
              onClick={stop}
              className="rounded-full border border-white/20 px-6 py-2 text-sm text-zinc-300 transition hover:bg-white/10"
            >
              Stop
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
