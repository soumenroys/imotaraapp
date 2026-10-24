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
  CONTACT_TABS, COLUMNS, columnLetter, parseContacts, parseDnc, parseLanguages, parseSettings, parseTeam,
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
  const ranges = tabs.map((t) => `ranges=${encodeURIComponent(`${quote(t)}!A1:Y1000`)}`).join("&");
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

/** Make sure column Y is headed, so the team sees what the system writes there. */
export async function ensureSystemColumn(): Promise<void> {
  const data = CONTACT_TABS.map((t) => ({ range: `${quote(t)}!Y1`, values: [[COLUMNS[COLUMNS.length - 1]]] }));
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
  const res = (await google(`/values/${encodeURIComponent(`${quote(tab)}!A:Y`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ values: [row] }),
  })) as { updates?: { updatedRange?: string } };
  const m = /!A(\d+)/.exec(res.updates?.updatedRange ?? "");
  if (!m) throw new Error("Google did not say which row it added.");
  return Number(m[1]);
}
