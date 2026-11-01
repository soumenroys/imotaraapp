/**
 * 🔑 #51 — COMMENTS UNDER OUR POSTS (owner, 31 Oct + 1 Nov 2026).
 *
 * Measured 1 Nov on the last 25 posts per channel: 0 genuine outside comments,
 * 7 repost scams, 4 from the team. The rules, tested on those real comments:
 * team left alone · spam hidden · crisis answered with the crisis line + email ·
 * everyone else a DRAFT that waits for the owner. ⛔ Never an unapproved reply.
 */
import { describe, it, expect, vi } from "vitest";
import { CRISIS_REPLY, classifyComment, isSpam } from "@/lib/social/comments/classify";
import { plan, runCommentReplies, MAX_DRAFTS_PER_DAY, type Deps } from "@/lib/social/comments/run";
import { readDraft } from "@/lib/social/comments/draft";
import type { RawComment } from "@/lib/social/comments/graph";

const REAL_SPAM = [
  "please SenD me ThIS p0st💖",
  "💞This shot is really great, please send me this post",
  "Send me This post",
  "Amazing post 🔥 please send this to us",
  "Suprb💚Dear can we repost? Plz send me this post in DM💌",
  "Love this content 😍 send this post please",
  "Wow, can we repost it, Send me this post DM 📬",
];

describe("what a comment is", () => {
  it.each(REAL_SPAM)("the repost scams we actually got are spam: %s", (t) => {
    expect(classifyComment({ author: "universe_health__llc", text: t })).toBe("spam");
  });

  it("our team is left alone", () => {
    expect(classifyComment({ author: "tapankumarkarmakar", text: "Wow" })).toBe("team");
    expect(classifyComment({ author: "imotaraofficial", text: "Thank you!" })).toBe("team");
  });

  it("a reader sharing is NOT spam", () => {
    expect(isSpam("I'll send this to my sister, she needs it")).toBe(false);
    expect(classifyComment({ author: "a_reader", text: "This is exactly how I felt last night 🙏" })).toBe("genuine");
  });

  it("🔴 crisis words win over everything — even from a team name, even with 'dm me'", () => {
    expect(classifyComment({ author: "someone", text: "I want to die, dm me" })).toBe("crisis");
    expect(classifyComment({ author: "tapankumarkarmakar", text: "i want to kill myself" })).toBe("crisis");
    expect(classifyComment({ author: "x", text: "আমি আর বাঁচতে চাই না" })).toBe("crisis");
  });

  it("the crisis reply is worldwide: emergency number + findahelpline, no country, no 'AI'", () => {
    expect(CRISIS_REPLY).toMatch(/local emergency number/);
    expect(CRISIS_REPLY).toMatch(/findahelpline\.com/);
    expect(CRISIS_REPLY).not.toMatch(/\b(India|Tele-MANAS|14416|AI|₹)\b/);
  });
});

const NOW = new Date("2026-11-01T18:00:00Z");
const c = (over: Partial<RawComment>): RawComment => ({
  platform: "instagram", commentId: "c1", postId: "p1", postSnippet: "Quiet company", author: "a_reader", text: "Lovely", at: "2026-11-01T10:00:00Z", ...over,
});

describe("what is done about it", () => {
  it("team → skip · spam → hide · crisis → crisis reply · genuine → draft", () => {
    const p = plan([
      c({ commentId: "1", author: "tapankumarkarmakar", text: "Wow" }),
      c({ commentId: "2", text: "Send me this post in DM" }),
      c({ commentId: "3", text: "I want to end my life" }),
      c({ commentId: "4", text: "Thank you, I needed this" }),
    ], NOW);
    expect(p.map((x) => x.action)).toEqual(["skip", "hide", "crisis_reply", "draft"]);
  });

  it("old comments are not answered late — but old spam is still hidden", () => {
    const old = "2026-10-01T10:00:00Z";
    expect(plan([c({ at: old })], NOW)[0].action).toBe("too_old");
    expect(plan([c({ at: old, text: "can we repost" })], NOW)[0].action).toBe("hide");
  });
});

// ── The run, with Meta and the model replaced ────────────────────────────────
function fakeDb(opts: { paused?: boolean; seen?: string[]; draftedToday?: number } = {}) {
  const inserted: Record<string, unknown>[] = [];
  const q = (table: string) => {
    const b: Record<string, unknown> = {};
    const chain = () => b;
    Object.assign(b, {
      select: chain, eq: chain, in: chain, gte: chain, neq: chain, order: chain, limit: chain,
      maybeSingle: async () => ({ data: table === "social_settings" ? { posting_paused: !!opts.paused } : null }),
      insert: async (row: Record<string, unknown>) => { inserted.push(row); return { error: null }; },
      then: (res: (v: unknown) => void) => {
        if (table === "social_accounts") return res({ data: [] });
        if (table === "social_comments") return res({ data: (opts.seen ?? []).map((id) => ({ platform: "instagram", comment_id: id })), count: opts.draftedToday ?? 0, error: null });
        return res({ data: [] });
      },
    });
    return b;
  };
  return { db: { from: q } as never, inserted };
}

describe("the run", () => {
  it("'Stop everything' stops it — nothing read, nothing done", async () => {
    const { db, inserted } = fakeDb({ paused: true });
    const deps: Deps = { hide: vi.fn(), reply: vi.fn(), draft: vi.fn(), alert: vi.fn() };
    expect(await runCommentReplies(db, deps, NOW)).toEqual({ skipped: "Stop everything is on" });
    expect(inserted).toEqual([]);
    expect(deps.reply).not.toHaveBeenCalled();
  });

  it("the daily ceiling is real", () => {
    expect(MAX_DRAFTS_PER_DAY).toBeGreaterThan(0);
    expect(MAX_DRAFTS_PER_DAY).toBeLessThanOrEqual(60);
  });
});

describe("⛔ a genuine comment is never answered without approval", () => {
  it("the run's only automatic reply is the fixed crisis text", async () => {
    const src = (await import("node:fs")).readFileSync("src/lib/social/comments/run.ts", "utf8").replace(/\/\/.*$/gm, "");
    const replies = [...src.matchAll(/deps\.reply\(([^)]*)\)/g)].map((m) => m[1]);
    expect(replies).toEqual(["p.c, CRISIS_REPLY, token"]);
  });
});

describe("reading the model's draft", () => {
  it("keeps the language it names, flags what breaks the house rules", () => {
    const d = readDraft('{"language":"bn","reply":"ধন্যবাদ, আপনার কথাগুলো আমাদের ভালো লাগল।"}');
    expect(d.language).toBe("bn");
    expect(d.reply).toMatch(/ধন্যবাদ/);
  });
  it("an unusable answer becomes an empty draft with a note, never a crash", () => {
    const d = readDraft("sorry, no");
    expect(d.reply).toBe("");
    expect(d.note).toMatch(/write the reply yourself/);
  });
  it("an unknown language falls back to English for the checks", () => {
    expect(readDraft('{"language":"xx","reply":"Thank you"}').language).toBe("en");
  });
});

describe("sharing with someone is not asking for it", () => {
  it("'I'll send this post to my friend' is a reader, not a scam", () => {
    expect(isSpam("I'll send this post to my friend")).toBe(false);
  });
});
