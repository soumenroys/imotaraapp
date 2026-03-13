// src/app/feel/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feel",
  robots: { index: false },
};

export default function FeelPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mx-auto max-w-sm space-y-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 text-2xl shadow-[0_10px_30px_rgba(15,23,42,0.6)] mx-auto">
          🌱
        </div>
        <h1 className="text-xl font-semibold text-zinc-100">
          Feel — Coming Soon
        </h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          A dedicated mood check-in space with quick prompts, mood patterns, and
          a quiet space to log how you're feeling — separate from the main chat.
        </p>
        <p className="text-xs text-zinc-500">
          For now, you can share how you're feeling directly in Chat — Imotara
          listens and reflects your mood automatically.
        </p>
        <Link
          href="/chat"
          className="inline-block rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 px-6 py-2.5 text-sm font-medium text-black shadow transition hover:brightness-110"
        >
          Go to Chat →
        </Link>
      </div>
    </div>
  );
}
