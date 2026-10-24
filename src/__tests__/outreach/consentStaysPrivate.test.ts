/**
 * 🔒 THE CONSENT NOTE STAYS PRIVATE (owner, 24 Oct 2026: "the user should not
 * see that consent part in his received mail or call content").
 *
 * consent_note (column J) is our record of how a person agreed to be contacted.
 * It decides WHETHER we contact them; it must never travel WITH the contact —
 * not into the email, not into the voice agent's variables (which it may say).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COLUMNS, userData, type Column, type Contact } from "@/lib/voice/rules";
import { buildMessage } from "@/lib/outreach/send";

const SECRET = "SECRET-CONSENT-met-at-12-Oct-seminar";
const contact = (): Contact => {
  const blank = Object.fromEntries(COLUMNS.map((c) => [c, ""])) as Record<Column, string>;
  return {
    tab: "NGOs", row: 2,
    v: { ...blank, phone: "919830012345", name: "Asha", organisation: "Hope Trust", country: "IN", time_zone: "Asia/Kolkata", language: "en", consent_note: SECRET, email: "asha@hope.org" },
  };
};

describe("🔒 consent never reaches the person", () => {
  it("not one of the call's variables carries it", () => {
    const data = userData(contact(), { team: new Map() }, new Date("2026-10-21T05:30:00Z"));
    expect(Object.keys(data)).not.toContain("consent_note");
    expect(JSON.stringify(data)).not.toContain(SECRET);
  });

  it("the email built for a person does not carry it", () => {
    const c = contact();
    const m = buildMessage({ subject: "Hello {{name|there}}", body: "Hello {{name|there}} at {{organisation}}.\n\nhttps://www.imotara.com" },
      { email: c.v.email, name: c.v.name, organisation: c.v.organisation }, { name: "Suchismita Sen", email: "suchismita.sen@imotara.com" });
    expect(JSON.stringify(m)).not.toContain(SECRET);
  });

  it("⛔ the sender is handed only name, email and organisation — never the whole row", () => {
    const run = readFileSync(join(process.cwd(), "src/lib/outreach/run.ts"), "utf8");
    expect(run).toMatch(/sendOutreach\(draft, \{ email, name: contact\.v\.name, organisation: contact\.v\.organisation \}/);
    expect(run).not.toMatch(/consent_note/);
  });

  it("the sheet tells the team: context is spoken, consent goes in consent_note", () => {
    const sheets = readFileSync(join(process.cwd(), "src/lib/voice/sheets.ts"), "utf8");
    expect(sheets).toMatch(/context: "[^"]*Not consent/);
  });
});
