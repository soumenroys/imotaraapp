// src/__tests__/privacyWordsMatchBehaviour.test.ts
// 🔑 #94 (owner, 7 Nov 2026): the home page and the storage notice said nothing
// leaves the device unless you allow it — but FirstVisitBanner switches every
// new visitor to cloud replies ('allow-remote'). Owner chose: fix the WORDS.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const home = readFileSync("src/app/HomeClient.tsx", "utf8");
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
  it.each(pages)("%s: says replies go to our service providers and offers the one-tap moods", (_s, src) => {
    expect(src).toMatch(/service providers/);
    expect(src).toMatch(/<MoodStartRow from="/);
  });
});

// #94 (owner, 14 Nov 2026): web cloud backup became OPT-IN, so "saved securely
// with us" is no longer true on the web — it now says history stays in the
// browser unless backup is switched on.
describe("web: words follow opt-in cloud backup", () => {
  it("⛔ no web screen says history is saved with us by default", () => {
    for (const src of [home, notice, chat]) expect(src).not.toMatch(/saved securely with us/);
  });
  it("home, notice and chat details say it stays in the browser unless backup is on", () => {
    expect(home).toMatch(/stay in this browser unless you switch on cloud backup/);
    expect(notice).toMatch(/kept in this browser/);
    expect(notice).toMatch(/Cloud backup is off unless you\s+switch it on/);
    expect(chat).toMatch(/cloud backup is off unless you switch it on in Settings/);
  });
});

describe("#94: no public page says history is saved with us by default", () => {
  const files = [
    "src/app/HomeClient.tsx", "src/app/layout.tsx", "src/app/guide/page.tsx", "src/app/about/page.tsx",
    "src/app/tutorial/page.tsx", "src/app/settings/page.tsx", "src/app/ai-emotional-support/page.tsx",
    "src/app/ai-mental-wellness/page.tsx", "src/app/mood-tracker-app/page.tsx",
    "src/components/imotara/OnboardingTour.tsx", "public/llms.txt",
  ];
  it.each(files)("%s", (f) => {
    expect(readFileSync(f, "utf8")).not.toMatch(/saved securely (in|with)/i);
  });
});
