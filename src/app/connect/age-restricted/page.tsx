// src/app/connect/age-restricted/page.tsx
// Shown when a user under 18 tries to access Imotara Connect.
import Link from "next/link";

export const metadata = { title: "Age Restriction · Imotara Connect" };

export default function AgeRestrictedPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-20 text-center">
      <div className="imotara-glass-card rounded-2xl p-10">
        <div className="mb-4 text-5xl">🔒</div>
        <h1 className="text-xl font-semibold text-zinc-50">Age Restriction</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          Imotara Connect is available to users aged <strong>18 and above</strong> only.
          This service involves real-time conversations with wellness companions and is not
          suitable for minors.
        </p>
        <p className="mt-4 text-xs leading-relaxed text-zinc-500">
          Our AI companion on the main chat is still available to you and provides
          free, unlimited support.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/chat"
            className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
          >
            Go to AI Chat
          </Link>
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition">
            Return to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
