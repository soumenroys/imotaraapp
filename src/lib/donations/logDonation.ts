// src/lib/donations/logDonation.ts
import { supabaseServer } from "@/lib/supabaseServer";

type DonationReceipt = {
    paymentId: string;
    orderId?: string;
    amount: number; // paise
    currency: string; // INR
    status: "captured" | "paid";
    createdAt: number;
    source: "razorpay";
    rawEvent?: any;

    // Optional (future): if you ever map donation to a logged-in user
    userId?: string | null;

    // Optional free-form note
    note?: string;
};

/**
 * Logs donation receipt.
 * - Writes to `donations` (upsert) for idempotency
 * - Writes to `billing_events` (insert) as audit trail (skip if already logged)
 * - Keeps the structured server log for visibility
 */
export async function logDonation(receipt: DonationReceipt) {
    try {
        // ✅ Always keep a structured log (useful even if DB insert fails)
        console.log("💚 Donation received", {
            paymentId: receipt.paymentId,
            orderId: receipt.orderId,
            amount: receipt.amount,
            currency: receipt.currency,
            status: receipt.status,
            createdAt: new Date(receipt.createdAt).toISOString(),
            source: receipt.source,
            userId: receipt.userId ?? null,
        });

        const isTest = (process.env.RAZORPAY_KEY_ID || "").includes("_test");

        // 1) Upsert into donations (idempotent on provider + payment id)
        const donationRow = {
            user_id: receipt.userId ?? null,
            provider: receipt.source, // 'razorpay'
            event_type: receipt.rawEvent?.event ?? null,
            razorpay_payment_id: receipt.paymentId,
            razorpay_order_id: receipt.orderId ?? null,
            razorpay_signature: null, // not stored (webhook signature verified already)
            amount_paise: receipt.amount,
            currency: (receipt.currency || "INR").toUpperCase(),
            status: receipt.status, // 'captured' | 'paid'
            is_test: isTest,
            note: receipt.note ?? null,
            metadata: receipt.rawEvent ? { rawEvent: receipt.rawEvent } : {},
        };

        const upsertRes = await supabaseServer
            .from("donations")
            .upsert(donationRow, {
                onConflict: "provider,razorpay_payment_id",
            })
            .select("id")
            .single();

        if (upsertRes.error) {
            console.error("Failed to upsert donations:", upsertRes.error);
            return { ok: false };
        }

        const donationId = upsertRes.data?.id as string | undefined;

        // 2) Insert billing event (skip if duplicate)
        // Since we didn't add a unique constraint on billing_events,
        // we do a small "exists" check to keep it idempotent.
        const eventType = receipt.rawEvent?.event || "donation";

        const existing = await supabaseServer
            .from("billing_events")
            .select("id")
            .eq("provider", receipt.source)
            .eq("provider_payment_id", receipt.paymentId)
            .eq("event_type", eventType)
            .limit(1)
            .maybeSingle();

        if (!existing.error && existing.data?.id) {
            // already logged
            return { ok: true, donationId, billingEventId: existing.data.id };
        }

        const billingRow = {
            user_id: receipt.userId ?? null,
            event_type: eventType, // e.g. 'payment.captured' / 'order.paid'
            provider: receipt.source, // 'razorpay'
            status: "success",
            amount_paise: receipt.amount,
            currency: (receipt.currency || "INR").toUpperCase(),
            provider_order_id: receipt.orderId ?? null,
            provider_payment_id: receipt.paymentId,
            provider_subscription_id: null,
            donation_id: donationId ?? null,
            entitlement_id: null,
            message: "Donation received",
            metadata: receipt.rawEvent ? { rawEvent: receipt.rawEvent } : {},
        };

        const insertEvent = await supabaseServer
            .from("billing_events")
            .insert(billingRow)
            .select("id")
            .single();

        if (insertEvent.error) {
            console.error("Failed to insert billing_events:", insertEvent.error);
            return { ok: false, donationId };
        }

        return { ok: true, donationId, billingEventId: insertEvent.data?.id };
    } catch (err) {
        console.error("Failed to log donation receipt:", err);
        return { ok: false };
    }
}
