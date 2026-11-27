// 27 Nov 2026 (owner's real ₹49 test): a CREDIT pack said "Plan activated! You are now on PLUS."
import { describe, it, expect } from "vitest";
import { purchaseMessage } from "@/lib/imotara/purchaseMessage";

describe("what the upgrade page says after paying", () => {
  it("credit pack, confirmed ⇒ credits added + new total", () => {
    expect(purchaseMessage("tokens_100", { ok: true, tier: "plus", tokenBalance: 200 }))
      .toBe("100 message credits added. You now have 200.");
    expect(purchaseMessage("tokens_1800", { ok: true, tier: "free" })).toBe("1800 message credits added.");
  });
  it("credit pack never names a plan", () => {
    expect(purchaseMessage("tokens_250", { ok: true, tier: "plus", tokenBalance: 5 })).not.toMatch(/PLUS|Plan/);
  });
  it("credit pack, not yet confirmed ⇒ credits, not plan", () => {
    expect(purchaseMessage("tokens_100", { ok: false })).toBe("Payment received. Your credits will be added within a minute.");
  });
  it("plan purchase is unchanged", () => {
    expect(purchaseMessage("plus_monthly", { ok: true, tier: "plus" })).toBe("Plan activated! You are now on PLUS.");
    expect(purchaseMessage("plus_annual", null)).toBe("Payment received. Your plan will activate within a minute.");
  });
});
