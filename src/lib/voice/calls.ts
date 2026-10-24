// src/lib/voice/calls.ts
// The call log, read from Bolna — every call our agents placed, with its
// recording, transcript, cost and outcome.
//
// 🔑 WHY NOT A TABLE OF OUR OWN. Bolna already keeps the complete record of
// every execution; copying it into Supabase would be a second truth that can
// drift. The sheet stays the contact list (owner, 24 Oct 2026), Bolna stays the
// call log, and this file only reads and shapes it.
//
// ⚠️ PURE where it can be: `toCallRecord` and `summarise` take plain data, so the
// shapes Bolna sends and the numbers the reports show are pinned by tests
// ⇒ src/__tests__/voice/callLog.test.ts.

import { BOLNA_AGENTS } from "@/lib/voice/agents";
import { flattenExtraction } from "@/lib/voice/bolna";

export type CallRecord = {
  id: string;
  createdAt: string;
  language: string;
  voice: "female" | "male" | "";
  status: string;
  durationSec: number;
  /** Bolna reports cost in cents (USD). */
  costCents: number;
  phone: string;
  name: string;
  organisation: string;
  tab: string;
  placedBy: string;
  outcome: string;
  summary: string;
  nextAction: string;
  transcript: string;
  recordingUrl: string;
  hangupBy: string;
  error: string;
};

type AgentInfo = { language: string; voice: "female" | "male" };
const AGENT_INDEX = new Map<string, AgentInfo>(
  Object.entries(BOLNA_AGENTS).flatMap(([language, a]): [string, AgentInfo][] => [
    [a.female, { language, voice: "female" }],
    [a.male, { language, voice: "male" }],
  ]),
);

export function allAgentIds(): string[] {
  return [...AGENT_INDEX.keys()];
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** Who we called and what we told the agent — Bolna echoes our user_data back. */
function recipientData(e: Record<string, unknown>): Record<string, unknown> {
  const ctx = obj(e.context_details);
  return obj(ctx.recipient_data ?? ctx.user_data ?? e.user_data);
}

export function toCallRecord(e: Record<string, unknown>): CallRecord {
  const tel = obj(e.telephony_data);
  const who = recipientData(e);
  const agent = AGENT_INDEX.get(str(e.agent_id));
  const x = flattenExtraction(e.extracted_data);
  return {
    id: str(e.id ?? e.execution_id),
    createdAt: str(e.created_at),
    language: agent?.language ?? "",
    voice: agent?.voice ?? "",
    status: str(e.status).toLowerCase(),
    durationSec: Math.round(num(e.conversation_duration ?? tel.duration)),
    costCents: num(e.total_cost),
    phone: str(who.imotara_phone ?? tel.to_number),
    name: str(who.name),
    organisation: str(who.organisation),
    tab: str(who.imotara_tab),
    placedBy: str(who.imotara_placed_by),
    outcome: (x.outcome ?? "").toLowerCase(),
    summary: str(e.summary) || x.summary || "",
    nextAction: x.next_action ?? "",
    transcript: str(e.transcript),
    recordingUrl: str(tel.recording_url),
    hangupBy: str(tel.hangup_by),
    error: str(e.error_message),
  };
}

const BASE = () => (process.env.BOLNA_API_BASE?.trim() || "https://api.bolna.ai").replace(/\/$/, "");

async function agentExecutions(agentId: string, from: string, to: string): Promise<Record<string, unknown>[]> {
  const key = process.env.BOLNA_API_KEY?.trim();
  if (!key) throw new Error("The calling service is not set up (missing key).");
  const out: Record<string, unknown>[] = [];
  for (let page = 1; page <= 20; page++) {
    const q = new URLSearchParams({ page_number: String(page), page_size: "50", from, to });
    const res = await fetch(`${BASE()}/v2/agent/${encodeURIComponent(agentId)}/executions?${q}`, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`The calling service answered ${res.status} (${(await res.text()).slice(0, 160)})`);
    const body = (await res.json()) as { data?: Record<string, unknown>[]; has_more?: boolean };
    out.push(...(body.data ?? []));
    if (!body.has_more) break;
  }
  return out;
}

/** Bolna refuses a `from`–`to` range longer than 7 days (422) ⇒ split it. */
export const BOLNA_MAX_RANGE_MS = 7 * 86400_000;

export function sevenDayWindows(from: Date, to: Date): [Date, Date][] {
  const out: [Date, Date][] = [];
  for (let start = from.getTime(); start < to.getTime(); start += BOLNA_MAX_RANGE_MS) {
    out.push([new Date(start), new Date(Math.min(start + BOLNA_MAX_RANGE_MS - 1, to.getTime()))]);
  }
  return out;
}

/**
 * Every call in [from, to], newest first. 44 agents × 7-day windows ⇒ fetched
 * ten requests at a time so the provider is never hit with all of them at once.
 */
export async function listCalls(from: Date, to: Date): Promise<CallRecord[]> {
  const tasks = allAgentIds().flatMap((id) => sevenDayWindows(from, to).map(([a, b]) => () => agentExecutions(id, a.toISOString(), b.toISOString())));
  const records = new Map<string, CallRecord>();
  const errors: string[] = [];
  for (let i = 0; i < tasks.length; i += 10) {
    const batch = await Promise.allSettled(tasks.slice(i, i + 10).map((t) => t()));
    for (const r of batch) {
      if (r.status === "fulfilled") for (const e of r.value) { const c = toCallRecord(e); records.set(c.id, c); }
      else errors.push((r.reason as Error).message);
    }
  }
  if (records.size === 0 && errors.length > 0) throw new Error(errors[0]);
  return [...records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type CallReport = {
  total: number;
  connected: number;
  connectRate: number;
  totalMinutes: number;
  avgDurationSec: number;
  costCents: number;
  byOutcome: Record<string, number>;
  byStatus: Record<string, number>;
  byLanguage: Record<string, number>;
  byTab: Record<string, number>;
  byPlacedBy: Record<string, number>;
  perDay: { day: string; calls: number; connected: number; costCents: number }[];
  safety: number;
  meetings: number;
};

const bump = (m: Record<string, number>, k: string) => {
  const key = k || "—";
  m[key] = (m[key] ?? 0) + 1;
};

/** Report figures. "Connected" = a completed call with a real conversation (≥ 10 s). */
export function summarise(calls: CallRecord[]): CallReport {
  const r: CallReport = {
    total: calls.length, connected: 0, connectRate: 0, totalMinutes: 0, avgDurationSec: 0, costCents: 0,
    byOutcome: {}, byStatus: {}, byLanguage: {}, byTab: {}, byPlacedBy: {}, perDay: [], safety: 0, meetings: 0,
  };
  const days = new Map<string, { calls: number; connected: number; costCents: number }>();
  let talked = 0;
  for (const c of calls) {
    const connected = c.status === "completed" && c.durationSec >= 10;
    if (connected) { r.connected++; talked += c.durationSec; }
    r.totalMinutes += c.durationSec / 60;
    r.costCents += c.costCents;
    bump(r.byStatus, c.status);
    if (connected) bump(r.byOutcome, c.outcome);
    bump(r.byLanguage, c.language);
    bump(r.byTab, c.tab);
    // ⚠️ Empty means the call was placed outside the console (e.g. the 21 Oct test), NOT by the dispatcher — which always writes "automatic".
    bump(r.byPlacedBy, c.placedBy || "not recorded");
    if (c.outcome === "safety") r.safety++;
    if (c.outcome === "meeting_booked") r.meetings++;
    const day = c.createdAt.slice(0, 10);
    const d = days.get(day) ?? { calls: 0, connected: 0, costCents: 0 };
    d.calls++; if (connected) d.connected++; d.costCents += c.costCents;
    days.set(day, d);
  }
  r.connectRate = r.total ? r.connected / r.total : 0;
  r.avgDurationSec = r.connected ? Math.round(talked / r.connected) : 0;
  r.totalMinutes = Math.round(r.totalMinutes * 10) / 10;
  r.perDay = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, ...v }));
  return r;
}
