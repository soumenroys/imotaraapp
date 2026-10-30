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
import { countryCode, countryZone, normalisePhoneFor } from "@/lib/voice/countries";
import { callSlot, callZone, yes, zoneOffsetMinutes } from "@/lib/voice/slots";

export const CONTACT_TABS = ["Individuals", "NGOs", "Education", "Eldercare", "Corporates"] as const;
export type ContactTab = (typeof CONTACT_TABS)[number];

/**
 * 🔑 THE COLUMNS, IN THE ORDER THE SHEET SHOWS THEM (owner, 29 Oct 2026: "the
 * columns admin fills on the left, the system's on the right"). What the admin
 * types first; what the system writes after; three retired columns last.
 *
 * ⚠️ The code finds every column BY ITS HEADER NAME, never by its letter ⇒
 * layoutOf. This order is what Sheet setup moves the columns into
 * (sheets.reorderColumns), and the fallback when a tab has no headers at all.
 */
export const COLUMNS = [
  // ── The admin's ──
  "phone", "name", "organisation", "country", "time_zone", "language", "consent_note", "source",
  "email", "contact_by_email", "contact_by_phone",
  "mail_date", "mail_time", "mail_time_zone", "call_date", "call_time", "call_time_zone",
  "asked_for_call", "organisation_type", "team_member", "voice_gender", "context", "call_reason",
  "ambassador_notes", "do_not_contact",
  // ── The system's ──
  "call_progress", "mail_progress", "what_to_do",
  "status", "call_attempts", "last_call_date", "outcome", "call_summary", "next_action", "follow_up_datetime", "call_id",
  "mail_status", "mail_step", "mail_last_sent",
  // ── Retired (owner, 29 Oct 2026): phone is the only number; the check and the disclosure are the system's ──
  "contact_number", "disclose_upfront", "Check",
] as const;

/**
 * The order the sheet had until Sheet v2 (29 Oct 2026). ⚠️ Only for a tab whose
 * header row names none of the columns — the code otherwise goes by name.
 */
export const LEGACY_COLUMNS: readonly string[] = [
  "phone", "contact_number", "name", "organisation", "organisation_type", "country", "time_zone",
  "language", "source", "consent_note", "team_member", "context", "call_reason", "disclose_upfront",
  "Check", "status", "call_attempts", "last_call_date", "outcome", "call_summary", "next_action",
  "follow_up_datetime", "ambassador_notes", "voice_gender", "call_id",
  "email", "mail_status", "mail_step", "mail_last_sent",
  "do_not_contact", "call_progress", "mail_progress", "what_to_do",
  "contact_by_email", "contact_by_phone", "mail_date", "mail_time", "mail_time_zone", "call_date", "call_time", "call_time_zone",
  "asked_for_call",
];

/**
 * 🔑 THE COLUMNS AN ADMIN FILLS — the only ones left unlocked when the sheet is
 * protected (owner, 24 Oct 2026: "lock the entire google sheet … only keep
 * unlocked the columns which admin need to fill up"). Everything else is the
 * system's or a formula. ⇒ sheets.protectAndFormat.
 */
export const ADMIN_COLUMNS: readonly Column[] = [
  "phone", "name", "organisation", "organisation_type", "country", "time_zone", "language", "source",
  "consent_note", "team_member", "context", "call_reason", "ambassador_notes", "voice_gender", "email", "do_not_contact",
  "contact_by_email", "contact_by_phone", "mail_date", "mail_time", "mail_time_zone", "call_date", "call_time", "call_time_zone",
  "asked_for_call",
];

/** "yes", "y", "true", "stop", "x" or a ticked box ⇒ never contact this person, by phone or email. */
export function stoppedByAdmin(c: { v: Record<string, string> }): boolean {
  return /^(yes|y|true|stop|x|✓|✔)$/i.test((c.v.do_not_contact ?? "").trim());
}
export type Column = (typeof COLUMNS)[number];

/** A 0-based column index as the sheet names it: 0 → A, 25 → Z, 26 → AA. */
export function letterFor(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** The column's letter in the CANONICAL order — what Sheet setup arranges. ⚠️ Writes go by layoutOf, not this. */
export function columnLetter(col: Column): string {
  return letterFor(COLUMNS.indexOf(col));
}

/** Where each column sits in one tab: its 0-based index, or -1 when the tab has no such header. */
export type Layout = Record<Column, number>;

/** "Call Date" / "call_date " / "CALL_DATE" all name call_date. */
const headerKey = (h: string) => String(h ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");

/**
 * 🔑 A tab's layout, from its header row. A column is found by its NAME, so
 * moving, inserting or reordering columns in the sheet never makes the system
 * read or write the wrong cell.
 * ⚠️ A header row that names NONE of the columns (an empty tab) falls back to
 * the old fixed order, so a tab that was never headed still reads as before.
 */
export function layoutOf(header: readonly string[] | undefined): Layout {
  const keys = (header ?? []).map(headerKey);
  const found = Object.fromEntries(COLUMNS.map((c) => [c, keys.indexOf(headerKey(c))])) as Layout;
  if (COLUMNS.some((c) => found[c] >= 0)) return found;
  return Object.fromEntries(COLUMNS.map((c) => [c, LEGACY_COLUMNS.indexOf(c)])) as Layout;
}

/**
 * The column moves that put a tab's columns into the COLUMNS order, applied one
 * after another (Sheets' moveDimension: the whole column moves, data and all).
 * A column the tab does not have is skipped; columns the system does not know
 * end up after ours, in their own order. [] when the tab is already in order.
 */
export function columnMoves(header: readonly string[]): { from: number; to: number }[] {
  const cur = header.map(headerKey);
  const moves: { from: number; to: number }[] = [];
  let to = 0;
  for (const c of COLUMNS) {
    const from = cur.indexOf(headerKey(c));
    if (from < 0) continue;
    if (from !== to) {
      moves.push({ from, to });
      cur.splice(to, 0, ...cur.splice(from, 1));
    }
    to++;
  }
  return moves;
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
  /**
   * The call service refused to place the call. ⛔ Never picked again by itself:
   * left Queued, a refused dial was retried every 5 minutes, for ever.
   */
  dialFailed: "Dial failed",
} as const;

/**
 * ⛔ A call that ENDED here is not called again — not by the dispatcher, not by
 * a person pressing 📞, not by a schedule (review, 24 Oct: "Call now" ignored
 * these and the console showed them as a green OK). Safety and meetings belong
 * to a person; "Wrong number" can be Retried once the number is corrected.
 */
export const NO_MORE_CALLS: readonly string[] = [
  STATUS.safety, STATUS.notInterested, STATUS.dnc, STATUS.wrongNumber, STATUS.review, STATUS.meeting,
];

/** Statuses a person must act on — the console lists them first. */
export const NEEDS_A_PERSON: readonly string[] = [STATUS.safety, STATUS.review, STATUS.dialFailed, STATUS.meeting, STATUS.sendInfo, STATUS.wrongNumber];

/**
 * A scheduled call this late is not placed: the admin chose THAT time, and a
 * call days later (calling was off, the job was down) is a call nobody chose.
 */
export const SCHEDULE_GRACE_HOURS = 2;

/** Written by a call that ended "send me details"; the outreach mailer picks it up. */
export const MAIL_INFO_DUE = "Info due";

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
  /**
   * 🔑 The local hours a RETRY may ring in (start inclusive, end exclusive).
   * Owner, 28 Oct 2026: an admin's own time is "anytime … no restriction";
   * a retry's time is the system's choice, so it alone keeps a daytime band.
   */
  retryHours?: { start: number; end: number };
};

export const DEFAULT_RETRY_HOURS = { start: 9, end: 21 };

export const DEFAULT_SETTINGS: Settings = {
  callingEnabled: false,
  autoDispatch: false,
  maxConcurrency: 2,
  dailyCap: 30,
  alertEmails: ["info@imotara.com"],
  allowIndividuals: false,
  retryHours: { ...DEFAULT_RETRY_HOURS },
};

export type Directory = {
  contacts: Contact[];
  /** code → "start" | "not_yet" */
  languages: Map<string, string>;
  /** team member name (lower-case) → gender */
  team: Map<string, string>;
  /** normalised phone numbers on the Do not call tab */
  dnc: Set<string>;
  /** Empty rows still showing status text ⇒ staleStatusRows. */
  staleStatus?: { tab: ContactTab; row: number }[];
  settings: Settings;
};

// ── Parsing the sheet ────────────────────────────────────────────────────────

/** "+91 98000-00000" / "919800000000" → "+919800000000"; "" when it is not a number. */
export function normalisePhone(raw: string): string {
  const digits = String(raw ?? "").replace(/[^0-9]/g, "");
  return digits ? `+${digits}` : "";
}

/**
 * Rows that are no longer a contact (no phone, number or name) but still show
 * status text in the system columns — e.g. a person deleted by clearing their
 * cells. The status sync blanks them, so the sheet never shows a status for
 * nobody. ⇒ outreach/syncSheet.
 */
/** The cells the SYSTEM writes on a contact row — everything that is neither an admin column nor a formula. */
export const SYSTEM_STATE: readonly Column[] = [
  "status", "call_attempts", "last_call_date", "outcome", "call_summary", "next_action", "follow_up_datetime", "call_id",
  "mail_status", "mail_step", "mail_last_sent", "call_progress", "mail_progress", "what_to_do",
];

/**
 * Rows that are no longer a contact (no phone, number or name) but still hold
 * system state. ⚠️ ALL of it is wiped, not just the status text: with the sheet
 * locked, clearing a row and typing a new person in is the only way to replace
 * someone — and the new person used to inherit "Safety", three spent attempts
 * and a half-finished email sequence (review, 24 Oct). ⇒ outreach/syncSheet.
 */
export function staleStatusRows(tab: ContactTab, rows: string[][]): { tab: ContactTab; row: number }[] {
  const at = layoutOf(rows[0]);
  const out: { tab: ContactTab; row: number }[] = [];
  rows.slice(1).forEach((r, i) => {
    const cell = (c: Column) => (at[c] < 0 ? "" : String(r[at[c]] ?? "").trim());
    if (cell("phone") || cell("contact_number") || cell("name")) return;
    if (SYSTEM_STATE.some((c) => cell(c))) out.push({ tab, row: i + 2 });
  });
  return out;
}

/**
 * 🔑 What an empty organisation_type means on each tab (owner, 29 Oct 2026:
 * "organisation_type should be optional … it is already in the tab").
 */
export const TAB_ORGANISATION_TYPE: Record<ContactTab, string> = {
  Individuals: "individual",
  NGOs: "NGO",
  Education: "educational institution",
  Eldercare: "old age home",
  Corporates: "company",
};

export function parseContacts(tab: ContactTab, rows: string[][]): Contact[] {
  const at = layoutOf(rows[0]);
  const out: Contact[] = [];
  rows.slice(1).forEach((r, i) => {
    const v = Object.fromEntries(COLUMNS.map((c) => [c, at[c] < 0 ? "" : String(r[at[c]] ?? "").trim()])) as Record<Column, string>;
    if (!v.phone && !v.contact_number && !v.name) return;
    // 🔑 The dropdown shows "IN — India (+91)"; everything downstream wants "IN".
    const typedCountry = v.country;
    v.country = countryCode(typedCountry);
    // 🔑 An empty time_zone takes the country's — only where the country has ONE zone ⇒ countries.ts.
    if (!v.time_zone) v.time_zone = countryZone(typedCountry) ?? "";
    if (!v.organisation_type) v.organisation_type = TAB_ORGANISATION_TYPE[tab];
    out.push({ tab, row: i + 2, v });
  });
  return out;
}

const truthy = (s: string | undefined) => /^(yes|on|true|1)$/i.test((s ?? "").trim());

/** The optional Settings tab: two columns, key | value. Missing ⇒ the safe defaults. */
export function parseSettings(rows: string[][] | null): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS, alertEmails: [...DEFAULT_SETTINGS.alertEmails], retryHours: { ...DEFAULT_RETRY_HOURS } };
  for (const [k, v] of rows ?? []) {
    const key = (k ?? "").trim().toLowerCase();
    if (key === "calling_enabled") s.callingEnabled = truthy(v);
    else if (key === "auto_dispatch") s.autoDispatch = truthy(v);
    else if (key === "max_concurrency" && Number(v) > 0) s.maxConcurrency = Math.min(10, Math.floor(Number(v)));
    else if (key === "daily_cap" && Number(v) > 0) s.dailyCap = Math.floor(Number(v));
    else if (key === "alert_emails" && v?.trim()) s.alertEmails = v.split(/[,;\s]+/).filter((e) => e.includes("@"));
    else if (key === "allow_individuals") s.allowIndividuals = truthy(v);
    else if (key === "retry_hours") {
      // "09-21", "9:00-21:00"; "0-24" means any hour.
      const m = (v ?? "").match(/^\s*(\d{1,2})(?::00)?\s*[-–to]+\s*(\d{1,2})(?::00)?\s*$/i);
      if (m && Number(m[1]) < Number(m[2]) && Number(m[2]) <= 24) s.retryHours = { start: Number(m[1]), end: Number(m[2]) };
    }
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

/**
 * 🔑 The number to call: phone, with the country's code added when the admin
 * typed a national number ⇒ countries.normalisePhoneFor. contact_number is
 * retired (owner, 29 Oct 2026: "phone only") and read only when phone is empty.
 */
export function phoneOf(c: Contact): string {
  return normalisePhoneFor(c.v.phone || c.v.contact_number, c.v.country);
}

/**
 * Countries whose numbers DROP the national trunk 0 after the country code
 * (UK 020… ⇒ +44 20…, India 098… ⇒ +91 98…). Not Italy (+39 keeps its 0).
 */
const DROPS_TRUNK_ZERO = ["44", "91", "61", "64", "49", "33", "81", "86", "27", "234", "254", "880", "92", "94", "977", "971", "65", "60", "62", "63", "66", "353", "31", "32", "41", "46", "47", "45", "34", "1"];

/**
 * 🔴 What is wrong with a phone number, or null. Found walking the live sheet
 * 24 Oct: "+01494680873" and "+4402088634637" passed a LENGTH-only check, so a
 * call would have gone to a wrong or non-existent number.
 */
export function phoneProblem(phone: string): string | null {
  const d = phone.replace("+", "");
  if (d.length < 10) return "Phone needs country code and number";
  if (d.length > 15) return "Phone has too many digits";
  if (d.startsWith("0")) return "Phone has no country code (it starts with 0)";
  const cc = DROPS_TRUNK_ZERO.find((c) => d.startsWith(c) && d[c.length] === "0");
  if (cc) return `Phone has an extra 0 after the country code +${cc}`;
  return null;
}

export function checkContact(
  c: Contact,
  d: Pick<Directory, "languages" | "dnc"> & { settings?: Pick<Settings, "allowIndividuals"> },
): string {
  const phone = phoneOf(c);
  const bad = phoneProblem(phone);
  if (bad) return bad;
  if (!c.v.name) return "Missing name";
  if (/^sample\b/i.test(c.v.name)) return "Sample row - delete it";
  // ⛔ Owner, 28 Oct 2026: called only when the admin chose "yes" for phone. Blank is not yes.
  if (!yes(c.v.contact_by_phone)) return "Contact by phone is not yes";
  if (d.dnc.has(phone)) return "On do-not-call list - never call";
  if (NO_MORE_CALLS.includes(c.v.status)) return `Call ended: ${c.v.status}`;
  if (stoppedByAdmin(c)) return "Stopped by admin (do_not_contact)";
  // ⛔ Permanent, owner's instruction ⇒ spec §5.1.
  if (/open ?lm/i.test(c.v.organisation) || /openlm\.com/i.test(c.v.consent_note + c.v.context)) {
    return "EXCLUDED: OpenLM - never call";
  }
  if (!c.v.consent_note) return "Add consent note";
  /**
   * ⛔ Promotional calls to individuals in India need TRAI DLT and a 140-series
   * number — not done yet (mailboxes checked 28 Oct 2026). Until then the
   * owner's middle path: an individual who ASKED us to call is a reply to their
   * own request, not promotion ⇒ asked_for_call = yes lets that row through.
   */
  if (c.tab === "Individuals" && d.settings?.allowIndividuals === false && !yes(c.v.asked_for_call)) {
    return "Individuals paused (TRAI/DLT) - only people who asked for a call";
  }
  if (d.languages.get(c.v.language.toLowerCase()) !== "start") return "Language not started yet";
  if (!agentFor(c.v.language, c.v.voice_gender)) return "No agent for this language and voice";
  if (!callZone(c)) return c.v.call_time_zone || c.v.time_zone ? "Time zone not understood" : "Add time zone";
  return "OK";
}

// ── Time ─────────────────────────────────────────────────────────────────────

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

/**
 * ⚠️ Only RETRIES are held to these hours — the one call whose time the system
 * picks. An admin's time, a console Schedule, Call now and a callback the
 * person asked for are placed when they say (owner, 28 Oct 2026: "anytime in
 * 24 hours, 365 days … no restriction").
 */
export function inRetryHours(now: Date, timeZone: string, hours: { start: number; end: number } = DEFAULT_RETRY_HOURS): boolean {
  const t = localTime(now, timeZone);
  if (!t) return false;
  return t.hour >= hours.start && t.hour < hours.end;
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

export const MISSED_SCHEDULE = "Scheduled time passed - schedule it again";

/** True when a Scheduled row's time is more than the grace period ago. */
export function missedSchedule(c: Contact, now: Date): boolean {
  const at = parseTime(c.v.follow_up_datetime);
  return c.v.status === STATUS.scheduled && at !== null && now.getTime() - at > SCHEDULE_GRACE_HOURS * 3600_000;
}

/**
 * ⛔ The console names a row by tab + row number, and the team edits the sheet
 * while the page is open: a row deleted above shifts everyone below up one, and
 * "call row 7" would ring someone else. Every action carries the phone the page
 * showed, and is refused if the row now holds a different number.
 */
export function sameContact(c: Contact, phone: string | undefined): boolean {
  return !!phone && phoneOf(c) === normalisePhone(phone);
}

export const MISSED_SHEET_CALL = "Call time passed - set a new call date";
export const OUTSIDE_RETRY_HOURS = "Retry waits for retry hours (their local time)";

/**
 * Is the sheet's call time due? "none" when no time is set, or when a call was
 * already placed at or after it (so a NEW, later date in the sheet calls again).
 * ⚠️ Missed by more than the grace period ⇒ "missed", never a call hours late.
 */
export function sheetCallDue(c: Contact, now: Date): "none" | "due" | "waiting" | "missed" {
  if (!yes(c.v.contact_by_phone)) return "none";
  // ⛔ A refused dial records no call time, so its slot would look unspent and
  // ring again every 5 minutes (the 24 Oct bug). It waits for a person's Retry.
  if (c.v.status === STATUS.dialFailed || c.v.status === STATUS.calling) return "none";
  const slot = callSlot(c);
  if (slot.kind !== "at") return "none";
  const at = slot.at.getTime();
  const last = parseTime(c.v.last_call_date);
  if (last !== null && last >= at) return "none";
  if (at > now.getTime()) return "waiting";
  return now.getTime() - at > SCHEDULE_GRACE_HOURS * 3600_000 ? "missed" : "due";
}

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

  const groups: Contact[][] = [[], [], []]; // follow-ups, the admin's own times, retries
  const skipped: Selection["skipped"] = [];

  for (const c of d.contacts) {
    const status = c.v.status || STATUS.pending;
    const attempts = Number(c.v.call_attempts) || 0;
    const sheet = sheetCallDue(c, now);
    let group = -1;
    if (status === STATUS.queued) group = 1;
    else if (status === STATUS.scheduled) {
      // An admin's own choice of time ⇒ not gated by autoDispatch, like Queued.
      const at = parseTime(c.v.follow_up_datetime) ?? Infinity;
      if (at <= nowMs && nowMs - at > SCHEDULE_GRACE_HOURS * 3600_000) {
        skipped.push({ contact: c, reason: MISSED_SCHEDULE });
        continue;
      }
      if (at <= nowMs) group = 1;
    }
    // 🔑 The sheet's call_date + call_time: the admin's own choice too ⇒ not gated by autoDispatch.
    else if (sheet === "due") group = 1;
    else if (sheet === "missed") { skipped.push({ contact: c, reason: MISSED_SHEET_CALL }); continue; }
    else if (opts.auto) {
      if ((status === STATUS.callback || status === STATUS.sendInfo) && (parseTime(c.v.follow_up_datetime) ?? Infinity) <= nowMs) group = 0;
      else if (status === STATUS.noAnswer && attempts < MAX_ATTEMPTS) {
        const zone = callZone(c) ?? "UTC";
        const last = parseTime(c.v.last_call_date);
        const lastLocal = last !== null ? localTime(new Date(last), zone) : null;
        const nowLocal = localTime(now, zone);
        const spaced = last === null || nowMs - last >= RETRY_GAP_HOURS * 3600_000;
        const differentPart = !lastLocal || !nowLocal || dayPart(lastLocal.hour) !== dayPart(nowLocal.hour);
        if (spaced && differentPart) group = 2;
      }
      // ⛔ No "new" group any more: a row with no call date WAITS (owner, 28 Oct 2026:
      // nothing goes out that the admin did not schedule).
    }
    if (group < 0) continue;

    const check = checkContact(c, d);
    if (check !== "OK") { skipped.push({ contact: c, reason: check }); continue; }
    // ⚠️ Retries only: their time is the system's choice ⇒ inRetryHours.
    if (group === 2 && !inRetryHours(now, callZone(c)!, d.settings.retryHours)) {
      skipped.push({ contact: c, reason: OUTSIDE_RETRY_HOURS });
      continue;
    }
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
    organisation_type: c.v.organisation_type || TAB_ORGANISATION_TYPE[c.tab],
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
    call_id: "",
  };
  const w: Writeback = { cells, addToDnc: false, safety: false, meeting: false, sendInfo: false };
  switch (outcome) {
    // ⛔ Safety overrides everything, and the number is never auto-called again.
    case "safety":
      cells.status = STATUS.safety; w.safety = true; break;
    case "meeting_booked":
      cells.status = STATUS.meeting; cells.follow_up_datetime = x.meeting_time ?? ""; w.meeting = true; break;
    case "callback_requested": {
      // ⚠️ The agent may say "tomorrow 4pm"; a time that cannot be read used to mean a callback that never came.
      const readable = x.callback_time && Number.isFinite(Date.parse(x.callback_time));
      cells.status = STATUS.callback;
      cells.follow_up_datetime = readable ? x.callback_time! : elevenLocal(now, 1, timeZone);
      if (x.callback_time && !readable) cells.next_action = `${x.next_action ? `${x.next_action} · ` : ""}They asked for: “${x.callback_time}” — set for 11:00 tomorrow their time; adjust if needed.`;
      break;
    }
    case "send_info":
      cells.status = STATUS.sendInfo; cells.follow_up_datetime = elevenLocal(now, 3, timeZone); w.sendInfo = true;
      // 🔑 The call asked for details ⇒ the outreach mailer sends the info email next ⇒ lib/outreach.
      cells.mail_status = MAIL_INFO_DUE;
      break;
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
