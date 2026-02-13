// src/components/imotara/VersionBanner.tsx

import pkg from "../../../package.json";

export default function VersionBanner() {
    // Single version source (same logic as footer)
    const raw =
        (process.env.NEXT_PUBLIC_APP_VERSION || "").trim() || (pkg?.version ?? "");

    // Normalize to clean production-safe format
    const clean = raw.replace(/^v/i, "").trim();
    const label = clean ? `v${clean}` : "v—";

    return (
        <div className="w-full border-b border-white/10 bg-gradient-to-r from-indigo-700/50 via-sky-700/40 to-emerald-700/40 py-1.5 text-center text-[11px] text-zinc-200 shadow-sm backdrop-blur-sm">
            Imotara · {label}
        </div>
    );
}

