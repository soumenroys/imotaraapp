/**
 * #85 (11 Nov 2026): the billing grace notice — banner, button and the one
 * email — in all 22 languages. English stays the owner-approved text of 6 Nov.
 */
import { describe, it, expect } from "vitest";
import { GRACE, GRACE_LANGS, graceBanner, graceEmailLines, graceLang, graceDate } from "@/lib/imotara/graceNoticeText";
import { graceEmail } from "@/lib/imotara/billingIssue";

const UNTIL = "2026-11-22T00:00:00.000Z";
const URL_ = "https://apps.apple.com/account/subscriptions";
const STORES = ["apple", "google_play"] as const;

describe("English is the approved text, word for word", () => {
  it("banner + button", () => {
    expect(graceBanner("google_play", UNTIL, "en")).toEqual({
      text: "Your last payment for Imotara Plus didn't go through on Google Play. Plus stays on until 22 November — update your payment method to keep it.",
      button: "Update payment in Google Play",
    });
    expect(graceBanner("apple", UNTIL).button).toBe("Update payment in the App Store");
  });
  it("email", () => {
    expect(graceEmailLines("apple", UNTIL, URL_, "en")).toEqual({
      subject: "Your Imotara Plus payment didn't go through",
      lines: [
        "Hi,", "",
        "Your last payment for Imotara Plus didn't go through in the App Store. Nothing is lost: Plus stays on until 22 November while the App Store tries again.",
        "", "To keep it, please check the card or payment method in your App Store subscriptions:", URL_, "",
        "If you meant to stop Plus, you don't need to do anything — Imotara stays free to use.", "", "— The Imotara team",
      ],
    });
    expect(graceEmail({ kind: "grace", until: UNTIL, store: "apple" }).html).toContain("Open my App Store subscriptions");
  });
});

describe("all 22 languages say the whole thing", () => {
  it("22, the same set as the rest of the app", () => {
    expect(GRACE_LANGS).toHaveLength(22);
    expect(Object.keys(GRACE).sort()).toEqual([...GRACE_LANGS].sort());
  });
  for (const lang of GRACE_LANGS) {
    for (const store of STORES) {
      it(`${lang} · ${store}: the store, the date, Plus, nothing left blank`, () => {
        const name = store === "apple" ? "App Store" : "Google Play";
        const when = graceDate(UNTIL, lang);
        expect(when).toMatch(/22|２２|٢٢|২২|२२|௨௨|౨౨|૨૨|೨೨|൨൨|੨੨|୨୨|۲۲/);
        const b = graceBanner(store, UNTIL, lang);
        const { subject, lines } = graceEmailLines(store, UNTIL, URL_, lang);
        const all = [b.text, b.button, subject, ...lines].join("\n");
        expect(b.text).toContain(name);
        expect(b.text).toContain(when);
        expect(b.button).toContain(name);
        expect(lines).toContain(URL_);
        expect(all).toContain("Imotara Plus");
        expect(all).not.toMatch(/\$\{|undefined|null|NaN/);
        // ⛔ public copy never says "AI"
        expect(all).not.toMatch(/\bAI\b/);
      });
    }
  }
  it("unknown or regional codes fall back sensibly", () => {
    expect(graceLang("hi-IN")).toBe("hi");
    expect(graceLang("xx")).toBe("en");
    expect(graceLang(null)).toBe("en");
  });
  it("the email goes right-to-left for Arabic, Urdu and Hebrew", () => {
    for (const l of ["ar", "ur", "he"]) expect(graceEmail({ kind: "grace", until: UNTIL, store: "google_play" }, l).html).toContain('dir="rtl"');
    expect(graceEmail({ kind: "grace", until: UNTIL, store: "google_play" }, "bn").html).not.toContain('dir="rtl"');
  });
});
