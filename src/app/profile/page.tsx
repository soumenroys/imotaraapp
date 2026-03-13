// src/app/profile/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import ProfileStreakProgress from "@/components/imotara/ProfileStreakProgress";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false },
};

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-lg space-y-6 px-6 py-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 text-2xl shadow-[0_10px_30px_rgba(15,23,42,0.6)]">
          🪞
        </div>
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Your Profile</h1>
          <p className="text-xs text-zinc-500">Long-term emotional fingerprint</p>
        </div>
      </div>

      {/* Emotional fingerprint teaser — blurred/locked */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm">
        {/* Blurred mock content */}
        <div className="pointer-events-none select-none blur-sm" aria-hidden="true">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Emotional Fingerprint
          </p>
          <div className="flex flex-wrap gap-2">
            {["Thoughtful", "Resilient", "Empathetic", "Introspective", "Curious"].map((t) => (
              <span key={t} className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300">{t}</span>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">Primary emotion this month:</span>
              <span className="text-sm font-medium text-zinc-100">😌 Calm</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">Streak:</span>
              <span className="text-sm font-medium text-amber-300">🔥 12 days</span>
            </div>
          </div>
        </div>
        {/* Lock overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 px-4 text-center backdrop-blur-sm">
          <span className="text-2xl">🔒</span>
          <p className="text-sm font-medium text-zinc-200">
            Unlocks after 7 days of journaling
          </p>
          <p className="text-xs text-zinc-500">
            Chat and reflect daily — your emotional fingerprint will emerge.
          </p>
          <Link
            href="/grow"
            className="mt-2 rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 px-5 py-2 text-xs font-medium text-black shadow transition hover:brightness-110"
          >
            Start reflecting today →
          </Link>
        </div>
      </div>

      {/* Streak progress toward fingerprint unlock */}
      <ProfileStreakProgress />

      {/* Settings bridge */}
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-400">
        Companion preferences and tone settings are available now in{" "}
        <Link href="/settings" className="text-indigo-400/80 underline underline-offset-2 hover:text-indigo-300 transition">
          Settings
        </Link>.
      </div>
    </div>
  );
}
