// src/components/imotara/ReplyOriginBadge.tsx
import React from "react";

type ReplyOriginBadgeProps = {
    origin?: "openai" | "local" | "local-fallback" | "unknown";
};

export default function ReplyOriginBadge({ origin }: ReplyOriginBadgeProps) {
    if (!origin || origin === "unknown") return null;

    const label =
        origin === "openai"
            ? "Cloud AI"
            : origin === "local-fallback"
                ? "Local (fallback)"
                : "Local only";

    const toneClasses =
        origin === "openai"
            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
            : "bg-slate-500/15 text-slate-200 border-slate-500/40";

    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${toneClasses}`}
        >
            {label}
        </span>
    );
}
