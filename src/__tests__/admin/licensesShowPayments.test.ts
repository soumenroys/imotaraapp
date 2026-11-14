// #139 (owner, 14 Nov 2026): Admin → Licenses shows "Amount paid" (what the
// customer paid, in their currency) and "Payment date" (latest payment);
// free / grandfathered / manual licences show "—".
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatMoney, summarisePayments } from "@/lib/admin/paymentsSummary";

describe("summarisePayments", () => {
  it("the latest payment is the headline; count and total across all", () => {
    const m = summarisePayments([
      { user_id: "a", amount_paise: 9900, currency: "INR", granted_at: "2026-05-25T10:00:00Z" },
      { user_id: "a", amount_paise: 14900, currency: "INR", granted_at: "2026-10-29T10:00:00Z" },
      { user_id: "b", amount_paise: 499, currency: "usd", granted_at: "2026-11-01T10:00:00Z" },
    ]);
    expect(m.get("a")).toEqual({ lastAmountMinor: 14900, lastCurrency: "INR", lastPaidAt: "2026-10-29T10:00:00Z", count: 2, totalMinor: 24800 });
    expect(m.get("b")?.lastCurrency).toBe("USD");
    expect(m.get("b")?.count).toBe(1);
  });

  it("mixed currencies: no misleading total", () => {
    const m = summarisePayments([
      { user_id: "a", amount_paise: 9900, currency: "INR", granted_at: "2026-05-25T10:00:00Z" },
      { user_id: "a", amount_paise: 499, currency: "USD", granted_at: "2026-10-29T10:00:00Z" },
    ]);
    expect(m.get("a")?.totalMinor).toBeNull();
    expect(m.get("a")?.lastCurrency).toBe("USD");
  });

  it("rows without a person are ignored; a person with no rows is absent", () => {
    const m = summarisePayments([{ user_id: null, amount_paise: 100, currency: "INR", granted_at: "2026-01-01T00:00:00Z" }]);
    expect(m.size).toBe(0);
  });

  it("formats money as the customer saw it", () => {
    expect(formatMoney(14900, "INR")).toMatch(/149\.00/);
    expect(formatMoney(14900, "INR")).toMatch(/₹/);
    expect(formatMoney(499, "USD")).toMatch(/4\.99/);
  });
});

describe("wiring", () => {
  const route = readFileSync(join(process.cwd(), "src/app/api/admin/licenses/route.ts"), "utf8");
  const page = readFileSync(join(process.cwd(), "src/app/admin/page.tsx"), "utf8");
  it("every list path (v6, v5, v4) adds payments", () => {
    expect(route.match(/await withPayments\(supabase,/g)?.length).toBe(3);
  });
  it("reads payment_licenses (the complete record), one query per page", () => {
    expect(route).toMatch(/\.from\("payment_licenses"\)[\s\S]*?\.in\("user_id", ids\)/);
    expect(route).not.toMatch(/\.from\("payment_invoices"\)/);
  });
  it("the row shows both labels, and '—' for people who never paid", () => {
    expect(page).toMatch(/Amount paid \{formatMoney\(user\.payment\.lastAmountMinor/);
    expect(page).toMatch(/Payment date \$\{fmtDate\(user\.payment\.lastPaidAt\)\}/);
    expect(page).toMatch(/"Amount paid — · Payment date —"/);
  });
});
