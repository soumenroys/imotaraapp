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
  ADMIN_COLUMNS, CONTACT_TABS, COLUMNS, columnMoves, layoutOf, letterFor, parseContacts, staleStatusRows, parseDnc, parseLanguages, parseSettings, parseTeam,
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
 * Every column the system knows gets its header: rewritten where it already is
 * (so "Call Date" reads call_date), added after the last header where it is
 * missing. Idempotent: header text only — no data cell is touched.
 */
export async function ensureSystemColumns(): Promise<void> {
  const ranges = CONTACT_TABS.map((t) => `ranges=${encodeURIComponent(headerRow(t))}`).join("&");
  const got = (await google(`/values:batchGet?${ranges}`)) as { valueRanges?: { values?: string[][] }[] };
  const data = CONTACT_TABS.flatMap((t, i) => {
    const header = got.valueRanges?.[i]?.values?.[0] ?? [];
    const at = layoutOf(header);
    let next = header.length;
    return COLUMNS.map((c) => ({ range: `${quote(t)}!${letterFor(at[c] >= 0 ? at[c] : next++)}1`, values: [[c]] }));
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
 * Add one contact to a tab and return its row. Columns follow COLUMNS; the
 * sheet's own "Check" formula column is left empty (the system recomputes it).
 */
export async function appendContact(tab: ContactTab, cells: Partial<Record<Column, string>>): Promise<number> {
  const at = (await layouts([tab]))[tab];
  const row: string[] = new Array(Math.max(...COLUMNS.map((c) => at[c])) + 1).fill("");
  for (const [col, value] of Object.entries(cells)) {
    cellRef(tab, at, col as Column, 1); // ⚠️ throws on a column the tab lacks
    row[at[col as Column]] = value ?? "";
  }
  const res = (await google(`/values/${encodeURIComponent(`${quote(tab)}!A:${letterFor(row.length - 1)}`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ values: [row] }),
  })) as { updates?: { updatedRange?: string } };
  const m = /!A(\d+)/.exec(res.updates?.updatedRange ?? "");
  if (!m) throw new Error("Google did not say which row it added.");
  return Number(m[1]);
}

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

/** What each column means, shown as the header cell's note. */
const NOTES: Partial<Record<Column, string>> = {
  phone: "YOU FILL: the phone number. Choose the country and the country code is added for you (98300 12345 with India = +91 98300 12345). A number starting with + is used as typed.",
  name: "YOU FILL: the person's name.",
  organisation: "YOU FILL: organisation name (leave blank for an individual).",
  organisation_type: "YOU FILL (optional): e.g. school, college, hospice. Empty = the tab says it (NGOs → NGO, Eldercare → old age home, Education → educational institution, Corporates → company).",
  country: "YOU FILL: choose from the list (or type the 2-letter code, e.g. IN). It adds the country code to the phone and, where the country has one time zone, sets the time zone.",
  time_zone: "YOU FILL (optional where the country has one zone): choose from the list. Empty = the country's zone. ⚠️ USA, Canada, Mexico, Brazil, Australia, Russia and Indonesia have several — choose one. Used when mail_time_zone / call_time_zone are empty.",
  language: "YOU FILL: the language to call in (bn, hi, en …).",
  source: "YOU FILL: where we met them.",
  consent_note: "YOU FILL — REQUIRED: how they agreed to be contacted. No consent note = no call and no email.",
  team_member: "YOU FILL: the ambassador who owns this contact.",
  context: "YOU FILL (optional): what the voice assistant may mention on the call, e.g. 'runs a student helpline'. ⛔ Not consent — that goes in consent_note, which is never said or sent.",
  call_reason: "YOU FILL (optional): why we are calling.",
  ambassador_notes: "YOU FILL (optional): your own notes.",
  voice_gender: "YOU FILL (optional): male, or leave empty for a female voice.",
  email: "YOU FILL (optional): their email. Emailed only when contact_by_email is yes.",
  contact_by_email: "YOU FILL: yes to email this person (intro at mail_date + mail_time, then day 7 and day 21 at the same time). Empty or no = never emailed.",
  contact_by_phone: "YOU FILL: yes to call this person at call_date + call_time. Empty or no = never called.",
  mail_date: "YOU FILL: the day of the FIRST email — double-click for a calendar, or type 2026-11-03. Follow-ups go 7 and 21 days later.",
  mail_time: "YOU FILL: the time of the first email — choose from the list, or type any time, e.g. 14:45. 24-hour. Any hour.",
  mail_time_zone: "YOU FILL (optional): e.g. Asia/Kolkata or IST. Empty = the time_zone column.",
  call_date: "YOU FILL: the day to call — double-click for a calendar, or type 2026-11-03. A new, later date calls again.",
  call_time: "YOU FILL: the time to call — choose from the list, or type any time, e.g. 11:15. 24-hour. ⚠️ The call service rings only 09:00–21:00 their time; a time outside is held until 09:00. Unanswered calls are retried automatically (up to 3 tries, within the retry hours).",
  call_time_zone: "YOU FILL (optional): e.g. Asia/Kolkata or IST. Empty = the time_zone column.",
  asked_for_call: "YOU FILL: yes ONLY if the person themselves asked us to call (website, 'call me' to the team). Write when and how in consent_note. Until TRAI DLT is done, individuals are called only with yes here.",
  do_not_contact: "YOU FILL: type yes to stop ALL calls and emails to this person.",
  call_progress: "SYSTEM: where calling stands — ✅ done · ⏳ in queue · 🟡 waiting · ⛔ problem · 🔴 safety.",
  mail_progress: "SYSTEM: where email stands — ✅ done · ⏳ in queue · 🟡 waiting · ⛔ problem.",
  what_to_do: "SYSTEM: what to do about a problem on this row. Empty or 'Nothing' means nothing is needed.",
  contact_number: "RETIRED: no longer used — the number goes in phone. Read only when phone is empty.",
  disclose_upfront: "RETIRED: the assistant always says it is a virtual assistant.",
  Check: "RETIRED: the system checks every row itself — see call_progress and what_to_do.",
};

/** Extra widths (pixels) for the columns people read most. */
const WIDTHS: Partial<Record<Column, number>> = {
  phone: 130, name: 170, organisation: 190, consent_note: 260, email: 220, context: 200,
  call_summary: 260, next_action: 240, call_progress: 300, mail_progress: 300, what_to_do: 380, do_not_contact: 120,
  contact_by_email: 120, contact_by_phone: 120, asked_for_call: 120, mail_date: 110, mail_time: 90, mail_time_zone: 140, call_date: 110, call_time: 90, call_time_zone: 140,
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
    requests.push({ setDataValidation: { range: col("time_zone"), rule: { condition: { type: "ONE_OF_LIST", values: COMMON_ZONES.map((z) => ({ userEnteredValue: z })) }, strict: false, showCustomUi: true, inputMessage: "Empty = the country's zone (one-zone countries). USA, Canada, Australia … choose one." } } });
    for (const c of ["mail_time_zone", "call_time_zone"] as const) {
      requests.push({ setDataValidation: { range: col(c), rule: { condition: { type: "ONE_OF_LIST", values: COMMON_ZONES.map((z) => ({ userEnteredValue: z })) }, strict: false, showCustomUi: true, inputMessage: "Choose a zone, or type another, e.g. Europe/Paris. Empty = the time_zone column." } } });
    }
    requests.push({
      setDataValidation: {
        range: { sheetId: id, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: idx("email"), endColumnIndex: idx("email") + 1 },
        rule: { condition: { type: "TEXT_IS_EMAIL" }, strict: false, inputMessage: "Their email address, e.g. name@organisation.org" },
      },
    });
    done.push(tab);
  }

  // The other tabs: the team adds to Team and Do not call; Languages, Settings and Start here are the owner's.
  for (const [tab, open] of [["Team", [0, 2]], ["Do not call", [0, 4]], ["Languages", null], ["Settings", null], ["Start here", null]] as const) {
    const s = byTitle.get(tab);
    if (!s) continue;
    dropOurs(s);
    protect(s.properties.sheetId, open ? `${tab}: header locked` : `${tab}: owner only`, open ? [{ startRowIndex: 1, startColumnIndex: open[0], endColumnIndex: open[1] }] : []);
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
    { range: `${t}!B5`, values: [["White (teal header), on the LEFT: you and your team fill these — phone, name, organisation, country, time zone, language, consent note, source, email, the schedule (contact_by_email, contact_by_phone, mail_date/time/zone, call_date/time/zone), asked_for_call, and the optional ones after. These are the only columns you can edit."]] },
    { range: `${t}!B6`, values: [["Grey (slate header), on the RIGHT: the system fills these after each call and email — call_progress, mail_progress, what_to_do, then status, attempts, outcome, summary, mail status. Locked. The last three (contact_number, disclose_upfront, Check) are retired."]] },
    { range: `${t}!B23:B30`, values: [
      ["READING A ROW (call_progress, mail_progress, what_to_do — updated every 10 minutes)"],
      ["call_progress and mail_progress: ✅ done · ⏳ in queue · 🟡 waiting for its day · ⛔ a problem · 🔴 SAFETY — call them yourself today."],
      ["what_to_do: the fix for a problem on that row, in plain words. 'Nothing' means nothing is needed."],
      ["COUNTRY: choose it from the list. The phone gets the country code by itself, and where the country has one time zone, time_zone may stay empty. organisation_type may stay empty too — the tab says it."],
      ["EMAIL: email, yes in contact_by_email, and the first email's date + time in mail_date / mail_time (zone in mail_time_zone, or time_zone). Day 7 and day 21 follow at the same time. Any hour, any day."],
      ["CALL: yes in contact_by_phone, and the date + time in call_date / call_time (zone in call_time_zone, or time_zone). The call service rings 09:00–21:00 their time and holds other times till 09:00. No answer ⇒ retried automatically, up to 3 tries, within the retry hours. A new, later date calls again. INDIVIDUALS: called only with yes in asked_for_call until TRAI DLT is done."],
      ["No date = nothing happens. No consent note = no call and no email. TO STOP SOMEONE: yes in do_not_contact. Unsubscribe, a bounce, 'not interested', 'do not call' or a meeting also stop everything."],
      ["Dates: double-click the cell for a calendar. Times: choose from the list, or type any time (24-hour)."],
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
