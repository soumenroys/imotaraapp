// Web → app handoff (owner 21 Nov 2026, options A + B).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FUNNEL_STEPS } from "@/lib/analytics/visitTally";

const chat = readFileSync("src/app/chat/page.tsx", "utf8");

describe("the website invites people into the app, quietly", () => {
  it("A: one line after the 3rd message, once per visitor, dismissible", () => {
    expect(chat).toMatch(/if \(userCount < 3 \|\| !last/);
    expect(chat).toMatch(/localStorage\.getItem\(HANDOFF_SEEN_KEY\)/);
    expect(chat).toMatch(/Want me with you on your phone\?/);
    expect(chat).toMatch(/aria-label="Dismiss"/);
  });

  it("A: never stacked on top of the check-in invite", () => {
    expect(chat).toMatch(/if \(inviteLang\) return;/);
  });

  it("A: never shown on the daily-limit card or an empty reply", () => {
    expect(chat).toMatch(/last\.isQuotaNotice \|\| !last\.content\) return;/);
  });

  it("B: a quiet header 'App' link to both stores", () => {
    expect(chat).toMatch(/title="Get the app"/);
    expect(chat).toMatch(/iPhone \(App Store\)/);
    expect(chat).toMatch(/Android \(Google Play\)/);
  });

  it("store links are worldwide, not the Indian storefront", () => {
    expect(chat).toMatch(/HANDOFF_APPSTORE_URL = "https:\/\/apps\.apple\.com\/app\/imotara\/id6756697569"/);
    expect(chat).not.toMatch(/HANDOFF_APPSTORE_URL = "https:\/\/apps\.apple\.com\/in\//);
  });

  it("every step is counted anonymously", () => {
    expect(FUNNEL_STEPS.app_handoff_shown).toBe(15);
    expect(FUNNEL_STEPS.app_handoff_click).toBe(16);
    expect(FUNNEL_STEPS.app_header_click).toBe(17);
  });

  it("help explains it", () => {
    expect(readFileSync("src/content/help/getting-started.md", "utf8")).toMatch(/## Getting the app on your phone/);
  });
});
