// src/app/loading.tsx
export default function Loading() {
    return (
        <main className="mx-auto flex h-[85vh] w-full max-w-5xl items-center justify-center px-4 text-zinc-300">
            <div className="imotara-glass-card flex flex-col items-center gap-4 rounded-2xl px-8 py-10">
                {/* Glow dot */}
                <div className="h-3 w-3 animate-pulse rounded-full bg-emerald-400" />

                <p className="text-sm font-medium text-zinc-100">
                    Loading Imotara…
                </p>

                <p className="text-xs text-zinc-400">
                    Preparing calm space for you
                </p>
            </div>
        </main>
    );
}
