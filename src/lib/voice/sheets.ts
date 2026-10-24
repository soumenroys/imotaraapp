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
  ADMIN_COLUMNS, CONTACT_TABS, COLUMNS, LAST_COLUMN, columnLetter, parseContacts, staleStatusRows, parseDnc, parseLanguages, parseSettings, parseTeam,
  type Column, type Contact, type ContactTab, type Directory,
} from "@/lib/voice/rules";

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

const quote = (tab: string) => `'${tab.replace(/'/g, "''")}'`;

/** Every tab in one request. ⚠️ A missing Settings tab is normal ⇒ safe defaults. */
export async function readDirectory(): Promise<Directory> {
  const tabs = [...CONTACT_TABS, "Languages", "Team", "Do not call"];
  // ⚠️ Open-ended: a tab past row 1000 used to be invisible to calling, email and the status sync (review, 24 Oct).
  const ranges = tabs.map((t) => `ranges=${encodeURIComponent(`${quote(t)}!A1:${LAST_COLUMN}`)}`).join("&");
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
  const data = Object.entries(cells).map(([col, value]) => ({
    range: `${quote(c.tab)}!${columnLetter(col as Column)}${c.row}`,
    values: [[value ?? ""]],
  }));
  if (data.length === 0) return;
  await google(`/values:batchUpdate`, { method: "POST", body: JSON.stringify({ valueInputOption: "RAW", data }) });
}

export async function appendDnc(phone: string, name: string, reason: string): Promise<void> {
  await google(`/values/${encodeURIComponent(`${quote("Do not call")}!A:D`)}:append?valueInputOption=RAW`, {
    method: "POST",
    body: JSON.stringify({ values: [[phone, name, reason, new Date().toISOString().slice(0, 10)]] }),
  });
}

/**
 * Head the columns the system added (Y call_id, Z–AC outreach email), so the
 * team sees what lives there. Idempotent: it writes header text only.
 */
export async function ensureSystemColumns(): Promise<void> {
  const from = COLUMNS.indexOf("call_id");
  const headers = COLUMNS.slice(from);
  const data = CONTACT_TABS.map((t) => ({ range: `${quote(t)}!${columnLetter("call_id")}1:${LAST_COLUMN}1`, values: [[...headers]] }));
  await google(`/values:batchUpdate`, { method: "POST", body: JSON.stringify({ valueInputOption: "RAW", data }) });
}

/** The Settings keys the admin console may change, as the sheet spells them. */
export type SettingKey = "calling_enabled" | "auto_dispatch" | "max_concurrency" | "daily_cap" | "allow_individuals";

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
  const row = COLUMNS.map((c) => cells[c] ?? "");
  const res = (await google(`/values/${encodeURIComponent(`${quote(tab)}!A:${LAST_COLUMN}`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ values: [row] }),
  })) as { updates?: { updatedRange?: string } };
  const m = /!A(\d+)/.exec(res.updates?.updatedRange ?? "");
  if (!m) throw new Error("Google did not say which row it added.");
  return Number(m[1]);
}

/** Many cells across many rows in ONE request — for the status columns, rewritten every few minutes. */
export async function writeMany(updates: { c: Pick<Contact, "tab" | "row">; cells: Partial<Record<Column, string>> }[]): Promise<number> {
  const data = updates.flatMap(({ c, cells }) =>
    Object.entries(cells).map(([col, value]) => ({ range: `${quote(c.tab)}!${columnLetter(col as Column)}${c.row}`, values: [[value ?? ""]] })),
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

/** What each column means, shown as the header cell's note. */
const NOTES: Partial<Record<Column, string>> = {
  phone: "YOU FILL: phone with country code, digits only, e.g. 919830012345.",
  name: "YOU FILL: the person's name.",
  organisation: "YOU FILL: organisation name (leave blank for an individual).",
  organisation_type: "YOU FILL: e.g. NGO, school, college, company, old age home.",
  country: "YOU FILL: 2-letter country code, e.g. IN.",
  time_zone: "YOU FILL: e.g. Asia/Kolkata. Calls and emails happen 10:00–18:00 in this zone.",
  language: "YOU FILL: the language to call in (bn, hi, en …).",
  source: "YOU FILL: where we met them.",
  consent_note: "YOU FILL — REQUIRED: how they agreed to be contacted. No consent note = no call and no email.",
  team_member: "YOU FILL: the ambassador who owns this contact.",
  context: "YOU FILL (optional): how they know us.",
  call_reason: "YOU FILL (optional): why we are calling.",
  ambassador_notes: "YOU FILL (optional): your own notes.",
  voice_gender: "YOU FILL (optional): male, or leave empty for a female voice.",
  email: "YOU FILL (optional): their email — they then get the outreach emails (intro, day 7, day 21).",
  do_not_contact: "YOU FILL: type yes to stop ALL calls and emails to this person.",
  call_progress: "SYSTEM: where calling stands — ✅ done · ⏳ in queue · 🟡 waiting · ⛔ problem · 🔴 safety.",
  mail_progress: "SYSTEM: where email stands — ✅ done · ⏳ in queue · 🟡 waiting · ⛔ problem.",
  what_to_do: "SYSTEM: what to do about a problem on this row. Empty or 'Nothing' means nothing is needed.",
};

/** Extra widths (pixels) for the columns people read most. */
const WIDTHS: Partial<Record<Column, number>> = {
  phone: 130, name: 170, organisation: 190, consent_note: 260, email: 220, context: 200,
  call_summary: 260, next_action: 240, call_progress: 300, mail_progress: 300, what_to_do: 380, do_not_contact: 120,
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
  const idx = (c: Column) => COLUMNS.indexOf(c);
  const progressCols = [idx("call_progress"), idx("what_to_do") + 1];

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
    dropOurs(s);
    // Our own colour rules on the status columns, replaced each time (descending, so indexes stay valid).
    (s.conditionalFormats ?? [])
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.ranges.some((g) => (g.startColumnIndex ?? 0) >= progressCols[0] && (g.endColumnIndex ?? 0) <= progressCols[1]))
      .reverse()
      .forEach(({ i }) => requests.push({ deleteConditionalFormatRule: { sheetId: id, index: i } }));

    // ⚠️ Alternating row colours paint over cell fills, which hid white-for-you /
    // grey-for-the-system. Removed on the contact tabs so the two read apart.
    for (const b of s.bandedRanges ?? []) requests.push({ deleteBanding: { bandedRangeId: b.bandedRangeId } });

    // 🔒 Everything locked except the admin's columns, below the header.
    protect(id, `${tab}: only the white columns can be edited`, ADMIN_COLUMNS.map((c) => ({ startRowIndex: 1, startColumnIndex: idx(c), endColumnIndex: idx(c) + 1 })));

    requests.push({ updateSheetProperties: { properties: { sheetId: id, gridProperties: { frozenRowCount: 1, frozenColumnCount: idx("name") + 1 } }, fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount" } });
    // Header: teal where the admin types, slate where the system writes.
    COLUMNS.forEach((c, i) => {
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
    { range: `${t}!B5`, values: [["White (teal header): you and your team fill these — phone, name, organisation, type, country, time zone, language, source, consent note, team member, context, call reason, ambassador notes, voice_gender, email, do_not_contact. These are the only columns you can edit."]] },
    { range: `${t}!B6`, values: [["Grey (slate header): the system fills these after each call and email — status, attempts, outcome, summary, next action, mail status, and the three status columns. Locked."]] },
    { range: `${t}!B23:B29`, values: [
      ["READING A ROW (columns AE–AG, updated every 10 minutes)"],
      ["call_progress and mail_progress: ✅ done · ⏳ in queue · 🟡 waiting for its day · ⛔ a problem · 🔴 SAFETY — call them yourself today."],
      ["what_to_do: the fix for a problem on that row, in plain words. 'Nothing' means nothing is needed."],
      ["EMAIL: type their email in column Z (with a consent note). They get an introduction, a follow-up on day 7 and a last note on day 21 — once the emails are approved in Outreach mail."],
      ["TO STOP SOMEONE: choose yes in do_not_contact (column AD). No more calls or emails to them."],
      ["Unsubscribe, a bounce, 'not interested', 'do not call' or a booked meeting also stop everything automatically."],
      [""],
    ] },
  ];
  await google(`/values:batchUpdate`, { method: "POST", body: JSON.stringify({ valueInputOption: "RAW", data }) });
}

/** One cell of one row, read fresh — for a last check just before a write. */
export async function readCell(c: Pick<Contact, "tab" | "row">, col: Column): Promise<string> {
  const r = (await google(`/values/${encodeURIComponent(`${quote(c.tab)}!${columnLetter(col)}${c.row}`)}`)) as { values?: string[][] };
  return String(r.values?.[0]?.[0] ?? "").trim();
}
