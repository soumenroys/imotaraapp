// src/app/error.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Future: pipe to remote logger
        // eslint-disable-next-line no-console
        console.error("[imotara] App error boundary:", error);
    }, [error]);

    return (
        <html lang="en">
            <body className="bg-gradient-to-b from-slate-950 via-slate-900 to-black text-zinc-50">
                <main
                    className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-10"
                    role="alert"
                    aria-labelledby="error-title"
                >
                    <div className="imotara-glass-card w-full max-w-lg rounded-3xl px-6 py-8 shadow-xl backdrop-blur-md sm:px-8 sm:py-10">
                        {/* Tiny label */}
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
                            Imotara · Unexpected Error
                        </p>

                        {/* Heading */}
                        <h1
                            id="error-title"
                            className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl"
                        >
                            Something went a little off balance
                        </h1>

                        {/* Description */}
                        <p className="mt-4 text-sm leading-7 text-zinc-300">
                            An unexpected error occurred while rendering this page.
                            Your local data is still safe in this browser — this view just
                            couldn&apos;t complete.
                        </p>

                        {/* Dev-mode diagnostics */}
                        {process.env.NODE_ENV === "development" && (
                            <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/5 p-3 text-[11px] text-red-200">
                                <span className="font-semibold">Dev note:</span> Check the
                                console for full details.<br />
                                Digest:{" "}
                                <span className="font-mono">{error.digest ?? "n/a"}</span>
                            </p>
                        )}

                        {/* Buttons */}
                        <div className="mt-7 flex flex-wrap gap-3 text-sm">
                            <button
                                type="button"
                                onClick={reset}
                                className="inline-flex items-center rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-sky-900/50 transition hover:brightness-110"
                            >
                                Try again
                            </button>

                            <Link
                                href="/"
                                className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-zinc-100 shadow-sm backdrop-blur-sm transition hover:bg-white/10"
                            >
                                Go back home
                            </Link>

                            <Link
                                href="/connect"
                                className="inline-flex items-center rounded-full border border-white/15 bg-black/40 px-4 py-2 text-xs text-zinc-200 shadow-sm backdrop-blur-sm transition hover:bg-black/60"
                            >
                                Report this issue
                            </Link>
                        </div>

                        {/* Gentle footer */}
                        <p className="mt-5 text-[11px] text-zinc-500">
                            Imotara is still a gentle experiment.
                            Thank you for your patience while we stabilise things.
                        </p>
                    </div>
                </main>
            </body>
        </html>
    );
}
