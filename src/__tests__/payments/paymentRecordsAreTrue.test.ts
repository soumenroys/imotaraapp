// #44 / payment-rails #4 #6 #8 (27 Nov 2026):
//  (a) a repeated Google Play token-pack token is no longer "already processed" without checking
//      the grant happened;
//  (b) the recorded price/currency is what the buyer paid (Apple's signed payload; Play: what the
//      app reports, else "XXX") — never a hard-coded "USD"/"INR";
//  (c) a failed admin licence-history write is reported, not swallowed.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

const grantLicense = vi.fn();
vi.mock("@/lib/imotara/grantLicense", () => ({ grantLicense: (...a: unknown[]) => grantLicense(...a) }));

import { reportedPlayPrice, settleRepeatedPack, RECOVERY_FROM, STALE_PENDING_MS } from "@/lib/imotara/playPackSettle";
import { applePaid } from "@/lib/apple/storeServer";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("(b) recorded price", () => {
  it("Play: the app-reported price in micros ⇒ hundredths, currency upper-cased", () => {
    expect(reportedPlayPrice(149_000_000, "inr")).toEqual({ minor: 14900, currency: "INR" });
    expect(reportedPlayPrice(6_990_000, "USD")).toEqual({ minor: 699, currency: "USD" });
  });
  it("Play: nothing / junk reported ⇒ 0 + XXX (not reported), never a guess", () => {
    for (const [m, c] of [[undefined, undefined], [0, "USD"], [-5, "USD"], [1.5, "USD"], [100, "US"], [100, "<b>"], ["abc", "USD"]] as const) {
      expect(reportedPlayPrice(m, c)).toEqual({ minor: 0, currency: "XXX" });
    }
  });
  it("Apple: signed price (×1000) ⇒ hundredths; missing ⇒ nulls", () => {
    expect(applePaid({ price: 1990, currency: "USD" })).toEqual({ paidMinor: 199, paidCurrency: "USD" });
    expect(applePaid({ price: 149000, currency: "INR" })).toEqual({ paidMinor: 14900, paidCurrency: "INR" });
    expect(applePaid({})).toEqual({ paidMinor: null, paidCurrency: null });
    expect(applePaid({ price: 1990, currency: "usd" })).toEqual({ paidMinor: null, paidCurrency: null });
  });
  it("no route writes a hard-coded currency any more", () => {
    const play = read("src/app/api/payments/google-play/verify/route.ts");
    const apple = read("src/app/api/license/verify-apple-purchase/route.ts");
    expect(play).not.toMatch(/currency:\s*"USD"/);
    expect(apple).not.toMatch(/currency:\s*"USD"/);
    expect(apple).not.toMatch(/:\s*"INR",/);
  });
});

// A tiny fake of the Supabase query chain used by settleRepeatedPack.
function fakeAdmin(row: Record<string, unknown> | null, opts: { takeoverWins?: boolean } = {}) {
  const updates: Record<string, unknown>[] = [];
  const admin = {
    from: () => {
      let mode: "select" | "update" = "select";
      let patch: Record<string, unknown> = {};
      const q: Record<string, unknown> = {
        select: () => q,
        update: (p: Record<string, unknown>) => { mode = "update"; patch = p; updates.push(p); return q; },
        eq: () => q,
        maybeSingle: async () => ({ data: row, error: null }),
        then: (res: (v: unknown) => unknown) => {
          if (mode === "update" && patch.tier === "granting") {
            return Promise.resolve({ data: opts.takeoverWins === false ? [] : [{ payment_id: "t" }], error: null }).then(res);
          }
          return Promise.resolve({ data: [], error: null }).then(res);
        },
      };
      return q;
    },
  };
  return { admin: admin as never, updates };
}

const after = new Date(RECOVERY_FROM + 60 * 60_000); // an hour after the fix went live
const stale = (base: Date) => new Date(base.getTime() - STALE_PENDING_MS - 1000).toISOString();

describe("(a) a repeated token-pack token", () => {
  beforeEach(() => {
    grantLicense.mockReset();
    grantLicense.mockResolvedValue({ ok: true, tier: "free", tokenBalance: 100, expiresAt: null });
    vi.useFakeTimers();
    vi.setSystemTime(after);
  });

  it("granted ⇒ already_processed, nothing granted", async () => {
    const { admin } = fakeAdmin({ user_id: "u1", tier: "free", granted_at: stale(after) });
    const r = await settleRepeatedPack(admin, "u1", "tokens_100" as never, "tok");
    expect(await r.json()).toEqual({ ok: true, message: "already_processed" });
    expect(grantLicense).not.toHaveBeenCalled();
  });

  it("another account's purchase ⇒ refused (409), nothing granted", async () => {
    const { admin } = fakeAdmin({ user_id: "someone-else", tier: "free", granted_at: stale(after) });
    const r = await settleRepeatedPack(admin, "u1", "tokens_100" as never, "tok");
    expect(r.status).toBe(409);
    expect(grantLicense).not.toHaveBeenCalled();
  });

  it("pending and fresh ⇒ 202 pending (the first attempt is still granting)", async () => {
    const { admin } = fakeAdmin({ user_id: "u1", tier: "pending", granted_at: new Date(after.getTime() - 10_000).toISOString() });
    const r = await settleRepeatedPack(admin, "u1", "tokens_100" as never, "tok");
    expect(r.status).toBe(202);
    expect((await r.json()).pending).toBe(true);
    expect(grantLicense).not.toHaveBeenCalled();
  });

  it("pending and stale ⇒ takes over and grants ONCE, then marks granted", async () => {
    const { admin, updates } = fakeAdmin({ user_id: "u1", tier: "pending", granted_at: stale(after) });
    const r = await settleRepeatedPack(admin, "u1", "tokens_100" as never, "tok");
    expect((await r.json()).ok).toBe(true);
    expect(grantLicense).toHaveBeenCalledTimes(1);
    expect(updates.map((u) => u.tier)).toEqual(["granting", "free"]);
  });

  it("stale but another caller took it over first ⇒ already_processed, no second grant", async () => {
    const { admin } = fakeAdmin({ user_id: "u1", tier: "pending", granted_at: stale(after) }, { takeoverWins: false });
    const r = await settleRepeatedPack(admin, "u1", "tokens_100" as never, "tok");
    expect((await r.json()).message).toBe("already_processed");
    expect(grantLicense).not.toHaveBeenCalled();
  });

  it("⛔ a 'pending' claim from BEFORE the fix is never re-granted (its mark was fire-and-forget)", async () => {
    const old = new Date(RECOVERY_FROM - 24 * 3600_000).toISOString();
    const { admin } = fakeAdmin({ user_id: "u1", tier: "pending", granted_at: old });
    const r = await settleRepeatedPack(admin, "u1", "tokens_100" as never, "tok");
    expect((await r.json()).message).toBe("already_processed");
    expect(grantLicense).not.toHaveBeenCalled();
  });

  it("the route uses it, and awaits the 'granted' mark", () => {
    const play = read("src/app/api/payments/google-play/verify/route.ts");
    expect(play).toMatch(/if \(!isSubscription\) return settleRepeatedPack\(/);
    expect(play).toMatch(/await markGranted\(admin, purchaseToken, result\.tier\);/);
    expect(play).not.toMatch(/void admin\.from\("payment_licenses"\)\.update/);
  });
});

describe("(c) admin licence history", () => {
  it("both history writes are awaited and a failure is reported as historySaved:false", () => {
    const src = read("src/app/api/admin/licenses/[userId]/route.ts");
    expect(src).not.toMatch(/\.then\(\(\{ error: hErr \}\)/);
    expect((src.match(/historySaved: false/g) ?? []).length).toBe(2);
    const page = read("src/app/admin/page.tsx");
    expect(page).toMatch(/data\.historySaved === false/);
  });
});
