// 🔑 Owner, 30 Oct 2026: Imotara is a "private companion", no longer an "AI
// companion" — so it must say plainly that no person writes the replies.
// Imotara Connect DOES offer real people, so the doubt is a reasonable one.
//
// 🔄 Owner, 6 Nov 2026 (testing 1.6.3): the line under the chat box "looks so
// artificial" ⇒ said ONCE, on the first-visit WELCOME screen, in the person's
// own language and the screen's own voice — nothing under the box, nothing in
// the chat. ⚠️ Owner chose first visit only; advised that some places expect a
// repeated reminder (decision recorded 6 Nov 2026).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONSENT_COPY_BY_LANG } from "@/lib/legal/consentCopy";
import { readMobileFile } from "./helpers/siblingRepo";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("the welcome screen says who writes the replies", () => {
  it("every language has the line, in the screen's own voice", () => {
    expect(Object.keys(CONSENT_COPY_BY_LANG)).toHaveLength(22);
    for (const [k, c] of Object.entries(CONSENT_COPY_BY_LANG)) expect([k, c.software.length > 10]).toEqual([k, true]);
    expect(CONSENT_COPY_BY_LANG.en.software).toBe("Its replies come from software, so you can say anything.");
  });

  it("shown on the welcome screen, under the 'not a therapist' line", () => {
    const gate = read("src/components/legal/ConsentGate.tsx");
    expect(gate.indexOf("{copy.software}")).toBeGreaterThan(gate.indexOf("{copy.body}"));
  });

  it("⛔ nothing under the chat box any more", () => {
    const page = read("src/app/chat/page.tsx");
    const note = page.slice(page.indexOf("{/* Crisis note"), page.indexOf("</main>"));
    expect(note).not.toContain("Replies come from software");
  });

  const mobile = readMobileFile("src/lib/legal/consentCopy.ts");
  (mobile ? it : it.skip)("the app's welcome screen says exactly the same, in all 22", () => {
    for (const [k, c] of Object.entries(CONSENT_COPY_BY_LANG)) {
      expect(mobile, k).toContain(`software: ${JSON.stringify(c.software)},`);
    }
  });
});
