"use client";

// src/app/upgrade/page.tsx — LIC-8: Pricing + Razorpay checkout for web

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X as XIcon } from "lucide-react";
import useLicense from "@/hooks/useLicense";

declare global {
    interface Window { Razorpay?: any; }
}

// ── Pricing data ──────────────────────────────────────────────────────────────

const SUBSCRIPTION_PLANS = [
    {
        id: "free",
        name: "Free",
        monthlyPaise: 0,
        annualPaise: 0,
        features: ["20 AI replies/day", "On-device replies (unlimited)", "7-day cloud history"],
        cta: "Current plan",
        accent: "zinc",
    },
    {
        id: "plus",
        name: "Plus",
        monthlyId: "plus_monthly",
        annualId:  "plus_annual",
        monthlyPaise: 7_900,
        annualPaise:  69_900,
        features: ["Unlimited AI replies", "90-day cloud history", "Companion mode", "Priority support"],
        cta: "Subscribe",
        accent: "sky",
    },
    {
        id: "pro",
        name: "Pro",
        monthlyId: "pro_monthly",
        annualId:  "pro_annual",
        monthlyPaise: 14_900,
        annualPaise:  119_900,
        features: ["Everything in Plus", "Unlimited history", "Early access features", "Higher daily limits"],
        cta: "Subscribe",
        accent: "indigo",
    },
] as const;

const TOKEN_PACKS = [
    { id: "tokens_100",  paise: 4_900,  tokens: 100,  label: "₹49",  desc: "100 AI messages" },
    { id: "tokens_250",  paise: 9_900,  tokens: 250,  label: "₹99",  desc: "250 AI messages" },
    { id: "tokens_600",  paise: 19_900, tokens: 600,  label: "₹199", desc: "600 AI messages" },
    { id: "tokens_1800", paise: 49_900, tokens: 1800, label: "₹499", desc: "1800 AI messages" },
] as const;

// ── Razorpay script loader ────────────────────────────────────────────────────

function loadRazorpay(): Promise<boolean> {
    if (typeof window === "undefined") return Promise.resolve(false);
    if (window.Razorpay) return Promise.resolve(true);
    return new Promise((resolve) => {
        const existing = document.querySelector(
            'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
        ) as HTMLScriptElement | null;
        if (existing) { existing.addEventListener("load", () => resolve(true)); return; }
        const s = document.createElement("script");
        s.src   = "https://checkout.razorpay.com/v1/checkout.js";
        s.async = true;
        s.onload  = () => resolve(true);
        s.onerror = () => resolve(false);
        document.head.appendChild(s);
    });
}

function fmt(paise: number) {
    return `₹${Math.round(paise / 100)}`;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function UpgradePage() {
    const license = useLicense();
    const [annual, setAnnual] = useState(false);
    const [busy,   setBusy]   = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
    const [rzReady, setRzReady] = useState(false);

    useEffect(() => {
        loadRazorpay().then(setRzReady).catch(() => setRzReady(false));
    }, []);

    async function checkout(productId: string, description: string) {
        if (busy) return;
        setBusy(productId);
        setStatus(null);
        try {
            if (!window.Razorpay) {
                const ok = await loadRazorpay();
                if (!ok) { setStatus({ type: "error", msg: "Checkout not available. Please try again." }); return; }
            }

            const res  = await fetch("/api/license/order-intent", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId }),
            });
            const json = await res.json();

            if (!res.ok || !json.ok) {
                if (res.status === 401) {
                    setStatus({ type: "error", msg: "You need to sign in first. Go to /chat and sign in, then come back here." });
                } else {
                    setStatus({ type: "error", msg: json?.error || "Could not create order. Please try again." });
                }
                return;
            }

            const rz = json.razorpay;
            const options: any = {
                key:         rz.keyId,
                amount:      rz.amount,
                currency:    rz.currency || "INR",
                name:        "Imotara",
                description,
                order_id:    rz.orderId,
                method:      { upi: true, card: true, netbanking: true, wallet: false },
                notes:       { purpose: "imotara_license", productId },
                theme:       { color: "#6366f1" },
                handler: async function (response: any) {
                    const paymentId = response?.razorpay_payment_id as string | undefined;
                    if (!paymentId) { setStatus({ type: "error", msg: "Payment ID missing. Contact support." }); return; }
                    // Confirm grant on server
                    const confirm = await fetch("/api/license/verify-payment", {
                        method: "POST",
                        credentials: "same-origin",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ paymentId, productId }),
                    }).then((r) => r.json()).catch(() => ({ ok: false }));
                    if (confirm?.ok) {
                        setStatus({ type: "success", msg: `Plan activated! You are now on ${confirm.tier?.toUpperCase() ?? "your new plan"}.` });
                    } else {
                        setStatus({ type: "success", msg: "Payment received. Your plan will activate within a minute." });
                    }
                },
                modal: { ondismiss: () => setStatus({ type: "error", msg: "Checkout closed. No payment was made." }) },
            };
            const rzp = new (window as any).Razorpay(options);
            rzp.on("payment.failed", (resp: any) => {
                setStatus({ type: "error", msg: resp?.error?.description || "Payment failed. Please try again." });
            });
            rzp.open();
        } catch (e: any) {
            setStatus({ type: "error", msg: e?.message || "Something went wrong. Please try again." });
        } finally {
            setBusy(null);
        }
    }

    const currentTier = license.loading ? null : license.tier;

    return (
        <main className="mx-auto w-full max-w-4xl px-4 py-14 text-zinc-50 sm:px-6">

            {/* Header */}
            <div className="mb-10 text-center">
                <Link href="/chat" className="mb-6 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition">
                    ← Back to chat
                </Link>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Unlock Imotara</h1>
                <p className="mt-2 text-sm text-zinc-400">
                    Local replies are always free. Subscriptions remove the daily AI limit and extend your history.
                </p>
                {currentTier && currentTier !== "free" && (
                    <p className="mt-3 inline-block rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-medium text-indigo-300 border border-indigo-400/20">
                        Current plan: {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
                    </p>
                )}
            </div>

            {/* Monthly / Annual toggle */}
            <div className="mb-8 flex justify-center">
                <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-1 py-1">
                    <button
                        type="button"
                        onClick={() => setAnnual(false)}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${!annual ? "bg-white/15 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}
                    >
                        Monthly
                    </button>
                    <button
                        type="button"
                        onClick={() => setAnnual(true)}
                        className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${annual ? "bg-white/15 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}
                    >
                        Annual
                        <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-400/20">
                            Save ~25%
                        </span>
                    </button>
                </div>
            </div>

            {/* Subscription cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                {SUBSCRIPTION_PLANS.map((plan) => {
                    const isFree     = plan.id === "free";
                    const isCurrent  = currentTier === plan.id || (currentTier === "free" && isFree);
                    const productId  = isFree ? null : (annual ? plan.annualId : plan.monthlyId) as string;
                    const paise      = annual ? plan.annualPaise : plan.monthlyPaise;
                    const isBusy     = !!productId && busy === productId;
                    const isPlus     = plan.id === "plus";
                    const isPro      = plan.id === "pro";

                    return (
                        <div
                            key={plan.id}
                            className={`relative flex flex-col rounded-2xl border p-5 ${isPro
                                ? "border-indigo-400/30 bg-indigo-500/10"
                                : isPlus
                                    ? "border-sky-400/25 bg-sky-500/8"
                                    : "border-white/10 bg-white/5"
                            }`}
                        >
                            {isPro && (
                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                                    Best value
                                </span>
                            )}

                            <h2 className="text-base font-semibold">{plan.name}</h2>

                            <div className="mt-2 mb-4">
                                {isFree ? (
                                    <span className="text-2xl font-bold">Free</span>
                                ) : (
                                    <>
                                        <span className="text-2xl font-bold">{fmt(paise)}</span>
                                        <span className="ml-1 text-xs text-zinc-400">
                                            {annual ? "/yr" : "/mo"}
                                        </span>
                                    </>
                                )}
                            </div>

                            <ul className="flex-1 space-y-2 text-sm text-zinc-300">
                                {plan.features.map((f) => (
                                    <li key={f} className="flex items-start gap-2">
                                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-5">
                                {isFree || isCurrent ? (
                                    <div className="w-full rounded-xl border border-white/10 py-2 text-center text-sm text-zinc-500">
                                        {isCurrent ? "Current plan" : "Always free"}
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={!!busy || !rzReady}
                                        onClick={() => checkout(productId!, `Imotara ${plan.name} ${annual ? "Annual" : "Monthly"}`)}
                                        className={`w-full rounded-xl py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${isPro
                                            ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                                            : "bg-sky-600 hover:bg-sky-500 text-white"
                                        }`}
                                    >
                                        {isBusy ? "Opening…" : plan.cta}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Token packs */}
            <div className="mt-12">
                <h2 className="text-base font-semibold mb-1">Token packs</h2>
                <p className="mb-5 text-sm text-zinc-400">
                    One-time top-ups that never expire. Use them on top of your daily limit.
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {TOKEN_PACKS.map((pack) => {
                        const isBusy = busy === pack.id;
                        return (
                            <button
                                key={pack.id}
                                type="button"
                                disabled={!!busy || !rzReady}
                                onClick={() => checkout(pack.id, `Imotara ${pack.desc}`)}
                                className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 px-3 py-4 text-center transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <span className="text-lg font-bold">{pack.label}</span>
                                <span className="mt-1 text-xs text-zinc-400">{pack.desc}</span>
                                {isBusy && <span className="mt-2 text-xs text-zinc-500">Opening…</span>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Status message */}
            {status && (
                <div className={`mt-8 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
                    status.type === "success"
                        ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                        : "border-red-400/20 bg-red-500/10 text-red-300"
                }`}>
                    <span className="flex-1">{status.msg}</span>
                    <button type="button" onClick={() => setStatus(null)} className="shrink-0 text-zinc-500 hover:text-zinc-300 transition">
                        <XIcon className="h-3.5 w-3.5" />
                    </button>
                    {status.type === "success" && (
                        <Link href="/chat" className="shrink-0 rounded-lg bg-white/10 px-3 py-1 text-xs font-medium hover:bg-white/20 transition">
                            Go to chat →
                        </Link>
                    )}
                </div>
            )}

            {/* Footer note */}
            <p className="mt-10 text-center text-xs text-zinc-600">
                UPI, cards, and netbanking accepted. Processed securely by Razorpay. All prices in INR.
            </p>
        </main>
    );
}
