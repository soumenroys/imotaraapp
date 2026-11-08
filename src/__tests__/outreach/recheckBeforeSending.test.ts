// src/__tests__/outreach/recheckBeforeSending.test.ts
// 8 Nov 2026: the sign-off rule changed on 5 Nov ("— The Imotara team"), but the
// 20 drafts approved BEFORE it still ended "— Suchismita Sen, Imotara" and kept
// being SENT after she left — approval was only checked when a draft was written.
// ⇒ runOutreach re-runs the checks at send time; a failing draft goes back to
// "needs review" (it shows on the To do page) and is never sent.
// 🔑 These tests RUN runOutreach (mocked edges, real checks) — not a text match.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OutreachState } from "@/lib/outreach/store";

const GOOD_BODY = [
  "Hello {{name|there}},",
  "",
  "A short, true note about Imotara for your team.",
  "",
  "If you want to see what it looks like: https://www.imotara.com",
  "",
  "How does your team usually check in during busy weeks?",
  "",
  "— The Imotara team",
].join("\n");
const OLD_SIGN_OFF = GOOD_BODY.replace("— The Imotara team", "— Suchismita Sen, Imotara");

let state: OutreachState;
const sent: string[] = [];

vi.mock("@/lib/voice/sheets", () => ({
  readDirectory: vi.fn(async () => ({
    contacts: [{ tab: "NGOs", row: 2, v: { email: "someone@example.org", name: "Asha", organisation: "Sristi", mail_last_sent: "" } }],
    dnc: [],
  })),
  writeRow: vi.fn(async () => {}),
}));
vi.mock("@/lib/broadcast/warmup", () => ({ getBudget: vi.fn(async () => ({ remaining: 50 })) }));
vi.mock("@/lib/broadcast/resendClient", () => ({ isResendConfigured: () => true }));
vi.mock("@/lib/broadcast/unsubscribe", () => ({ isUnsubscribeConfigured: () => true }));
vi.mock("@/lib/outreach/send", () => ({
  senderIdentity: vi.fn(async () => ({ name: "Imotara", email: "social@imotara.com" })),
  suppressedEmails: vi.fn(async () => new Set<string>()),
  sendOutreach: vi.fn(async (draft: { body: string }) => { sent.push(draft.body); return { ok: true, id: "r1" }; }),
}));
vi.mock("@/lib/outreach/record", () => ({
  createVersion: vi.fn(async () => "b1"),
  outreachHistory: vi.fn(async () => new Map()),
  recordSend: vi.fn(async () => {}),
}));
vi.mock("@/lib/outreach/sequence", async (orig) => {
  const real = await orig<typeof import("@/lib/outreach/sequence")>();
  return { ...real, selectMail: vi.fn((contacts: unknown[]) => [{ contact: (contacts as never[])[0], step: "intro" }]) };
});
vi.mock("@/lib/outreach/store", async (orig) => {
  const real = await orig<typeof import("@/lib/outreach/store")>();
  return {
    ...real,
    readOutreach: vi.fn(async () => state),
    updateOutreach: vi.fn(async (_s: unknown, change: (s: OutreachState) => void) => { change(state); return state; }),
  };
});
vi.mock("@/lib/outreach/writer", async (orig) => {
  const real = await orig<typeof import("@/lib/outreach/writer")>();
  // Every other draft "exists" so nothing is written by a model in the test.
  return { ...real, writeMailDraft: vi.fn(async () => { throw new Error("no model in tests"); }) };
});

function withIntro(body: string): OutreachState {
  const draft = { subject: "A private place for your team", body, status: "approved" as const, writtenAt: "2026-11-01T00:00:00Z", writtenBy: "admin", findings: [], broadcastId: "b0" };
  return { settings: { enabled: true, sendWithoutAsking: false, dailyCap: 20 }, drafts: { "ngos:intro": draft } };
}

describe("an approved outreach draft is re-checked before it is sent", () => {
  beforeEach(() => { sent.length = 0; });

  it("✅ control: a draft that passes today's checks IS sent", async () => {
    state = withIntro(GOOD_BODY);
    const { runOutreach } = await import("@/lib/outreach/run");
    const r = await runOutreach({} as never, new Date("2026-11-08T05:00:00Z"));
    expect(r.failedChecks).toEqual([]);
    expect(sent).toHaveLength(1);
  });

  it("⛔ the 8 Nov case: approved, but signed by someone who left ⇒ NOT sent, back to review", async () => {
    state = withIntro(OLD_SIGN_OFF);
    const { runOutreach } = await import("@/lib/outreach/run");
    const r = await runOutreach({} as never, new Date("2026-11-08T05:00:00Z"));
    expect(sent).toHaveLength(0);
    expect(r.failedChecks.map((f) => f.draft)).toEqual(["ngos:intro"]);
    expect(r.failedChecks[0].findings.join(" ")).toMatch(/The Imotara team/);
    // Shows on the To do page as waiting, with the reason.
    expect(state.drafts["ngos:intro"].status).toBe("needs_review");
    expect(state.drafts["ngos:intro"].findings.length).toBeGreaterThan(0);
  });
});
