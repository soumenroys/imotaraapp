"use client";

import useLicense from "@/hooks/useLicense";
import TopBar from "@/components/imotara/TopBar";
import LicenseBadge from "@/components/imotara/LicenseBadge";

export default function LicenseDebugClient() {
    const license = useLicense();

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
            <TopBar title="License Debug" showSyncChip={false} showConflictsButton={false} />

            <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-16 pt-20">
                <section className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-6 shadow-lg shadow-black/40 backdrop-blur">
                    <h1 className="text-xl font-semibold tracking-tight text-slate-50">
                        Licensing Status (Internal Debug)
                    </h1>

                    <div className="mt-2">
                        <LicenseBadge showMode />
                    </div>

                    <p className="mt-3 text-sm text-slate-400">
                        This page is only for development. It does not enforce anything.
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="rounded-xl border border-slate-800/80 bg-slate-900/80 p-4">
                            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                Status
                            </div>
                            <div className="mt-1 text-lg font-semibold text-emerald-400">
                                {license.status}
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-800/80 bg-slate-900/80 p-4">
                            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                Tier
                            </div>
                            <div className="mt-1 text-lg font-semibold text-indigo-400">
                                {license.tier}
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-800/80 bg-slate-900/80 p-4">
                            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                Mode
                            </div>
                            <div className="mt-1 text-lg font-semibold text-sky-400">
                                {license.mode}
                            </div>
                        </div>
                    </div>

                    <p className="mt-4 text-xs text-slate-500">
                        Currently, the helper always returns a{" "}
                        <span className="font-semibold text-emerald-400">valid</span>{" "}
                        <span className="font-semibold text-indigo-400">pro</span> license. Changing{" "}
                        <code className="rounded bg-slate-800 px-1.5 py-0.5 text-[0.7rem]">
                            NEXT_PUBLIC_IMOTARA_LICENSE_MODE
                        </code>{" "}
                        to{" "}
                        <code className="rounded bg-slate-800 px-1.5 py-0.5 text-[0.7rem]">log</code>{" "}
                        or{" "}
                        <code className="rounded bg-slate-800 px-1.5 py-0.5 text-[0.7rem]">
                            enforce
                        </code>{" "}
                        will only affect what you see here (for now).
                    </p>
                </section>
            </main>
        </div>
    );
}
