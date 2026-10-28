/**
 * 🔴 "STAYS ON THE DEVICE" WAS READ AS "NOTHING IS SENT".
 *
 * 28 Oct 2026: FACTS said "Conversations stay on the device by default" —
 * true of STORAGE. Re-written outreach drafts turned it into "nothing leaves
 * your device unless you choose to sync" (4 of 20), and approved social posts
 * into "Nothing is sent anywhere unless you switch it on". ⚠️ Replies are
 * written by a cloud AI by default (web `allow-remote`, mobile `cloud`), and
 * the privacy policy says the message text is sent to OpenAI or Gemini.
 * ⇒ The same shape as voice+offline: two true facts, one false sentence.
 */
import { describe, it, expect } from "vitest";
import { FACTS } from "@/lib/social/writer";
import { checkMailStyle, NOTHING_SENT } from "@/lib/outreach/writer";

// The writer's own sentences, 28 Oct — each one false.
const FALSE = [
  "If you type, it works even offline—nothing leaves your device unless you choose to sync.",
  "If you type, it works offline, so nothing leaves your phone until you want it to.",
  "Typing works even when there’s no signal, and nothing is sent anywhere unless you choose to turn on cloud sync.",
  "It doesn’t send your thoughts anywhere unless you switch on cloud sync yourself.",
  "A reply that listens but never leaves your device",
  "If you never switch on cloud sync, nothing from your conversations leaves your phone.",
  "No copy is sent anywhere unless you switch it on yourself.",
];

// True sentences from the same drafts — the check must leave them alone.
const TRUE = [
  "Conversations stay on the device by default, and the employer never sees them.",
  "Conversations stay on the device unless the user chooses otherwise.",
  "Nothing is shared with the institution.",
  "If you speak, the audio is sent securely to be turned into text, so you’ll need a connection for that.",
  "I won’t write again unless you want more.",
];

describe("the facts the writers are given", () => {
  it("say STORED, and that each message is sent for the reply", () => {
    expect(FACTS).toMatch(/STORED on the device by default/);
    expect(FACTS).toMatch(/sent to\s+an AI service/);
    expect(FACTS).not.toMatch(/Conversations stay on the device by default/);
  });
});

describe("the mail check", () => {
  it.each(FALSE)("catches: %s", (s) => {
    expect(NOTHING_SENT.test(s.toLowerCase())).toBe(true);
    const body = `Hello {{name|there}},\n\n${s}\n\nWhat do you think?\n\n— Suchismita Sen, Imotara`;
    expect(checkMailStyle("A subject", body).join(" ")).toMatch(/nothing leaves the phone/);
  });

  it.each(TRUE)("leaves alone: %s", (s) => {
    expect(NOTHING_SENT.test(s.toLowerCase())).toBe(false);
  });
});
