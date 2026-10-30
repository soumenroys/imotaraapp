// src/lib/voice/sheets.ts
// Reading and writing the "Imotara Call Directory" Google Sheet.
//
// 🔑 A SERVICE ACCOUNT, signed with Node's own crypto — no googleapis package.
// The sheet is shared with the service account's address as an editor; the
// account can reach nothing else.
//
// ⛔ The private key lives only in Vercel (GOOGLE_SA_PRIVATE_KEY). It is never
// logged, and a missing one is a plain refusal, not a crash.

import { createSign } from "node:crypto";
import {
  ADMIN_COLUMNS, CONTACT_TABS, COLUMNS, SYSTEM_STATE, columnMoves, label, layoutOf, letterFor, parseContacts, staleStatusRows, parseDnc, parseLanguages, parseSettings, parseTeam,
  type Column, type Contact, type ContactTab, type Directory, type Layout,
} from "@/lib/voice/rules";
import { COUNTRIES, countryLabel } from "@/lib/voice/countries";

/** ⚠️ Not a secret: the id is in every link to the sheet. Override with VOICE_SHEET_ID. */
const DEFAULT_SHEET_ID = "1KrmVD2vjDq6QVbWl1Vt9qbiwtI47lB05ZFt8IblESjY";
const API = "https://sheets.googleapis.com/v4/spreadsheets";

export function sheetId(): string {
  return process.env.VOICE_SHEET_ID?.trim() || DEFAULT_SHEET_ID;
}

/**
 * 🔑 GOOGLE_SA_JSON is the whole key file Google downloads, pasted as it is —
 * nobody has to pick a field out of it. GOOGLE_SA_EMAIL + GOOGLE_SA_PRIVATE_KEY
 * still work for a key added the long way.
 */
function credentials(): { email: string; key: string } | null {
  const json = process.env.GOOGLE_SA_JSON?.trim();
  if (json) {
    try {
      const f = JSON.parse(json) as { client_email?: string; private_key?: string };
      if (f.client_email && f.private_key) return { email: f.client_email, key: f.private_key };
    } catch {
      // ⚠️ A broken paste falls through to "not set up", never to a crash.
    }
    return null;
  }
  const email = process.env.GOOGLE_SA_EMAIL?.trim();
  // ⚠️ Vercel stores a pasted key with literal "\n"; restore real newlines.
  const key = process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, "\n");
  return email && key?.trim() ? { email, key } : null;
}

export function sheetsConfigured(): boolean {
  return credentials() !== null;
}

let cached: { token: string; until: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const creds = credentials();
  if (!creds) throw new Error("Google access to the call sheet is not set up (GOOGLE_SA_JSON).");
  const { email, key } = creds;

  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(key).toString("base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !body.access_token) throw new Error(`Google refused the sign-in: ${body.error_description ?? res.status}`);
  cached = { token: body.access_token, until: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return body.access_token;
}

async function google(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${API}/${sheetId()}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${await accessToken()}`, "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Google Sheets answered ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

// ── Links that open the sheet AT the thing to fix ─────────────────────────────
// 🔑 Owner, 25 Oct 2026: "share the required google sheet links in all places
// where admin may need those to fill up or verification". A link to the sheet's
// first page made the admin hunt for the tab and the row; these open both.

let gidCache: { at: number; gids: Record<string, number> } | null = null;

/** Each tab's id as it appears in the sheet's own links (#gid=…), cached 10 minutes. */
export async function tabGids(): Promise<Record<string, number>> {
  if (gidCache && Date.now() - gidCache.at < 10 * 60_000) return gidCache.gids;
  const meta = (await google("?fields=sheets(properties(sheetId,title))")) as { sheets?: { properties: { sheetId: number; title: string } }[] };
  const gids = Object.fromEntries((meta.sheets ?? []).map((s) => [s.properties.title, s.properties.sheetId]));
  gidCache = { at: Date.now(), gids };
  return gids;
}

/** Open the sheet at a tab and, if given, a row. Falls back to the sheet itself when the tab's id is unknown. */
export function sheetLink(gids: Record<string, number> | null | undefined, tab?: string, row?: number): string {
  const base = `https://docs.google.com/spreadsheets/d/${sheetId()}/edit`;
  const gid = tab ? gids?.[tab] : undefined;
  if (gid === undefined) return base;
  return `${base}#gid=${gid}${row ? `&range=A${row}` : ""}`;
}

const quote = (tab: string) => `'${tab.replace(/'/g, "''")}'`;

/**
 * ⚠️ OPEN RANGES: the whole tab, or its whole first row — never "A1:BZ".
 * Google refuses a range wider than the tab's grid, and a column moved or added
 * by the team must still be seen.
 */
const wholeTab = (tab: string) => quote(tab);
const headerRow = (tab: string) => `${quote(tab)}!1:1`;

/**
 * 🔑 A HIDDEN "Lists" tab holds what the dropdowns and the time-zone formula
 * look up: the countries with their zones, and the languages as "bn — Bengali"
 * (a live formula over the Languages tab). Owner only.
 */
const LISTS_TAB = "Lists";
const LISTS = quote(LISTS_TAB);

/**
 * 🔑 Each tab's layout, read FRESH from its header row before every write.
 * ⛔ Never cached across calls: Sheet setup moves columns, and a layout from
 * before a move would write a call result into somebody else's column.
 */
async function layouts(tabs: readonly string[]): Promise<Record<string, Layout>> {
  const unique = [...new Set(tabs)];
  const ranges = unique.map((t) => `ranges=${encodeURIComponent(headerRow(t))}`).join("&");
  const data = (await google(`/values:batchGet?${ranges}`)) as { valueRanges?: { values?: string[][] }[] };
  return Object.fromEntries(unique.map((t, i) => [t, layoutOf(data.valueRanges?.[i]?.values?.[0])]));
}

/** The A1 cell of one column on one row. ⚠️ Throws when the tab has no such column — a guess would write into the wrong one. */
function cellRef(tab: string, at: Layout, col: Column, row: number): string {
  if (at[col] < 0) throw new Error(`The "${tab}" tab has no "${col}" column — press Sheet setup in the admin to add it.`);
  return `${quote(tab)}!${letterFor(at[col])}${row}`;
}

/** Every tab in one request. ⚠️ A missing Settings tab is normal ⇒ safe defaults. */
export async function readDirectory(): Promise<Directory> {
  const tabs = [...CONTACT_TABS, "Languages", "Team", "Do not call"];
  // ⚠️ Open-ended: a tab past row 1000 used to be invisible to calling, email and the status sync (review, 24 Oct).
  const ranges = tabs.map((t) => `ranges=${encodeURIComponent(wholeTab(t))}`).join("&");
  const data = (await google(`/values:batchGet?${ranges}&valueRenderOption=FORMATTED_VALUE`)) as {
    valueRanges?: { values?: string[][] }[];
  };
  const values = (i: number) => data.valueRanges?.[i]?.values ?? [];

  let settingsRows: string[][] | null = null;
  try {
    const s = (await google(`/values/${encodeURIComponent(`${quote("Settings")}!A1:B50`)}`)) as { values?: string[][] };
    settingsRows = s.values ?? [];
  } catch {
    settingsRows = null;
  }

  const contacts: Contact[] = CONTACT_TABS.flatMap((t, i) => parseContacts(t, values(i)));
  return {
    contacts,
    staleStatus: CONTACT_TABS.flatMap((t, i) => staleStatusRows(t, values(i))),
    languages: parseLanguages(values(CONTACT_TABS.length)),
    team: parseTeam(values(CONTACT_TABS.length + 1)),
    dnc: parseDnc(values(CONTACT_TABS.length + 2)),
    settings: parseSettings(settingsRows),
  };
}

/** Write some cells of one contact row. ⚠️ RAW: nothing the agent says becomes a formula. */
export async function writeRow(c: Pick<Contact, "tab" | "row">, cells: Partial<Record<Column, string>>): Promise<void> {
  if (Object.keys(cells).length === 0) return;
  const at = (await layouts([c.tab]))[c.tab];
  const data = Object.entries(cells).map(([col, value]) => ({
    range: cellRef(c.tab, at, col as Column, c.row),
    values: [[value ?? ""]],
  }));
  await google(`/values:batchUpdate`, { method: "POST", body: JSON.stringify({ valueInputOption: "RAW", data }) });
}

export async function appendDnc(phone: string, name: string, reason: string): Promise<void> {
  await google(`/values/${encodeURIComponent(`${quote("Do not call")}!A:D`)}:append?valueInputOption=RAW`, {
    method: "POST",
    body: JSON.stringify({ values: [[phone, name, reason, new Date().toISOString().slice(0, 10)]] }),
  });
}

/**
 * Every column the system knows gets its header — the friendly one, e.g.
 * "Call them? (yes/no)" (owner, 30 Oct 2026): rewritten where the column
 * already is, added after the last header where it is missing. Idempotent:
 * header text only — no data cell is touched.
 */
export async function ensureSystemColumns(): Promise<void> {
  const ranges = CONTACT_TABS.map((t) => `ranges=${encodeURIComponent(headerRow(t))}`).join("&");
  const got = (await google(`/values:batchGet?${ranges}`)) as { valueRanges?: { values?: string[][] }[] };
  const data = CONTACT_TABS.flatMap((t, i) => {
    const header = got.valueRanges?.[i]?.values?.[0] ?? [];
    const at = layoutOf(header);
    let next = header.length;
    return COLUMNS.map((c) => ({ range: `${quote(t)}!${letterFor(at[c] >= 0 ? at[c] : next++)}1`, values: [[label(c)]] }));
  });
  await google(`/values:batchUpdate`, { method: "POST", body: JSON.stringify({ valueInputOption: "RAW", data }) });
}

/**
 * 🔑 Move each contact tab's columns into the COLUMNS order — the admin's on
 * the left, the system's on the right (owner, 29 Oct 2026). Sheets' own column
 * move: every cell, note, format and formula goes with its column, so no row's
 * data is retyped or lost. Safe to press again: an ordered tab needs no moves.
 * ⚠️ Run after ensureSystemColumns (every column must have its header).
 */
export async function reorderColumns(): Promise<{ tab: string; moves: number }[]> {
  const gids = await tabGids();
  const ranges = CONTACT_TABS.map((t) => `ranges=${encodeURIComponent(headerRow(t))}`).join("&");
  const got = (await google(`/values:batchGet?${ranges}`)) as { valueRanges?: { values?: string[][] }[] };
  const out: { tab: string; moves: number }[] = [];
  const requests: unknown[] = [];
  CONTACT_TABS.forEach((t, i) => {
    const sheetId = gids[t];
    if (sheetId === undefined) return;
    const moves = columnMoves(got.valueRanges?.[i]?.values?.[0] ?? []);
    out.push({ tab: t, moves: moves.length });
    if (!moves.length) return;
    // ⚠️ Unfreeze first: a move across the frozen edge is refused. protectAndFormat freezes again.
    requests.push({ updateSheetProperties: { properties: { sheetId, gridProperties: { frozenColumnCount: 0 } }, fields: "gridProperties.frozenColumnCount" } });
    for (const m of moves) {
      requests.push({ moveDimension: { source: { sheetId, dimension: "COLUMNS", startIndex: m.from, endIndex: m.from + 1 }, destinationIndex: m.to } });
    }
  });
  // One request: the moves apply in order, all or none.
  if (requests.length) await google(`:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) });
  return out;
}

/** The Settings keys the admin console may change, as the sheet spells them. */
export type SettingKey = "calling_enabled" | "auto_dispatch" | "max_concurrency" | "daily_cap" | "allow_individuals" | "retry_hours";

/**
 * Write Settings values from the admin console. Updates the row that already
 * holds a key, appends the ones that are missing — so the team still sees and
 * can edit every switch in the sheet.
 */
export async function writeSettings(values: Partial<Record<SettingKey, string>>): Promise<void> {
  const entries = Object.entries(values);
  if (entries.length === 0) return;
  const s = (await google(`/values/${encodeURIComponent(`${quote("Settings")}!A1:B50`)}`)) as { values?: string[][] };
  const rows = s.values ?? [];
  const data: { range: string; values: string[][] }[] = [];
  const missing: string[][] = [];
  for (const [key, value] of entries) {
    const i = rows.findIndex((r) => (r[0] ?? "").trim().toLowerCase() === key);
    if (i >= 0) data.push({ range: `${quote("Settings")}!B${i + 1}`, values: [[value ?? ""]] });
    else missing.push([key, value ?? ""]);
  }
  if (data.length) await google(`/values:batchUpdate`, { method: "POST", body: JSON.stringify({ valueInputOption: "RAW", data }) });
  if (missing.length) {
    await google(`/values/${encodeURIComponent(`${quote("Settings")}!A:B`)}:append?valueInputOption=RAW`, {
      method: "POST",
      body: JSON.stringify({ values: missing }),
    });
  }
}

/**
 * Add one contact to a tab and return its row: the FIRST EMPTY row, written by
 * column name. ⚠️ Not Google's "append": every row carries a time-zone formula
 * (fillZoneDefaults), so append would find the table "full" and add row 1001.
 */
export async function appendContact(tab: ContactTab, cells: Partial<Record<Column, string>>): Promise<number> {
  const data = (await google(`/values/${encodeURIComponent(wholeTab(tab))}`)) as { values?: string[][] };
  const rows = data.values ?? [];
  const at = layoutOf(rows[0]);
  for (const col of Object.keys(cells)) cellRef(tab, at, col as Column, 1); // ⚠️ throws on a column the tab lacks
  const used = (r: string[]) => (["phone", "name", "contact_number", "email", ...SYSTEM_STATE] as Column[]).some((c) => at[c] >= 0 && String(r[at[c]] ?? "").trim());
  let i = rows.findIndex((r, k) => k > 0 && !used(r));
  if (i < 0) i = Math.max(rows.length, 1);
  const row = i + 1;
  const grid = await rowCount(tab);
  if (row > grid) {
    const gids = await tabGids();
    await google(`:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: [{ appendDimension: { sheetId: gids[tab], dimension: "ROWS", length: 100 } }] }) });
  }
  await writeRow({ tab, row }, cells);
  return row;
}

/** How many rows a tab's grid has. */
async function rowCount(tab: string): Promise<number> {
  const meta = (await google(`?fields=sheets(properties(title,gridProperties(rowCount)))`)) as { sheets?: { properties: { title: string; gridProperties?: { rowCount?: number } } }[] };
  return meta.sheets?.find((x) => x.properties.title === tab)?.properties.gridProperties?.rowCount ?? 1000;
}

/**
 * 🔑 The hidden Lists tab: countries (code, dropdown label, zone) and the
 * languages as "bn — Bengali", live from the Languages tab. Created hidden if
 * missing; rewritten on every Sheet setup, so a country added in code arrives.
 */
export async function ensureLists(): Promise<void> {
  const gids = await tabGids();
  if (gids[LISTS_TAB] === undefined) {
    await google(`:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: [{ addSheet: { properties: { title: LISTS_TAB, hidden: true } } }] }) });
    gidCache = null;
  }
  const values = [
    ["Country code", "Country (dropdown)", "Time zone", "Call language (dropdown)"],
    ...COUNTRIES.map((k, i) => [k.code, countryLabel(k), k.zone ?? "", i === 0 ? LANGUAGE_CHOICES : ""]),
  ];
  await google(`/values/${encodeURIComponent(`${LISTS}!A1:D${values.length}`)}?valueInputOption=USER_ENTERED`, { method: "PUT", body: JSON.stringify({ values }) });
}

/** "bn — Bengali" for every language on the Languages tab — a live formula, so a language the owner adds appears by itself. */
const LANGUAGE_CHOICES = `=IFERROR(FILTER(TRIM(${quote("Languages")}!A2:A)&" — "&TRIM(${quote("Languages")}!B2:B), TRIM(${quote("Languages")}!A2:A)<>""), "")`;

/**
 * 🔑 Owner, 30 Oct 2026: "when i am selecting the country, the timezone is not
 * getting selected". Every EMPTY time-zone cell gets a formula that looks the
 * country's zone up in Lists — it fills the moment a country is chosen; picking
 * another zone from the dropdown simply replaces it. A country with several
 * zones gives "" (the admin chooses).
 * ⚠️ ONLY empty cells are written: a zone an admin chose is never touched.
 */
export async function fillZoneDefaults(): Promise<number> {
  const lay = await layouts(CONTACT_TABS);
  let written = 0;
  const data: { range: string; values: string[][] }[] = [];
  for (const tab of CONTACT_TABS) {
    const at = lay[tab];
    if (at.time_zone < 0 || at.country < 0) continue;
    const zoneCol = letterFor(at.time_zone);
    const countryCol = letterFor(at.country);
    const last = await rowCount(tab);
    const got = (await google(`/values/${encodeURIComponent(`${quote(tab)}!${zoneCol}2:${zoneCol}${last}`)}?valueRenderOption=FORMULA`)) as { values?: string[][] };
    const cur = got.values ?? [];
    // Runs of empty cells ⇒ one range each.
    let start = -1;
    const flush = (end: number) => {
      if (start < 0) return;
      const vals = [];
      for (let r = start; r < end; r++) vals.push([zoneFormula(countryCol, r + 2)]);
      data.push({ range: `${quote(tab)}!${zoneCol}${start + 2}:${zoneCol}${end + 1}`, values: vals });
      written += vals.length;
      start = -1;
    };
    for (let r = 0; r < last - 1; r++) {
      const empty = !String(cur[r]?.[0] ?? "").trim();
      if (empty && start < 0) start = r;
      if (!empty) flush(r);
    }
    flush(last - 1);
  }
  if (data.length) await google(`/values:batchUpdate`, { method: "POST", body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }) });
  return written;
}

/** The time-zone default for one row: the country's zone from Lists, or "". */
export const zoneFormula = (countryCol: string, row: number) =>
  `=IFERROR(VLOOKUP(UPPER(LEFT(TRIM(${countryCol}${row}),2)),${LISTS}!$A:$C,3,FALSE)&"","")`;

/** Many cells across many rows in ONE request — for the status columns, rewritten every few minutes. */
export async function writeMany(updates: { c: Pick<Contact, "tab" | "row">; cells: Partial<Record<Column, string>> }[]): Promise<number> {
  if (updates.length === 0) return 0;
  const at = await layouts(updates.map((u) => u.c.tab));
  const data = updates.flatMap(({ c, cells }) =>
    Object.entries(cells).map(([col, value]) => ({ range: cellRef(c.tab, at[c.tab], col as Column, c.row), values: [[value ?? ""]] })),
  );
  for (let i = 0; i < data.length; i += 500) {
    await google(`/values:batchUpdate`, { method: "POST", body: JSON.stringify({ valueInputOption: "RAW", data: data.slice(i, i + 500) }) });
  }
  return data.length;
}

// ── Locking and formatting ───────────────────────────────────────────────────
//
// 🔑 OWNER, 24 Oct 2026: "lock the entire google sheet, format it nicely in a
// professional way, only keep unlocked the columns which admin need to fill up".
//
// 🔴 THE LOCK MUST NOT LOCK OUT THE SYSTEM. Every call result and email status
// is written by this service account; a protection that left it out would stop
// every write-back silently. ⇒ It is named as the protection's editor, and the
// caller proves a write still works afterwards (verifySystemCanWrite).
//
// ⚠️ IDEMPOTENT: our protections carry the PROTECT_TAG description and are
// replaced, not stacked; our conditional-format rules are replaced the same way.

const PROTECT_TAG = "imotara-system:";
const TEAL = { red: 0.06, green: 0.3, blue: 0.36 };
const SLATE = { red: 0.37, green: 0.42, blue: 0.48 };
const WHITE = { red: 1, green: 1, blue: 1 };
const SYSTEM_FILL = { red: 0.95, green: 0.96, blue: 0.97 };
const SYSTEM_TEXT = { red: 0.25, green: 0.28, blue: 0.33 };

/**
 * The zones offered in the dropdowns: every listed country's own zone, plus the
 * main zones of the countries that span several. Any other IANA name may still be typed.
 */
const COMMON_ZONES = [...new Set([
  "Asia/Kolkata",
  ...COUNTRIES.flatMap((c) => (c.zone ? [c.zone] : [])),
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto", "America/Vancouver",
  "America/Mexico_City", "America/Sao_Paulo", "Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane", "Australia/Perth",
  "Asia/Jakarta", "Europe/Moscow", "UTC",
])];

/** Every half hour, for the time dropdowns. ⚠️ Not strict: "14:45" or "2 pm" may still be typed. */
const HALF_HOURS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

/**
 * 🔑 THE NOTE ON EVERY HEADER (owner, 30 Oct 2026: "add notes in each column
 * header so that admin can understand why the column is required and whether
 * admin need to fillup that column or not"). Each starts with who fills it.
 */
export const NOTES: Record<Column, string> = {
  phone: "REQUIRED for calls. The number to call. Type it as you have it — choose the Country and its code is added for you (98300 12345 with India = +91 98300 12345). A number starting with + is used as typed. Only digits, +, spaces, ( ) and - are accepted.",
  name: "REQUIRED. The person's name — the assistant greets them by it, and every email opens with it.",
  organisation: "REQUIRED for organisations, empty for a person. The emails and the call mention it.",
  country: "REQUIRED. Choose from the list. It adds the country code to the phone number and fills the Time zone for you.",
  time_zone: "REQUIRED — filled for you when you choose the Country. ⚠️ USA, Canada, Mexico, Brazil, Australia, Russia and Indonesia have several zones: choose one from the list. Calls and emails go at the times you set, in this zone.",
  language: "REQUIRED for calls. Choose from the list — the assistant speaks this language. A language marked 'Not yet' on the Languages tab is not called.",
  consent_note: "REQUIRED. How and when they agreed to be contacted, e.g. 'Asked for a call at the Kolkata fair, 12 Oct'. No consent = no call and no email. Never said on the call or sent.",
  source: "OPTIONAL. Where we found them, e.g. a fair, a referral, the website.",
  email: "REQUIRED for emails. Their email address — checked as you type. Emailed only when 'Send emails?' is yes.",
  contact_by_email: "REQUIRED for emails. yes = send the introduction at the First email date + time, then follow-ups 7 and 21 days later at the same time. Empty or no = never emailed.",
  contact_by_phone: "REQUIRED for calls. yes = call at the Call date + time. Empty or no = never called.",
  mail_date: "REQUIRED for emails. The day of the FIRST email — double-click for a calendar. Follow-ups go 7 and 21 days later.",
  mail_time: "REQUIRED for emails. The time of the first email — choose from the list, or type any time (24-hour, e.g. 14:45). Any hour.",
  mail_time_zone: "OPTIONAL. Only if the emails should follow another zone than the row's Time zone.",
  call_date: "REQUIRED for calls. The day to call — double-click for a calendar. A new, later date calls again.",
  call_time: "REQUIRED for calls. The time to call — choose from the list, or type any time (24-hour). ⚠️ The call service rings only 09:00–21:00 their time; a time outside is held until 09:00. No answer = retried automatically, up to 3 tries.",
  call_time_zone: "OPTIONAL. Only if the call should follow another zone than the row's Time zone.",
  asked_for_call: "REQUIRED for the Individuals tab. yes ONLY if the person themselves asked us to call — and write when and how in 'How they agreed to be contacted'. Until TRAI DLT registration is done, individuals are called only with yes here.",
  organisation_type: "OPTIONAL. Empty = the tab says it (NGOs → NGO, Eldercare → old age home, Education → educational institution, Corporates → company). Fill only to be more exact, e.g. college, hospice.",
  team_member: "OPTIONAL. The team member who owns this contact — the assistant may offer a meeting with them. Use a name from the Team tab.",
  voice_gender: "OPTIONAL. The assistant's voice: Female (also when empty) or Male.",
  context: "OPTIONAL. What the assistant may mention on the call, e.g. 'runs a student helpline'. ⛔ Not consent — that goes in 'How they agreed to be contacted'.",
  call_reason: "OPTIONAL. Why we are calling, if not the usual introduction.",
  ambassador_notes: "OPTIONAL. Your own notes — never used by the system.",
  do_not_contact: "Fill ONLY to stop: choose yes and nobody calls or emails this person again.",
  call_progress: "SYSTEM — do not fill. Where calling stands: ✅ done · ⏳ in queue · 🟡 waiting · ⛔ problem · 🔴 safety (call them yourself today).",
  mail_progress: "SYSTEM — do not fill. Where email stands: ✅ done · ⏳ in queue · 🟡 waiting · ⛔ problem.",
  what_to_do: "SYSTEM — do not fill. What YOU should do about this row, in plain words. 'Nothing needed now' = nothing.",
  status: "SYSTEM — do not fill. The result of the last call (No answer, Interested, Callback requested …).",
  call_attempts: "SYSTEM — do not fill. How many times we have called. Unanswered calls are retried up to 3 times.",
  last_call_date: "SYSTEM — do not fill. When the last call was placed.",
  outcome: "SYSTEM — do not fill. The call's outcome as the call service reported it.",
  call_summary: "SYSTEM — do not fill. A short summary of what was said on the call.",
  next_action: "SYSTEM — do not fill. The next step the call agreed, e.g. send details, call back Tuesday.",
  follow_up_datetime: "SYSTEM — do not fill. When the follow-up (callback or meeting) is due.",
  call_id: "SYSTEM — do not fill. The call service's id, to find the recording.",
  mail_status: "SYSTEM — do not fill. The result of the last email (Sent, Bounced, Unsubscribed …).",
  mail_step: "SYSTEM — do not fill. Which email of the sequence went last (introduction, day 7, day 21).",
  mail_last_sent: "SYSTEM — do not fill. When the last email went.",
  contact_number: "NOT USED any more — the number goes in 'Phone number'. Kept so old rows keep their data.",
  disclose_upfront: "NOT USED any more — the assistant always says it is a virtual assistant.",
  Check: "NOT USED any more — the system checks every row itself; see 'Call progress' and 'What to do next'.",
};

/** Extra widths (pixels) for the columns people read most. */
const WIDTHS: Partial<Record<Column, number>> = {
  phone: 130, name: 170, organisation: 190, consent_note: 260, email: 220, context: 200,
  call_summary: 260, next_action: 240, call_progress: 300, mail_progress: 300, what_to_do: 380, do_not_contact: 120,
  contact_by_email: 120, contact_by_phone: 120, asked_for_call: 120, mail_date: 110, mail_time: 90, mail_time_zone: 140, call_date: 110, call_time: 90, call_time_zone: 140,
};

/** The switches whose value is yes or no. */
const YES_NO_SETTINGS = ["calling_enabled", "auto_dispatch", "allow_individuals"];

type OtherColumn = { header: string; note: string; width: number; fill: boolean; list?: string[]; kind?: "date" | "phone" };

/**
 * 🔑 The other tabs, headed and explained like the contact tabs (owner, 30 Oct
 * 2026). ⚠️ POSITIONAL: the code reads these tabs by column position
 * (parseLanguages, parseTeam, parseDnc, parseSettings) — a header here only
 * names the column, never moves it.
 */
const OTHER_TABS: Record<string, { columns: OtherColumn[] }> = {
  Settings: { columns: [
    { header: "Setting", note: "SYSTEM — do not change. The switch's name, as the system reads it.", width: 170, fill: false },
    { header: "Value", note: "OWNER fills. The switch's value — yes/no for the on/off switches, a number or a list for the others. Read every few minutes.", width: 140, fill: true },
    { header: "What it does", note: "What the switch does, in plain words.", width: 520, fill: false },
  ] },
  Languages: { columns: [
    { header: "Code", note: "OWNER fills. The short code the system uses, e.g. bn. Shown in the contact tabs' language list as 'bn — Bengali'.", width: 70, fill: true },
    { header: "Language", note: "OWNER fills. The language's name, shown in the contact tabs' language list.", width: 130, fill: true },
    { header: "Calls allowed?", note: "OWNER fills. Start = people may be called in this language. Not yet = nobody is called in it.", width: 120, fill: true, list: ["Start", "Not yet"] },
    { header: "Phase", note: "OWNER fills (optional). The rollout phase this language belongs to.", width: 190, fill: true },
    { header: "Native speaker check", note: "OWNER fills (optional). Whether a native speaker has checked the assistant in this language.", width: 150, fill: true },
    { header: "Reviewer", note: "OWNER fills (optional). Who checked it.", width: 130, fill: true },
    { header: "Review date", note: "OWNER fills (optional). When it was checked — double-click for a calendar.", width: 110, fill: true, kind: "date" },
    { header: "Notes", note: "OWNER fills (optional). Anything else about this language.", width: 260, fill: true },
  ] },
  Team: { columns: [
    { header: "Name", note: "TEAM fills. The team member's name, as written in the contact tabs' 'Team member in charge'.", width: 160, fill: true },
    { header: "Gender", note: "TEAM fills. Female or Male — the assistant refers to them correctly when it offers a meeting.", width: 100, fill: true, list: ["Female", "Male"] },
    { header: "Role", note: "TEAM fills (optional). Their role, e.g. Ambassador.", width: 200, fill: true },
  ] },
  "Do not call": { columns: [
    { header: "Phone number", note: "TEAM or SYSTEM fills. Never called again. The system adds a number here when someone says 'do not call'. With the country code, e.g. +91 98300 12345.", width: 160, fill: true, kind: "phone" },
    { header: "Name", note: "Who it is.", width: 180, fill: true },
    { header: "Reason", note: "Why they are on this list.", width: 260, fill: true },
    { header: "Date added", note: "When they were added — double-click for a calendar.", width: 110, fill: true, kind: "date" },
  ] },
};

type SheetMeta = {
  properties: { sheetId: number; title: string };
  bandedRanges?: { bandedRangeId: number }[];
  protectedRanges?: { protectedRangeId: number; description?: string }[];
  conditionalFormats?: { ranges: { startColumnIndex?: number; endColumnIndex?: number }[] }[];
};

function serviceAccountEmail(): string {
  const c = credentials();
  if (!c) throw new Error("Google access to the call sheet is not set up (GOOGLE_SA_JSON).");
  return c.email;
}

export async function protectAndFormat(): Promise<{ tabs: string[]; requests: number }> {
  const meta = (await google(`?fields=sheets(properties(sheetId,title),protectedRanges(protectedRangeId,description),conditionalFormats(ranges),bandedRanges(bandedRangeId))`)) as { sheets: SheetMeta[] };
  const byTitle = new Map(meta.sheets.map((s) => [s.properties.title, s]));
  const sa = serviceAccountEmail();
  const requests: unknown[] = [];
  // 🔑 Where each column REALLY is on each tab — never assumed from the order in code.
  const lay = await layouts(CONTACT_TABS);

  const dropOurs = (s: SheetMeta) => {
    for (const p of s.protectedRanges ?? []) {
      if ((p.description ?? "").startsWith(PROTECT_TAG)) requests.push({ deleteProtectedRange: { protectedRangeId: p.protectedRangeId } });
    }
  };
  const protect = (sheetId: number, what: string, unprotected: { startRowIndex: number; startColumnIndex: number; endColumnIndex: number }[]) => {
    requests.push({
      addProtectedRange: {
        protectedRange: {
          range: { sheetId },
          description: `${PROTECT_TAG} ${what}`,
          warningOnly: false,
          editors: { users: [sa] },
          unprotectedRanges: unprotected.map((u) => ({ sheetId, ...u })),
        },
      },
    });
  };

  const done: string[] = [];
  for (const tab of CONTACT_TABS) {
    const s = byTitle.get(tab);
    if (!s) continue;
    const id = s.properties.sheetId;
    const at = lay[tab];
    const missing = COLUMNS.filter((c) => at[c] < 0);
    if (missing.length) throw new Error(`The "${tab}" tab has no ${missing.join(", ")} column — nothing was locked.`);
    const idx = (c: Column) => at[c];
    const progressCols = [Math.min(idx("call_progress"), idx("mail_progress"), idx("what_to_do")), Math.max(idx("call_progress"), idx("mail_progress"), idx("what_to_do")) + 1];
    dropOurs(s);
    // Our own colour rules on the status columns, replaced each time (descending, so indexes stay valid).
    (s.conditionalFormats ?? [])
      .map((r, i) => ({ r, i }))
      // ⚠️ TOUCHING, not inside: a column move can split one of our rules across the moved columns.
      .filter(({ r }) => r.ranges.some((g) => g.startColumnIndex !== undefined && g.startColumnIndex < progressCols[1] && (g.endColumnIndex ?? Infinity) > progressCols[0]))
      .reverse()
      .forEach(({ i }) => requests.push({ deleteConditionalFormatRule: { sheetId: id, index: i } }));

    // ⚠️ Alternating row colours paint over cell fills, which hid white-for-you /
    // grey-for-the-system. Removed on the contact tabs so the two read apart.
    for (const b of s.bandedRanges ?? []) requests.push({ deleteBanding: { bandedRangeId: b.bandedRangeId } });

    // 🔒 Everything locked except the admin's columns, below the header.
    protect(id, `${tab}: only the white columns can be edited`, ADMIN_COLUMNS.map((c) => ({ startRowIndex: 1, startColumnIndex: idx(c), endColumnIndex: idx(c) + 1 })));

    requests.push({ updateSheetProperties: { properties: { sheetId: id, gridProperties: { frozenRowCount: 1, frozenColumnCount: idx("name") + 1 } }, fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount" } });
    // Header: teal where the admin types, slate where the system writes.
    COLUMNS.forEach((c) => {
      const i = idx(c);
      const mine = ADMIN_COLUMNS.includes(c);
      requests.push({
        repeatCell: {
          range: { sheetId: id, startRowIndex: 0, endRowIndex: 1, startColumnIndex: i, endColumnIndex: i + 1 },
          cell: { userEnteredFormat: { backgroundColor: mine ? TEAL : SLATE, textFormat: { bold: true, foregroundColor: WHITE, fontSize: 10 }, wrapStrategy: "WRAP", verticalAlignment: "MIDDLE" }, note: NOTES[c] ?? (mine ? "YOU FILL." : "SYSTEM: filled automatically — do not edit.") },
          fields: "userEnteredFormat(backgroundColor,textFormat,wrapStrategy,verticalAlignment),note",
        },
      });
      // Body: white for the admin, light grey for the system.
      requests.push({
        repeatCell: {
          range: { sheetId: id, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: i, endColumnIndex: i + 1 },
          cell: { userEnteredFormat: mine ? { backgroundColor: WHITE } : { backgroundColor: SYSTEM_FILL, textFormat: { foregroundColor: SYSTEM_TEXT } } },
          fields: mine ? "userEnteredFormat.backgroundColor" : "userEnteredFormat(backgroundColor,textFormat.foregroundColor)",
        },
      });
      const w = WIDTHS[c];
      if (w) requests.push({ updateDimensionProperties: { range: { sheetId: id, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 }, properties: { pixelSize: w }, fields: "pixelSize" } });
    });
    requests.push({ updateDimensionProperties: { range: { sheetId: id, dimension: "ROWS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 42 }, fields: "pixelSize" } });
    // Status columns wrap so the whole sentence is readable.
    requests.push({
      repeatCell: {
        range: { sheetId: id, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: progressCols[0], endColumnIndex: progressCols[1] },
        cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP" } },
        fields: "userEnteredFormat(wrapStrategy,verticalAlignment)",
      },
    });
    // ✅ green · ⏳ amber · ⛔ red · 🔴 strong red, on the two progress columns.
    const statusRange = { sheetId: id, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: idx("call_progress"), endColumnIndex: idx("mail_progress") + 1 };
    const rule = (prefix: string, bg: { red: number; green: number; blue: number }, bold = false) => ({
      addConditionalFormatRule: {
        index: 0,
        rule: { ranges: [statusRange], booleanRule: { condition: { type: "TEXT_STARTS_WITH", values: [{ userEnteredValue: prefix }] }, format: { backgroundColor: bg, textFormat: { bold } } } },
      },
    });
    requests.push(
      rule("✅", { red: 0.86, green: 0.95, blue: 0.88 }),
      rule("⏳", { red: 1, green: 0.95, blue: 0.8 }),
      rule("🟡", { red: 1, green: 0.98, blue: 0.85 }),
      rule("⛔", { red: 0.99, green: 0.88, blue: 0.88 }),
      rule("🔴", { red: 0.98, green: 0.73, blue: 0.73 }, true),
    );
    // Dropdown for the stop column; a soft check on the email column.
    requests.push({
      setDataValidation: {
        range: { sheetId: id, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: idx("do_not_contact"), endColumnIndex: idx("do_not_contact") + 1 },
        rule: { condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "yes" }] }, strict: false, showCustomUi: true, inputMessage: "Choose yes to stop all calls and emails to this person." },
      },
    });
    // 🔑 The admin's schedule (owner, 28 Oct 2026): yes/no, a real date, a 24-hour time, a zone.
    const col = (c: Column) => ({ sheetId: id, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: idx(c), endColumnIndex: idx(c) + 1 });
    for (const c of ["contact_by_email", "contact_by_phone", "asked_for_call"] as const) {
      requests.push({ setDataValidation: { range: col(c), rule: { condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "yes" }, { userEnteredValue: "no" }] }, strict: false, showCustomUi: true, inputMessage: "yes or no" } } });
    }
    for (const c of ["mail_date", "call_date"] as const) {
      requests.push({ setDataValidation: { range: col(c), rule: { condition: { type: "DATE_IS_VALID" }, strict: false, inputMessage: "A date, e.g. 2026-11-03" } } });
      requests.push({ repeatCell: { range: col(c), cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" } } }, fields: "userEnteredFormat.numberFormat" } });
    }
    for (const c of ["mail_time", "call_time"] as const) {
      requests.push({ repeatCell: { range: col(c), cell: { userEnteredFormat: { numberFormat: { type: "TIME", pattern: "hh:mm" } } }, fields: "userEnteredFormat.numberFormat" } });
    }
    for (const c of ["mail_time", "call_time"] as const) {
      requests.push({ setDataValidation: { range: col(c), rule: { condition: { type: "ONE_OF_LIST", values: HALF_HOURS.map((h) => ({ userEnteredValue: h })) }, strict: false, showCustomUi: true, inputMessage: "Choose a time, or type any other, e.g. 14:45 (24-hour)." } } });
    }
    // 🔑 Owner, 29 Oct 2026: country and time zone chosen from a list.
    requests.push({ setDataValidation: { range: col("country"), rule: { condition: { type: "ONE_OF_LIST", values: COUNTRIES.map((k) => ({ userEnteredValue: countryLabel(k) })) }, strict: false, showCustomUi: true, inputMessage: "Choose the country — its code is added to the phone. Or type the 2-letter code." } } });
    requests.push({ setDataValidation: { range: col("time_zone"), rule: { condition: { type: "ONE_OF_LIST", values: COMMON_ZONES.map((z) => ({ userEnteredValue: z })) }, strict: false, showCustomUi: true, inputMessage: "Filled for you from the Country. USA, Canada, Australia … choose one." } } });
    for (const c of ["mail_time_zone", "call_time_zone"] as const) {
      requests.push({ setDataValidation: { range: col(c), rule: { condition: { type: "ONE_OF_LIST", values: COMMON_ZONES.map((z) => ({ userEnteredValue: z })) }, strict: false, showCustomUi: true, inputMessage: "Only if different from the row's Time zone. Choose a zone, or type another, e.g. Europe/Paris." } } });
    }
    // 🔑 Owner, 30 Oct 2026: a real email address only — anything else is refused as typed.
    requests.push({ setDataValidation: { range: col("email"), rule: { condition: { type: "TEXT_IS_EMAIL" }, strict: true, inputMessage: "Their email address, e.g. name@organisation.org" } } });
    // 🔑 Owner, 30 Oct 2026: a phone takes digits, +, spaces, ( ) and - only. Kept as TEXT, so a leading 0 survives.
    const ph = `${letterFor(idx("phone"))}2`;
    requests.push({ setDataValidation: { range: col("phone"), rule: { condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: `=REGEXMATCH(TO_TEXT(${ph}),"^[0-9+() -]+$")` }] }, strict: true, inputMessage: "Digits, +, spaces, ( ) and - only, e.g. 98300 12345 or +44 20 7946 0000" } } });
    requests.push({ repeatCell: { range: col("phone"), cell: { userEnteredFormat: { numberFormat: { type: "TEXT" } } }, fields: "userEnteredFormat.numberFormat" } });
    // 🔑 Owner, 30 Oct 2026: the language by its NAME and code ("bn — Bengali"), live from the Languages tab via Lists.
    requests.push({ setDataValidation: { range: col("language"), rule: { condition: { type: "ONE_OF_RANGE", values: [{ userEnteredValue: `=${LISTS}!$D$2:$D$200` }] }, strict: false, showCustomUi: true, inputMessage: "Choose the language the assistant speaks on the call." } } });
    requests.push({ setDataValidation: { range: col("voice_gender"), rule: { condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "Female" }, { userEnteredValue: "Male" }] }, strict: false, showCustomUi: true, inputMessage: "Female (also when empty) or Male." } } });
    done.push(tab);
  }

  // The other tabs: the team adds to Team and Do not call; Languages, Settings, Start here and Lists are the owner's.
  // 🔑 Owner, 30 Oct 2026: "all google pages of that file should follow the same rules" ⇒ OTHER_TABS.
  const settingKeys = byTitle.has("Settings") ? ((await google(`/values/${encodeURIComponent(`${quote("Settings")}!A1:A50`)}`)) as { values?: string[][] }).values ?? [] : [];
  for (const [tab, open] of [["Team", [0, 3]], ["Do not call", [0, 4]], ["Languages", null], ["Settings", null], ["Start here", null], [LISTS_TAB, null]] as const) {
    const s = byTitle.get(tab);
    if (!s) continue;
    const id = s.properties.sheetId;
    dropOurs(s);
    protect(id, open ? `${tab}: header locked` : `${tab}: owner only`, open ? [{ startRowIndex: 1, startColumnIndex: open[0], endColumnIndex: open[1] }] : []);
    const spec = OTHER_TABS[tab];
    if (spec) {
      requests.push({ updateSheetProperties: { properties: { sheetId: id, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } });
      requests.push({ updateDimensionProperties: { range: { sheetId: id, dimension: "ROWS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 42 }, fields: "pixelSize" } });
      spec.columns.forEach((c, i) => {
        const range = (from: number) => ({ sheetId: id, startRowIndex: from, endRowIndex: from === 0 ? 1 : 1000, startColumnIndex: i, endColumnIndex: i + 1 });
        requests.push({
          repeatCell: {
            range: range(0),
            cell: { userEnteredValue: { stringValue: c.header }, userEnteredFormat: { backgroundColor: c.fill ? TEAL : SLATE, textFormat: { bold: true, foregroundColor: WHITE, fontSize: 10 }, wrapStrategy: "WRAP", verticalAlignment: "MIDDLE" }, note: c.note },
            fields: "userEnteredValue,userEnteredFormat(backgroundColor,textFormat,wrapStrategy,verticalAlignment),note",
          },
        });
        requests.push({ updateDimensionProperties: { range: { sheetId: id, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 }, properties: { pixelSize: c.width }, fields: "pixelSize" } });
        if (c.list) requests.push({ setDataValidation: { range: range(1), rule: { condition: { type: "ONE_OF_LIST", values: c.list.map((v) => ({ userEnteredValue: v })) }, strict: false, showCustomUi: true } } });
        if (c.kind === "date") {
          requests.push({ setDataValidation: { range: range(1), rule: { condition: { type: "DATE_IS_VALID" }, strict: false, inputMessage: "A date — double-click for a calendar." } } });
          requests.push({ repeatCell: { range: range(1), cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" } } }, fields: "userEnteredFormat.numberFormat" } });
        }
        if (c.kind === "phone") {
          requests.push({ setDataValidation: { range: range(1), rule: { condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: `=REGEXMATCH(TO_TEXT(${letterFor(i)}2),"^[0-9+() -]+$")` }] }, strict: true, inputMessage: "Digits, +, spaces, ( ) and - only." } } });
          requests.push({ repeatCell: { range: range(1), cell: { userEnteredFormat: { numberFormat: { type: "TEXT" } } }, fields: "userEnteredFormat.numberFormat" } });
        }
      });
    }
    // The on/off switches: a yes/no dropdown on their own value cells.
    if (tab === "Settings") {
      settingKeys.forEach((r, i) => {
        if (!YES_NO_SETTINGS.includes((r[0] ?? "").trim().toLowerCase())) return;
        requests.push({ setDataValidation: { range: { sheetId: id, startRowIndex: i, endRowIndex: i + 1, startColumnIndex: 1, endColumnIndex: 2 }, rule: { condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "yes" }, { userEnteredValue: "no" }] }, strict: true, showCustomUi: true } } });
      });
    }
    done.push(tab);
  }

  for (let i = 0; i < requests.length; i += 400) {
    await google(`:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: requests.slice(i, i + 400) }) });
  }
  return { tabs: done, requests: requests.length };
}

/** 🔴 After locking: prove the system can still write where it must. Rewrites the headers it owns. */
export async function verifySystemCanWrite(): Promise<void> {
  await ensureSystemColumns();
}

/** The "Start here" tab's words for the columns added on 24 Oct 2026 — written by the setup button. */
export async function updateGuide(): Promise<void> {
  const t = quote("Start here");
  const data = [
    { range: `${t}!B2`, values: [["Contacts for Imotara's calls and outreach email. You fill the white (teal-header) columns; the system fills the grey ones."]] },
    { range: `${t}!B5`, values: [["White (teal header), on the LEFT: you and your team fill these — from Phone number to Stop all contact?. Every header has a note: hover over it to see whether it is REQUIRED or OPTIONAL and why. These are the only columns you can edit."]] },
    { range: `${t}!B6`, values: [["Grey (slate header), on the RIGHT: the system fills these after each call and email — Call progress, Email progress, What to do next, then the call and email results. Locked. The last three are no longer used."]] },
    { range: `${t}!B23:B30`, values: [
      ["READING A ROW (Call progress, Email progress, What to do next — updated every 10 minutes)"],
      ["Call progress and Email progress: ✅ done · ⏳ in queue · 🟡 waiting for its day · ⛔ a problem · 🔴 SAFETY — call them yourself today."],
      ["What to do next: the fix for a problem on that row, in plain words. 'Nothing needed now' means nothing is needed."],
      ["COUNTRY: choose it from the list. The phone number gets the country code by itself, and the Time zone fills in (USA, Canada, Australia … have several zones: choose one). Organisation type may stay empty — the tab says it. LANGUAGE: choose it from the list."],
      ["EMAIL: Email address, yes in Send emails?, and the First email date + First email time. Day 7 and day 21 follow at the same time, in the row's Time zone (or Email time zone). Any hour, any day."],
      ["CALL: yes in Call them?, and the Call date + Call time, in the row's Time zone (or Call time zone). The call service rings 09:00–21:00 their time and holds other times till 09:00. No answer ⇒ retried automatically, up to 3 tries, within the retry hours. A new, later date calls again. INDIVIDUALS: called only with yes in They asked us to call? until TRAI DLT is done."],
      ["No date = nothing happens. No consent (How they agreed to be contacted) = no call and no email. TO STOP SOMEONE: yes in Stop all contact?. Unsubscribe, a bounce, 'not interested', 'do not call' or a meeting also stop everything."],
      ["Dates: double-click the cell for a calendar. Times: choose from the list, or type any time (24-hour). Phone numbers take digits, +, spaces, ( ) and - only; email addresses are checked as you type."],
    ] },
  ];
  await google(`/values:batchUpdate`, { method: "POST", body: JSON.stringify({ valueInputOption: "RAW", data }) });
  // The Settings tab explains each switch in column C — say what they mean now (owner, 28 Oct 2026).
  const st = (await google(`/values/${encodeURIComponent(`${quote("Settings")}!A1:C50`)}`)) as { values?: string[][] };
  const rows = st.values ?? [];
  const say: Record<string, string> = {
    auto_dispatch: "yes = every 5 minutes, retry unanswered calls (within retry_hours) and place callbacks people asked for. Calls at a date and time the admin set go out either way.",
    retry_hours: "The local hours a RETRY may ring in, e.g. 09-21. A time the admin sets is used as it is, any hour. 0-24 = any hour.",
  };
  if (!rows.some((r) => (r[0] ?? "").trim().toLowerCase() === "retry_hours")) {
    await google(`/values/${encodeURIComponent(`${quote("Settings")}!A:C`)}:append?valueInputOption=RAW`, { method: "POST", body: JSON.stringify({ values: [["retry_hours", "09-21", say.retry_hours]] }) });
  }
  const notes = rows.flatMap((r, i) => (say[(r[0] ?? "").trim().toLowerCase()] ? [{ range: `${quote("Settings")}!C${i + 1}`, values: [[say[(r[0] ?? "").trim().toLowerCase()]]] }] : []));
  if (notes.length) await google(`/values:batchUpdate`, { method: "POST", body: JSON.stringify({ valueInputOption: "RAW", data: notes }) });
}

/** One cell of one row, read fresh — for a last check just before a write. */
export async function readCell(c: Pick<Contact, "tab" | "row">, col: Column): Promise<string> {
  const at = (await layouts([c.tab]))[c.tab];
  const r = (await google(`/values/${encodeURIComponent(cellRef(c.tab, at, col, c.row))}`)) as { values?: string[][] };
  return String(r.values?.[0]?.[0] ?? "").trim();
}
