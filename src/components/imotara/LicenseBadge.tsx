// src/components/imotara/LicenseBadge.tsx
"use client";

import useLicense from "@/hooks/useLicense";

type LicenseBadgeProps = {
    showMode?: boolean; // whether to show "off/log/enforce" for debugging
};

export default function LicenseBadge({ showMode = false }: LicenseBadgeProps) {
    const license = useLicense();

    const tierLabel: Record<string, string> = {
        free: "Free",
        plus: "Plus",
        pro: "Pro",
        family: "Family",
    };

    const statusLabel: Record<string, string> = {
        valid: "Active",
        invalid: "Invalid",
        expired: "Expired",
        trial: "Trial",
        free: "Free",
    };

    const accentClass =
        license.tier === "pro"
            ? "bg-indigo-500/20 text-indigo-200 ring-indigo-400/50"
            : license.tier === "plus"
                ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/40"
                : "bg-slate-800/80 text-slate-300 ring-slate-600/60";

    return (
        <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${accentClass}`}
        >
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>{tierLabel[license.tier] ?? license.tier}</span>
            <span className="text-slate-400/90">
                {statusLabel[license.status] ?? license.status}
            </span>
            {showMode && (
                <span className="rounded-full bg-slate-900/70 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-slate-400">
                    {license.mode}
                </span>
            )}
        </div>
    );
}
