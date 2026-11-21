// #163 (owner, 21 Nov 2026, option 1): when today's 20 free replies are used,
// the web chat says so plainly and offers both ways back.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const chat = readFileSync("src/app/chat/page.tsx", "utf8");

describe("a used-up daily limit is said plainly on the web", () => {
  it("the card names the limit and offers Top up and Get Plus", () => {
    expect(chat).toMatch(/You&apos;ve used today&apos;s 20 free replies/);
    expect(chat).toMatch(/will be simpler\. For full replies now, top up or try Plus\./);
    expect(chat).toMatch(/href="\/upgrade#credits"[\s\S]{0,300}Top up credits/);
    expect(chat).toMatch(/Get Plus/);
    expect(chat).not.toMatch(/Upgrade for unlimited replies/);
  });

  it("a strip shows while replies are simpler, and clears when a full reply returns", () => {
    expect(chat).toMatch(/\{quotaLimited && \(/);
    expect(chat).toMatch(/Simpler replies until your free replies reset/);
    expect(chat).toMatch(/cloudQuotaHit = true;\s*setQuotaLimited\(true\);/);
    expect(chat).toMatch(/aiMetaFrom = "openai";\s*setQuotaLimited\(false\);/);
  });

  it("the credits link has somewhere to land", () => {
    expect(readFileSync("src/app/upgrade/page.tsx", "utf8")).toMatch(/id="credits"/);
  });

  it("help describes what people now see", () => {
    expect(readFileSync("src/content/help/getting-started.md", "utf8")).toMatch(/Top up credits\*\* or \*\*Get Plus\*\*/);
  });
});
