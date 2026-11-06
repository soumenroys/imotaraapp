// 🔑 Owner, 30 Oct 2026: Imotara is a "private companion", no longer an "AI
// companion" — so the chat itself must say that no person writes the replies.
// Imotara Connect DOES offer real people, so the doubt is a reasonable one.
//
// 🔄 Owner, 6 Nov 2026 (testing 1.6.3): the line under the box "looks so
// artificial" ⇒ it is now said ONCE, as the opening greeting of every chat, and
// nothing sits under the box. Same words on web, Android and iOS.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openingGreeting, opensWithGreeting } from "@/lib/imotara/openingGreeting";

const page = readFileSync(join(process.cwd(), "src/app/chat/page.tsx"), "utf8");

describe("the chat says who is replying — in its opening greeting", () => {
  it("the owner's words, with the companion's own name", () => {
    expect(openingGreeting()).toBe("I'm Imotara — a private companion. My replies come from software, so you can say anything.");
    expect(openingGreeting("Mira")).toBe("I'm Mira — a private companion. My replies come from software, so you can say anything.");
    expect(openingGreeting("  ")).toContain("I'm Imotara");
  });

  it("shown in an EMPTY chat and first in a chat with messages", () => {
    const empty = page.slice(page.indexOf("activeThread.messages.length === 0 ? ("), page.indexOf("<EmptyState"));
    expect(empty).toMatch(/<OpeningGreeting companionName=\{companionDisplayName\} lang=\{preferredLang\} \/>/);
    const list = page.slice(page.indexOf("{activeThread.messages\n") - 400, page.indexOf("{activeThread.messages\n"));
    expect(list).toMatch(/<OpeningGreeting companionName=\{companionDisplayName\} lang=\{preferredLang\} \/>/);
  });

  it("the FIRST chat's stored greeting uses the same words, and is never doubled", async () => {
    const { opensWithGreeting } = await import("@/lib/imotara/openingGreeting");
    expect(page).toMatch(/openingGreeting\(\s*\(getImotaraProfile\(\)\?\.companion[\s\S]{0,120}preferredLang/);
    expect(opensWithGreeting({ role: "assistant", content: openingGreeting("Mira") })).toBe(true);
    expect(opensWithGreeting({ role: "assistant", content: "Hi, I’m Imotara — a quiet companion. Try sending me a message." })).toBe(true);
    expect(opensWithGreeting({ role: "user", content: "I'm Imotara — a private companion." })).toBe(false);
    expect(opensWithGreeting({ role: "assistant", content: "I'm sorry you feel that way." })).toBe(false);
    expect(page).toMatch(/!opensWithGreeting\(activeThread\.messages\[0\]\)/);
  });

  it("in the person's own language, all 22, each naming the companion once", async () => {
    const { OPENING_GREETING } = await import("@/lib/imotara/openingGreeting");
    expect(Object.keys(OPENING_GREETING).sort()).toEqual(["ar","bn","de","en","es","fr","gu","he","hi","id","ja","kn","ml","mr","or","pa","pt","ru","ta","te","ur","zh"]);
    for (const [k, t] of Object.entries(OPENING_GREETING)) expect(t.split("{name}").length - 1, k).toBe(1);
    expect(openingGreeting("Mira", "bn-IN")).toBe("আমি Mira — তোমার একান্ত সঙ্গী। আমার উত্তরগুলো সফটওয়্যার থেকে আসে, তাই তুমি নির্দ্বিধায় যা খুশি বলতে পারো।");
    expect(openingGreeting(null, "xx")).toBe(openingGreeting(null, "en"));
    expect(opensWithGreeting({ role: "assistant", content: openingGreeting("Mira", "hi") })).toBe(true);
  });

  it("⛔ nothing under the box any more", () => {
    const note = page.slice(page.indexOf("{/* Crisis note"), page.indexOf("</main>"));
    expect(note).not.toContain("Replies come from software");
  });
});

import { readMobileFile } from "./helpers/siblingRepo";
import { OPENING_GREETING as WEB_TABLE } from "@/lib/imotara/openingGreeting";

describe("the app says the same words as the website", () => {
  const mobile = readMobileFile("src/lib/welcome/openingGreeting.ts");
  (mobile ? it : it.skip)("all 22 lines are identical in imotara-mobile", () => {
    for (const [k, t] of Object.entries(WEB_TABLE)) {
      expect(mobile, k).toContain(`${k}: ${JSON.stringify(t)},`);
    }
  });
});
