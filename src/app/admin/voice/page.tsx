"use client";

// /admin/voice — voice calls to warm contacts, driven by the Google Sheet.
//
// 🔑 THE SHEET STAYS THE PLACE THE TEAM WORKS. This page reads it, shows who
// can be called and why not, and queues the ones an admin ticks. The 5-minute
// cron places queued calls as lines free up and writes results back into the
// sheet ⇒ src/lib/voice/dispatch.ts.
//
// ⛔ Nothing rings while the sheet's Settings tab has calling_enabled off.

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell, useAdminRole } from "@/app/admin/_components/ui";
import { PageTutorial } from "@/app/admin/_components/PageTutorial";
import { ADMIN_TUTORIALS } from "@/app/admin/_components/adminTutorials";

type Row = {
  tab: string; row: number; name: string; organisation: string; phone: string; language: string;
  status: string; attempts: string; lastCall: string; outcome: string; summary: string; check: string;
};
type Preview = {
  setup: { sheets: boolean; bolna: boolean; webhookToken: boolean };
  sheetUrl: string;
  settings?: { callingEnabled: boolean; autoDispatch: boolean; maxConcurrency: number; dailyCap: number; alertEmails: string[] };
  contacts?: Row[];
  wouldCallNow?: { tab: string; row: number; name: string }[];
  dueIfAutomatic?: number;
  activeCalls?: number;
  error?: string;
};

const key = (r: { tab: string; row: number }) => `${r.tab}#${r.row}`;

export default function VoicePage() {
  const role = useAdminRole();
  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/admin/voice/preview", { credentials: "include" });
    if (res.status === 401) { setError("unauthorized"); return; }
    setData(await res.json());
  }, []);

  useEffect(() => { void load(); }, [load]);

  const callable = useMemo(() => (data?.contacts ?? []).filter((c) => c.check === "OK"), [data]);

  const run = async () => {
    const rows = (data?.contacts ?? []).filter((c) => chosen.has(key(c))).map((c) => ({ tab: c.tab, row: c.row }));
    if (rows.length === 0) return;
    if (!window.confirm(`Queue ${rows.length} call${rows.length === 1 ? "" : "s"}? Calls are placed two at a time.`)) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/voice/run", {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows }),
    });
    const body = await res.json();
    setBusy(false);
    setChosen(new Set());
    setMessage(
      res.ok
        ? `${body.queued} queued · ${body.placedNow?.length ?? 0} ringing now${body.failed?.length ? ` · ${body.failed.length} failed` : ""}${body.note ? ` — ${body.note}` : ""}`
        : body.error ?? "Something went wrong.",
    );
    void load();
  };

  return (
    <AdminShell
      title="Voice calls"
      lede="Calls warm contacts from the Imotara Call Directory sheet in their own language, and writes every result back into the sheet."
      current="voice"
      role={role}
    >
      <PageTutorial id="admin-voice" {...ADMIN_TUTORIALS.voice} />
      <div className="mt-6 space-y-6 text-sm">
        {error === "unauthorized" && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-200">
            Your admin session isn&apos;t active here. <a href="/admin" className="font-semibold underline">Log in at /admin</a> first.
          </div>
        )}

        {data && (
          <section className="rounded-2xl border border-zinc-700 p-4 space-y-2">
            <div className="font-semibold">Set-up</div>
            <div>Google sheet access: {data.setup.sheets ? "✅" : "⛔ not set up"} · Bolna: {data.setup.bolna ? "✅" : "⛔ not set up"} · Results webhook: {data.setup.webhookToken ? "✅" : "⛔ not set up"}</div>
            <div>
              <a href={data.sheetUrl} target="_blank" rel="noreferrer" className="underline">Open the Call Directory sheet</a>
            </div>
            {data.settings && (
              <div>
                Calling: <b>{data.settings.callingEnabled ? "ON" : "OFF"}</b> · Automatic: <b>{data.settings.autoDispatch ? "ON" : "OFF"}</b> · {data.settings.maxConcurrency} lines · cap {data.settings.dailyCap}/day · ringing now: {data.activeCalls ?? 0}
                <div className="text-zinc-400">Switch these in the sheet&apos;s Settings tab. Off unless it says yes.</div>
              </div>
            )}
            {data.error && <div className="text-red-400">{data.error}</div>}
          </section>
        )}

        {data?.contacts && (
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
                disabled={busy || chosen.size === 0}
                onClick={run}
              >
                {busy ? "Queuing…" : `Call ${chosen.size || ""} selected`}
              </button>
              <button className="underline" onClick={() => setChosen(new Set(callable.map(key)))}>Select all callable ({callable.length})</button>
              <button className="underline" onClick={() => void load()}>Refresh</button>
            </div>
            {message && <div className="rounded-xl border border-zinc-700 p-3">{message}</div>}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-zinc-400">
                  <tr><th /><th>Tab</th><th>Name</th><th>Language</th><th>Status</th><th>Tries</th><th>Last result</th><th>Check</th></tr>
                </thead>
                <tbody>
                  {data.contacts.map((c) => (
                    <tr key={key(c)} className="border-t border-zinc-800 align-top">
                      <td>
                        <input
                          type="checkbox"
                          disabled={c.check !== "OK"}
                          checked={chosen.has(key(c))}
                          onChange={(e) => {
                            const next = new Set(chosen);
                            if (e.target.checked) next.add(key(c)); else next.delete(key(c));
                            setChosen(next);
                          }}
                        />
                      </td>
                      <td>{c.tab}</td>
                      <td>{c.name}{c.organisation ? <div className="text-zinc-400">{c.organisation}</div> : null}</td>
                      <td>{c.language}</td>
                      <td>{c.status}</td>
                      <td>{c.attempts || 0}</td>
                      <td className="max-w-xs">{c.outcome}{c.summary ? <div className="text-zinc-400">{c.summary}</div> : null}</td>
                      <td className={c.check === "OK" ? "text-emerald-400" : "text-red-400"}>{c.check}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </AdminShell>
  );
}
