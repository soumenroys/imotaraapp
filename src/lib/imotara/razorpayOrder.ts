// src/lib/imotara/razorpayOrder.ts
//
// #172 security (27 Nov 2026): what a Razorpay payment is FOR comes from the ORDER our server
// created — never from the browser.
//
// 🔴 Before this, two holes:
//   • verify-payment believed the productId the browser sent, and never compared the amount ⇒
//     pay ₹49 (or a ₹1 donation / Connect recharge), claim "plus_annual", get a year of Plus.
//   • the webhook read the PAYMENT's notes first. Checkout lets the PAYER set those notes, so a
//     small donation could carry {purpose:"imotara_corporate", seats:"500", userId:<self>}.
//     And our own checkout notes carry no userId, so the webhook could never grant a licence —
//     it was no safety net at all.
//
// ✅ Orders are created only by our server (order-intent, corporate, donation-intent,
// connect recharge), with the buyer, the product and the amount in their notes. A payment
// counts only for the order it belongs to, and only if it paid that order's amount.

import { isValidProductId, type LicenseProductId } from "@/lib/imotara/grantLicense";

export type RzpOrder = {
    id: string;
    amount: number;
    currency: string;
    status?: string;
    notes?: Record<string, string> | unknown[];
};

export type RzpPaymentLike = {
    id?: string;
    order_id?: string | null;
    amount?: number;
    currency?: string;
    status?: string;
};

const ORDER_ID = /^order_[A-Za-z0-9]+$/;

/** Order notes as a plain object (Razorpay sends `[]` for "no notes"). */
export function orderNotes(order: RzpOrder | null | undefined): Record<string, string> {
    const n = order?.notes;
    return n && !Array.isArray(n) && typeof n === "object" ? (n as Record<string, string>) : {};
}

/** Fetch an order from Razorpay. null on any failure — callers must treat that as "not verified". */
export async function fetchRzpOrder(orderId: string | null | undefined): Promise<RzpOrder | null> {
    const keyId = process.env.RAZORPAY_KEY_ID ?? "";
    const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
    if (!keyId || !secret || !orderId || !ORDER_ID.test(orderId)) return null;
    try {
        const res = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
            headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}` },
        });
        if (!res.ok) return null;
        return (await res.json()) as RzpOrder;
    } catch {
        return null;
    }
}

/** The payment belongs to this order and paid its full amount, in its currency. */
export function paymentMatchesOrder(payment: RzpPaymentLike | null | undefined, order: RzpOrder | null | undefined): boolean {
    if (!payment || !order) return false;
    return (
        typeof payment.order_id === "string" && payment.order_id === order.id &&
        typeof payment.amount === "number" && payment.amount > 0 && payment.amount === order.amount &&
        String(payment.currency ?? "").toUpperCase() === String(order.currency ?? "").toUpperCase()
    );
}

export type LicenseFromOrder =
    | { ok: true; productId: LicenseProductId; userId: string }
    | { ok: false; reason: "not_a_licence_order" | "unknown_product" | "no_buyer" | "other_buyer" | "amount_mismatch" };

/**
 * Which licence a payment buys, decided ONLY by the server-made order.
 * `expectedUserId` (the signed-in caller) must be the order's buyer when given.
 */
export function licenseFromOrder(
    order: RzpOrder | null | undefined,
    payment: RzpPaymentLike | null | undefined,
    expectedUserId?: string,
): LicenseFromOrder {
    const notes = orderNotes(order);
    if (notes.purpose !== "imotara_license") return { ok: false, reason: "not_a_licence_order" };
    const productId = String(notes.productId ?? "").trim();
    if (!isValidProductId(productId)) return { ok: false, reason: "unknown_product" };
    const buyer = String(notes.userId ?? "").trim();
    if (!buyer) return { ok: false, reason: "no_buyer" };
    if (expectedUserId !== undefined && buyer !== expectedUserId) return { ok: false, reason: "other_buyer" };
    if (!paymentMatchesOrder(payment, order)) return { ok: false, reason: "amount_mismatch" };
    return { ok: true, productId: productId as LicenseProductId, userId: buyer };
}
