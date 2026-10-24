/**
 * 🔑 THE CALL LOG AND THE CONSOLE'S RULES.
 *
 * The console reads Bolna's own record of every call; these pin how a Bolna
 * execution becomes a row (who, how long, what it cost, what came of it) and
 * how the report counts them — plus the two rules the console added: a
 * Scheduled call goes out when due, and Individuals stay paused until the
 * owner allows them.
 */

import { describe, it, expect } from "vitest";
import { toCallRecord, summarise, allAgentIds, sevenDayWindows, BOLNA_MAX_RANGE_MS } from "@/lib/voice/calls";
import { BOLNA_AGENTS } from "@/lib/voice/agents";
import {
  COLUMNS, STATUS, checkContact, selectDue, parseSettings, DEFAULT_SETTINGS,
  type Contact, type Directory, type Column,
} from "@/lib/voice/rules";

const execution = (over: Record<string, unknown> = {}) => ({
  id: "exec-1",
  agent_id: BOLNA_AGENTS.bn.male,
  status: "completed",
  conversation_duration: 94.6,
  total_cost: 13.2,
  created_at: "2026-10-21T18:40:00Z",
  transcript: "assistant: নমস্কার…\nuser: হ্যাঁ বলুন",
  summary: "Asked for details by WhatsApp.",
  telephony_data: { recording_url: "https://example.com/rec/1.mp3", to_number: "+919000000000", hangup_by: "user" },
  extracted_data: { call_result: { outcome: { objective: "send_info" }, next_action: { subjective: "Send the brochure" } } },
  context_details: { recipient_data: { name: "Asha", organisation: "Sahay NGO", imotara_tab: "NGOs", imotara_phone: "+919830012345", imotara_placed_by: "owner@imotara.com" } },
  ...over,
});

describe("a Bolna execution becomes a call record", () => {
  it("reads who, how long, cost, outcome, recording and transcript", () => {
    const r = toCallRecord(execution());
    expect(r).toMatchObject({
      id: "exec-1", language: "bn", voice: "male", status: "completed", durationSec: 95, costCents: 13.2,
      phone: "+919830012345", name: "Asha", organisation: "Sahay NGO", tab: "NGOs", placedBy: "owner@imotara.com",
      outcome: "send_info", nextAction: "Send the brochure", recordingUrl: "https://example.com/rec/1.mp3", hangupBy: "user",
    });
    expect(r.transcript).toContain("হ্যাঁ");
  });

  it("falls back to the dialled number when our own data is missing", () => {
    const r = toCallRecord(execution({ context_details: {} }));
    expect(r.phone).toBe("+919000000000");
    expect(r.placedBy).toBe("");
  });

  it("knows every one of the 44 agents", () => {
    expect(allAgentIds()).toHaveLength(44);
  });
});

describe("the report", () => {
  const calls = [
    toCallRecord(execution()),
    toCallRecord(execution({ id: "2", extracted_data: { o: { outcome: { objective: "meeting_booked" } } } })),
    toCallRecord(execution({ id: "3", status: "no-answer", conversation_duration: 0, total_cost: 1, created_at: "2026-10-22T05:00:00Z" })),
    toCallRecord(execution({ id: "4", conversation_duration: 4, extracted_data: {} })), // completed but 4 s: not a conversation
  ];
  const r = summarise(calls);

  it("counts a call as connected only when a real conversation happened", () => {
    expect(r.total).toBe(4);
    expect(r.connected).toBe(2);
    expect(r.connectRate).toBe(0.5);
  });

  it("counts outcomes of connected calls only, and meetings separately", () => {
    expect(r.byOutcome).toEqual({ send_info: 1, meeting_booked: 1 });
    expect(r.meetings).toBe(1);
  });

  it("adds up cost and groups by day", () => {
    expect(r.costCents).toBeCloseTo(13.2 * 3 + 1);
    expect(r.perDay.map((d) => d.day)).toEqual(["2026-10-21", "2026-10-22"]);
  });

  it("an empty period is all zeros, not NaN", () => {
    const e = summarise([]);
    expect(e.connectRate).toBe(0);
    expect(e.avgDurationSec).toBe(0);
  });
});

const contact = (over: Partial<Record<Column, string>> = {}, tab: Contact["tab"] = "NGOs", row = 2): Contact => {
  const blank = Object.fromEntries(COLUMNS.map((c) => [c, ""])) as Record<Column, string>;
  return {
    tab, row,
    v: {
      ...blank,
      phone: "919830012345", name: "Asha", country: "IN", time_zone: "Asia/Kolkata", language: "bn",
      consent_note: "Seminar sign-up, 12 Oct", status: "Pending", call_attempts: "0", team_member: "Tapan",
      ...over,
    },
  };
};
const dir = (contacts: Contact[], settings: Partial<Directory["settings"]> = {}): Directory => ({
  contacts,
  languages: new Map([["bn", "start"]]),
  team: new Map([["tapan", "male"]]),
  dnc: new Set(),
  settings: { ...DEFAULT_SETTINGS, callingEnabled: true, ...settings },
});
// Tuesday 21 Oct 2026, 11:00 IST
const TUE_11_IST = new Date("2026-10-21T05:30:00Z");

describe("the Individuals switch", () => {
  it("is OFF by default, and blocks only the Individuals tab", () => {
    expect(parseSettings([]).allowIndividuals).toBe(false);
    const d = dir([]);
    expect(checkContact(contact({}, "Individuals"), d)).toBe("Individuals paused (TRAI/DLT)");
    expect(checkContact(contact({}, "NGOs"), d)).toBe("OK");
  });

  it("allow_individuals = yes in the sheet lets them through", () => {
    expect(parseSettings([["allow_individuals", "yes"]]).allowIndividuals).toBe(true);
    expect(checkContact(contact({}, "Individuals"), dir([], { allowIndividuals: true }))).toBe("OK");
  });
});

describe("a Scheduled call", () => {
  it("goes out when its time has come — even with automatic calling off", () => {
    const due = contact({ status: STATUS.scheduled, follow_up_datetime: "2026-10-21T05:00:00Z" });
    const s = selectDue(dir([due], { autoDispatch: false }), TUE_11_IST, { auto: true });
    expect(s.toCall.map((c) => c.row)).toEqual([2]);
  });

  it("waits while its time is still ahead", () => {
    const later = contact({ status: STATUS.scheduled, follow_up_datetime: "2026-10-21T09:00:00Z" });
    expect(selectDue(dir([later]), TUE_11_IST, { auto: true }).toCall).toHaveLength(0);
  });

  it("still respects the person's calling hours", () => {
    // Due 30 minutes ago (inside the grace period), but it is now 20:30 IST — outside 10:00–18:00.
    const due = contact({ status: STATUS.scheduled, follow_up_datetime: "2026-10-21T14:30:00Z" });
    const s = selectDue(dir([due]), new Date("2026-10-21T15:00:00Z"), { auto: true });
    expect(s.toCall).toHaveLength(0);
    expect(s.skipped[0].reason).toMatch(/calling hours/);
  });
});

describe("the provider's 7-day limit", () => {
  // Bolna answers 422 to any from–to range over 7 days — measured on production, 24 Oct.
  it("splits 30 days into 5 windows, none longer than 7 days, covering the whole range", () => {
    const to = new Date("2026-10-24T10:00:00Z");
    const from = new Date(to.getTime() - 30 * 86400_000);
    const w = sevenDayWindows(from, to);
    expect(w).toHaveLength(5);
    for (const [a, b] of w) expect(b.getTime() - a.getTime()).toBeLessThan(BOLNA_MAX_RANGE_MS);
    expect(w[0][0].getTime()).toBe(from.getTime());
    expect(w[w.length - 1][1].getTime()).toBe(to.getTime());
  });

  it("a range under 7 days is one window", () => {
    const to = new Date("2026-10-24T10:00:00Z");
    expect(sevenDayWindows(new Date(to.getTime() - 86400_000), to)).toHaveLength(1);
  });
});
