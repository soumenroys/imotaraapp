// src/__tests__/social/fbFirstCommentTrial.test.ts
// 🔑 Owner, 7 Nov 2026 (#92): TRY a tracked link in the first comment under
// each Facebook post — cautiously, and the before/after comparison must not be
// forgotten. ⛔ So the trial ends by itself: forgetting can only stop it.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { TRIAL_START, TRIAL_UNTIL, commentTargetId, firstCommentActive, firstCommentText, isOurFirstComment } from "@/lib/social/firstComment";
import { facebookComments } from "@/lib/social/comments/graph";

describe("the trial switches itself off", () => {
  it("is 14 days: 7 Nov 15:00 IST → 22 Nov 00:00 IST", () => {
    expect((Date.parse(TRIAL_UNTIL) - Date.parse(TRIAL_START)) / 86_400_000).toBeCloseTo(14.375, 2);
  });
  it("off before, on during, OFF after — with nobody touching anything", () => {
    expect(firstCommentActive(Date.parse("2026-11-07T09:00:00Z"))).toBe(false);
    expect(firstCommentActive(Date.parse("2026-11-12T12:00:00Z"))).toBe(true);
    expect(firstCommentActive(Date.parse(TRIAL_UNTIL))).toBe(false);
    expect(firstCommentActive(Date.parse("2027-01-01T00:00:00Z"))).toBe(false);
  });
});

describe("the comment", () => {
  const t = firstCommentText();
  it("one tagged link, house style (no 'AI', no hype)", () => {
    expect(t.match(/https?:\/\//g)).toHaveLength(1);
    expect(t).toMatch(/utm_source=facebook&utm_medium=social&utm_campaign=first_comment/);
    expect(t).not.toMatch(/\bAI\b|therap|best|#1|free!/i);
    expect(isOurFirstComment(t)).toBe(true);
  });
});

describe("⛔ our own comment is never read back as a visitor's", () => {
  const fakeFetch = (async () => ({
    ok: true,
    json: async () => ({
      data: [{
        id: "post1", message: "A post",
        comments: { data: [
          { id: "c1", from: { id: "PAGE" }, message: "anything the Page wrote" },
          { id: "c2", message: firstCommentText() },          // author hidden by Meta
          { id: "c3", from: { id: "someone" }, message: "Thank you for this" },
        ] },
      }],
    }),
  })) as unknown as typeof fetch;

  it("by author, and by tag when Meta hides the author", async () => {
    const got = await facebookComments("PAGE", "tok", fakeFetch);
    expect(got.map((c) => c.commentId)).toEqual(["c3"]);
  });
});

describe("🔴 8 Nov: the comment goes on the Page post, whatever kind of post it was", () => {
  // Real ids from our own posts: a video comes back bare, a photo page-qualified.
  it("a VIDEO post's bare number is qualified with the Page — Facebook refused the bare one (#12)", () => {
    expect(commentTargetId("122139749793392789", "1222416224285686")).toBe("1222416224285686_122139749793392789");
  });
  it("a PHOTO post's id is already qualified and is left alone", () => {
    expect(commentTargetId("1222416224285686_122139318603392789", "1222416224285686")).toBe("1222416224285686_122139318603392789");
  });
  it("no Page id ⇒ the id as given (never a leading underscore)", () => {
    expect(commentTargetId("123", "")).toBe("123");
  });
});

describe("wiring", () => {
  it("the route comments on the Page-qualified id", () => {
    expect(readFileSync("src/app/api/cron/social-publish/route.ts", "utf8")).toMatch(/commentOnPost\(commentTargetId\(result\.postId, cred\.externalId\)/);
  });
  const route = readFileSync("src/app/api/cron/social-publish/route.ts", "utf8");
  it("Facebook only, after the post exists, only while the trial is on", () => {
    expect(route).toMatch(/if \(platform === "facebook" && result\.postId && firstCommentActive\(\)\) \{/);
  });
  it("a failed comment can never fail the post (it runs inside try/catch before the row is marked published)", () => {
    const i = route.indexOf("firstCommentActive()) {");
    const block = route.slice(i, route.indexOf('status: "published"', i));
    expect(block).toMatch(/try \{[\s\S]*commentOnPost\([\s\S]*\} catch \(e\) \{/);
    expect(block).not.toMatch(/continue;|return /);
  });
});
