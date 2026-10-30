// src/__tests__/voice/sheetV2.test.ts
// 🔑 Sheet v2 (owner, 29 Oct 2026): columns found by HEADER NAME, moved into
// admin-left / system-right order, country → dial code + time zone, and an
// organisation_type the tab already says.
//
// ⚠️ The move is simulated exactly as Sheets' moveDimension does it — the whole
// column, data and all — and the rows must read the same afterwards.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COLUMNS, LEGACY_COLUMNS, columnMoves, layoutOf, parseContacts, phoneOf, staleStatusRows, userData, type Column } from "@/lib/voice/rules";
import { COUNTRIES, countryCode, countryLabel, countryOf, countryZone, normalisePhoneFor } from "@/lib/voice/countries";

/** A sheet in a given column order, with rows given by column name. */
function sheet(order: readonly string[], rows: Partial<Record<Column, string>>[]): string[][] {
  return [[...order], ...rows.map((r) => order.map((h) => (r as Record<string, string>)[h] ?? ""))];
}

/** moveDimension, one column at a time: the column and every cell in it. */
function applyMoves(grid: string[][], moves: { from: number; to: number }[]): string[][] {
  const g = grid.map((r) => [...r]);
  for (const { from, to } of moves) for (const r of g) r.splice(to, 0, ...r.splice(from, 1));
  return g;
}

const ROW: Partial<Record<Column, string>> = {
  phone: "98300 12345", contact_number: "", name: "Asha Roy", organisation: "Sunrise Home", country: "IN — India (+91)",
  language: "bn", consent_note: "Met at the Kolkata fair, 12 Oct", email: "asha@example.org",
  contact_by_phone: "yes", call_date: "2026-11-03", call_time: "11:00", status: "Pending", call_id: "abc-123",
  mail_status: "Sent", what_to_do: "Nothing",
};

describe("🔑 columns are found by their header name", () => {
  it("the old order and the new order read the SAME row", () => {
    const [a] = parseContacts("Eldercare", sheet(LEGACY_COLUMNS, [ROW]));
    const [b] = parseContacts("Eldercare", sheet(COLUMNS, [ROW]));
    expect(a.v).toEqual(b.v);
    expect(a.v.name).toBe("Asha Roy");
    expect(a.v.call_id).toBe("abc-123");
  });

  it("a shuffled sheet — with a column the system does not know — still reads right", () => {
    const shuffled = ["notes by Tapan", ...[...COLUMNS].reverse()];
    const [c] = parseContacts("NGOs", sheet(shuffled, [ROW]));
    expect(c.v.email).toBe("asha@example.org");
    expect(c.v.call_time).toBe("11:00");
    expect(c.v.status).toBe("Pending");
  });

  it("'Call Date' and ' call_date ' both name call_date", () => {
    const at = layoutOf(["Phone", "Call Date", " call_date "]);
    expect(at.phone).toBe(0);
    expect(at.call_date).toBe(1);
    expect(at.status).toBe(-1);
  });

  it("a missing column reads as empty, never as its neighbour", () => {
    const order = COLUMNS.filter((c) => c !== "email");
    const [c] = parseContacts("NGOs", sheet(order, [ROW]));
    expect(c.v.email).toBe("");
    expect(c.v.contact_by_email).toBe("");
  });

  it("a tab with no header names at all falls back to the old fixed order", () => {
    const rows = sheet(LEGACY_COLUMNS, [ROW]);
    rows[0] = rows[0].map(() => "");
    rows.push(rows[1]); // a second data row, so the empty header is clearly not data
    const [c] = parseContacts("NGOs", rows);
    expect(c.v.name).toBe("Asha Roy");
  });

  it("stale-status rows are found by name too", () => {
    const empty: Partial<Record<Column, string>> = { call_progress: "⛔ Not callable" };
    expect(staleStatusRows("NGOs", sheet([...COLUMNS].reverse(), [ROW, empty]))).toEqual([{ tab: "NGOs", row: 3 }]);
  });
});

describe("🔑 Sheet setup moves the columns into order — data and all", () => {
  it("the old order becomes the new one, and every row reads the same after", () => {
    const before = sheet(LEGACY_COLUMNS, [ROW, { ...ROW, name: "Bina", phone: "+44 20 7946 0000", country: "GB" }]);
    const moves = columnMoves(before[0]);
    expect(moves.length).toBeGreaterThan(0);
    const after = applyMoves(before, moves);
    expect(after[0]).toEqual([...COLUMNS]);
    expect(parseContacts("Eldercare", after)).toEqual(parseContacts("Eldercare", before));
  });

  it("every move goes LEFT, so Sheets' destinationIndex means what the plan means", () => {
    for (const m of columnMoves([...COLUMNS].reverse())) expect(m.to).toBeLessThan(m.from);
  });

  it("pressing it again moves nothing", () => {
    expect(columnMoves(COLUMNS)).toEqual([]);
  });

  it("a column the team added stays, after ours", () => {
    const after = applyMoves(sheet(["my notes", ...LEGACY_COLUMNS], []), columnMoves(["my notes", ...LEGACY_COLUMNS]));
    expect(after[0].slice(0, COLUMNS.length)).toEqual([...COLUMNS]);
    expect(after[0][COLUMNS.length]).toBe("my notes");
  });

  it("the admin fills the left: phone first, then name; the system's columns after every admin column", () => {
    expect(COLUMNS.slice(0, 2)).toEqual(["phone", "name"]);
    expect(COLUMNS.indexOf("call_progress")).toBeGreaterThan(COLUMNS.indexOf("do_not_contact"));
    expect(COLUMNS.slice(-3)).toEqual(["contact_number", "disclose_upfront", "Check"]);
  });

  it("no column was lost or doubled in the reorder", () => {
    expect([...COLUMNS].sort()).toEqual([...LEGACY_COLUMNS].sort());
  });
});

describe("🔑 country → dial code (owner: 'country code appended as a prefix')", () => {
  it.each([
    ["98300 12345", "IN", "+919830012345"],
    ["098300 12345", "IN", "+919830012345"],
    ["919830012345", "IN", "+919830012345"],
    ["9198300123", "IN", "+919198300123"], // a 10-digit Indian mobile that happens to start 91
    ["020 7946 0000", "GB — United Kingdom (+44)", "+442079460000"],
    ["+44 20 7946 0000", "IN", "+442079460000"], // + means international, whatever the country says
    ["0044 20 7946 0000", "IN", "+442079460000"],
    ["415 555 0123", "US", "+14155550123"],
    ["1 415 555 0123", "US", "+14155550123"],
    ["06 1234 5678", "IT", "+390612345678"], // Italy keeps its 0
    ["919830012345", "", "+919830012345"], // no country: as typed, the old behaviour
  ])("%s with %s → %s", (raw, country, want) => expect(normalisePhoneFor(raw, country)).toBe(want));

  it("an empty phone stays empty", () => expect(normalisePhoneFor("", "IN")).toBe(""));

  it("the row's number is phone; contact_number only when phone is empty", () => {
    const [c] = parseContacts("NGOs", sheet(COLUMNS, [{ ...ROW, contact_number: "+447700900000" }]));
    expect(phoneOf(c)).toBe("+919830012345");
    const [d] = parseContacts("NGOs", sheet(COLUMNS, [{ ...ROW, phone: "", contact_number: "+447700900000" }]));
    expect(phoneOf(d)).toBe("+447700900000");
  });

  it("the dropdown label reads back as its code, and every code is unique", () => {
    for (const k of COUNTRIES) expect(countryCode(countryLabel(k))).toBe(k.code);
    expect(new Set(COUNTRIES.map((k) => k.code)).size).toBe(COUNTRIES.length);
    expect(countryOf("in")?.name).toBe("India");
    expect(countryOf("India")).toBeNull(); // a name, not a code — not guessed
  });

  it("every country's zone is a real zone", () => {
    for (const k of COUNTRIES) if (k.zone) expect(() => new Intl.DateTimeFormat("en", { timeZone: k.zone! })).not.toThrow();
  });
});

describe("🔑 an empty time_zone takes the country's — only where it has one", () => {
  it("India → Asia/Kolkata, filled in when the row is read", () => {
    const [c] = parseContacts("NGOs", sheet(COLUMNS, [ROW]));
    expect(c.v.country).toBe("IN");
    expect(c.v.time_zone).toBe("Asia/Kolkata");
  });
  it("a zone the admin chose wins", () => {
    const [c] = parseContacts("NGOs", sheet(COLUMNS, [{ ...ROW, time_zone: "Asia/Dubai" }]));
    expect(c.v.time_zone).toBe("Asia/Dubai");
  });
  it.each(["US", "CA", "AU", "RU", "BR", "ID", "MX"])("⛔ %s spans several zones — never guessed", (k) => {
    expect(countryZone(k)).toBeNull();
    const [c] = parseContacts("NGOs", sheet(COLUMNS, [{ ...ROW, country: k }]));
    expect(c.v.time_zone).toBe("");
  });
});

describe("🔑 organisation_type is optional — the tab says it", () => {
  const d = { team: new Map<string, string>() };
  const now = new Date("2026-10-30T06:00:00Z");
  it.each([
    ["NGOs", "NGO"], ["Eldercare", "old age home"], ["Education", "educational institution"],
    ["Corporates", "company"], ["Individuals", "individual"],
  ] as const)("%s → %s", (tab, want) => {
    const [c] = parseContacts(tab, sheet(COLUMNS, [ROW]));
    expect(userData(c, d, now).organisation_type).toBe(want);
  });
  it("what the admin typed wins", () => {
    const [c] = parseContacts("Education", sheet(COLUMNS, [{ ...ROW, organisation_type: "college" }]));
    expect(userData(c, d, now).organisation_type).toBe("college");
  });
});

describe("⛔ no fix text names a column by LETTER — the letters move", () => {
  it.each(["src/lib/outreach/progress.ts", "src/lib/admin/todoSources.ts"])("%s", (f) => {
    expect(readFileSync(join(process.cwd(), f), "utf8")).not.toMatch(/column [A-Z]{1,2}\b/);
  });
  it("the Start here guide neither", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/voice/sheets.ts"), "utf8");
    const guide = src.slice(src.indexOf("export async function updateGuide"), src.indexOf("export async function readCell"));
    expect(guide).not.toMatch(/\((?:[A-Z]{1,2})(?:–[A-Z]{1,2})?\)|column [A-Z]{1,2}\b(?! —)/);
  });
});

// ── Sheet v3 (owner, 30 Oct 2026): friendly headers, notes, language names, live time zone ──

import { generateKeyPairSync } from "node:crypto";
import { vi, beforeAll, afterAll } from "vitest";
import { HEADERS, label } from "@/lib/voice/rules";
import { languageCode } from "@/lib/voice/countries";
import { NOTES, appendContact, fillZoneDefaults, zoneFormula } from "@/lib/voice/sheets";

describe("🔑 friendly headers — and the code still finds every column", () => {
  const friendly = COLUMNS.map((c) => label(c));
  it("a sheet headed in plain words reads the same as one headed with field names", () => {
    const [a] = parseContacts("NGOs", sheet(COLUMNS, [ROW]));
    const rows = sheet(COLUMNS, [ROW]);
    rows[0] = friendly;
    const [b] = parseContacts("NGOs", rows);
    expect(b.v).toEqual(a.v);
  });
  it("the old field-name order still moves into place under friendly names", () => {
    const before = sheet(LEGACY_COLUMNS, [ROW]);
    const after = applyMoves(before, columnMoves(before[0]));
    expect(after[0]).toEqual([...COLUMNS]);
    const mixed = [...friendly].reverse();
    expect(applyMoves([mixed], columnMoves(mixed))[0]).toEqual(friendly);
  });
  it("no two columns share a header, and no header is another column's field name", () => {
    const key = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, "_");
    const owner = new Map<string, string>();
    for (const c of COLUMNS) for (const k of new Set([c, ...HEADERS[c]].map(key))) {
      expect(owner.get(k) ?? c).toBe(c);
      owner.set(k, c);
    }
  });
  it("⛔ no header looks like a database field", () => {
    for (const c of COLUMNS) expect(label(c)).not.toMatch(/_/);
  });
  it("every column's note says who fills it", () => {
    for (const c of COLUMNS) expect(NOTES[c]).toMatch(/^(REQUIRED|OPTIONAL|SYSTEM — do not fill|Fill ONLY|NOT USED)/);
  });
  it("optional columns say so in the header too", () => {
    for (const c of COLUMNS) if (NOTES[c].startsWith("OPTIONAL")) expect(label(c)).toMatch(/\(optional\)/);
  });
});

describe("🔑 the language is chosen by name, read as its code", () => {
  it.each([["bn — Bengali", "bn"], ["hi — Hindi", "hi"], ["en", "en"], ["EN", "en"], ["Bengali", "bengali"], ["", ""]])("%s → %s", (raw, want) =>
    expect(languageCode(raw)).toBe(want));
  it("a row with the dropdown's language is callable in that language", () => {
    const [c] = parseContacts("NGOs", sheet(COLUMNS, [{ ...ROW, language: "bn — Bengali" }]));
    expect(c.v.language).toBe("bn");
  });
});

describe("🔑 the time zone fills itself from the country — a formula, per row", () => {
  it("looks the row's own country up in Lists, and is empty when it cannot", () => {
    const f = zoneFormula("D", 7);
    expect(f).toContain("LEFT(TRIM(D7),2)");
    expect(f).toContain("'Lists'!$A:$C,3");
    expect(f).toMatch(/^=IFERROR\(.*,""\)$/);
  });
});

// ── Against a stand-in Google: what is actually WRITTEN ──
describe("🔴 writes that touch live rows", () => {
  type Body = { valueInputOption?: string; data: { range: string; values: string[][] }[] };
  const calls: { url: string; body: Body }[] = [];
  let grid: Record<string, string[][]> = {};
  let formulas: string[][] = [];
  beforeAll(() => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
    process.env.GOOGLE_SA_JSON = JSON.stringify({ client_email: "sa@test", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) });
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({ url: decodeURIComponent(url), body });
      const ok = (o: unknown) => new Response(JSON.stringify(o), { status: 200 });
      if (url.includes("oauth2")) return ok({ access_token: "t", expires_in: 3600 });
      if (url.includes("fields=sheets(properties(title,gridProperties")) return ok({ sheets: CONTACT_TABS_LIST.map((title) => ({ properties: { title, gridProperties: { rowCount: 12 } } })) });
      if (url.includes("fields=sheets(properties(sheetId,title))")) return ok({ sheets: CONTACT_TABS_LIST.map((title, i) => ({ properties: { title, sheetId: i } })) });
      if (url.includes("values:batchGet")) {
        const ranges = new URL(url).searchParams.getAll("ranges");
        return ok({ valueRanges: ranges.map((r) => ({ values: [grid[r.split("!")[0].replace(/'/g, "")]?.[0] ?? []] })) });
      }
      if (url.includes("valueRenderOption=FORMULA")) return ok({ values: formulas });
      if (/values\/[^:]+$/.test(decodeURIComponent(url).split("?")[0]) && !init?.method) {
        const tab = decodeURIComponent(url).split("/values/")[1].replace(/'/g, "").split("!")[0];
        return ok({ values: grid[tab] ?? [] });
      }
      return ok({});
    });
  });
  afterAll(() => { vi.unstubAllGlobals(); delete process.env.GOOGLE_SA_JSON; });
  const CONTACT_TABS_LIST = ["Individuals", "NGOs", "Education", "Eldercare", "Corporates"];

  it("only EMPTY time-zone cells get the formula — a zone the admin chose is never overwritten", async () => {
    grid = Object.fromEntries(CONTACT_TABS_LIST.map((t) => [t, [COLUMNS.map((c) => label(c))]]));
    // rows 2..12: row 3 has a chosen zone, row 5 already has the formula
    formulas = [[""], ["Asia/Dubai"], [""], [zoneFormula("D", 5)]];
    calls.length = 0;
    await fillZoneDefaults();
    const write = calls.find((c) => c.url.includes("values:batchUpdate"))!;
    expect(write.body.valueInputOption).toBe("USER_ENTERED");
    const eldercare = write.body.data.filter((d: Body["data"][number]) => d.range.startsWith("'Eldercare'"));
    // E = time_zone, D = country in the canonical order
    expect(eldercare.map((d: Body["data"][number]) => d.range)).toEqual(["'Eldercare'!E2:E2", "'Eldercare'!E4:E4", "'Eldercare'!E6:E12"]);
    expect(eldercare[2].values[0][0]).toBe(zoneFormula("D", 6));
  });

  it("a contact added from the console lands in the FIRST EMPTY row, not after 1000 formula rows", async () => {
    const header = COLUMNS.map((c) => label(c));
    const row = (name: string) => COLUMNS.map((c) => (c === "name" ? name : c === "time_zone" ? "" : ""));
    grid = { NGOs: [header, row("Asha"), row(""), row("Bina")] };
    calls.length = 0;
    const at = await appendContact("NGOs", { name: "Chitra", phone: "98300 12345", time_zone: "Asia/Kolkata" });
    expect(at).toBe(3);
    const write = calls.find((c) => c.url.includes("values:batchUpdate"))!;
    expect(write.body.valueInputOption).toBe("RAW");
    expect(write.body.data.map((d: Body["data"][number]) => d.range).sort()).toEqual(["'NGOs'!A3", "'NGOs'!B3", "'NGOs'!E3"]);
  });
});
