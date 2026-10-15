"use client";

// src/components/admin/BroadcastTemplateUsage.tsx
// Which of the 50 templates have been used, how often, and how they did.
//
// Owner request, 2026-10-15: "a counter with template content so that admin
// can see which template was sent how many times with details".
//
// ⚠️ `used` and `unedited` are shown as separate numbers rather than one
// count. A template is a starting point the admin then rewrites, so a single
// figure would claim a message still says what the template says when it may
// not. The split is the honest version and it is also the useful one — a
// template that is always heavily edited is a template that needs rewriting.

import { useCallback, useEffect, useState } from "react";
import { adminFetchOpts } from "@/lib/imotara/adminFetch";

type Row = {
    id: string;
    audienceLabel: string;
    title: string;
    subject: string;
    used: number;
    sent: number;
    unedited: number;
    recipients: number;
    delivered: number;
    bounced: number;
    bounceRate: number | null;
    lastUsed: string | null;
};

export default function BroadcastTemplateUsage({ token }: { token: string }) {
    const [rows, setRows] = useState<Row[] | null>(null);
    const [migrationNeeded, setMigrationNeeded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [onlyUsed, setOnlyUsed] = useState(true);

    const load = useCallback(async () => {
        setError(null);
        try {
            const res = await fetch("/api/admin/broadcast/templates", adminFetchOpts(token));
            const j = await res.json().catch(() => ({}));
            if (!res.ok) { setError(j.error ?? `HTTP ${res.status}`); return; }
            setMigrationNeeded(Boolean(j.migrationNeeded));
            setRows(j.usage ?? []);
        } catch {
            setError("Could not reach the server");
        }
    }, [token]);

    useEffect(() => { void load(); }, [load]);

    if (error) {
        return <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>;
    }
    if (!rows) {
        return <p className="p-4 text-sm text-zinc-500">Loading…</p>;
    }

    // ⚠️ Said plainly rather than rendering an empty table, which would read as
    // "no template has ever been used" when the truth is "nothing is recorded yet".
    if (migrationNeeded) {
        return (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                <p className="text-sm font-semibold text-amber-200">Usage is not being recorded yet</p>
                <p className="mt-1.5 text-xs leading-relaxed text-amber-200/80">
                    The template columns have not been added to the database. Run{" "}
                    <code className="rounded bg-black/30 px-1 py-0.5">docs/sql/broadcast_template_usage.sql</code>{" "}
                    and reload this page. Nothing is lost in the meantime — messages sent before
                    the migration simply will not be attributed to a template.
                </p>
            </div>
        );
    }

    const shown = onlyUsed ? rows.filter((r) => r.used > 0) : rows;
    const totalUsed = rows.reduce((n, r) => n + r.used, 0);
    const neverUsed = rows.filter((r) => r.used === 0).length;

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-zinc-500">
                    {totalUsed} message{totalUsed === 1 ? "" : "s"} started from a template ·{" "}
                    {neverUsed} of {rows.length} templates never used
                </p>
                <button
                    type="button"
                    onClick={() => setOnlyUsed((v) => !v)}
                    className="rounded-lg bg-white/5 px-2.5 py-1 text-[11px] text-zinc-400 transition hover:bg-white/10"
                >
                    {onlyUsed ? "Show all 50" : "Show only used"}
                </button>
            </div>

            {shown.length === 0 ? (
                <p className="rounded-xl border border-white/8 bg-white/3 p-4 text-sm text-zinc-500">
                    No template has been used yet. Pick one in the composer and it will appear here.
                </p>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-white/8">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-zinc-500">
                            <tr>
                                <th className="px-3 py-2 font-semibold">Template</th>
                                <th className="px-3 py-2 font-semibold">Audience</th>
                                <th className="px-3 py-2 text-right font-semibold">Used</th>
                                <th className="px-3 py-2 text-right font-semibold">Sent</th>
                                <th className="px-3 py-2 text-right font-semibold">Unedited</th>
                                <th className="px-3 py-2 text-right font-semibold">Recipients</th>
                                <th className="px-3 py-2 text-right font-semibold">Delivered</th>
                                <th className="px-3 py-2 text-right font-semibold">Bounced</th>
                                <th className="px-3 py-2 font-semibold">Last used</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shown.map((r) => (
                                <tr key={r.id} className="border-t border-white/5 align-top">
                                    <td className="px-3 py-2">
                                        <span className="font-medium text-zinc-200">{r.title}</span>
                                        <span className="mt-0.5 block text-[11px] text-zinc-500">{r.subject}</span>
                                    </td>
                                    <td className="px-3 py-2 text-zinc-400">{r.audienceLabel}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-zinc-200">{r.used}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{r.sent}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
                                        {r.unedited}
                                        {r.used > 0 && r.unedited < r.used && (
                                            <span className="ml-1 text-[10px] text-amber-300/70">
                                                {r.used - r.unedited} edited
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{r.recipients}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-emerald-300/80">{r.delivered}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                        <span className={r.bounceRate !== null && r.bounceRate > 5 ? "text-rose-300" : "text-zinc-400"}>
                                            {r.bounced}
                                        </span>
                                        {/* ⚠️ A rate is only shown once something was actually sent —
                                            "0%" against zero recipients would look like a measurement. */}
                                        {r.bounceRate !== null && (
                                            <span className="ml-1 text-[10px] text-zinc-600">{r.bounceRate}%</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-zinc-500">
                                        {r.lastUsed ? r.lastUsed.slice(0, 10) : "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <p className="text-[10px] leading-relaxed text-zinc-600">
                <strong className="text-zinc-500">Used</strong> counts drafts started from the
                template, whether or not they were sent. <strong className="text-zinc-500">Unedited</strong>{" "}
                counts those whose wording still matched it when saved — a template that is always
                edited is one worth rewriting.
            </p>
        </div>
    );
}
