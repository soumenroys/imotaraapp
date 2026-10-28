/**
 * 🔴 A CHANNEL THAT CAN BE CHECKED CAN STILL BE DAYS FROM DYING.
 *
 * 28 Oct 2026: LinkedIn was connected and "Check it now" answered 400 —
 * channelCheck.ts had no LinkedIn branch, although the adapter's
 * `checkLinkedInPage` had existed since 19 Oct.
 *
 * ⚠️ Wiring it in exposed the second defect. The cron only looked at
 * `token_expires_at` when it could NOT ask the platform, because until then no
 * checkable channel had an expiry. A LinkedIn token is both (~60 days), so the
 * day its check started working, its 10-day warning would have silently
 * stopped ⇒ expiryVerdict, applied after a successful check in BOTH callers.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  checkChannel,
  channelCanBeChecked,
  expiryVerdict,
  EXPIRY_WARN_DAYS,
} from "@/lib/social/channelCheck";

const linkedin = {
  ok: true as const,
  id: "acc-1",
  platform: "linkedin",
  externalId: "115173947",
  displayName: "Imotara on LinkedIn",
  token: "test-token",
};

function answer(status: number, body: unknown) {
  const calls: { url: string; method: string }[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? "GET" });
    return new Response(JSON.stringify(body), { status });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("LinkedIn can be checked", () => {
  it("is a platform the dispatcher answers for", () => {
    expect(channelCanBeChecked("linkedin")).toBe(true);
  });

  it("asks LinkedIn about the Page it was connected for — with a READ, never a post", async () => {
    const calls = answer(200, { localizedName: "Imotara" });
    const r = await checkChannel(linkedin);

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.canPost).toBe(true);
      expect(r.note).toContain("Imotara");
      // ⚠️ The note must not claim more than a read proves.
      expect(r.note).toMatch(/read, not a test post/);
    }
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("GET");
    expect(calls[0].url).toBe("https://api.linkedin.com/rest/organizations/115173947");
  });

  it("a rejected token reads as a dead token", async () => {
    answer(401, { message: "Invalid access token", serviceErrorCode: 65600 });
    const r = await checkChannel(linkedin);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("token");
  });

  it("⛔ LinkedIn's own 5xx is NOT LinkedIn saying no — it maps to the kind both callers leave alone", async () => {
    answer(503, { message: "Service unavailable" });
    const r = await checkChannel(linkedin);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe("network");
  });
});

describe("the expiry rule", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString();

  it("is silent far from the date", () => {
    expect(expiryVerdict(inDays(60), now)).toBeNull();
    expect(expiryVerdict(null, now)).toBeNull();
  });

  it("warns inside the window", () => {
    expect(expiryVerdict(inDays(EXPIRY_WARN_DAYS - 3), now)?.status).toBe("expiring");
  });

  it("calls an expired token dead", () => {
    expect(expiryVerdict(inDays(-1), now)?.status).toBe("dead");
  });
});

describe("both callers apply it after a SUCCESSFUL check", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("the daily cron does, inside the branch where the platform answered", () => {
    const cron = read("src/app/api/cron/social-health/route.ts");
    const ok = cron.indexOf("if (result.ok) {");
    const notOk = cron.indexOf('} else if (result.kind === "network")');
    const applied = cron.indexOf("expiryVerdict(a.token_expires_at", ok);
    expect(ok).toBeGreaterThan(-1);
    expect(applied, "the cron no longer warns about a checkable token's expiry").toBeGreaterThan(ok);
    expect(applied).toBeLessThan(notOk);
  });

  it("the button does too, and only describes tokens Facebook issued", () => {
    const button = read("src/app/api/admin/social/channels/[id]/check/route.ts");
    expect(button).toMatch(/expiryVerdict\(row\.token_expires_at/);
    expect(button).toMatch(
      /cred\.platform === "facebook" \|\| cred\.platform === "instagram"\) \{\s*try \{\s*const facts = await describeToken/,
    );
  });
});
