// src/components/imotara/PageShell.tsx
"use client";

import React from "react";

export default function PageShell({
    children,
    className = "",
    ...rest
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={[
                "mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20 text-zinc-50",
                "animate-fade-in",
                className,
            ].join(" ")}
            {...rest}
        >
            {children}
        </div>
    );
}
