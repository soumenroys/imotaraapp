// src/__tests__/social/nothingIsSentIsFalse.test.ts
// 🔴 30 Oct 2026: two queued Facebook posts claimed nothing leaves the phone.
// False — every message goes to an AI service for the reply. The outreach mail
// writer refused that claim; the social gate did not. ⇒ one rule, both gates.

import { describe, it, expect } from "vitest";
import { checkVoice, NOTHING_SENT } from "@/lib/social/voiceGate";
import { NOTHING_SENT as MAIL_RULE } from "@/lib/outreach/writer";

describe("🔴 the social gate refuses 'nothing leaves your phone'", () => {
  it.each([
    // the two real posts, word for word
    "You can leave a thought unfinished and pick it up days later — Imotara will still remember what you meant. Nothing is sent anywhere unless you switch it on.",
    "If you never switch on cloud sync, nothing from your conversations leaves your phone. It stays right where you said it, even if the signal drops or you forget your login.",
    "Your words never leave your device.",
    "It doesn’t send anything off your phone.",
  ])("refused: %s", (post) => {
    const r = checkVoice(post, "en");
    expect(r.ok).toBe(false);
    expect(r.findings.map((f) => f.list)).toContain("privacy");
    expect(r.listsRun).toContain("privacy");
  });

  it.each([
    // the corrected wording that was approved
    "You can leave a thought unfinished and pick it up days later — Imotara will still remember what you meant. Your conversations are stored on your phone unless you switch on cloud backup.",
    "If you never switch on cloud backup, your conversations are stored only on your phone. They stay right where you left them, even if the signal drops.",
    "Nothing to set up, no account needed to start.",
  ])("allowed: %s", (post) => {
    expect(checkVoice(post, "en").findings.filter((f) => f.list === "privacy")).toEqual([]);
  });

  it("the reviewer is told what to write instead", () => {
    const f = checkVoice("Nothing is sent anywhere.", "en").findings.find((x) => x.list === "privacy")!;
    expect(f.because).toMatch(/STORED on the phone/);
  });

  it("not English ⇒ said to be unchecked, never pretended", () => {
    const r = checkVoice("আপনার কথা ফোনেই থাকে।", "bn");
    expect(r.listsUnavailable).toContain("privacy");
    expect(r.listsRun).not.toContain("privacy");
  });

  it("posts and emails share ONE rule", () => expect(MAIL_RULE).toBe(NOTHING_SENT));
});
