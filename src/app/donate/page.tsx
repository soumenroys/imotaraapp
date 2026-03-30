"use client";

import { useEffect, useState } from "react";

declare global {
    interface Window {
        Razorpay?: any;
    }
}

type DonationIntentResponse = {
    ok: boolean;
    error?: string;
    razorpay?: {
        orderId: string;
        keyId: string;
        amount: number;
        currency: string;
    };
};

type LocalDonationReceipt = {
    paymentId: string;
    orderId?: string;
    amount: number;
    currency: string;
    timestamp: number;
};

const LOCAL_DONATIONS_KEY = "imotara.donations.v1";

function saveLocalDonation(receipt: LocalDonationReceipt) {
    try {
        const raw = window.localStorage.getItem(LOCAL_DONATIONS_KEY);
        const existing: LocalDonationReceipt[] = raw ? JSON.parse(raw) : [];
        const deduped = existing.filter((r) => r.paymentId !== receipt.paymentId);
        const updated = [receipt, ...deduped].slice(0, 20);
        window.localStorage.setItem(LOCAL_DONATIONS_KEY, JSON.stringify(updated));
    } catch {
        // ignore quota errors
    }
}

function loadRazorpayScript(): Promise<boolean> {
    if (typeof window === "undefined") return Promise.resolve(false);
    if (window.Razorpay) return Promise.resolve(true);

    return new Promise((resolve) => {
        const existing = document.querySelector(
            'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
        ) as HTMLScriptElement | null;
        if (existing) {
            existing.addEventListener("load", () => resolve(true));
            return;
        }
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });
}

const DONATION_PRESETS = [
    { id: "inr_49", label: "₹49", amount: 4900 },
    { id: "inr_99", label: "₹99", amount: 9900 },
    { id: "inr_199", label: "₹199", amount: 19900 },
    { id: "inr_499", label: "₹499", amount: 49900 },
    { id: "inr_999", label: "₹999", amount: 99900 },
] as const;

export default function DonatePage() {
    const [rzReady, setRzReady] = useState(false);
    const [donating, setDonating] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        loadRazorpayScript()
            .then((ok) => setRzReady(!!ok))
            .catch(() => setRzReady(false));
    }, []);

    async function handleDonate(presetId: string, presetLabel: string, presetAmount: number) {
        if (donating) return;
        try {
            setDonating(true);
            setStatus(null);

            if (!window.Razorpay) {
                const ok = await loadRazorpayScript();
                if (!ok) {
                    setStatus("Checkout is loading. Please try again in a moment.");
                    return;
                }
            }

            const res = await fetch("/api/payments/donation-intent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    presetId,
                    purpose: "imotara_donation",
                    platform: "web",
                }),
            });

            const json = (await res.json()) as DonationIntentResponse;

            if (!res.ok || !json.ok || !json.razorpay) {
                setStatus(json?.error || "Donation order failed. Please try again.");
                return;
            }

            const rz = json.razorpay;

            const options: any = {
                key: rz.keyId,
                amount: rz.amount,
                currency: rz.currency || "INR",
                name: "Imotara",
                description:
                    "Support Imotara (UPI preferred) — privacy-first, non-commercial Indian initiative",
                order_id: rz.orderId,
                method: {
                    upi: true,
                    card: true,
                    netbanking: true,
                    wallet: false,
                },
                notes: { purpose: "imotara_donation" },
                theme: { color: "#38bdf8" },
                handler: function (response: any) {
                    const pid = response?.razorpay_payment_id as string | undefined;
                    if (pid && rz.amount) {
                        saveLocalDonation({
                            paymentId: pid,
                            orderId: rz.orderId,
                            amount: rz.amount,
                            currency: rz.currency || "INR",
                            timestamp: Date.now(),
                        });
                    }
                    setStatus("Thank you for supporting Imotara \uD83D\uDE4F Payment confirmed.");
                },
                modal: {
                    ondismiss: function () {
                        setStatus("Checkout closed. No payment was made.");
                    },
                },
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.on("payment.failed", function (resp: any) {
                const msg =
                    resp?.error?.description ||
                    resp?.error?.reason ||
                    "Please try again.";
                setStatus(`Payment failed. ${msg}`);
            });
            rzp.open();
        } catch (e: any) {
            setStatus(e?.message || "Something went wrong. Please try again.");
        } finally {
            setDonating(false);
        }
    }

    return (
        <main className="mx-auto w-full max-w-lg px-4 py-16 text-zinc-50 sm:px-6">
            <div className="imotara-glass-card rounded-2xl px-5 py-8 sm:px-8 sm:py-10">
                <h1 className="text-lg font-semibold text-zinc-50 sm:text-xl">
                    Support Imotara
                </h1>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Imotara is privacy-first and non-commercial. Your donation helps keep it
                    running and improving. UPI preferred.
                </p>

                {!rzReady && (
                    <p className="mt-4 text-xs text-zinc-500">Loading checkout…</p>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                    {DONATION_PRESETS.map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => handleDonate(p.id, p.label, p.amount)}
                            disabled={donating || !rzReady}
                            className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-zinc-100 shadow-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {donating ? "Opening…" : p.label}
                        </button>
                    ))}
                </div>

                {status && (
                    <p className="mt-5 text-sm text-zinc-300">{status}</p>
                )}

                <p className="mt-6 text-[11px] text-zinc-500">
                    Payment is processed securely via Razorpay. Final confirmation is recorded
                    after payment via secure webhook.
                </p>
            </div>
        </main>
    );
}
