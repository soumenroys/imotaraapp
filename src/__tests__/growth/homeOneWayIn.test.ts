// 12 Nov 2026 (owner): typing on the home page and then tapping a mood / "Start talking" / the Chat
// menu dropped the words — only Send saved them. Now the box keeps them as they type. And an open
// page follows the Mac's light/dark switch while the choice is "System".
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { keepLandingDraft, takeLandingDraft, LANDING_DRAFT_KEY } from "@/lib/imotara/landingDraft";

function mem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

describe("the words are kept as they type", () => {
  it("typing keeps them; clearing the box forgets them", () => {
    const s = mem();
    keepLandingDraft("I had a hard day", s);
    expect(s.m.get(LANDING_DRAFT_KEY)).toBe("I had a hard day");
    keepLandingDraft("   ", s);
    expect(s.m.has(LANDING_DRAFT_KEY)).toBe(false);
  });
  it("the chat still reads them once", () => {
    const s = mem();
    keepLandingDraft("hello", s);
    expect(takeLandingDraft(s)).toBe("hello");
    expect(takeLandingDraft(s)).toBeNull();
  });
  it("the box saves on every change, and a mood tapped after typing sends THEIR words, not the mood", () => {
    const box = readFileSync("src/components/imotara/FirstMessageBox.tsx", "utf8");
    expect(box).toMatch(/onChange=\{\(e\) => change\(e\.target\.value\)\}/);
    expect(box).toMatch(/function change\(v: string\) \{\s*setText\(v\);\s*keepLandingDraft\(v\);/);
    expect(box).toMatch(/if \(ready\) \{ go\(\); return; \}\s*router\.push\(`\/chat\?mood=\$\{key\}`\)/);
  });
});

describe("the home page has one way in, and tells the truth", () => {
  const home = readFileSync("src/app/HomeClient.tsx", "utf8");
  it("no 'on-device by default' claim (replies default to our servers)", () => {
    expect(home).not.toMatch(/on-device by default/);
    expect(home).toMatch(/Replies come from our secure servers by default/);
  });
});

describe("System theme follows the OS while the page is open", () => {
  it("AppearanceInit listens for the OS change and only acts while the choice is System", () => {
    const src = readFileSync("src/components/imotara/AppearanceInit.tsx", "utf8");
    expect(src).toMatch(/mq\.addEventListener\?\.\("change", follow\)/);
    expect(src).toMatch(/if \(localStorage\.getItem\(THEME_KEY\) !== "system"\) return;/);
    expect(src).toMatch(/return \(\) => mq\.removeEventListener\?\.\("change", follow\)/);
  });
});
