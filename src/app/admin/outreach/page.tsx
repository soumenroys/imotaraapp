"use client";

// /admin/outreach — automatic outreach email from the Call Directory sheet.
//
// 🔑 The owner's goal (24 Oct 2026): the admin only fills the sheet; calling and
// email then run on their own. This page is where the drafts are approved, the
// switch is turned on, and anyone can see who got what ⇒ lib/outreach.

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminShell, useAdminRole } from "@/app/admin/_components/ui";
import { PageTutorial } from "@/app/admin/_components/PageTutorial";
import { ADMIN_TUTORIALS } from "@/app/admin/_components/adminTutorials";
import { AUDIENCES, AUDIENCE_LABEL, STEPS, STEP_LABEL, type Audience, type StepId } from "@/lib/outreach/sequence";
import { MailFlow } from "./MailFlow";
import { DailyList } from "@/app/admin/_components/DailyList";
import { scrollToTarget } from "@/app/admin/_components/scrollToTarget";

type Draft = { subject: string; body: string; status: "needs_review" | "approved"; writtenAt: string; writtenBy: string; approvedAt?: string; approvedBy?: string; findings: string[] };
type Settings = { enabled: boolean; sendWithoutAsking: boolean; dailyCap: number };
type ContactRow = {
  tab: string; row: number; sheetLink: string; audience: Audience; name: string; organisation: string; email: string; mailStatus: string;
  mailStep: number; lastSent: string; callStatus: string; check: string; due: StepId | null;
};
type Overview = {
  settings: Settings; drafts: Record<string, Draft>; contacts: ContactRow[]; sentToday: number;
  domainBudget: { remaining: number; cap: number; week: number }; sender: { name: string; email: string } | null;
  ready: { email: boolean; unsubscribe: boolean; sender: boolean }; sheetUrl: string; error?: string;
};
type Tab = "emails" | "daily" | "contacts" | "settings";

const fmtTime = (iso: string) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");

async function post(url: string, body: unknown) {
  try {
    const res = await fetch(url, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok && !json.error) json.error = `The server could not do that (${res.status}).`;
    return { ok: res.ok, json };
  } catch {
    return { ok: false, json: { error: "Could not reach the server." } };
  }
}

export default function OutreachPage() {
  const role = useAdminRole();
  // 🔑 ?tab=settings (or contacts) opens that tab — the To do page links straight to it.
  const [tab, setTab] = useState<Tab>("emails");
  const [data, setData] = useState<Overview | null>(null);
  const jump = useRef(false);
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "settings" || t === "contacts") { setTab(t); jump.current = true; }
  }, []);
  // ⚠️ Only once the data is in — the strip and diagram above load with it (measured live, 24 Oct).
  useEffect(() => {
    if (data && jump.current) { jump.current = false; scrollToTarget("outreach-tabs"); }
  }, [data]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/outreach", { credentials: "include" });
    if (res.status === 401) { setError("unauthorized"); return; }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? "Could not load."); return; }
    setError(null);
    setData(json);
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <AdminShell
      title="Outreach mail"
      lede="Fill the sheet; approved emails go out by themselves — an introduction, a follow-up and a last note, in each person's daytime."
      current="outreach"
      role={role}
    >
      <PageTutorial id="admin-outreach" {...ADMIN_TUTORIALS.outreach} />
      <div className="mt-6 space-y-5 text-sm">
        {error === "unauthorized" && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-200">
            Your admin session isn&apos;t active here. <a href="/admin" className="font-semibold underline">Log in at /admin</a> first.
          </div>
        )}
        {error && error !== "unauthorized" && <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-red-200">{error}</div>}
        {data && <StatusStrip d={data} />}
        {data && <MailFlow on={data.settings.enabled} auto={data.settings.sendWithoutAsking} cap={data.settings.dailyCap} />}
        <nav id="outreach-tabs" className="flex scroll-mt-4 flex-wrap gap-2">
          {(["emails", "daily", "contacts", "settings"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 font-semibold ${tab === t ? "bg-white text-zinc-900" : "border border-white/15 text-zinc-300 hover:bg-white/10"}`}>
              {t === "emails" ? "Emails" : t === "daily" ? "Daily list" : t === "contacts" ? "Contacts" : "Settings"}
            </button>
          ))}
        </nav>
        {message && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-white/15 bg-white/5 p-3">
            <span>{message}</span>
            <button className="text-zinc-400" onClick={() => setMessage(null)} aria-label="Dismiss">✕</button>
          </div>
        )}
        {data && tab === "emails" && <EmailsTab d={data} reload={load} say={setMessage} />}
        {tab === "daily" && <DailyList kind="mail" historyHint="From the sheet's mail_date / mail_time (day 7 and day 21 follow at the same time). Every email ever sent is also in Broadcast → history, under “Outreach ·”." />}
        {data && tab === "contacts" && <ContactsTab d={data} />}
        {data && tab === "settings" && <SettingsTab d={data} reload={load} say={setMessage} />}
      </div>
    </AdminShell>
  );
}

function StatusStrip({ d }: { d: Overview }) {
  const approved = Object.values(d.drafts).filter((x) => x.status === "approved").length;
  const dueNow = d.contacts.filter((c) => c.due).length;
  return (
    <section className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-white/15 p-4">
      <span className={`rounded-full px-3 py-1 font-bold ${d.settings.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
        Outreach email {d.settings.enabled ? "ON" : "OFF"}
      </span>
      <span>Sent today: <b>{d.sentToday}</b> / {d.settings.dailyCap}</span>
      <span>Due now: <b>{dueNow}</b></span>
      <span>Approved emails: <b>{approved}</b> / {AUDIENCES.length * STEPS.length}</span>
      <span className="text-zinc-400">
        Sender {d.ready.sender ? `✅ ${d.sender?.email}` : "⛔"} · Sending {d.ready.email ? "✅" : "⛔"} · Unsubscribe {d.ready.unsubscribe ? "✅" : "⛔"}
      </span>
      <a href={d.sheetUrl} target="_blank" rel="noreferrer" className="ml-auto underline">Open the contact sheet ↗</a>
    </section>
  );
}

function EmailsTab({ d, reload, say }: { d: Overview; reload: () => Promise<void>; say: (m: string) => void }) {
  // 🔑 Deep link from the To do page: ?audience=ngos&step=intro opens that email.
  const [want] = useState(() => {
    const sp = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
    const a = sp?.get("audience") as Audience | null;
    const st = sp?.get("step") as StepId | null;
    return { audience: a && AUDIENCES.includes(a) ? a : null, step: st && STEPS.includes(st) ? st : null };
  });
  const [audience, setAudience] = useState<Audience>(want.audience ?? "ngos");
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {AUDIENCES.map((a) => {
          const ok = STEPS.filter((s) => d.drafts[`${a}:${s}`]?.status === "approved").length;
          return (
            <button key={a} onClick={() => setAudience(a)}
              className={`rounded-lg px-3 py-1.5 ${audience === a ? "bg-white/15 font-semibold" : "border border-white/10"}`}>
              {AUDIENCE_LABEL[a]} <span className="text-zinc-400">({ok}/{STEPS.length} approved)</span>
            </button>
          );
        })}
      </div>
      <p className="text-zinc-400">
        English for now. {"{{name|there}}"} and {"{{organisation}}"} are filled in for each person when it is sent.
      </p>
      {STEPS.map((s) => <DraftCard key={`${audience}:${s}:${d.drafts[`${audience}:${s}`]?.writtenAt ?? ""}`} audience={audience} step={s} draft={d.drafts[`${audience}:${s}`]} reload={reload} say={say}
        startOpen={audience === want.audience && s === want.step} />)}
    </section>
  );
}

function DraftCard({ audience, step, draft, reload, say, startOpen = false }: { audience: Audience; step: StepId; draft?: Draft; reload: () => Promise<void>; say: (m: string) => void; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  // 🔑 Opened from a To do link ⇒ bring it on screen (it sits below the guide and the diagram).
  useEffect(() => { if (startOpen) scrollToTarget(`draft-${audience}-${step}`); }, [startOpen, audience, step]);
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [body, setBody] = useState(draft?.body ?? "");
  const [busy, setBusy] = useState("");
  const act = async (action: "write" | "save" | "approve") => {
    setBusy(action);
    const { ok, json } = await post("/api/admin/outreach/drafts", { audience, step, action, subject, body });
    setBusy("");
    if (!ok) { say(json.error); return; }
    setSubject(json.draft.subject); setBody(json.draft.body); setOpen(true);
    say(action === "approve" ? "Approved. It will be used for everyone due this email." : action === "write" ? "Written. Read it, then approve or edit." : json.draft.findings.length ? "Saved, but the checks found something — see below." : "Saved. Approve it when you are happy.");
    void reload();
  };
  const test = async () => {
    setBusy("test");
    const { ok, json } = await post("/api/admin/outreach/test", { audience, step });
    setBusy("");
    say(ok ? `Test sent to ${json.to}. Check your inbox.` : json.error);
  };
  const tone = !draft ? "border-white/10" : draft.status === "approved" ? "border-emerald-400/40" : "border-amber-400/40";
  return (
    <div id={`draft-${audience}-${step}`} className={`scroll-mt-4 rounded-2xl border ${tone} p-3`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">{STEP_LABEL[step]}</span>
        <span className={!draft ? "text-zinc-500" : draft.status === "approved" ? "text-emerald-300" : "text-amber-300"}>
          {!draft ? "Not written yet" : draft.status === "approved" ? `Approved ${fmtTime(draft.approvedAt ?? "")}` : "Waiting for you"}
        </span>
        {draft && <span className="text-zinc-400">“{draft.subject}”</span>}
        <span className="ml-auto flex gap-2">
          {draft && <button className="underline" onClick={() => setOpen((v) => !v)}>{open ? "Close" : "Read it"}</button>}
          <button className="rounded-lg border border-white/15 px-2 py-1 disabled:opacity-40" disabled={!!busy} onClick={() => void act("write")}>
            {busy === "write" ? "Writing…" : draft ? "Write it again" : "Write it"}
          </button>
        </span>
      </div>
      {draft && open && (
        <div className="mt-3 space-y-2">
          <input className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1.5" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <textarea className="h-72 w-full rounded-lg border border-white/15 bg-black/30 p-2 font-sans" value={body} onChange={(e) => setBody(e.target.value)} />
          {draft.findings.length > 0 && (
            <ul className="list-disc rounded-lg border border-red-400/30 bg-red-500/10 p-2 pl-6 text-red-200">
              {draft.findings.map((f) => <li key={f}>{f}</li>)}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg border border-white/15 px-3 py-1.5 disabled:opacity-40" disabled={!!busy} onClick={() => void act("save")}>
              {busy === "save" ? "Saving…" : "Save changes"}
            </button>
            <button className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white disabled:opacity-40"
              disabled={!!busy || draft.status === "approved" || draft.findings.length > 0 || subject !== draft.subject || body !== draft.body}
              title={subject !== draft.subject || body !== draft.body ? "Save your changes first" : undefined}
              onClick={() => void act("approve")}>
              Approve
            </button>
            <button className="rounded-lg border border-white/15 px-3 py-1.5 disabled:opacity-40" disabled={!!busy} onClick={() => void test()}>
              {busy === "test" ? "Sending…" : "Send me a test"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactsTab({ d }: { d: Overview }) {
  const [q, setQ] = useState("");
  const rows = d.contacts.filter((c) => !q || `${c.name} ${c.organisation} ${c.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, organisation, email" className="w-64 rounded-lg border border-white/15 bg-black/30 px-3 py-1.5" />
        <span className="text-zinc-400">{d.contacts.length} with an email in the sheet</span>
      </div>
      {d.contacts.length === 0 && (
        <p className="text-zinc-400">Nobody has an email in the sheet yet. Add it in the <b>email</b> column, with a consent note, <b>yes</b> in contact_by_email and a mail_date + mail_time, then press Refresh. <a href={d.sheetUrl} target="_blank" rel="noreferrer" className="text-sky-300 underline">Open the sheet ↗</a></p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-zinc-400"><tr><th>Contact</th><th>Type</th><th>Emails sent</th><th>Last sent</th><th>Next</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={`${c.tab}#${c.row}`} className="border-t border-white/10 align-top">
                <td className="py-2"><div className="font-semibold">{c.name}</div><div className="text-zinc-400">{c.organisation}{c.organisation ? " · " : ""}{c.email}</div></td>
                <td>{c.tab}</td>
                <td>{c.mailStep} of 3{c.mailStatus ? <div className="text-zinc-400">{c.mailStatus}</div> : null}</td>
                <td>{fmtTime(c.lastSent)}</td>
                <td className={c.due ? "text-emerald-300" : c.check === "OK" ? "text-zinc-300" : "text-red-300"}>
                  {c.due ? `Due now: ${STEP_LABEL[c.due]}` : c.check === "OK" ? "Waiting for its scheduled date and time" : c.check}
                  {!c.due && c.check !== "OK" && <div><a href={c.sheetLink} target="_blank" rel="noreferrer" className="whitespace-nowrap text-xs text-sky-300 underline">{"open row ↗"}</a></div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SettingsTab({ d, reload, say }: { d: Overview; reload: () => Promise<void>; say: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [cap, setCap] = useState(String(d.settings.dailyCap));
  const save = async (body: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    const { ok, json } = await post("/api/admin/outreach/settings", body);
    setBusy(false);
    say(ok ? "Saved." : json.error);
    void reload();
  };
  const approved = Object.values(d.drafts).filter((x) => x.status === "approved").length;
  return (
    <section className="space-y-0 rounded-2xl border border-white/15 p-4">
      <Row label="Outreach email" hint={`The master switch. While it is off, nothing is emailed. ${approved === 0 ? "⚠️ No email is approved yet — nothing would go out until you approve some on the Emails tab." : ""}`}>
        <Switch on={d.settings.enabled} busy={busy}
          onClick={() => void save({ enabled: !d.settings.enabled }, !d.settings.enabled ? "Turn outreach email ON? Approved emails will start going to contacts in the sheet who are due." : undefined)} />
      </Row>
      <Row label="Send without asking me" hint="Off by default. When on, a newly written email that passes every check is sent without waiting for your approval. Leave it off until you have read a few weeks of them.">
        <Switch on={d.settings.sendWithoutAsking} busy={busy}
          onClick={() => void save({ sendWithoutAsking: !d.settings.sendWithoutAsking }, !d.settings.sendWithoutAsking ? "Let emails that pass the checks go out without your approval?" : undefined)} />
      </Row>
      <div className="flex flex-wrap items-end gap-4 border-t border-white/10 py-3">
        <label>Emails per day (1–500)<input type="number" min={1} max={500} className="block w-28 rounded-lg border border-white/15 bg-black/30 px-2 py-1.5" value={cap} onChange={(e) => setCap(e.target.value)} /></label>
        <button className="rounded-xl border border-white/15 px-4 py-1.5 font-semibold" disabled={busy} onClick={() => void save({ dailyCap: Number(cap) })}>Save</button>
        <span className="text-zinc-400">The domain&apos;s warm-up also allows {d.domainBudget.remaining} more today (week {d.domainBudget.week}); the smaller limit wins.</span>
      </div>
      <p className="border-t border-white/10 pt-3 text-zinc-400">
        Sent from {d.sender ? `${d.sender.name || "Imotara"} <${d.sender.email}>` : "— (set a sender in Broadcast)"}; replies go to the same address.
      </p>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-white/10 py-3 first:border-t-0">
      <div><div className="font-semibold">{label}</div><div className="text-zinc-400">{hint}</div></div>
      {children}
    </div>
  );
}

function Switch({ on, busy, onClick }: { on: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button disabled={busy} onClick={onClick}
      className={`min-w-20 rounded-full px-4 py-1.5 font-bold ${on ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-zinc-300"}`}>
      {on ? "ON" : "OFF"}
    </button>
  );
}
