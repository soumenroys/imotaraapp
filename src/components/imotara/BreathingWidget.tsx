// src/components/imotara/BreathingWidget.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "inhale" | "hold" | "exhale" | "rest";

type Pattern = {
  label: string;
  inhale: number;
  hold: number;
  exhale: number;
  rest: number;
};

const PATTERNS: Pattern[] = [
  { label: "Box (4-4-4-4)",   inhale: 4, hold: 4, exhale: 4, rest: 4 },
  { label: "4-7-8 Calming",   inhale: 4, hold: 7, exhale: 8, rest: 1 },
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

export default function BreathingWidget({ onClose }: { onClose?: () => void }) {
  const [patternIdx, setPatternIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>("inhale");
  const [remaining, setRemaining] = useState(0);
  const [cycles, setCycles] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seqRef = useRef<{ phase: Phase; secs: number }[]>([]);
  const stepRef = useRef(0);
  const secRef = useRef(0);

  const pattern = PATTERNS[patternIdx];

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
    seqRef.current = seq;
    stepRef.current = 0;
    secRef.current = seq[0].secs;
    setPhase(seq[0].phase);
    setRemaining(seq[0].secs);
    setCycles(0);
    setRunning(true);
  }

  function stop() {
    setRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  useEffect(() => {
    if (!running) return;
    timerRef.current = setInterval(() => {
      secRef.current -= 1;
      setRemaining(secRef.current);
      if (secRef.current <= 0) {
        const seq = seqRef.current;
        const nextStep = (stepRef.current + 1) % seq.length;
        stepRef.current = nextStep;
        if (nextStep === 0) setCycles((c) => c + 1);
        secRef.current = seq[nextStep].secs;
        setPhase(seq[nextStep].phase);
        setRemaining(seq[nextStep].secs);
      }
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running]);

  // Dur CSS var for animations
  const dur = running
    ? (phase === "inhale" ? pattern.inhale : phase === "hold" ? pattern.hold : phase === "exhale" ? pattern.exhale : pattern.rest)
    : 4;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/50 px-5 py-5 backdrop-blur-xl shadow-xl animate-fade-in">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-100">Breathing Exercise</p>
          <p className="text-[11px] text-zinc-500">Ground yourself with a few slow breaths</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition text-lg leading-none">✕</button>
        )}
      </div>

      {/* Pattern selector */}
      <div className="mb-4 flex flex-wrap gap-1.5">
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

      {/* Circle */}
      <div className="relative mx-auto mb-4 flex h-36 w-36 items-center justify-center">
        {/* Ring ping */}
        {running && (
          <div
            className={`absolute inset-0 rounded-full bg-gradient-to-br ${PHASE_COLOR[phase]} animate-breath-ring opacity-30`}
            style={{ "--breath-dur": `${dur}s` } as React.CSSProperties}
          />
        )}
        {/* Main circle */}
        <div
          className={`h-28 w-28 rounded-full bg-gradient-to-br ${running ? PHASE_COLOR[phase] : "from-zinc-700 to-zinc-800"} shadow-[0_0_40px_rgba(99,102,241,0.3)] flex items-center justify-center transition-all duration-500 ${running ? "animate-breath-expand" : ""}`}
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
            className="rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 px-6 py-2 text-sm font-medium text-black shadow transition hover:brightness-110"
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
  );
}
