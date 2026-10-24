"use client";

// /admin/voice — the calling console.
//
// 🔑 The Google Sheet stays the contact list (owner, 24 Oct 2026); Bolna keeps the
// call log. This page reads both and gives the team one place to call now,
// schedule, read every call back (recording, transcript, outcome) and see the
// numbers — like the social media monitoring pages.
//
// ⛔ Nothing here bypasses a rule: every dial goes through the same kill switch,
// contact check (consent, do-not-call, language, the Individuals switch) and
// local calling hours as the automatic dispatcher ⇒ src/lib/voice/dispatch.ts.

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell, useAdminRole } from "@/app/admin/_components/ui";
import { PageTutorial } from "@/app/admin/_components/PageTutorial";
import { ADMIN_TUTORIALS } from "@/app/admin/_components/adminTutorials";
import { LineChart, Bars, Donut } from "@/app/admin/_components/charts";
import { CallFlow } from "./CallFlow";

type Row = {
  tab: string; row: number; name: string; organisation: string; phone: string; language: string;
  status: string; attempts: string; lastCall: string; outcome: string; summary: string; check: string;
  followUp: string; nextAction: string; voice: string; country: string; timeZone: string; teamMember: string; type: string;
  /** A Scheduled row whose time passed by more than the grace period — it will not be called. */
  missed?: boolean;
  /** Safety, Needs review, Dial failed, Meeting booked, Send info — a person acts on these. */
  needsPerson?: boolean;
};
type Settings = { callingEnabled: boolean; autoDispatch: boolean; maxConcurrency: number; dailyCap: number; alertEmails: string[]; allowIndividuals?: boolean };
type Preview = {
  setup: { sheets: boolean; bolna: boolean; webhookToken: boolean };
  sheetUrl: string;
  settings?: Settings;
  contacts?: Row[];
  activeCalls?: number;
  error?: string;
};
type Call = {
  id: string; createdAt: string; language: string; voice: string; status: string; durationSec: number; costCents: number;
  phone: string; name: string; organisation: string; tab: string; placedBy: string; outcome: string; summary: string;
  nextAction: string; transcript: string; recordingUrl: string; hangupBy: string; error: string;
};
type Report = {
  total: number; connected: number; connectRate: number; totalMinutes: number; avgDurationSec: number; costCents: number;
  byOutcome: Record<string, number>; byStatus: Record<string, number>; byLanguage: Record<string, number>;
  byTab: Record<string, number>; byPlacedBy: Record<string, number>;
  perDay: { day: string; calls: number; connected: number; costCents: number }[]; safety: number; meetings: number;
};
type Tab = "contacts" | "scheduled" | "calls" | "reports" | "settings";

const key = (r: { tab: string; row: number }) => `${r.tab}#${r.row}`;
/** ⛔ Every action names the row AND the phone shown, so a sheet edited meanwhile cannot ring someone else. */
const ref = (c: Row) => ({ tab: c.tab, row: c.row, phone: c.phone });
type Ref = ReturnType<typeof ref>;
const TABS: { id: Tab; label: string }[] = [
  { id: "contacts", label: "Contacts" },
  { id: "scheduled", label: "Scheduled" },
  { id: "calls", label: "Call records" },
  { id: "reports", label: "Reports" },
  { id: "settings", label: "Settings" },
];
const CONTACT_TABS = ["NGOs", "Education", "Eldercare", "Corporates", "Individuals"];
const LANGS: [string, string][] = [
  ["en", "English"], ["hi", "Hindi"], ["bn", "Bengali"], ["mr", "Marathi"], ["ta", "Tamil"], ["te", "Telugu"], ["gu", "Gujarati"],
  ["pa", "Punjabi"], ["kn", "Kannada"], ["ml", "Malayalam"], ["or", "Odia"], ["ur", "Urdu"], ["es", "Spanish"], ["fr", "French"],
  ["de", "German"], ["pt", "Portuguese"], ["ru", "Russian"], ["ar", "Arabic"], ["zh", "Mandarin"], ["ja", "Japanese"], ["he", "Hebrew"], ["id", "Indonesian"],
];
const OUTCOME_LABEL: Record<string, string> = {
  meeting_booked: "Meeting booked", interested: "Interested", send_info: "Send info", callback_requested: "Callback",
  not_interested: "Not interested", do_not_call: "Do not call", wrong_number: "Wrong number", safety: "SAFETY", "—": "No outcome",
};
const COLORS = ["#34d399", "#60a5fa", "#a78bfa", "#fbbf24", "#f87171", "#22d3ee", "#f472b6", "#94a3b8", "#fb923c"];

const fmtTime = (iso: string) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");
const fmtDur = (s: number) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "—");
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const toRows = (m: Record<string, number>, label: (k: string) => string = (k) => k) =>
  Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: label(k), value: v }));

async function post(url: string, body: unknown, method = "POST") {
  try {
    const res = await fetch(url, { method, credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    // ⚠️ A failure with no message used to read as "0 ringing now".
    if (!res.ok && !json.error && !json.reason) json.error = `The server could not do that (${res.status}). Nothing was changed.`;
    return { ok: res.ok, json };
  } catch {
    return { ok: false, json: { error: "Could not reach the server. Check the connection and try again." } };
  }
}

const skippedText = (skipped?: { name: string; reason: string }[]) =>
  skipped?.length ? ` ${skipped.length} not done: ${skipped.map((s) => `${s.name} (${s.reason})`).join("; ")}` : "";

function describeCallNow(j: { placed?: unknown[]; queued?: unknown[]; skipped?: { name: string; reason: string }[]; reason?: string; error?: string }) {
  if (j.reason || j.error) return j.reason ?? j.error!;
  const parts = [`${j.placed?.length ?? 0} ringing now`];
  if (j.queued?.length) parts.push(`${j.queued.length} queued for the next free line`);
  if (j.skipped?.length) parts.push(`${j.skipped.length} not called: ${j.skipped.map((s) => `${s.name} (${s.reason})`).join("; ")}`);
  return parts.join(" · ");
}

export default function VoicePage() {
  const role = useAdminRole();
  const [tab, setTab] = useState<Tab>("contacts");
  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // 🔑 One call log for both tabs: Call records and Reports used to load it separately (10–30 s each).
  const [days, setDays] = useState(30);
  const calls = useCalls(days, tab === "calls" || tab === "reports");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/voice/preview", { credentials: "include" });
    if (res.status === 401) { setError("unauthorized"); return; }
    setError(null);
    setData(await res.json());
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <AdminShell
      title="Voice calls"
      lede="Call contacts from the Imotara Call Directory in their own language — now or at a time you choose — and read every call back."
      current="voice"
      role={role}
    >
      <PageTutorial id="admin-voice" {...ADMIN_TUTORIALS.voice} />
      <div className="mt-6 space-y-5 text-sm">
        {error === "unauthorized" && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-200">
            Your admin session isn&apos;t active here. <a href="/admin" className="font-semibold underline">Log in at /admin</a> first.
          </div>
        )}
        {data && <StatusStrip data={data} />}
        {data && <CallFlow callingOn={!!data.settings?.callingEnabled} autoOn={!!data.settings?.autoDispatch} />}
        <nav className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-1.5 font-semibold ${tab === t.id ? "bg-white text-zinc-900" : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        {message && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-zinc-700 bg-zinc-900 p-3">
            <span>{message}</span>
            <button className="text-zinc-400" onClick={() => setMessage(null)} aria-label="Dismiss">✕</button>
          </div>
        )}
        {tab === "contacts" && data?.contacts && <ContactsTab data={data} reload={load} say={setMessage} />}
        {tab === "scheduled" && data?.contacts && <ScheduledTab data={data} reload={load} say={setMessage} />}
        {tab === "calls" && <CallsTab calls={calls} days={days} setDays={setDays} />}
        {tab === "reports" && <ReportsTab calls={calls} days={days} setDays={setDays} />}
        {tab === "settings" && data && <SettingsTab data={data} reload={load} say={setMessage} />}
      </div>
    </AdminShell>
  );
}

function StatusStrip({ data }: { data: Preview }) {
  const s = data.settings;
  return (
    <section className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-zinc-700 p-4">
      <span className={`rounded-full px-3 py-1 font-bold ${s?.callingEnabled ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
        Calling {s?.callingEnabled ? "ON" : "OFF"}
      </span>
      <span>Automatic: <b>{s?.autoDispatch ? "on" : "off"}</b></span>
      <span>Individuals: <b>{s?.allowIndividuals ? "allowed" : "paused"}</b></span>
      <span>On a call now: <b>{data.activeCalls ?? 0}</b></span>
      <span className="text-zinc-400">
        Google {data.setup.sheets ? "✅" : "⛔"} · Imotara calling {data.setup.bolna ? "✅" : "⛔"} · Results webhook {data.setup.webhookToken ? "✅" : "⛔"}
      </span>
      <a href={data.sheetUrl} target="_blank" rel="noreferrer" className="ml-auto underline">Open the contact sheet ↗</a>
      {data.error && <div className="w-full text-red-400">{data.error}</div>}
    </section>
  );
}

function ContactsTab({ data, reload, say }: { data: Preview; reload: () => Promise<void>; say: (m: string) => void }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  const contacts = data.contacts ?? [];
  const statuses = useMemo(() => [...new Set(contacts.map((c) => c.status))].sort(), [contacts]);
  const shown = contacts.filter((c) =>
    (!type || c.tab === type) &&
    (!status || c.status === status) &&
    (!q || `${c.name} ${c.organisation} ${c.phone}`.toLowerCase().includes(q.toLowerCase())),
  );
  const callable = shown.filter((c) => c.check === "OK");
  const rowsOf = (keys: Set<string>) => contacts.filter((c) => keys.has(key(c))).map(ref);
  const callingOn = !!data.settings?.callingEnabled;
  const attention = contacts.filter((c) => c.needsPerson || c.missed);

  const callNow = async (rows: Ref[]) => {
    if (rows.length === 0) return;
    if (!window.confirm(`Call ${rows.length} contact${rows.length === 1 ? "" : "s"} now? What does not fit in a free line is queued.`)) return;
    setBusy(true);
    const { json } = await post("/api/admin/voice/call-now", { rows });
    setBusy(false);
    setChosen(new Set());
    say(describeCallNow(json));
    void reload();
  };

  const scheduleChosen = async () => {
    const rows = rowsOf(chosen);
    if (!when || rows.length === 0) return;
    const at = new Date(when);
    setBusy(true);
    const { ok, json } = await post("/api/admin/voice/schedule", { rows, at: at.toISOString() });
    setBusy(false);
    setChosen(new Set());
    say(ok
      ? `${json.scheduled} scheduled for ${fmtTime(json.at)} (your time).${skippedText(json.skipped)}${callingOn ? "" : " ⚠️ Calling is OFF — they will only ring if it is ON at that time."}`
      : json.error);
    void reload();
  };

  return (
    <section className="space-y-3">
      {!callingOn && <CallingOffNote />}
      {attention.length > 0 && (
        <NeedsAPerson
          rows={attention}
          retry={async (c) => {
            const { ok, json } = await post("/api/admin/voice/schedule", { rows: [ref(c)] }, "DELETE");
            say(ok ? (json.cancelled ? `${c.name} is back to Pending.` : "Nothing changed — press Refresh.") : json.error);
            void reload();
          }}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, organisation, phone" className="w-56 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5">
          <option value="">All types</option>
          {CONTACT_TABS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5">
          <option value="">Any status</option>
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="underline" onClick={() => void reload()}>Refresh</button>
        <button className="ml-auto rounded-xl border border-zinc-600 px-3 py-1.5 font-semibold" onClick={() => setAdding((v) => !v)}>
          {adding ? "Close" : "+ Add a contact"}
        </button>
      </div>

      {adding && <AddContact onDone={(m) => { setAdding(false); say(m); void reload(); }} />}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 p-3">
        <button className="rounded-xl bg-emerald-600 px-4 py-1.5 font-semibold text-white disabled:opacity-40" disabled={busy || chosen.size === 0 || !callingOn} title={callingOn ? undefined : "Calling is OFF — turn it on in Settings"} onClick={() => void callNow(rowsOf(chosen))}>
          📞 Call {chosen.size || ""} now
        </button>
        <span className="text-zinc-500">or</span>
        <label className="flex items-center gap-1 text-zinc-400">at (your time)
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100" />
        </label>
        <button className="rounded-xl border border-zinc-600 px-3 py-1.5 font-semibold disabled:opacity-40" disabled={busy || chosen.size === 0 || !when} onClick={() => void scheduleChosen()}>
          🗓 Schedule {chosen.size || ""}
        </button>
        <button className="underline" onClick={() => setChosen(new Set(callable.map(key)))}>Select all callable ({callable.length})</button>
        {chosen.size > 0 && <button className="underline" onClick={() => setChosen(new Set())}>Clear</button>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-zinc-400">
            <tr><th /><th>Contact</th><th>Type</th><th>Language</th><th>Status</th><th>Last result</th><th>Check</th><th /></tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={key(c)} className="border-t border-zinc-800 align-top">
                <td className="py-2">
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
                <td className="py-2">
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-zinc-400">{c.organisation}{c.organisation ? " · " : ""}{c.phone}</div>
                </td>
                <td>{c.tab}</td>
                <td>{c.language}{c.voice === "male" ? " ♂" : " ♀"}</td>
                <td className={c.needsPerson ? "font-semibold text-amber-300" : undefined}>
                  {c.status}
                  {c.status === "Scheduled" && c.followUp && <div className={c.missed ? "text-red-400" : "text-zinc-400"}>{fmtTime(c.followUp)}{c.missed ? " — missed" : ""}</div>}
                  <div className="text-zinc-500">tries {c.attempts || 0}</div>
                </td>
                <td className="max-w-xs">{c.outcome}{c.summary ? <div className="text-zinc-400">{c.summary}</div> : null}</td>
                <td className={c.check === "OK" ? "text-emerald-400" : "text-red-400"}>{c.check}</td>
                <td>
                  <button
                    className="rounded-lg border border-emerald-600/60 px-2 py-1 text-emerald-300 disabled:opacity-30"
                    disabled={busy || !callingOn || c.check !== "OK" || c.status === "Calling"}
                    onClick={() => void callNow([ref(c)])}
                    title={callingOn ? "Call this contact now" : "Calling is OFF — turn it on in Settings"}
                  >
                    📞
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="py-6 text-center text-zinc-500">No contacts match.</p>}
      </div>
    </section>
  );
}

function CallingOffNote() {
  return (
    <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-amber-200">
      Calling is <b>OFF</b>, so nothing rings — Call now is disabled and scheduled calls wait. Turn it on in the Settings tab when you are ready.
    </div>
  );
}

/** 🔴 What a PERSON must do next — safety first. These were only visible by scanning the sheet. */
function NeedsAPerson({ rows, retry }: { rows: Row[]; retry: (r: Row) => void }) {
  const order = (r: Row) => (r.status.startsWith("Safety") ? 0 : r.missed ? 3 : 1);
  return (
    <div className="rounded-2xl border border-amber-400/40 p-3">
      <div className="mb-1 font-semibold">Needs a person ({rows.length})</div>
      {[...rows].sort((a, b) => order(a) - order(b)).map((c) => (
        <div key={key(c)} className="flex flex-wrap gap-x-3 border-t border-zinc-800 py-1.5">
          <span className={c.status.startsWith("Safety") ? "font-bold text-red-400" : "font-semibold text-amber-300"}>
            {c.missed ? "Missed schedule" : c.status}
          </span>
          <span className="font-semibold">{c.name}</span>
          <span className="text-zinc-400">{c.organisation || c.tab} · {c.phone}</span>
          <span className="text-zinc-400">{c.missed ? "Its time passed while calling was off — schedule it again or cancel it." : c.nextAction}</span>
          {(c.status === "Dial failed" || c.missed) && (
            <button className="ml-auto underline" onClick={() => retry(c)} title="Back to Pending, so it can be called or scheduled again">
              {c.missed ? "Clear" : "Retry"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

const EMPTY_CONTACT = {
  tab: "NGOs", name: "", organisation: "", organisation_type: "", phone: "", country: "IN", time_zone: "Asia/Kolkata",
  language: "en", voice_gender: "female", consent_note: "", team_member: "", context: "", call_reason: "", email: "",
};

function AddContact({ onDone }: { onDone: (m: string) => void }) {
  const [f, setF] = useState(EMPTY_CONTACT);
  const [callNow, setCallNow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof EMPTY_CONTACT) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const input = "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5";

  const submit = async () => {
    setBusy(true);
    setErr(null);
    const { ok, json } = await post("/api/admin/voice/contacts", { ...f, callNow });
    setBusy(false);
    if (!ok) { setErr(json.error ?? "Could not add the contact."); return; }
    onDone(`Added to ${json.added.tab}, row ${json.added.row}.${json.call ? ` ${describeCallNow(json.call)}` : ""}`);
  };

  return (
    <div className="grid gap-3 rounded-2xl border border-zinc-700 p-4 sm:grid-cols-3">
      <label>Type<select className={input} value={f.tab} onChange={set("tab")}>{CONTACT_TABS.map((t) => <option key={t}>{t}</option>)}</select></label>
      <label>Name<input className={input} value={f.name} onChange={set("name")} /></label>
      <label>Organisation<input className={input} value={f.organisation} onChange={set("organisation")} /></label>
      <label>Phone (with country code)<input className={input} value={f.phone} onChange={set("phone")} placeholder="+91…" /></label>
      <label>Email (optional — for outreach mail)<input className={input} value={f.email} onChange={set("email")} placeholder="name@organisation.org" /></label>
      <label>Country (2 letters)<input className={input} value={f.country} onChange={set("country")} /></label>
      <label>Time zone<input className={input} value={f.time_zone} onChange={set("time_zone")} /></label>
      <label>Language<select className={input} value={f.language} onChange={set("language")}>{LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
      <label>Agent voice<select className={input} value={f.voice_gender} onChange={set("voice_gender")}><option value="female">Female</option><option value="male">Male</option></select></label>
      <label>Ambassador (team member)<input className={input} value={f.team_member} onChange={set("team_member")} /></label>
      <label className="sm:col-span-3">How did they agree to be called? (required)<input className={input} value={f.consent_note} onChange={set("consent_note")} placeholder="e.g. Asked for a call at the 12 Oct seminar" /></label>
      <label className="sm:col-span-2">How they know us (optional)<input className={input} value={f.context} onChange={set("context")} /></label>
      <label>Reason for the call<input className={input} value={f.call_reason} onChange={set("call_reason")} /></label>
      <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" checked={callNow} onChange={(e) => setCallNow(e.target.checked)} /> Call them now after adding</label>
      <div className="flex items-center justify-end gap-3">
        {err && <span className="text-red-400">{err}</span>}
        <button className="rounded-xl bg-white px-4 py-1.5 font-semibold text-zinc-900 disabled:opacity-40" disabled={busy} onClick={() => void submit()}>
          {busy ? "Saving…" : "Add contact"}
        </button>
      </div>
    </div>
  );
}

function ScheduledTab({ data, reload, say }: { data: Preview; reload: () => Promise<void>; say: (m: string) => void }) {
  const upcoming = (data.contacts ?? [])
    .filter((c) => c.status === "Scheduled" || c.status === "Queued")
    .sort((a, b) => (a.followUp || "9").localeCompare(b.followUp || "9"));
  const followUps = (data.contacts ?? [])
    .filter((c) => (c.status === "Callback requested" || c.status === "Send info") && c.followUp)
    .sort((a, b) => a.followUp.localeCompare(b.followUp));

  const auto = !!data.settings?.autoDispatch;
  const cancel = async (rows: Ref[]) => {
    const { ok, json } = await post("/api/admin/voice/schedule", { rows }, "DELETE");
    say(ok ? `${json.cancelled} taken off the schedule.` : json.error);
    void reload();
  };

  return (
    <section className="space-y-6">
      {!data.settings?.callingEnabled && <CallingOffNote />}
      <div>
        <h3 className="mb-2 font-semibold">Scheduled and queued ({upcoming.length})</h3>
        {upcoming.length === 0 && <p className="text-zinc-500">Nothing scheduled. Choose contacts on the Contacts tab and pick a time.</p>}
        {upcoming.map((c) => (
          <div key={key(c)} className="flex flex-wrap items-center gap-3 border-t border-zinc-800 py-2">
            <span className={`w-44 ${c.missed ? "text-red-400" : "text-zinc-300"}`}>{c.status === "Queued" ? "Next free line" : `${fmtTime(c.followUp)}${c.missed ? " — missed" : ""}`}</span>
            <span className="font-semibold">{c.name}</span>
            <span className="text-zinc-400">{c.organisation} · {c.tab} · {c.language}</span>
            {c.check !== "OK" && <span className="text-red-400">⚠ {c.check}</span>}
            <button className="ml-auto underline" onClick={() => void cancel([ref(c)])}>Cancel</button>
          </div>
        ))}
      </div>
      <div>
        <h3 className="mb-2 font-semibold">Callbacks and send-info follow-ups</h3>
        <p className="mb-2 text-zinc-400">
          {auto ? "Automatic calling is ON — these are called at the time shown." : "Automatic calling is OFF — these are NOT called by themselves. Call them from the Contacts tab, or turn automatic on."}
        </p>
        {followUps.length === 0 && <p className="text-zinc-500">None.</p>}
        {followUps.map((c) => (
          <div key={key(c)} className="flex flex-wrap gap-3 border-t border-zinc-800 py-2">
            <span className="w-44 text-zinc-300">{fmtTime(c.followUp)}</span>
            <span className="font-semibold">{c.name}</span>
            <span className="text-zinc-400">{c.status} · {c.nextAction}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

type CallsState = { loading: boolean; error?: string; calls: Call[]; report?: Report; asOf?: string; refresh: () => void };

/** Loads only once a calls tab is opened, then serves both tabs. */
function useCalls(days: number, wanted: boolean): CallsState {
  const [state, setState] = useState<Omit<CallsState, "refresh">>({ loading: false, calls: [] });
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  const fetchCalls = useCallback(async (fresh: boolean) => {
    setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const res = await fetch(`/api/admin/voice/calls?days=${days}${fresh ? "&fresh=1" : ""}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      setState(res.ok ? { loading: false, calls: json.calls, report: json.report, asOf: json.asOf } : { loading: false, calls: [], error: json.error ?? "Could not load calls." });
    } catch {
      setState({ loading: false, calls: [], error: "Could not reach the server." });
    }
    setLoadedFor(days);
  }, [days]);
  useEffect(() => { if (wanted && loadedFor !== days) void fetchCalls(false); }, [wanted, loadedFor, days, fetchCalls]);
  return { ...state, refresh: () => void fetchCalls(true) };
}

function RangePicker({ days, setDays, refresh, asOf }: { days: number; setDays: (d: number) => void; refresh: () => void; asOf?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {[7, 30, 90].map((d) => (
        <button key={d} onClick={() => setDays(d)} className={`rounded-full px-3 py-1 ${days === d ? "bg-zinc-200 text-zinc-900" : "border border-zinc-700"}`}>
          Last {d} days
        </button>
      ))}
      <button className="underline" onClick={refresh}>Refresh</button>
      {asOf && <span className="text-zinc-500">as of {fmtTime(asOf)} · reading every agent takes 10–30 s</span>}
    </div>
  );
}

type CallsTabProps = { calls: CallsState; days: number; setDays: (d: number) => void };

function CallsTab({ calls: state, days, setDays }: CallsTabProps) {
  const { loading, error, calls, refresh, asOf } = state;
  const [open, setOpen] = useState<string | null>(null);
  const safety = calls.filter((c) => c.outcome === "safety");

  return (
    <section className="space-y-3">
      <RangePicker days={days} setDays={setDays} refresh={refresh} asOf={asOf} />
      {loading && <p className="text-zinc-400">Loading calls…</p>}
      {error && <p className="text-red-400">{error}</p>}
      {safety.length > 0 && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-red-200">
          🔴 {safety.length} call{safety.length === 1 ? "" : "s"} flagged SAFETY — a person must call them back today:{" "}
          {safety.map((c) => `${c.name || c.phone} (${fmtTime(c.createdAt)})`).join(", ")}
        </div>
      )}
      {!loading && calls.length === 0 && !error && <p className="text-zinc-500">No calls in this period.</p>}
      <div className="divide-y divide-zinc-800">
        {calls.map((c) => (
          <div key={c.id} className="py-2">
            <button className="grid w-full grid-cols-2 gap-2 text-left sm:grid-cols-6" onClick={() => setOpen(open === c.id ? null : c.id)}>
              <span className="text-zinc-300">{fmtTime(c.createdAt)}</span>
              <span className="font-semibold">{c.name || c.phone}<span className="block font-normal text-zinc-400">{c.organisation || c.tab}</span></span>
              <span>{c.language} {c.voice === "male" ? "♂" : "♀"}</span>
              <span>{c.status} · {fmtDur(c.durationSec)}</span>
              <span className={c.outcome === "safety" ? "font-bold text-red-400" : ""}>{OUTCOME_LABEL[c.outcome] ?? (c.outcome || "—")}</span>
              <span className="text-zinc-400">{usd(c.costCents)} · {c.placedBy || "not recorded"}</span>
            </button>
            {open === c.id && <CallDetail c={c} />}
          </div>
        ))}
      </div>
    </section>
  );
}

function CallDetail({ c }: { c: Call }) {
  return (
    <div className="mt-2 space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="grid gap-1 sm:grid-cols-2">
        <div><span className="text-zinc-400">Phone:</span> {c.phone || "—"}</div>
        <div><span className="text-zinc-400">Hung up by:</span> {c.hangupBy || "—"}</div>
        <div className="sm:col-span-2"><span className="text-zinc-400">Summary:</span> {c.summary || "—"}</div>
        <div className="sm:col-span-2"><span className="text-zinc-400">Next action:</span> {c.nextAction || "—"}</div>
        {c.error && <div className="text-red-400 sm:col-span-2">Error: {c.error}</div>}
      </div>
      {c.recordingUrl ? <audio controls preload="none" src={`/api/admin/voice/recording/${encodeURIComponent(c.id)}`} className="w-full" /> : <p className="text-zinc-500">No recording for this call.</p>}
      {c.transcript ? (
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-950 p-3 font-sans text-zinc-200">{c.transcript}</pre>
      ) : (
        <p className="text-zinc-500">No transcript.</p>
      )}
    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-700 p-3">
      <div className="text-zinc-400">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {note && <div className="text-zinc-500">{note}</div>}
    </div>
  );
}

function ReportsTab({ calls: state, days, setDays }: CallsTabProps) {
  const { loading, error, report, refresh, asOf } = state;
  const outcomeSlices = report
    ? toRows(report.byOutcome, (k) => OUTCOME_LABEL[k] ?? k).map((r, i) => ({ ...r, color: COLORS[i % COLORS.length] }))
    : [];

  return (
    <section className="space-y-5">
      <RangePicker days={days} setDays={setDays} refresh={refresh} asOf={asOf} />
      {loading && <p className="text-zinc-400">Loading…</p>}
      {error && <p className="text-red-400">{error}</p>}
      {report && (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Calls" value={String(report.total)} />
            <Kpi label="Connected" value={`${Math.round(report.connectRate * 100)}%`} note={`${report.connected} conversations`} />
            <Kpi label="Avg conversation" value={fmtDur(report.avgDurationSec)} note={`${report.totalMinutes} min in all`} />
            <Kpi label="Meetings booked" value={String(report.meetings)} />
            <Kpi label="Safety flags" value={String(report.safety)} />
            <Kpi label="Cost" value={usd(report.costCents)} note="USD" />
          </div>
          {report.perDay.length > 1 && (
            <div className="rounded-2xl border border-zinc-700 p-4">
              <div className="mb-2 font-semibold">Calls per day</div>
              <LineChart
                lines={[
                  { label: "Calls", color: "#60a5fa", points: report.perDay.map((d) => d.calls) },
                  { label: "Connected", color: "#34d399", points: report.perDay.map((d) => d.connected) },
                ]}
                xFirst={report.perDay[0].day}
                xLast={report.perDay[report.perDay.length - 1].day}
              />
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {outcomeSlices.length > 0 && (
              <div className="rounded-2xl border border-zinc-700 p-4">
                <div className="mb-2 font-semibold">Outcomes of connected calls</div>
                <Donut slices={outcomeSlices} centreLabel="connected" centreValue={String(report.connected)} />
              </div>
            )}
            <div className="rounded-2xl border border-zinc-700 p-4">
              <div className="mb-2 font-semibold">By call status</div>
              <Bars rows={toRows(report.byStatus)} />
            </div>
            <div className="rounded-2xl border border-zinc-700 p-4">
              <div className="mb-2 font-semibold">By language</div>
              <Bars rows={toRows(report.byLanguage)} />
            </div>
            <div className="rounded-2xl border border-zinc-700 p-4">
              <div className="mb-2 font-semibold">By contact type</div>
              <Bars rows={toRows(report.byTab)} />
            </div>
            <div className="rounded-2xl border border-zinc-700 p-4">
              <div className="mb-2 font-semibold">Placed by</div>
              <Bars rows={toRows(report.byPlacedBy)} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/** 🔒 Format the sheet and lock everything but the admin's columns (owner only). Safe to press again. */
function SheetSetup({ say }: { say: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!window.confirm("Format the contact sheet and lock every column except the ones an admin fills? The system can still write its own columns.")) return;
    setBusy(true);
    const { ok, json } = await post("/api/admin/sheet/setup", {});
    setBusy(false);
    say(ok ? `Done: ${json.tabs.length} tabs formatted and locked; status written on ${json.status.rows} rows.` : json.error);
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800 py-3">
      <div>
        <div className="font-semibold">Format and lock the contact sheet</div>
        <div className="text-zinc-400">Only the white columns stay editable. Status, errors and what to do are written into the grey columns every 10 minutes.</div>
      </div>
      <button className="rounded-xl border border-zinc-600 px-4 py-1.5 font-semibold disabled:opacity-40" disabled={busy} onClick={() => void run()}>
        {busy ? "Working…" : "Format and lock"}
      </button>
    </div>
  );
}

function Toggle({ label, hint, on, warn, busy, onToggle }: {
  label: string; hint: string; on: boolean; warn?: string; busy: boolean;
  onToggle: (next: boolean, warn?: string) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-zinc-800 py-3">
      <div>
        <div className="font-semibold">{label}</div>
        <div className="text-zinc-400">{hint}</div>
      </div>
      <button
        disabled={busy}
        onClick={() => onToggle(!on, !on ? warn : undefined)}
        className={`min-w-20 rounded-full px-4 py-1.5 font-bold ${on ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-zinc-300"}`}
      >
        {on ? "ON" : "OFF"}
      </button>
    </div>
  );
}

function SettingsTab({ data, reload, say }: { data: Preview; reload: () => Promise<void>; say: (m: string) => void }) {
  const s = data.settings;
  const [busy, setBusy] = useState(false);
  const [cap, setCap] = useState(String(s?.dailyCap ?? 30));
  const [lines, setLines] = useState(String(s?.maxConcurrency ?? 2));
  if (!s) return <p className="text-zinc-500">Settings are not available — check the Google connection.</p>;

  const save = async (body: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    const { ok, json } = await post("/api/admin/voice/settings", body);
    setBusy(false);
    say(ok ? "Saved. The sheet's Settings tab now shows the same values." : json.error);
    void reload();
  };

  return (
    <section className="rounded-2xl border border-zinc-700 p-4">
      <Toggle
        label="Calling"
        hint="The master switch. While it is off, no call is placed — not by hand, not on schedule, not automatically."
        on={s.callingEnabled}
        busy={busy}
        onToggle={(next, warn) => void save({ callingEnabled: next }, warn)}
        warn="Turn calling ON? Calls will start going out — by hand, on schedule and (if automatic is on) by the dispatcher."
      />
      <Toggle
        label="Automatic calling"
        hint="Every 5 minutes, call new contacts, retries and due follow-ups by itself. Scheduled and queued calls go out either way."
        on={s.autoDispatch}
        busy={busy}
        onToggle={(next, warn) => void save({ autoDispatch: next }, warn)}
        warn="Turn automatic calling ON? The dispatcher will start calling new contacts by itself."
      />
      <Toggle
        label="Call individuals"
        hint="Off until the TRAI/DLT question for promotional calls is settled. Organisations are not affected."
        on={!!s.allowIndividuals}
        busy={busy}
        onToggle={(next, warn) => void save({ allowIndividuals: next }, warn)}
        warn="Allow calls to INDIVIDUALS? In India, promotional calls to individuals need TRAI DLT registration and DND scrubbing."
      />
      <div className="flex flex-wrap items-end gap-4 border-t border-zinc-800 py-3">
        <label>Calls per 24 hours (1–500)<input type="number" min={1} max={500} className="block w-28 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5" value={cap} onChange={(e) => setCap(e.target.value)} /></label>
        <label>Lines at once (1–10)<input type="number" min={1} max={10} className="block w-28 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5" value={lines} onChange={(e) => setLines(e.target.value)} /></label>
        <button className="rounded-xl border border-zinc-600 px-4 py-1.5 font-semibold" disabled={busy} onClick={() => void save({ dailyCap: Number(cap), maxConcurrency: Number(lines) })}>
          Save limits
        </button>
      </div>
      <SheetSetup say={say} />
      <p className="border-t border-zinc-800 pt-3 text-zinc-400">
        Alerts (safety, meetings, send-info) go to: {s.alertEmails.join(", ") || "—"} — change them in the sheet&apos;s Settings tab.
      </p>
    </section>
  );
}
