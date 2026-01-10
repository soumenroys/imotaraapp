"use client";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="mx-auto flex min-h-[60vh] w-full max-w-5xl flex-col items-center justify-center px-4 py-10 text-zinc-50">
            <div className="imotara-glass-card w-full rounded-2xl p-6 sm:p-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
                    Imotara · Error
                </p>
                <h1 className="mt-2 text-lg font-semibold text-zinc-50 sm:text-xl">
                    Something went wrong
                </h1>
                <p className="mt-2 text-sm text-zinc-300">
                    Please try again. If it keeps happening, refresh the page.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => reset()}
                        className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-zinc-100 shadow-sm transition hover:bg-white/20"
                    >
                        Try again
                    </button>

                    <a
                        href="/chat"
                        className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-100 shadow-sm transition hover:bg-white/10"
                    >
                        Go to Chat
                    </a>
                </div>

                {process.env.NODE_ENV !== "production" ? (
                    <pre className="mt-5 max-h-56 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] text-zinc-300">
                        {String(error?.message || error)}
                    </pre>
                ) : null}
            </div>
        </div>
    );
}
