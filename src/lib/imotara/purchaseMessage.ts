// src/lib/imotara/purchaseMessage.ts
// What the upgrade page says after a web payment.
//
// 🔴 27 Nov 2026 (owner's real ₹49 test): buying a CREDIT pack said "Plan activated! You are
// now on PLUS." — it named the person's existing plan instead of what they had just bought.
// A credit pack now says how many credits were added (and the new total when the server
// sent it); a plan still says the plan.
import { PRODUCT_CATALOG } from "@/lib/imotara/pricing";

type Confirm = { ok?: boolean; tier?: string | null; tokenBalance?: number | null } | null | undefined;

export function purchaseMessage(productId: string, confirm: Confirm): string {
    const def = (PRODUCT_CATALOG as Record<string, { type: string; tokens?: number }>)[productId];
    const isPack = def?.type === "token_pack";
    if (confirm?.ok) {
        if (isPack) {
            const added = `${def?.tokens ?? ""} message credits added.`.trim();
            const total = typeof confirm.tokenBalance === "number" ? ` You now have ${confirm.tokenBalance}.` : "";
            return `${added}${total}`;
        }
        return `Plan activated! You are now on ${confirm.tier?.toUpperCase() ?? "your new plan"}.`;
    }
    return isPack
        ? "Payment received. Your credits will be added within a minute."
        : "Payment received. Your plan will activate within a minute.";
}
