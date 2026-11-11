/**
 * 🔴 "SPEAK TO IT, EVEN OFFLINE" IS FALSE, AND THE WRITER WAS HANDED THE PARTS.
 *
 * 28 Oct 2026: the first LinkedIn draft said "say, out loud or in writing …
 * Imotara waits for you, even offline" — and three APPROVED posts said the
 * same thing, one of them "out loud … No transcript is sent".
 *
 * ⚠️ The facts list said "You can type or speak" and, separately, "Works
 * offline". Both true; their combination is not. The mic uploads the
 * recording to /api/voice/transcribe (mobile useVoiceInput.ts), so speaking
 * needs a connection and the audio leaves the phone. The same correction was
 * made by hand on PeerPush on 27 Oct — and lived nowhere the writer could see.
 * ⇒ trap_a_rule_cannot_fix_what_the_model_cannot_know: hand it the checked
 * sentence, not a rule to be careful.
 */

import { describe, it, expect } from "vitest";
import { FACTS } from "@/lib/social/writer";
import { AUDIENCE_FOCUS } from "@/lib/outreach/writer";
import { THEMES } from "@/lib/broadcast/autoBroadcast";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("what the writer is told about offline", () => {
  // 🔄 11 Nov 2026 (#127, owner): offline is a FALLBACK, never sold — the writer is told not to mention it.
  it("tells the writer NOT to mention offline, and never says the product works offline", () => {
    expect(FACTS).toMatch(/Do not mention offline use/);
    expect(FACTS).not.toMatch(/^- (TYPING )?[Ww]orks offline/m);
  });

  it("says speaking needs a connection and is transcribed on a server", () => {
    expect(FACTS).toMatch(/SPEAKING is transcribed on a server/);
    expect(FACTS).toMatch(/needs a\s+connection/);
    expect(FACTS).toMatch(/transcribed/);
  });

  it("the trends brief does not say a bare 'works offline' either", () => {
    const trends = readFileSync(join(process.cwd(), "src/lib/social/trends.ts"), "utf8");
    expect(trends).not.toMatch(/; works offline;/);
    expect(trends).not.toMatch(/talk to, any hour, even offline/);
  });
});

/**
 * ⚠️ 28 Oct, the same day: the outreach writer had its OWN strengths list per
 * audience — "speak instead of type · … · works offline" for eldercare — and
 * the monthly newsletter a theme "It works offline". Fixing FACTS fixed neither.
 */
describe("the mail writers say the same", () => {
  it("no audience's strengths say a bare 'works offline'", () => {
    for (const [audience, f] of Object.entries(AUDIENCE_FOCUS)) {
      expect(f.lead, audience).not.toMatch(/(^|· )works offline/);
      if (/offline/.test(f.lead)) expect(f.lead, audience).toMatch(/typing works[\s\S]*speaking needs a connection/);
    }
  });

  it("an audience led by SPEAKING is not told about offline at all", () => {
    for (const [audience, f] of Object.entries(AUDIENCE_FOCUS)) {
      if (/^speak/.test(f.lead)) expect(f.lead, audience).not.toMatch(/offline/);
    }
  });

  // 🔄 11 Nov 2026 (#127, owner): the newsletter's "offline" theme was removed — never sold.
  it("the newsletter has no offline theme any more", () => {
    expect(THEMES.find((x) => x.id === "offline")).toBeUndefined();
    for (const x of THEMES) expect(x.brief, x.id).not.toMatch(/works offline/i);
  });
});
