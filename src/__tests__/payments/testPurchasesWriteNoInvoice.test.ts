// 28 Nov 2026 (owner's TestFlight test): a FREE test-store purchase wrote a real-looking invoice
// (INV-001020, ₹49 INR). Test purchases — Apple sandbox, Play licence tester — are still granted
// and recorded (currency SANDBOX), but never invoiced. Also: no hard-coded "USD" anywhere.
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("test purchases are not invoiced", () => {
  it("Apple: sandbox ⇒ no createInvoice", () => {
    const s = read("src/app/api/license/verify-apple-purchase/route.ts");
    expect(s).toMatch(/if \(!isSandbox\) createInvoice\(admin, \{/);
  });
  it("Play verify: licence tester ⇒ SANDBOX record, no invoice", () => {
    const s = read("src/app/api/payments/google-play/verify/route.ts");
    expect(s).toMatch(/currency:\s+verification\.isTest \? "SANDBOX" : paid\.currency,/);
    expect(s).toMatch(/if \(!verification\.isTest\) createInvoice\(admin, \{/);
  });
  it("Play renewal: tester ⇒ no invoice; never a false USD", () => {
    const s = read("src/lib/imotara/playRenewal.ts");
    expect(s).toMatch(/if \(verification\.orderId && !verification\.isTest\) \{/);
    expect(s).not.toMatch(/currency:\s*"USD"/);
  });
  it("Google tells us: products purchaseType 0 / subscriptions testPurchase", () => {
    const s = read("src/lib/googlePlay.ts");
    expect(s).toMatch(/isTest: data\.purchaseType === 0/);
    expect(s).toMatch(/isTest:\s+data\.testPurchase != null,/);
  });
});
