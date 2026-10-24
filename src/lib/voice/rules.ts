// src/lib/voice/rules.ts
// Who gets called, what the agent is told, and what a call's outcome writes back.
//
// 🔑 THE SHEET IS THE DATABASE. The owner's decision, 21 Oct 2026: keep the
// "Imotara Call Directory" Google Sheet the team already edits, invoke Bolna
// from the admin, and write results back into the sheet — built so the same
// path can later run unattended on a schedule, like social posting.
//
// ⚠️ PURE: no network, no clock of its own. Everything time-dependent takes
// `now`, so the rules can be tested exactly ⇒ src/__tests__/voice.
//
// ⛔ The sheet's own "Check" and "disclose_upfront" columns are formulas the
// team can see; this file does NOT trust them. It recomputes the check, and it
// ALWAYS discloses (owner, 21 Oct: say "virtual assistant" up front everywhere).

import { getCrisisResourcesForCountry } from "@/lib/safety/crisisResources";
import { agentFor } from "@/lib/voice/agents";

export const CONTACT_TABS = ["Individuals", "NGOs", "Education", "Eldercare", "Corporates"] as const;
export type ContactTab = (typeof CONTACT_TABS)[number];

/** The sheet's columns A–X, in order, plus Y which the system adds. */
export const COLUMNS = [
  "phone", "contact_number", "name", "organisation", "organisation_type", "country", "time_zone",
  "language", "source", "consent_note", "team_member", "context", "call_reason", "disclose_upfront",
  "Check", "status", "call_attempts", "last_call_date", "outcome", "call_summary", "next_action",
  "follow_up_datetime", "ambassador_notes", "voice_gender", "bolna_execution_id",
] as const;
export type Column = (typeof COLUMNS)[number];

/** Column letter for a field ⇒ writing a single cell back. */
export function columnLetter(col: Column): string {
  return String.fromCharCode(65 + COLUMNS.indexOf(col));
}

/** The status labels as the sheet shows them. */
export const STATUS = {
  pending: "Pending",
  queued: "Queued",
  calling: "Calling",
  noAnswer: "No answer",
  callback: "Callback requested",
  sendInfo: "Send info",
  interested: "Interested",
  meeting: "Meeting booked",
  notInterested: "Not interested",
  dnc: "Do not call",
  wrongNumber: "Wrong number",
  safety: "Safety - follow up today",
  /** The call happened but no outcome came back. ⛔ Never auto-called: a person reads it. */
  review: "Needs review",
  /** An admin chose a time in the console; follow_up_datetime holds it. Called when due, like Queued. */
  scheduled: "Scheduled",
} as const;

export type Contact = { tab: ContactTab; row: number; v: Record<Column, string> };

export type Settings = {
  /** ⛔ THE KILL SWITCH. Nothing is placed unless this is on. Default OFF. */
  callingEnabled: boolean;
  /** The scheduled job picks due contacts by itself only when this is on. */
  autoDispatch: boolean;
  maxConcurrency: number;
  dailyCap: number;
  alertEmails: string[];
  /**
   * ⛔ Unsolicited promotional calls to INDIVIDUALS need TRAI DLT registration in
   * India, so the Individuals tab is blocked until the owner switches this on.
   * Optional so an omitted value (tests, old callers) means "not decided here";
   * parseSettings always sets it, and its default is false.
   */
  allowIndividuals?: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  callingEnabled: false,
  autoDispatch: false,
  maxConcurrency: 2,
  dailyCap: 30,
  alertEmails: ["info@imotara.com"],
  allowIndividuals: false,
};

export type Directory = {
  contacts: Contact[];
  /** code → "start" | "not_yet" */
  languages: Map<string, string>;
  /** team member name (lower-case) → gender */
  team: Map<string, string>;
  /** normalised phone numbers on the Do not call tab */
  dnc: Set<string>;
  settings: Settings;
};

// ── Parsing the sheet ────────────────────────────────────────────────────────

/** "+91 98000-00000" / "919800000000" → "+919800000000"; "" when it is not a number. */
export function normalisePhone(raw: string): string {
  const digits = String(raw ?? "").replace(/[^0-9]/g, "");
  return digits ? `+${digits}` : "";
}

export function parseContacts(tab: ContactTab, rows: string[][]): Contact[] {
  const out: Contact[] = [];
  rows.slice(1).forEach((r, i) => {
    const v = Object.fromEntries(COLUMNS.map((c, k) => [c, String(r[k] ?? "").trim()])) as Record<Column, string>;
    if (!v.phone && !v.contact_number && !v.name) return;
    out.push({ tab, row: i + 2, v });
  });
  return out;
}

const truthy = (s: string | undefined) => /^(yes|on|true|1)$/i.test((s ?? "").trim());

/** The optional Settings tab: two columns, key | value. Missing ⇒ the safe defaults. */
export function parseSettings(rows: string[][] | null): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS, alertEmails: [...DEFAULT_SETTINGS.alertEmails] };
  for (const [k, v] of rows ?? []) {
    const key = (k ?? "").trim().toLowerCase();
    if (key === "calling_enabled") s.callingEnabled = truthy(v);
    else if (key === "auto_dispatch") s.autoDispatch = truthy(v);
    else if (key === "max_concurrency" && Number(v) > 0) s.maxConcurrency = Math.min(10, Math.floor(Number(v)));
    else if (key === "daily_cap" && Number(v) > 0) s.dailyCap = Math.floor(Number(v));
    else if (key === "alert_emails" && v?.trim()) s.alertEmails = v.split(/[,;\s]+/).filter((e) => e.includes("@"));
    else if (key === "allow_individuals") s.allowIndividuals = truthy(v);
  }
  return s;
}

export function parseLanguages(rows: string[][]): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of rows.slice(1)) {
    const code = (r[0] ?? "").trim().toLowerCase();
    if (code) m.set(code, /^start$/i.test((r[2] ?? "").trim()) ? "start" : "not_yet");
  }
  return m;
}

export function parseTeam(rows: string[][]): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of rows.slice(1)) {
    const name = (r[0] ?? "").trim();
    if (name) m.set(name.toLowerCase(), /^female$/i.test((r[1] ?? "").trim()) ? "female" : "male");
  }
  return m;
}

export function parseDnc(rows: string[][]): Set<string> {
  return new Set(rows.slice(1).map((r) => normalisePhone(r[0] ?? "")).filter(Boolean));
}

// ── The check (replaces the sheet's Check column) ────────────────────────────

export function phoneOf(c: Contact): string {
  return normalisePhone(c.v.contact_number || c.v.phone);
}

export function checkContact(
  c: Contact,
  d: Pick<Directory, "languages" | "dnc"> & { settings?: Pick<Settings, "allowIndividuals"> },
): string {
  const phone = phoneOf(c);
  if (phone.replace("+", "").length < 10) return "Phone needs country code and number";
  if (!c.v.name) return "Missing name";
  if (/^sample\b/i.test(c.v.name)) return "Sample row - delete it";
  if (d.dnc.has(phone)) return "On do-not-call list - never call";
  // ⛔ Permanent, owner's instruction ⇒ spec §5.1.
  if (/open ?lm/i.test(c.v.organisation) || /openlm\.com/i.test(c.v.consent_note + c.v.context)) {
    return "EXCLUDED: OpenLM - never call";
  }
  if (!c.v.consent_note) return "Add consent note";
  if (c.tab === "Individuals" && d.settings?.allowIndividuals === false) return "Individuals paused (TRAI/DLT)";
  if (d.languages.get(c.v.language.toLowerCase()) !== "start") return "Language not started yet";
  if (!agentFor(c.v.language, c.v.voice_gender)) return "No agent for this language and voice";
  if (!c.v.time_zone) return "Add time zone";
  return "OK";
}

// ── Time ─────────────────────────────────────────────────────────────────────

export const WINDOW_START_HOUR = 10;
export const WINDOW_END_HOUR = 18;

/** The contact's local hour and weekday (0 = Sunday), from an IANA zone. */
export function localTime(now: Date, timeZone: string): { hour: number; weekday: number; date: string } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone, hour: "numeric", hourCycle: "h23", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    return { hour: Number(get("hour")), weekday, date: `${get("year")}-${get("month")}-${get("day")}` };
  } catch {
    return null;
  }
}

/** ⚠️ India additionally: never on a Sunday ⇒ spec §6. */
export function inCallingWindow(now: Date, timeZone: string, country: string): boolean {
  const t = localTime(now, timeZone);
  if (!t) return false;
  if (country.toUpperCase() === "IN" && t.weekday === 0) return false;
  return t.hour >= WINDOW_START_HOUR && t.hour < WINDOW_END_HOUR;
}

export function dayPart(hour: number): "morning" | "afternoon" | "late" {
  return hour < 13 ? "morning" : hour < 16 ? "afternoon" : "late";
}

const parseTime = (s: string): number | null => {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
};

// ── Who is due ───────────────────────────────────────────────────────────────

export const MAX_ATTEMPTS = 3;
export const RETRY_GAP_HOURS = 20;
/** A call still "Calling" after this long is treated as stuck ⇒ reconcile. */
export const ACTIVE_CALL_MINUTES = 20;

export type Selection = {
  toCall: Contact[];
  skipped: { contact: Contact; reason: string }[];
  activeCalls: number;
  placedToday: number;
};

export function selectDue(d: Directory, now: Date, opts: { auto: boolean }): Selection {
  const nowMs = now.getTime();
  const active = d.contacts.filter((c) => {
    if (c.v.status !== STATUS.calling) return false;
    const t = parseTime(c.v.last_call_date);
    return t !== null && nowMs - t < ACTIVE_CALL_MINUTES * 60_000;
  });
  const placedToday = d.contacts.filter((c) => {
    const t = parseTime(c.v.last_call_date);
    return t !== null && nowMs - t < 24 * 3600_000;
  }).length;

  const groups: Contact[][] = [[], [], [], []]; // follow-ups, queued, retries, new
  const skipped: Selection["skipped"] = [];

  for (const c of d.contacts) {
    const status = c.v.status || STATUS.pending;
    const attempts = Number(c.v.call_attempts) || 0;
    let group = -1;
    if (status === STATUS.queued) group = 1;
    else if (status === STATUS.scheduled) {
      // An admin's own choice of time ⇒ not gated by autoDispatch, like Queued.
      if ((parseTime(c.v.follow_up_datetime) ?? Infinity) <= nowMs) group = 1;
    }
    else if (opts.auto) {
      if ((status === STATUS.callback || status === STATUS.sendInfo) && (parseTime(c.v.follow_up_datetime) ?? Infinity) <= nowMs) group = 0;
      else if (status === STATUS.noAnswer && attempts < MAX_ATTEMPTS) {
        const last = parseTime(c.v.last_call_date);
        const lastLocal = last !== null ? localTime(new Date(last), c.v.time_zone) : null;
        const nowLocal = localTime(now, c.v.time_zone);
        const spaced = last === null || nowMs - last >= RETRY_GAP_HOURS * 3600_000;
        const differentPart = !lastLocal || !nowLocal || dayPart(lastLocal.hour) !== dayPart(nowLocal.hour);
        if (spaced && differentPart) group = 2;
      } else if (status === STATUS.pending && attempts === 0) group = 3;
    }
    if (group < 0) continue;

    const check = checkContact(c, d);
    if (check !== "OK") { skipped.push({ contact: c, reason: check }); continue; }
    if (!inCallingWindow(now, c.v.time_zone, c.v.country)) { skipped.push({ contact: c, reason: "Outside calling hours (their local time)" }); continue; }
    groups[group].push(c);
  }

  // Organisations before individuals within a group; then oldest first by sheet order.
  const orgFirst = (a: Contact, b: Contact) => Number(a.tab === "Individuals") - Number(b.tab === "Individuals");
  groups[0].sort((a, b) => (parseTime(a.v.follow_up_datetime) ?? 0) - (parseTime(b.v.follow_up_datetime) ?? 0) || orgFirst(a, b));
  for (const g of groups.slice(1)) g.sort(orgFirst);

  // ⛔ One number, one call at a time — across tabs, and never while it is ringing.
  const busy = new Set(active.map(phoneOf));
  const ordered: Contact[] = [];
  for (const c of groups.flat()) {
    const p = phoneOf(c);
    if (busy.has(p)) { skipped.push({ contact: c, reason: "Already being called" }); continue; }
    busy.add(p);
    ordered.push(c);
  }

  const slots = Math.max(0, Math.min(d.settings.maxConcurrency - active.length, d.settings.dailyCap - placedToday));
  for (const c of ordered.slice(slots)) skipped.push({ contact: c, reason: "Waiting for a free line" });
  return { toCall: ordered.slice(0, slots), skipped, activeCalls: active.length, placedToday };
}

// ── What the agent is told ───────────────────────────────────────────────────

/**
 * 🔑 THE HELPLINE, from the same table the app's crisis card uses.
 * ⚠️ A web-only line ("findahelpline.com") cannot be dialled, so it is sent as
 * "" and the agent points to local emergency services instead ⇒ spec §7.1.
 */
export function helplineFor(country: string): string {
  const r = getCrisisResourcesForCountry(country);
  const line = r.primary.find((p) => !p.url);
  if (r.countryCode === "ZZ" || !line) return "";
  return `${line.label}, ${line.contact.split("/")[0].trim()}`;
}

export function userData(c: Contact, d: Pick<Directory, "team">, now: Date): Record<string, string> {
  const member = c.v.team_member;
  return {
    name: c.v.name,
    organisation: c.v.organisation,
    organisation_type: c.v.organisation_type || (c.tab === "Individuals" ? "individual" : ""),
    country: c.v.country.toUpperCase(),
    context: c.v.context,
    call_reason: c.v.call_reason || "scheduled",
    team_member: member,
    ambassador_gender: d.team.get(member.toLowerCase()) ?? "",
    // ⛔ Always — owner, 21 Oct: "virtual assistant" up front everywhere.
    disclose_upfront: "yes",
    helpline: helplineFor(c.v.country),
    timezone: c.v.time_zone,
    current_date: localTime(now, c.v.time_zone)?.date ?? now.toISOString().slice(0, 10),
    imotara_tab: c.tab,
    imotara_phone: phoneOf(c),
  };
}

// ── What an outcome writes back ──────────────────────────────────────────────

export type Extraction = {
  outcome?: string;
  summary?: string;
  next_action?: string;
  callback_time?: string;
  meeting_time?: string;
  sentiment?: string;
  objections?: string;
  needs?: string;
};

export type Writeback = {
  cells: Partial<Record<Column, string>>;
  addToDnc: boolean;
  safety: boolean;
  meeting: boolean;
  sendInfo: boolean;
};

/** Minutes the zone is ahead of UTC at `at` (e.g. +330 for Asia/Kolkata). */
function zoneOffsetMinutes(at: Date, timeZone: string): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/**
 * 11:00 in the CONTACT'S zone, N local days ahead, as a full ISO instant.
 * ⚠️ Not "T11:00:00" with no zone: the server is UTC, so that would mean
 * 16:30 in India and the callback would land at the end of the window.
 */
export function elevenLocal(now: Date, days: number, timeZone: string): string {
  const today = localTime(now, timeZone)?.date ?? now.toISOString().slice(0, 10);
  const [y, m, d] = today.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d + days, 11, 0, 0));
  return new Date(guess.getTime() - zoneOffsetMinutes(guess, timeZone) * 60_000).toISOString();
}

export function writebackFor(x: Extraction, now: Date, timeZone = "Asia/Kolkata"): Writeback {
  const outcome = (x.outcome ?? "").trim().toLowerCase();
  const cells: Writeback["cells"] = {
    outcome,
    call_summary: x.summary ?? "",
    next_action: x.next_action ?? "",
    bolna_execution_id: "",
  };
  const w: Writeback = { cells, addToDnc: false, safety: false, meeting: false, sendInfo: false };
  switch (outcome) {
    // ⛔ Safety overrides everything, and the number is never auto-called again.
    case "safety":
      cells.status = STATUS.safety; w.safety = true; break;
    case "meeting_booked":
      cells.status = STATUS.meeting; cells.follow_up_datetime = x.meeting_time ?? ""; w.meeting = true; break;
    case "callback_requested":
      cells.status = STATUS.callback; cells.follow_up_datetime = x.callback_time || elevenLocal(now, 1, timeZone); break;
    case "send_info":
      cells.status = STATUS.sendInfo; cells.follow_up_datetime = elevenLocal(now, 3, timeZone); w.sendInfo = true; break;
    case "not_interested":
      cells.status = STATUS.notInterested; break;
    case "do_not_call":
      cells.status = STATUS.dnc; w.addToDnc = true; break;
    case "wrong_number":
      cells.status = STATUS.wrongNumber; break;
    case "interested":
      cells.status = STATUS.interested; break;
    default:
      // no_answer, voicemail, or nothing extracted ⇒ retried by the rules.
      cells.status = STATUS.noAnswer; break;
  }
  return w;
}
