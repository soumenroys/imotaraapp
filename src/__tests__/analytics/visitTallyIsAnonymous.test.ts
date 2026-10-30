// 🔑 Owner, 31 Oct 2026 (S4): yes to an ANONYMOUS count of return visits and
// visit length — "no message text, no name, no account". These tests hold the
// three things that make it true: what can be sent, what is stored, and that
// it is actually wired in.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ageBucket, messagesBucket, minutesBucket, parseTallyEvents } from "@/lib/analytics/visitTally";
import { daysBetween, visitEvents } from "@/lib/analytics/visitTallyClient";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("buckets", () => {
  it("day-1, day-7 and day-30 return are exact; later days are grouped", () => {
    expect([0, 1, 7, 30, 31, 90, 91, 400].map(ageBucket)).toEqual([0, 1, 7, 30, 31, 31, 91, 91]);
  });
  it("messages and minutes", () => {
    expect([0, 1, 5, 6, 10, 11, 99].map(messagesBucket)).toEqual([0, 1, 5, 6, 6, 11, 11]);
    expect([0.2, 1.5, 2.5, 4, 8, 15, 60].map(minutesBucket)).toEqual([0, 1, 2, 3, 6, 11, 21]);
  });
  it("days are counted on the device's own calendar", () => {
    expect(daysBetween("2026-10-30", "2026-10-31")).toBe(1);
    expect(daysBetween("2026-10-01", "2026-11-01")).toBe(31);
  });
});

describe("the endpoint accepts only what the design allows", () => {
  it("drops unknown kinds, impossible buckets, other deltas and anything extra", () => {
    expect(parseTallyEvents({ events: [
      { kind: "visit_age", bucket: 1, delta: 1 },
      { kind: "visit_age", bucket: 45, delta: 1 },          // no device sends 45
      { kind: "session_messages", bucket: 2, delta: 5 },   // only ±1
      { kind: "user_id", bucket: 1, delta: 1 },             // not a kind
    ] })).toEqual([{ kind: "visit_age", bucket: 1, delta: 1 }]);
    expect(parseTallyEvents(null)).toEqual([]);
    expect(parseTallyEvents({ events: Array(10).fill({ kind: "visit_age", bucket: 0, delta: 1 }) })).toHaveLength(4);
  });
});

describe("a continuing visit is counted once, at its final size", () => {
  it("first report is +1; a later report moves the +1 to the new bucket", () => {
    const v = { start: 0, last: 0, messages: 1, sent: null };
    const first = visitEvents(v, 30_000);
    expect(first.events).toEqual([
      { kind: "session_messages", bucket: 1, delta: 1 },
      { kind: "session_minutes", bucket: 0, delta: 1 },
    ]);
    const later = visitEvents({ ...v, messages: 3, sent: first.sent }, 4 * 60_000);
    expect(later.events).toEqual([
      { kind: "session_messages", bucket: 1, delta: -1 },
      { kind: "session_messages", bucket: 3, delta: 1 },
      { kind: "session_minutes", bucket: 0, delta: -1 },
      { kind: "session_minutes", bucket: 3, delta: 1 },
    ]);
    expect(visitEvents({ ...v, messages: 3, sent: later.sent }, 4 * 60_000).events).toEqual([]);
  });
});

describe("nothing identifying is sent or stored", () => {
  it("the client sends only { events } — no id, text, path or time", () => {
    // Code only — the comments explain what is NOT sent, in those very words.
    const src = read("src/lib/analytics/visitTallyClient.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(src).toMatch(/JSON\.stringify\(\{ events \}\)/);
    expect(src).not.toMatch(/user_?id|deviceId|session_?id|location\.href|\btext\b|navigator\.userAgent/i);
  });
  it("the table has no column that could identify a person", () => {
    const sql = read("docs/sql/visit_tallies.sql");
    const table = sql.slice(sql.indexOf("create table"), sql.indexOf(");", sql.indexOf("create table"))).replace(/--.*$/gm, "");
    expect(table).not.toMatch(/user|device|session_id|\bip\b|country|city|content/i);
    // 🔴 new tables need an explicit grant since 30 Oct 2026
    expect(sql).toMatch(/grant select, insert, update, delete on public\.visit_tallies to service_role/);
    expect(sql).toMatch(/revoke all on public\.visit_tallies from anon/);
  });
});

describe("it is wired in", () => {
  it("every visitor page mounts the tally", () => {
    expect(read("src/app/layout.tsx")).toMatch(/<VisitTally \/>/);
  });
  it("the chat counts a message only after the send guards pass", () => {
    const chat = read("src/app/chat/page.tsx");
    const fn = chat.slice(chat.indexOf("function sendMessage("));
    const guard = fn.indexOf("if (text.length > 2000) return;");
    const note = fn.indexOf("noteMessageSent();");
    expect(guard).toBeGreaterThan(0);
    expect(note).toBeGreaterThan(guard);
    expect(note).toBeLessThan(fn.indexOf("const userMsg"));
  });
});
