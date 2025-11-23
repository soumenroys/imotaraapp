// src/app/loading.tsx
"use client";

export default function Loading() {
    return (
        <main
            className="mx-auto flex h-[85vh] w-full max-w-5xl items-center justify-center px-4 text-zinc-300"
            role="status"
            aria-busy="true"
            aria-live="polite"
        >
            <div className="imotara-glass-card flex flex-col items-center gap-4 rounded-2xl px-8 py-10 shadow-xl backdrop-blur-md">
                {/* Soft shimmer ring */}
                <div className="relative flex items-center justify-center">
                    <div className="absolute h-10 w-10 animate-ping rounded-full bg-emerald-400/20" />
                    <div className="h-3 w-3 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.7)]" />
                </div>

                <p className="text-sm font-medium text-zinc-100">
                    Loading Imotara…
                </p>

                <p className="text-xs text-zinc-400">
                    Preparing a calm space for you
                </p>
            </div>
        </main>
    );
}
