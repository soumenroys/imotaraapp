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
