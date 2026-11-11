/**
 * #129 (11 Nov 2026): the retention and payment funnel is counted ANONYMOUSLY — a daily count per
 * step in visit_tallies, nothing about who. Without it nobody could tell whether the invite, the
 * welcome-back card or the upgrade page ever worked.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { parseTallyEvents, FUNNEL_STEPS } from "@/lib/analytics/visitTally";
import { funnelOncePerDay } from "@/lib/analytics/visitTallyClient";

const read = (p: string) => readFileSync(p, "utf8");

describe("the tally accepts only real funnel steps", () => {
  it("12 numbered steps, never renumbered", () => {
    expect(FUNNEL_STEPS).toMatchObject({ invite_shown: 1, invite_accepted: 2, invite_declined: 3, welcome_shown: 4, welcome_pick: 5, welcome_fresh: 6, checkin_opened: 7, upgrade_view: 8, checkout_start: 9, purchase_ok: 10, purchase_cancel: 11, quota_hit: 12 });
  });
  it("valid steps pass; anything else is dropped", () => {
    expect(parseTallyEvents({ events: [{ kind: "funnel", bucket: 1, delta: 1 }, { kind: "funnel", bucket: 12, delta: 1 }] })).toHaveLength(2);
    expect(parseTallyEvents({ events: [{ kind: "funnel", bucket: 13, delta: 1 }, { kind: "funnel", bucket: 0, delta: 1 }, { kind: "funnel", bucket: 2, delta: 5 }] })).toHaveLength(0);
  });
  it("the database change exists and only widens the kind check", () => {
    const sql = read("docs/sql/visit_tallies_funnel.sql");
    expect(sql).toMatch(/check \(kind in \('visit_age', 'session_messages', 'session_minutes', 'funnel'\)\)/);
    expect(sql).not.toMatch(/user_id|email|ip_address/i);
  });
});

describe("once per device per day per step", () => {
  it("counts the first time today, not again", () => {
    expect(funnelOncePerDay({}, "invite_shown", "2026-11-11")).toBe(true);
    expect(funnelOncePerDay({ invite_shown: "2026-11-11" }, "invite_shown", "2026-11-11")).toBe(false);
    expect(funnelOncePerDay({ invite_shown: "2026-11-10" }, "invite_shown", "2026-11-11")).toBe(true);
  });
});

describe("every step is wired where it happens (web)", () => {
  const chat = read("src/app/chat/page.tsx");
  const invite = read("src/components/imotara/CheckInInviteCard.tsx");
  const upgrade = read("src/app/upgrade/page.tsx");
  it("invite: shown / accepted / declined", () => {
    expect(invite).toMatch(/tallyFunnel\("invite_shown"\)/);
    expect(invite).toMatch(/tallyFunnel\(s === "accepted" \? "invite_accepted" : "invite_declined"\)/);
    expect(invite).not.toMatch(/(?<!=> \{ )setInviteState\("(accepted|declined)"\)/);
  });
  it("welcome-back: shown / pick / fresh; check-in opened; quota hit", () => {
    for (const s of ["welcome_shown", "welcome_pick", "welcome_fresh", "checkin_opened", "quota_hit"]) expect(chat).toContain(`tallyFunnel("${s}")`);
  });
  it("upgrade: view / checkout start / ok / cancel", () => {
    for (const s of ["upgrade_view", "checkout_start", "purchase_ok", "purchase_cancel"]) expect(upgrade).toContain(`tallyFunnel("${s}")`);
  });
  it("the reminder push opens /chat?src=checkin", () => {
    expect(read("src/app/api/push/cron/route.ts")).toMatch(/url: "\/chat\?src=checkin"/);
  });
});

import { summariseFunnel } from "@/lib/analytics/funnelSummary";
describe("the admin summary", () => {
  it("sums by platform and gives the four rates", () => {
    const s = summariseFunnel([
      { platform: "web", bucket: 1, hits: 10 }, { platform: "android", bucket: 1, hits: 10 },
      { platform: "web", bucket: 2, hits: 5 },
      { platform: "web", bucket: 8, hits: 4 }, { platform: "web", bucket: 9, hits: 2 }, { platform: "web", bucket: 10, hits: 1 },
      { platform: "web", bucket: 99, hits: 7 },
    ]);
    expect(s.steps.find((x) => x.step === "invite_shown")).toMatchObject({ web: 10, android: 10, total: 20 });
    expect(s.rates).toEqual({ inviteAccepted: 25, welcomePicked: null, viewToCheckout: 50, checkoutToPaid: 50 });
  });
  it("the admin endpoint is admin-only", () => {
    expect(read("src/app/api/admin/funnel/route.ts")).toMatch(/if \(!\(await adminAuthorized\(req\)\)\) return NextResponse\.json\(\{ error: "unauthorized" \}, \{ status: 401 \}\)/);
  });
});
