/**
 * The privacy promise made to organisation members must match what the product
 * actually does.
 *
 * 🔴 WHY THIS EXISTS. Until 2026-10-06 the Organizations article told admins:
 *
 *     "You can never see any individual member's conversations, moods, or
 *      private data — by design. This is a hard boundary, not a setting."
 *
 * Individual wellbeing trends shipped the same day. Half that sentence stayed
 * true — conversation CONTENTS are still invisible to everyone — and half of it
 * became false: moods ARE visible for members who consent, and it IS a setting.
 *
 * A stale privacy promise is worse than a stale feature list. Someone reads it,
 * believes it, and uses the product differently because of it. On a
 * mental-health product used through an employer or an NGO, that is the single
 * sentence most worth keeping true.
 *
 * ⚠️ The markdown is the SOURCE; helpKb.json is a compiled bundle
 * (scripts/build-help-kb.mjs). Both are asserted, because the chat answers from
 * the bundle — so a doc edit that was never recompiled would leave the help
 * assistant still reciting the old promise.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const HELP = path.join(process.cwd(), "src/content/help");
const read = (f: string) => fs.readFileSync(path.join(HELP, f), "utf8");

const ORGS = () => read("organizations.md");
const PRIVACY = () => read("sync-privacy-account.md");
const BUNDLE = () => read("helpKb.json");

describe("the admin-facing article no longer over-promises", () => {
  it("does not claim moods can NEVER be seen", () => {
    // The specific false sentence. If it returns, individual reporting has
    // been documented away rather than explained.
    expect(ORGS()).not.toMatch(/never see any individual member's conversations, moods/i);
  });

  it("does not call the boundary 'not a setting' — it is one", () => {
    const s = ORGS();
    // "hard boundary, not a setting" may still appear, but only about
    // conversation CONTENTS, which genuinely has no setting.
    const i = s.indexOf("hard boundary");
    if (i > -1) {
      expect(s.slice(Math.max(0, i - 400), i + 200)).toMatch(/conversation/i);
    }
  });

  it("still promises conversations are never visible — that part is unchanged", () => {
    expect(ORGS()).toMatch(/never see any member's conversations/i);
  });
});

describe("both articles state the rule that is easiest to get wrong", () => {
  // People reliably assume opting out removes them from the numbers. It does
  // not. If this sentence disappears from either article, the product still
  // works and the promise quietly breaks.
  it("the admin article says opting out keeps them in the aggregate", () => {
    expect(ORGS()).toMatch(/still counted in your aggregate/i);
  });

  it("the member article says the same thing, in their words", () => {
    expect(PRIVACY()).toMatch(/still counted in the organisation's overall figures/i);
  });

  it("both name the 10-member threshold", () => {
    expect(ORGS()).toMatch(/fewer than 10|Below 10/i);
    expect(PRIVACY()).toMatch(/fewer than 10/i);
  });

  it("both say the switch is on by default and can be turned off", () => {
    for (const doc of [ORGS(), PRIVACY()]) {
      expect(doc).toMatch(/on by default/i);
      expect(doc).toMatch(/turn it off|switch it off/i);
    }
  });

  it("the member article says a personal account is never individually visible", () => {
    expect(PRIVACY()).toMatch(/personal account is never individually visible/i);
  });
});

describe("the compiled bundle is not stale", () => {
  // The help chat answers from helpKb.json, not from the markdown. An edit
  // that was never recompiled leaves the assistant reciting the old promise.
  it("contains the new org consent wording", () => {
    expect(BUNDLE()).toMatch(/still counted in your aggregate/i);
  });

  it("contains the new member-facing wording", () => {
    expect(BUNDLE()).toMatch(/Share my individual wellbeing trends/i);
  });

  it("no longer contains the retired promise", () => {
    expect(BUNDLE()).not.toMatch(/never see any individual member's conversations, moods/i);
  });
});

describe("the tutorial documents it too — the standing sync rule", () => {
  // "Tutorial + KB must update whenever features/licensing change." The
  // tutorial already covers personal privacy controls (Export Data, Delete All
  // Cloud Data), so a switch that governs who can see your moods belongs
  // beside them.
  const TUTORIAL = () =>
    fs.readFileSync(path.join(process.cwd(), "src/app/tutorial/page.tsx"), "utf8");

  it("has an entry for the consent switch", () => {
    expect(TUTORIAL()).toContain("Share My Individual Wellbeing Trends");
  });

  it("says conversations are never readable, whatever the switch is set to", () => {
    const s = TUTORIAL();
    const i = s.indexOf("Share My Individual Wellbeing Trends");
    expect(s.slice(i, i + 1400)).toMatch(/can ever read your conversations|never read your conversations/i);
  });

  it("repeats the half people get wrong — still counted in the totals", () => {
    const s = TUTORIAL();
    const i = s.indexOf("Share My Individual Wellbeing Trends");
    expect(s.slice(i, i + 1400)).toMatch(/still counted in the organisation's overall figures/i);
  });

  it("marks it as organisation-members-only, not a Plus feature", () => {
    const s = TUTORIAL();
    const i = s.indexOf("Share My Individual Wellbeing Trends");
    expect(s.slice(i, i + 1800)).toMatch(/Organisation members/);
  });
});
