/**
 * ⛔ LOSING THE TUNING TABLE MUST COST NOTHING BUT THE TUNING.
 *
 * 🔑 THE RISK THIS FILE EXISTS FOR. The dials decide how long a post should
 * be and how many tags it may carry, and they are read from a table. If that
 * read can fail in a way that produces NUMBERS rather than an error, the
 * writer is instructed with them: an empty table means "aim for 0 characters,
 * use 0 tags", and every check agrees, because the check reads the same
 * nothing.
 *
 * ⇒ The code is the default and the table only ever improves on it. Pinned
 * here against the three ways the read goes wrong: it throws, it errors, and
 * it returns something unusable.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
process.env.SOCIAL_TOKEN_KEY ??= Buffer.alloc(32, 9).toString("base64");

/** What the fake table answers with this time. */
let answer: { data: unknown; error: { message: string } | null } | Error = { data: [], error: null };

vi.mock("@/lib/supabaseServer", () => ({
  getSupabaseAdmin: () => {
    if (answer instanceof Error) throw answer;
    return { from: () => ({ select: async () => answer }) };
  },
}));

const { loadDials } = await import("@/lib/social/platformDialsStore");
const { allCodeDials, codeDials } = await import("@/lib/social/platformDials");
const { PLATFORM_IDS } = await import("@/lib/social/platforms");

beforeEach(() => {
  answer = { data: [], error: null };
});

describe("when the table cannot be read at all", () => {
  it("⛔ uses the built-in values and says so, rather than throwing", async () => {
    answer = new Error("getaddrinfo ENOTFOUND");
    const { dials, notes } = await loadDials();
    expect(dials).toEqual(allCodeDials());
    expect(notes.join(" ")).toMatch(/built-in values/i);
    // 🔑 The REASON is carried, not swallowed: "the table is missing" and
    // "the network is down" need different actions.
    expect(notes.join(" ")).toMatch(/ENOTFOUND/);
  });

  it("uses the built-in values when the query returns an error", async () => {
    // ⚠️ The likeliest case by far: the SQL file has not been applied yet.
    answer = { data: null, error: { message: 'relation "social_platform_dials" does not exist' } };
    const { dials, notes } = await loadDials();
    expect(dials).toEqual(allCodeDials());
    expect(notes.join(" ")).toMatch(/does not exist/);
  });

  it("⛔ an EMPTY table is the built-in values, not zeroes", async () => {
    /**
     * 🔴 THE WORST CASE, because nothing anywhere is an error. A table that
     * exists and is empty would, if it were treated as the truth, instruct
     * the writer to aim for nothing at all.
     */
    answer = { data: [], error: null };
    const { dials, notes } = await loadDials();
    expect(dials).toEqual(allCodeDials());
    expect(notes).toEqual([]);
    for (const id of PLATFORM_IDS) expect(dials[id].bodyTarget.min).toBeGreaterThan(0);
  });
});

describe("when the table has something to say", () => {
  it("a sane row wins for its own channel, and only for its own channel", async () => {
    answer = {
      data: [
        { platform: "facebook", body_min: 500, body_max: 900, hashtags: 1, emoji: 0, tags_drive_discovery: true },
      ],
      error: null,
    };
    const { dials, notes } = await loadDials();
    expect(dials.facebook).toEqual({
      bodyTarget: { min: 500, max: 900 },
      hashtags: 1,
      emoji: 0,
      tagsDriveDiscovery: true,
    });
    // ⛔ Every other channel is untouched by a row about Facebook.
    expect(dials.instagram).toEqual(codeDials("instagram"));
    expect(notes).toEqual([]);
  });

  it("⛔ an out-of-range row falls back for THAT channel alone, and is reported", async () => {
    answer = {
      data: [
        { platform: "facebook", body_min: 320, body_max: 460, hashtags: 400, emoji: 0, tags_drive_discovery: false },
        { platform: "instagram", body_min: 150, body_max: 260, hashtags: 4, emoji: 2, tags_drive_discovery: true },
      ],
      error: null,
    };
    const { dials, notes } = await loadDials();
    expect(dials.facebook, "a 400-tag row was obeyed").toEqual(codeDials("facebook"));
    // 🔑 The good row still applies. One bad row must not discard the others.
    expect(dials.instagram.bodyTarget).toEqual({ min: 150, max: 260 });
    expect(notes.join(" ")).toMatch(/facebook/);
    expect(notes.join(" ")).toMatch(/out of range/i);
  });

  it("⚠️ a row for a channel that no longer exists is ignored and reported", async () => {
    // ⛔ Not an error: channels can be removed from the code, and an orphan
    // row is a leftover rather than a fault.
    answer = {
      data: [{ platform: "tumblr", body_min: 100, body_max: 200, hashtags: 1, emoji: 0, tags_drive_discovery: false }],
      error: null,
    };
    const { dials, notes } = await loadDials();
    expect(dials).toEqual(allCodeDials());
    expect(notes.join(" ")).toMatch(/tumblr/);
    expect(notes.join(" ")).toMatch(/not a channel any more/i);
  });

  it("⛔ a null column does not become a zero", async () => {
    /**
     * 🔴 `Number(null)` IS 0, NOT NaN. A nullable column — or one added by a
     * later migration without a backfill — would otherwise read as "no tags,
     * zero-length post" and pass for a deliberate setting.
     */
    answer = {
      data: [
        { platform: "facebook", body_min: null, body_max: null, hashtags: null, emoji: null, tags_drive_discovery: null },
      ],
      error: null,
    };
    const { dials, notes } = await loadDials();
    expect(dials.facebook).toEqual(codeDials("facebook"));
    expect(notes.join(" ")).toMatch(/out of range/i);
  });
});
