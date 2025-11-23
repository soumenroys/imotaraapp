// src/components/imotara/PageShell.tsx
"use client";

export default function PageShell({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20 text-zinc-50">
            {children}
        </div>
    );
}
