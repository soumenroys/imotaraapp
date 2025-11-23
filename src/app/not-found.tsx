// src/app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
    return (
        <main className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-5xl items-center px-4 py-16 text-zinc-50 sm:px-6">
            <div className="w-full">
                <div className="imotara-glass-card rounded-2xl px-6 py-8 sm:px-8 sm:py-10">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
                        Imotara · 404
                    </p>

                    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
                        This page drifted away
                    </h1>

                    <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-300">
                        The link you followed doesn&apos;t exist anymore, or maybe it never
                        did. Your conversations and emotion history are still safe — this is
                        just a missing page.
                    </p>

                    <div className="mt-6 flex flex-wrap gap-3">
                        <Link
                            href="/"
                            className="inline-flex items-center rounded-full border border-white/20 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-sky-900/40 transition hover:brightness-110"
                        >
                            ← Back to Home
                        </Link>

                        <Link
                            href="/chat"
                            className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-zinc-100 shadow-sm transition hover:bg-white/10"
                        >
                            Open Chat
                        </Link>

                        <Link
                            href="/history"
                            className="inline-flex items-center rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm text-zinc-100 shadow-sm transition hover:bg-black/60"
                        >
                            View Emotion History
                        </Link>
                    </div>

                    <p className="mt-5 text-xs text-zinc-500">
                        If you reached this page from a bookmark, the route may have
                        changed. Try navigating from the home page instead.
                    </p>
                </div>
            </div>
        </main>
    );
}
