// src/__tests__/privacyWordsMatchBehaviour.test.ts
// 🔑 #94 (owner, 7 Nov 2026): the home page and the storage notice said nothing
// leaves the device unless you allow it — but FirstVisitBanner switches every
// new visitor to cloud replies ('allow-remote'). Owner chose: fix the WORDS.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const home = readFileSync("src/app/page.tsx", "utf8");
const notice = readFileSync("src/components/imotara/LocalDataNotice.tsx", "utf8");
const chat = readFileSync("src/app/chat/page.tsx", "utf8");
const banner = readFileSync("src/components/imotara/FirstVisitBanner.tsx", "utf8");
const toggle = readFileSync("src/components/imotara/AnalysisConsentToggle.tsx", "utf8");

describe("while new visitors default to cloud replies, no screen says otherwise", () => {
  it("the default really is cloud (if this changes, revisit the words)", () => {
    expect(banner).toMatch(/saveConsentMode\("allow-remote"\)/);
  });
  it("⛔ the old untrue sentences are gone", () => {
    expect(home).not.toMatch(/only if you explicitly allow it/);
    expect(notice).not.toMatch(/Nothing is sent to our servers/);
    expect(notice).not.toMatch(/Local-only storage by default/);
  });
  it("home + notice say replies use our servers, and where to switch", () => {
    expect(home).toMatch(/Replies come from our\s+secure servers — you can switch to on-device only in Settings\./);
    expect(notice).toMatch(/To reply, your\s+messages are sent to our secure servers\./);
  });
  it("the chat privacy details follow the actual mode", () => {
    expect(chat).toMatch(/\{remoteAllowed\s*\? "Your choice is stored only on this device\. Right now, replies and emotion reading use our secure servers\."/);
  });
  it("the switch the words point to exists in Settings", () => {
    expect(toggle).toMatch(/value: "local-only"/);
  });
});

// #77f (7 Nov 2026): the pages AI assistants send people to — and READ when
// they describe Imotara — carried the same untrue "on your device by default"
// claims. Same owner decision as #94: the words follow the behaviour.
describe("the AI-assistant landing pages say the same true thing", () => {
  const pages = ["ai-emotional-support", "ai-mental-wellness", "mood-tracker-app"].map((s) => [s, readFileSync(`src/app/${s}/page.tsx`, "utf8")] as const);
  it.each(pages)("%s: ⛔ no 'on-device by default' / 'local-first' / 'no data sharing' claims", (_s, src) => {
    expect(src).not.toMatch(/stay on your device by default|stored on your device by default|On-device by default|local-first by design|stores data locally by default|without sharing your data|no data sharing|By default all data is stored locally/i);
  });
  it.each(pages)("%s: says replies use our secure servers and offers the one-tap moods", (_s, src) => {
    expect(src).toMatch(/secure servers/);
    expect(src).toMatch(/<MoodStartRow from="/);
  });
});
