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
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("what the writer is told about offline", () => {
  it("says TYPING works offline — not the product as a whole", () => {
    expect(FACTS).toMatch(/TYPING works offline/);
    expect(FACTS).not.toMatch(/^- Works offline/m);
  });

  it("says speaking needs a connection and is transcribed on a server", () => {
    expect(FACTS).toMatch(/SPEAKING[\s\S]{0,40}not/);
    expect(FACTS).toMatch(/needs a\s+connection/);
    expect(FACTS).toMatch(/transcribed/);
  });

  it("the trends brief does not say a bare 'works offline' either", () => {
    const trends = readFileSync(join(process.cwd(), "src/lib/social/trends.ts"), "utf8");
    expect(trends).not.toMatch(/; works offline;/);
    expect(trends).not.toMatch(/talk to, any hour, even offline/);
  });
});
