/**
 * #154 (15 Nov 2026) — the owner pressed Approve and "nothing happened".
 *
 * Proven cause: the draft (written 4 Nov) said "your chat history stays on
 * your phone"; the card showed the stored "privacy ✓" from writing time; the
 * approve route re-checks against TODAY's rules (rule added 11 Nov) and
 * refused with 409; the refusal printed at the top of the page, out of view.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { gateNowFor } from "@/lib/social/gateNow";

const REFUSED_TODAY = {
  status: "needs_review",
  language: "en",
  subject: "Typed or spoken: where your words go",
  body:
    "Type or speak — either way, your words go to our secure servers so Imotara can reply, and your chat " +
    "history stays on your phone. You can choose on-device replies in Settings. #privacy",
};

describe("#154 the review card shows today's word check, not the one from writing day", () => {
  it("the exact 15 Nov X draft is refused today, by the privacy list", () => {
    const now = gateNowFor(REFUSED_TODAY);
    expect(now?.ok).toBe(false);
    expect(now?.findings.map((f) => f.list)).toContain("privacy");
    expect(now?.findings[0].matched).toMatch(/history stays on your phone/);
  });

  it("the accurate rewrite passes", () => {
    const now = gateNowFor({
      ...REFUSED_TODAY,
      subject: "Your words, kept private",
      body: "What you tell Imotara is private. It is never sold, never shown to an employer or a school, and you can delete your account and everything in it from Settings, any time. #privacy",
    });
    expect(now?.ok).toBe(true);
  });

  it("only posts that can still go out are re-checked", () => {
    for (const status of ["published", "skipped", "failed"]) {
      expect(gateNowFor({ ...REFUSED_TODAY, status })).toBeUndefined();
    }
    expect(gateNowFor({ ...REFUSED_TODAY, status: "approved" })?.ok).toBe(false);
  });

  it("checks the same text the approve route checks (subject, newline, body)", () => {
    const route = readFileSync("src/app/api/admin/social/posts/[id]/route.ts", "utf8");
    expect(route).toContain("checkVoice(`${post.subject}\\n${post.body}`");
    const lib = readFileSync("src/lib/social/gateNow.ts", "utf8");
    expect(lib).toContain('`${String(row.subject ?? "")}\\n${String(row.body ?? "")}`');
  });

  it("the list route attaches it", () => {
    const list = readFileSync("src/app/api/admin/social/posts/route.ts", "utf8");
    expect(list).toMatch(/gateNowFor\(r, overlay\)/);
    expect(list).toMatch(/posts: withNow/);
  });
});

describe("#154 the answer to a button appears where it was pressed", () => {
  const page = readFileSync("src/app/admin/social/page.tsx", "utf8");

  it("a reply that is not JSON no longer throws silently", () => {
    expect(page).toMatch(/await res\.json\(\)\.catch\(\(\) => null\)/);
    expect(page).toMatch(/catch \(e\) \{\s*const text = `That did not reach the server/);
  });

  it("the result is rendered on the card itself, and a success pops up at the bottom", () => {
    expect(page).toMatch(/result\?\.id === post\.id &&/);
    expect(page).toMatch(/result\?\.ok && \(\s*<div role="status" className="fixed/);
  });

  it("Approve is disabled, with a reason, when today's check refuses the words", () => {
    expect(page).toMatch(/disabled=\{busy === post\.id \|\| post\.gateNow\?\.ok === false\}/);
    expect(page).toContain("Today&apos;s word check refuses these words");
  });

  it("the pressed button says it is working", () => {
    expect(page).toContain('busyAction === "approve" ? "Approving…');
  });

  it("no green tick is shown for a list that objected", () => {
    expect(page).toMatch(/filter\(\(l\) => !\(post\.gateNow\?\.findings \?\? \[\]\)\.some\(\(f\) => f\.list === l\)\)/);
  });
});
