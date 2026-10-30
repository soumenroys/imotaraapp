// src/__tests__/broadcast/deliveryReportsAreNotLost.test.ts
// 🔴 30 Oct 2026: 71 broadcast sends stayed at "sent" — Resend said 52 were
// delivered and 5 bounced. The reports reached the webhook before the queue
// had written their row, and were acknowledged and dropped. 5 of 11 recent
// bounces went to domains with no mail server at all.
//   ⇒ an early report is asked to come back · lost ones are fetched ·
//     a domain with no mail server is not mailed.

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EARLY_REPORT_MINUTES, reconcileSent, retryUnmatched, statusFromLastEvent } from "@/lib/broadcast/deliveryReports";
import { domainsWithoutMail, type Resolver } from "@/lib/broadcast/mailDomains";

const NOW = new Date("2026-10-30T14:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

describe("🔑 a report that arrives before its row is asked to come back", () => {
  it("a young one is retried", () => expect(retryUnmatched(minutesAgo(0.05), NOW)).toBe(true));
  it(`one older than ${EARLY_REPORT_MINUTES} min is really not ours (sign-in mail, wallet) — acknowledged`, () =>
    expect(retryUnmatched(minutesAgo(EARLY_REPORT_MINUTES + 1), NOW)).toBe(false));
  it("no timestamp ⇒ acknowledged, never retried for days", () => expect(retryUnmatched(undefined, NOW)).toBe(false));

  const src = readFileSync(join(process.cwd(), "src/app/api/webhooks/resend/route.ts"), "utf8");
  it("the webhook answers 503 on that path — and still records the suppression first", () => {
    const block = src.slice(src.indexOf("if (!row) {"), src.indexOf("const email = row.email ?? to;"));
    const suppress = block.indexOf("broadcast_suppressions");
    const retry = block.indexOf("retryUnmatched(");
    const ack = block.lastIndexOf("return NextResponse.json({ ok: true, unmatched");
    expect(suppress).toBeGreaterThan(0);
    expect(retry).toBeGreaterThan(suppress);
    expect(ack).toBeGreaterThan(retry); // the retry is reached BEFORE the acknowledgement
    expect(block).toMatch(/status: 503/);
  });
});

describe("Resend's last event ⇒ our row", () => {
  it.each([
    ["delivered", "delivered"], ["opened", "delivered"], ["clicked", "delivered"],
    ["bounced", "bounced"], ["suppressed", "bounced"], ["complained", "complained"],
    ["sent", null], ["delivery_delayed", null], [undefined, null],
  ] as const)("%s → %s", (ev, want) => expect(statusFromLastEvent(ev)).toBe(want));
});

describe("🔑 a domain with no mail server is not mailed", () => {
  const err = (code: string) => Object.assign(new Error(code), { code });
  const resolver = (table: Record<string, { mx?: string; a?: string }>): Resolver => ({
    mx: async (d) => { const r = table[d]?.mx; if (r === "ok") return [{}]; throw err(r ?? "ENOTFOUND"); },
    a: async (d) => { const r = table[d]?.a; if (r === "ok") return ["1.2.3.4"]; throw err(r ?? "ENOTFOUND"); },
  });

  it("no MX and no address ⇒ dead (the 30 Oct cottagesofcarmel.com kind)", async () => {
    const dead = await domainsWithoutMail(["info@cottagesofcarmel.com", "a@gmail.com"], resolver({ "gmail.com": { mx: "ok" } }));
    expect([...dead]).toEqual(["cottagesofcarmel.com"]);
  });
  it("no MX but an A record can still take mail ⇒ kept", async () => {
    expect((await domainsWithoutMail(["x@old.example"], resolver({ "old.example": { mx: "ENODATA", a: "ok" } }))).size).toBe(0);
  });
  it("⛔ OUR DNS failing is not their domain dying ⇒ kept", async () => {
    expect((await domainsWithoutMail(["x@slow.example"], resolver({ "slow.example": { mx: "ETIMEOUT" } }))).size).toBe(0);
    expect((await domainsWithoutMail(["x@half.example"], resolver({ "half.example": { mx: "ENOTFOUND", a: "ESERVFAIL" } }))).size).toBe(0);
  });
  it("each domain is looked up once, whatever its case", async () => {
    const mx = vi.fn(async () => [{}]);
    await domainsWithoutMail(["a@X.org", "b@x.org", "c@x.ORG"], { mx, a: async () => [] });
    expect(mx).toHaveBeenCalledTimes(1);
  });

  it("the queue checks BEFORE it sends", () => {
    const q = readFileSync(join(process.cwd(), "src/app/api/cron/broadcast-queue/route.ts"), "utf8");
    expect(q.indexOf("domainsWithoutMail(")).toBeGreaterThan(0);
    expect(q.indexOf("domainsWithoutMail(")).toBeLessThan(q.indexOf("await sendBatch("));
  });
});

describe("🔑 reports that never arrived are fetched", () => {
  type Row = { id: string; email: string; resend_id: string };
  function fakeDb(rows: Row[]) {
    const updates: { id: string; patch: Record<string, unknown> }[] = [];
    const chain = {
      select: () => chain, eq: () => chain, not: () => chain, is: () => chain, lt: () => chain, gt: () => chain, order: () => chain,
      limit: async () => ({ data: rows }),
    };
    const db = {
      from: () => ({
        ...chain,
        update: (patch: Record<string, unknown>) => ({ eq: (_k: string, id: string) => ({ eq: async () => { updates.push({ id, patch }); return {}; } }) }),
      }),
    };
    return { db: db as never, updates };
  }

  it("delivered and bounced are written; an unsettled one is marked so it is not asked again", async () => {
    const { db, updates } = fakeDb([
      { id: "1", email: "a@x.org", resend_id: "r1" },
      { id: "2", email: "b@x.org", resend_id: "r2" },
      { id: "3", email: "c@x.org", resend_id: "r3" },
    ]);
    const answers: Record<string, string> = { r1: "delivered", r2: "bounced", r3: "sent" };
    vi.stubGlobal("fetch", async (url: string) => new Response(JSON.stringify({ last_event: answers[url.split("/").pop()!] }), { status: 200 }));
    const fixed = await reconcileSent(db, 3, NOW, "key");
    vi.unstubAllGlobals();
    expect(fixed).toBe(2);
    expect(updates.find((u) => u.id === "1")?.patch).toMatchObject({ status: "delivered" });
    expect(updates.find((u) => u.id === "2")?.patch).toMatchObject({ status: "bounced" });
    expect(String(updates.find((u) => u.id === "3")?.patch.error)).toMatch(/^reconcile: no final report/);
  });

  it("⛔ never throws — a broadcast must still go out", async () => {
    const db = { from: () => { throw new Error("db down"); } } as never;
    await expect(reconcileSent(db, 3, NOW, "key")).resolves.toBe(0);
  });

  it("the queue job runs it every tick", () => {
    const q = readFileSync(join(process.cwd(), "src/app/api/cron/broadcast-queue/route.ts"), "utf8");
    expect(q).toMatch(/await reconcileSent\(supabase\)/);
  });
});
