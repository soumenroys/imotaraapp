// src/app/reflect/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reflect",
  robots: { index: false },
};

export default function ReflectPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mx-auto max-w-sm space-y-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 text-2xl shadow-[0_10px_30px_rgba(15,23,42,0.6)] mx-auto">
          🔮
        </div>
        <h1 className="text-xl font-semibold text-zinc-100">
          Reflect — Coming Soon
        </h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Guided reflection sessions — structured prompts to help you slow down,
          process your day, and surface what's quietly weighing on you.
        </p>
        <p className="text-xs text-zinc-500">
          Try the Grow page now for daily reflection prompts, or chat with
          Imotara directly.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/grow"
            className="inline-block rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 px-6 py-2.5 text-sm font-medium text-black shadow transition hover:brightness-110"
          >
            Try Grow →
          </Link>
          <Link
            href="/chat"
            className="inline-block rounded-full border border-white/20 px-6 py-2.5 text-sm text-zinc-300 transition hover:bg-white/10"
          >
            Chat
          </Link>
        </div>
      </div>
    </div>
  );
}
