// src/__tests__/billing/ngoPilotPath.test.ts
// 🔑 #132 F part 2 (12 Nov 2026): an NGO can start a FREE 30-day pilot set up by the admin, and pay
// afterwards by bank transfer / UPI against a hand-written invoice.
//   · the pilot is an org with an end date — resolve_user_tier already ignores an expired org
//   · the invoice is a payment_invoices row: gateway "manual", "due" until paid, owner sees it in Settings
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
vi.mock("server-only", () => ({}));
import { pilotWindow, pilotNote, PILOT_DAYS } from "@/lib/imotara/orgPilot";
import { buildManualInvoice, MANUAL_GATEWAY } from "@/lib/imotara/manualInvoice";
import { renderInvoiceHtml } from "@/lib/imotara/invoiceUtils";

const ORG = { id: "org-1", slug: "zz-test-ngo", tier: "enterprise", ownerUserId: "user-1" };
const NOW = new Date("2026-11-12T05:30:00Z");

describe("the pilot window", () => {
  it("30 days from today, as the admin form's dates", () => {
    expect(PILOT_DAYS).toBe(30);
    expect(pilotWindow(NOW)).toEqual({ start: "2026-11-12", end: "2026-12-12" });
  });
  it("crosses a month and a year correctly", () => {
    expect(pilotWindow(new Date("2026-12-20T10:00:00Z")).end).toBe("2027-01-19");
  });
  it("the note says what happens at the end", () => {
    const n = pilotNote(pilotWindow(NOW));
    expect(n).toContain("2026-12-12");
    expect(n).toMatch(/own plan/);
  });
  it("⛔ nothing new is enforced — the database already drops an expired org", () => {
    const sql = readFileSync("docs/sql/resolve_user_tier_canonical.sql", "utf8");
    expect(sql).toContain("and (o.expires_at is null or o.expires_at > now())");
  });
});

describe("a hand-written invoice", () => {
  const ok = (input: Record<string, unknown>) => {
    const r = buildManualInvoice(input, ORG, NOW);
    if (!r.ok) throw new Error(r.error);
    return r.row;
  };
  it("due by default, issued to the owner, tagged with the org, no GST", () => {
    const row = ok({ description: "Imotara NGO licence · 25 seats · 12 months", amount_inr: 19975 });
    expect(row).toMatchObject({ user_id: "user-1", org_id: "org-1", status: "due", payment_gateway: MANUAL_GATEWAY, amount_paise: 1_997_500, currency: "INR", product_id: "org_manual" });
    expect(row.gateway_ref).toBe("MANUAL-zz-test-ngo-20261112053000");
  });
  it("paid needs — and carries — the bank reference", () => {
    expect(buildManualInvoice({ description: "x", amount_inr: 100, status: "paid" }, ORG, NOW)).toMatchObject({ ok: false });
    expect(ok({ description: "x", amount_inr: 100, status: "paid", reference: "UTR123" }).gateway_ref).toBe("UTR123");
  });
  it.each([
    ["no owner", { description: "x", amount_inr: 1 }, { ...ORG, ownerUserId: null }],
    ["no description", { description: "  ", amount_inr: 1 }, ORG],
    ["zero amount", { description: "x", amount_inr: 0 }, ORG],
    ["not a number", { description: "x", amount_inr: "abc" }, ORG],
    ["an extra zero", { description: "x", amount_inr: 20_000_000 }, ORG],
    ["a bad date", { description: "x", amount_inr: 1, period_start: "12/11/2026" }, ORG],
    ["a period that ends first", { description: "x", amount_inr: 1, period_start: "2026-12-01", period_end: "2026-11-01" }, ORG],
  ])("refused: %s", (_n, input, org) => {
    expect(buildManualInvoice(input, org, NOW).ok).toBe(false);
  });
});

describe("what the organisation reads", () => {
  const base = {
    invoice_number: "INV-001234", description: "Imotara NGO licence · 25 seats", amount_paise: 1_997_500, currency: "INR",
    payment_gateway: "manual", gateway_ref: "MANUAL-zz-test-ngo-20261112053000", issued_at: NOW.toISOString(),
    user_email: "owner@ngo.example", billed_to_org: "ZZ Test NGO",
  };
  it("a DUE invoice says Invoice and Amount due — never a receipt", () => {
    const html = renderInvoiceHtml({ ...base, status: "due" });
    expect(html).toContain(">Invoice<");
    expect(html).toContain("Amount due");
    expect(html).not.toContain("Total paid");
    expect(html).not.toContain("Payment Receipt");
    expect(html).toContain("ZZ Test NGO");
    expect(html).toContain("M/S IMOTARA");
    expect(html).not.toMatch(/\bGST\b/);
  });
  it("once PAID it is a receipt with the bank reference", () => {
    const html = renderInvoiceHtml({ ...base, status: "paid", gateway_ref: "UTR123" });
    expect(html).toContain("Payment Receipt");
    expect(html).toContain("Total paid");
    expect(html).toContain("Bank transfer / UPI");
    expect(html).toContain("UTR123");
  });
  it("what the admin typed cannot inject markup", () => {
    const html = renderInvoiceHtml({ ...base, status: "due", description: "<script>x</script>" });
    expect(html).not.toContain("<script>x</script>");
  });
});

describe("⛔ mark-paid can only touch a due, hand-written invoice of that org", () => {
  it("the PATCH is fenced on all four", () => {
    const route = readFileSync("src/app/api/admin/organizations/[orgId]/invoices/route.ts", "utf8");
    const patch = route.slice(route.indexOf("export async function PATCH"));
    for (const fence of ['.eq("id", body.invoiceId)', '.eq("org_id", orgId)', '.eq("payment_gateway", MANUAL_GATEWAY)', '.eq("status", "due")']) {
      expect(patch).toContain(fence);
    }
    expect(patch.indexOf("requireSuperAdmin(")).toBeLessThan(patch.indexOf(".update("));
  });
});

describe("🔴 found in the 12 Nov live run: a brand-new owner was never recorded on the org", () => {
  it("creating an org records the owner the invite just created", () => {
    const route = readFileSync("src/app/api/admin/organizations/route.ts", "utf8");
    const after = route.slice(route.indexOf("ownerProvisioned = provision.ok;"));
    expect(after).toMatch(/if \(provision\.ok && !ownerUserId\)[\s\S]{0,200}owner_user_id: provision\.data\.userId/);
  });
  it("an invoice for an older org falls back to its active owner member", () => {
    const route = readFileSync("src/app/api/admin/organizations/[orgId]/invoices/route.ts", "utf8");
    expect(route).toMatch(/\.eq\("role", "owner"\)\.eq\("status", "active"\)/);
  });
});

describe("🔴 found in the 12 Nov live run: changing the org's end date changed nothing for members", () => {
  const route = readFileSync("src/app/api/admin/organizations/[orgId]/route.ts", "utf8");
  const patch = route.slice(route.indexOf("export async function PATCH"), route.indexOf("export async function DELETE"));
  it("the end date before the edit is read BEFORE the update", () => {
    expect(patch.indexOf('select("tier, expires_at")')).toBeGreaterThan(-1);
    expect(patch.indexOf('select("tier, expires_at")')).toBeLessThan(patch.indexOf(".update(update)"));
  });
  it("only licences the org GRANTED move: this org, source org, same tier, same old date", () => {
    const i = patch.indexOf("end-date propagation");
    const block = patch.slice(patch.indexOf("if (body.expires_at !== undefined && before"), i);
    for (const fence of ['.eq("org_id", orgId)', '.eq("source", "org")', '.eq("tier", before.tier)', 'granted.eq("expires_at", before.expires_at)']) {
      expect(block).toContain(fence);
    }
  });
  it("it runs before the floor sync, so that sync reads the new dates", () => {
    expect(patch.indexOf("end-date propagation")).toBeLessThan(patch.indexOf("const tierChanged"));
  });
});
