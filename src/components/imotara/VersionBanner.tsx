// src/components/imotara/VersionBanner.tsx
"use client";

export default function VersionBanner() {
    const version =
        process.env.NEXT_PUBLIC_IMOTARA_VERSION || "0.0.0-dev";

    return (
        <div className="w-full bg-gradient-to-r from-indigo-700/50 via-sky-700/40 to-emerald-700/40 backdrop-blur-sm border-b border-white/10 text-center py-1.5 text-[11px] text-zinc-200 shadow-sm">
            Imotara Web Beta · v{version}
        </div>
    );
}
