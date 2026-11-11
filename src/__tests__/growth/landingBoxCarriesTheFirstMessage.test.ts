// src/__tests__/growth/landingBoxCarriesTheFirstMessage.test.ts
// 🔑 #130 D (11 Nov 2026 audit): ~7% of web visits sent a message. People arriving from AI
// assistants land on / and /ai-emotional-support, so those pages now have a message box:
// type, press send, and the chat opens with those words in its box.
// ⛔ the words never go in a URL · ⛔ never sent for them · counted anonymously (steps 13/14).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  LANDING_CHAT_URL, LANDING_DRAFT_KEY, LANDING_DRAFT_MAX, LANDING_OPENERS, saveLandingDraft, takeLandingDraft,
} from "@/lib/imotara/landingDraft";
import { FUNNEL_STEPS } from "@/lib/analytics/visitTally";
import { summariseFunnel } from "@/lib/analytics/funnelSummary";

function fakeStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

describe("the handoff", () => {
  it("what they typed arrives once, trimmed", () => {
    const s = fakeStore();
    expect(saveLandingDraft("  I can't sleep again  ", s)).toBe(true);
    expect(takeLandingDraft(s)).toBe("I can't sleep again");
    expect(takeLandingDraft(s)).toBeNull(); // a reload never refills the box
    expect(s.m.has(LANDING_DRAFT_KEY)).toBe(false);
  });
  it("nothing typed ⇒ nothing kept", () => {
    const s = fakeStore();
    expect(saveLandingDraft("   ", s)).toBe(false);
    expect(takeLandingDraft(s)).toBeNull();
  });
  it("capped at the chat composer's own limit", () => {
    const s = fakeStore();
    saveLandingDraft("x".repeat(5000), s);
    expect(takeLandingDraft(s)!.length).toBe(LANDING_DRAFT_MAX);
    expect(LANDING_DRAFT_MAX).toBe(2000);
  });
  it("storage that throws never breaks the page", () => {
    const bad = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(saveLandingDraft("hello", bad)).toBe(false);
    expect(takeLandingDraft(bad)).toBeNull();
  });
});

describe("⛔ the words never travel in a URL", () => {
  it("the chat link is a marker only", () => {
    expect(LANDING_CHAT_URL).toBe("/chat?src=landing");
  });
  it("the box navigates only to that constant", () => {
    const box = readFileSync("src/components/imotara/FirstMessageBox.tsx", "utf8");
    const pushes = [...box.matchAll(/router\.push\(([^)]*)\)/g)].map((m) => m[1].trim());
    expect(pushes).toEqual(["LANDING_CHAT_URL"]);
    expect(box).not.toMatch(/encodeURIComponent|[?&](q|text|msg|draft)=/);
  });
});

describe("⛔ never sent for them", () => {
  const chat = readFileSync("src/app/chat/page.tsx", "utf8");
  const start = chat.indexOf("const landingDraftRef");
  const effect = chat.slice(start, chat.indexOf("}, [mounted]);", start));
  it("the chat fills the box and focuses it — and does not call send", () => {
    expect(effect).toContain("takeLandingDraft()");
    expect(effect).toContain("setDraft(t)");
    expect(effect).not.toMatch(/sendMessage\(/);
  });
  it("only an EMPTY box is filled — never over what they already typed", () => {
    const guard = effect.indexOf('draft.trim() !== ""');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(effect.indexOf("setDraft(t)"));
  });
});

describe("the openers read for anyone, anywhere", () => {
  it.each(LANDING_OPENERS.map((o) => [o]))("%s", (o) => {
    expect(o).not.toMatch(/\bAI\b|India|Tele-MANAS|therap/i);
    expect(o.length).toBeLessThan(60);
  });
});

describe("both landing pages carry the box", () => {
  it.each([["src/app/HomeClient.tsx", "home"], ["src/app/ai-emotional-support/page.tsx", "ai-emotional-support"]])("%s", (file, from) => {
    expect(readFileSync(file, "utf8")).toContain(`<FirstMessageBox from="${from}" />`);
  });
});

describe("counted anonymously (#129 funnel)", () => {
  it("two new steps, inside the table's bucket range, no clash", () => {
    expect(FUNNEL_STEPS.landing_send).toBe(13);
    expect(FUNNEL_STEPS.landing_sent).toBe(14);
    const nums = Object.values(FUNNEL_STEPS);
    expect(new Set(nums).size).toBe(nums.length);
    expect(Math.max(...nums)).toBeLessThanOrEqual(91);
  });
  it("admin sees the share carried through", () => {
    const s = summariseFunnel([{ platform: "web", bucket: 13, hits: 10 }, { platform: "web", bucket: 14, hits: 7 }]);
    expect(s.rates.landingCarried).toBe(70);
  });
});
