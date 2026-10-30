"use client";

// The daily list on Outreach mail and Voice calls: one day's emails or calls,
// from the admin's schedule in the sheet ⇒ lib/outreach/daily.

import { useCallback, useEffect, useState } from "react";

type Entry = { tab: string; row: number; name: string; organisation: string; what: string; at: string; theirTime: string; status: string };
type List = { day: string; mail: Entry[]; calls: Entry[]; error?: string };

const istDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const istTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const tone = (s: string) =>
  s.startsWith("✅") || s.startsWith("📞") ? "text-emerald-300" : s.startsWith("⛔") ? "text-red-300" : s.startsWith("⏸") ? "text-zinc-400" : "text-amber-200";

export function DailyList({ kind, historyHint }: { kind: "mail" | "calls"; historyHint: string }) {
  const [day, setDay] = useState(() => istDay(new Date()));
  const [data, setData] = useState<List | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/daily?date=${day}`, { credentials: "include" });
      setData((await res.json()) as List);
    } catch (e) {
      setData({ day, mail: [], calls: [], error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }, [day]);
  useEffect(() => { void load(); }, [load]);

  const rows = data ? data[kind] : [];
  const shift = (n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); setDay(d.toISOString().slice(0, 10)); };
  const done = rows.filter((r) => r.status.startsWith("✅") || r.status.startsWith("📞")).length;
  const problems = rows.filter((r) => r.status.startsWith("⛔")).length;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button className="rounded-lg border border-white/15 px-2 py-1" onClick={() => shift(-1)} aria-label="Previous day">‹</button>
        <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="rounded-lg border border-white/15 bg-black/30 px-3 py-1" />
        <button className="rounded-lg border border-white/15 px-2 py-1" onClick={() => shift(1)} aria-label="Next day">›</button>
        <button className="rounded-lg border border-white/15 px-3 py-1" onClick={() => setDay(istDay(new Date()))}>Today</button>
        <button className="rounded-lg border border-white/15 px-3 py-1" disabled={busy} onClick={() => void load()}>{busy ? "Loading…" : "Refresh"}</button>
        <span className="text-zinc-400">
          {rows.length} {kind === "mail" ? "email" : "call"}{rows.length === 1 ? "" : "s"} · {done} done{problems ? ` · ${problems} with a problem` : ""} · times in IST
        </span>
      </div>
      {data?.error && <p className="text-red-300">{data.error}</p>}
      {data && !data.error && rows.length === 0 && (
        <p className="text-zinc-400">
          Nothing on this day. {kind === "mail"
            ? "Emails appear here once a row has “Send emails?” = yes and a “First email date” + “First email time”."
            : "Calls appear here once a row has “Call them?” = yes and a “Call date” + “Call time”."}
        </p>
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-zinc-400"><tr><th>IST</th><th>Contact</th><th>Type</th><th>{kind === "mail" ? "Email" : "Call"}</th><th>Their time</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.tab}#${r.row}#${r.what}#${i}`} className="border-t border-white/10 align-top">
                  <td className="py-2 whitespace-nowrap">{istTime(r.at)}</td>
                  <td><div className="font-semibold">{r.name}</div>{r.organisation && <div className="text-zinc-400">{r.organisation}</div>}</td>
                  <td>{r.tab}</td>
                  <td>{r.what}</td>
                  <td className="text-zinc-400">{r.theirTime || "—"}</td>
                  <td className={tone(r.status)}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-zinc-500">{historyHint}</p>
    </section>
  );
}
