// 🔑 Owner, 30 Oct 2026: Imotara is a "private companion", no longer an "AI
// companion" — so the chat itself must say that no person writes the replies.
// Without it, the only place that said so was the Privacy Policy, and Imotara
// Connect DOES offer real people, so the doubt is a reasonable one.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("the chat says who is replying", () => {
  it("the line under the message box says replies come from software", () => {
    const src = readFileSync(join(process.cwd(), "src/app/chat/page.tsx"), "utf8");
    const note = src.slice(src.indexOf("{/* Crisis note"), src.indexOf("</main>"));
    expect(note).toContain("Replies come from software, not a person.");
  });
});
