// src/__tests__/social/channelFiguresPlatformFirst.test.ts
// 🔴 #81, 7 Nov 2026: every social-stats run logged "That channel has a row but
// no stored token" as an ERROR for YouTube and X — a false alarm that reads like
// a broken connection. The reader asked for the access token before looking at
// the platform. This test RUNS both readers on the rows production really has.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

const loadChannelCredential = vi.fn(async () => ({ ok: false, reason: "That channel has a row but no stored token." }));
vi.mock("@/lib/social/channelCredentials", () => ({
  loadChannelCredential: (...a: unknown[]) => loadChannelCredential(...(a as [])),
  loadCredentialFor: vi.fn(async () => ({ ok: false, reason: "not used here" })),
}));

import { captureChannelStats, capturePostStats } from "@/lib/social/stats";

function dbWith(platform: string) {
  const q = (rows: unknown) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "not", "gte", "order", "limit"]) b[m] = () => b;
    b.maybeSingle = async () => ({ data: Array.isArray(rows) ? rows[0] : rows, error: null });
    b.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(res);
    return b;
  };
  return { from: (t: string) => (t === "social_accounts" ? q([{ platform }]) : q([])) } as never;
}

beforeEach(() => loadChannelCredential.mockClear());

describe.each(["youtube", "x"])("%s — no reader yet is said plainly, never as a missing token", (platform) => {
  it("channel figures: 'no way to read' + unsupported, and the token is never asked for", async () => {
    const r = await captureChannelStats(dbWith(platform), "acct");
    expect(r).toEqual({ ok: false, unsupported: true, reason: `There is no way to read ${platform} channel figures yet.` });
    expect(loadChannelCredential).not.toHaveBeenCalled();
  });
});

it("X post figures: no problem logged, an honest 'no reader' note instead", async () => {
  const r = await capturePostStats(dbWith("x"), "acct");
  expect(r).toEqual({ captured: 0, skipped: 0, problems: [], unsupported: "No reader for x posts yet." });
  expect(loadChannelCredential).not.toHaveBeenCalled();
});

it("⛔ Facebook still asks for its token — and a REAL missing token is still an error", async () => {
  const r = await captureChannelStats(dbWith("facebook"), "acct");
  expect(loadChannelCredential).toHaveBeenCalledTimes(1);
  expect(r).toEqual({ ok: false, reason: "That channel has a row but no stored token." });
});

it("the job logs an expected gap as a note, and a real failure as an error", () => {
  const route = readFileSync("src/app/api/cron/social-stats/route.ts", "utf8");
  expect(route).toMatch(/if \(!stats\.ok && stats\.unsupported\) \{\s*console\.log\(/);
  expect(route).toMatch(/\} else if \(!stats\.ok\) \{\s*console\.error\("\[social-stats\] channel figures could not be read"/);
});
