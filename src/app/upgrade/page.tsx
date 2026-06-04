"use client";

// src/app/upgrade/page.tsx — LIC-8: Pricing + Razorpay checkout for web

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, X as XIcon } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import useLicense from "@/hooks/useLicense";

const PENDING_KEY = "imotara_pending_purchase";
type PendingPurchase = { productId: string; description: string };

function getSupabase() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
}

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
        features: ["20 replies/day", "On-device replies (unlimited)", "7-day cloud history"],
        cta: "Current plan",
        accent: "zinc",
    },
    {
        id: "plus",
        name: "Plus",
        monthlyId: "plus_monthly",
        annualId:  "plus_annual",
        monthlyPaise: 9_900,
        annualPaise:  69_900,
        features: ["Unlimited replies", "90-day cloud history", "Companion mode", "Data export", "Priority support"],
        cta: "Subscribe",
        accent: "sky",
    },
    {
        id: "pro",
        name: "Pro",
        monthlyId: "pro_monthly",
        annualId:  "pro_annual",
        monthlyPaise: 14_900,
        annualPaise:  129_900,
        features: ["Everything in Plus", "Unlimited history", "Early access features", "Higher daily limits"],
        cta: "Subscribe",
        accent: "indigo",
    },
] as const;

const TOKEN_PACKS = [
    { id: "tokens_100",  paise: 4_900,  tokens: 100,  label: "₹49",  desc: "100 message credits" },
    { id: "tokens_250",  paise: 9_900,  tokens: 250,  label: "₹99",  desc: "250 message credits" },
    { id: "tokens_600",  paise: 19_900, tokens: 600,  label: "₹199", desc: "600 message credits" },
    { id: "tokens_1800", paise: 49_900, tokens: 1800, label: "₹499", desc: "1800 message credits" },
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

// ── CompareRow ─────────────────────────────────────────────────────────────────

function Cell({ value }: { value: boolean | string }) {
    if (value === true)  return <span className="text-emerald-400 text-base leading-none" aria-label="included">✓</span>;
    if (value === false) return <span className="text-zinc-600 text-base leading-none" aria-label="not included">—</span>;
    return <span className="text-zinc-300 text-xs font-medium">{value}</span>;
}

function CompareRow({ label, desc, free, plus, pro, ent }: {
    label: string; desc: string;
    free: boolean | string; plus: boolean | string;
    pro: boolean | string;  ent: boolean | string;
}) {
    return (
        <tr className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
            <td className="py-3 px-4">
                <p className="font-medium text-zinc-200 text-xs">{label}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{desc}</p>
            </td>
            <td className="py-3 px-3 text-center"><Cell value={free} /></td>
            <td className="py-3 px-3 text-center"><Cell value={plus} /></td>
            <td className="py-3 px-3 text-center"><Cell value={pro} /></td>
            <td className="py-3 px-3 text-center"><Cell value={ent} /></td>
        </tr>
    );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function UpgradePage() {
    const license = useLicense();
    const [mounted, setMounted] = useState(false);
    const [annual, setAnnual] = useState(false);
    const [busy,   setBusy]   = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
    const [rzReady, setRzReady] = useState(false);
    const [pendingPurchase, setPendingPurchase] = useState<PendingPurchase | null>(null);

    // checkoutRef lets the auth-state listener always call the latest checkout closure
    const checkoutRef = useRef<(productId: string, description: string) => void>(() => {});

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        loadRazorpay().then(setRzReady).catch(() => setRzReady(false));
    }, []);

    // Show error if returning from a failed OAuth attempt (query param or hash fragment)
    useEffect(() => {
        const params   = new URLSearchParams(window.location.search);
        const hash     = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const hasError = params.get("auth_error") || hash.get("error");
        if (hasError) {
            setStatus({ type: "error", msg: "Sign-in failed. Please try again." });
            const clean = new URL(window.location.href);
            clean.searchParams.delete("auth_error");
            clean.hash = "";
            window.history.replaceState({}, "", clean.toString());
        }
    }, []);

    // On mount, check if we're returning from a sign-in that was triggered by a pending purchase
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(PENDING_KEY);
            if (raw) {
                setPendingPurchase(JSON.parse(raw));
                sessionStorage.removeItem(PENDING_KEY);
            }
        } catch {}
    }, []);

    // When a pending purchase is detected, wait for both the session and Razorpay,
    // then auto-trigger checkout. INITIAL_SESSION fires for every new subscriber so
    // it arrives even if initialize() completed before this effect ran.
    useEffect(() => {
        if (!pendingPurchase || !rzReady) return;

        const supabase = getSupabase();
        let triggered = false;

        const trigger = (productId: string, description: string) => {
            if (triggered) return;
            triggered = true;
            setPendingPurchase(null);
            subscription.unsubscribe();
            checkoutRef.current(productId, description);
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session) {
                trigger(pendingPurchase.productId, pendingPurchase.description);
            }
        });

        return () => subscription.unsubscribe();
    }, [pendingPurchase, rzReady]);

    async function checkout(productId: string, description: string) {
        if (busy) return;

        const supabase = getSupabase();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            // Save what the user wanted to buy, then start OAuth.
            // After sign-in, the auth listener above will auto-trigger checkout.
            try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ productId, description })); } catch {}
            const redirectTo = `${window.location.origin}/auth/callback?redirectTo=/upgrade`;
            await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
            return;
        }

        setBusy(productId);
        setStatus(null);
        // Tracks whether the Razorpay modal was opened. If true, setBusy is cleared by
        // the modal callbacks (handler/ondismiss/payment.failed) rather than the finally
        // block — because rzp.open() is non-blocking and the finally would fire immediately,
        // re-enabling buttons while the modal is still open and allowing duplicate orders.
        let modalOpened = false;
        try {
            if (!window.Razorpay) {
                const ok = await loadRazorpay();
                if (!ok) { setStatus({ type: "error", msg: "Checkout not available. Please try again." }); return; }
            }

            const res  = await fetch("/api/license/order-intent", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ productId }),
            });
            const json = await res.json();

            if (!res.ok || !json.ok) {
                if (res.status === 401) {
                    try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ productId, description })); } catch {}
                    const redirectTo = `${window.location.origin}/auth/callback?redirectTo=/upgrade`;
                    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
                    return;
                }
                setStatus({ type: "error", msg: json?.error || "Could not create order. Please try again." });
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
                    setBusy(null);
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
                modal: { ondismiss: () => { setBusy(null); setStatus({ type: "error", msg: "Checkout closed. No payment was made." }); } },
            };
            const rzp = new (window as any).Razorpay(options);
            rzp.on("payment.failed", (resp: any) => {
                setBusy(null);
                setStatus({ type: "error", msg: resp?.error?.description || "Payment failed. Please try again." });
            });
            rzp.open();
            modalOpened = true;
        } catch (e: any) {
            setStatus({ type: "error", msg: e?.message || "Something went wrong. Please try again." });
        } finally {
            // Only clear busy here if the modal never opened (pre-modal error path).
            // If the modal opened, the callbacks above handle it.
            if (!modalOpened) setBusy(null);
        }
    }

    // Keep the ref current so the auth-state listener always calls the latest checkout
    checkoutRef.current = checkout;

    const currentTier = (mounted && !license.loading) ? license.tier : null;

    return (
        <main className="mx-auto w-full max-w-4xl px-4 py-14 text-zinc-50 sm:px-6">

            {/* Header */}
            <div className="mb-10 text-center">
                <Link href="/chat" className="mb-6 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition">
                    ← Back to chat
                </Link>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Unlock Imotara</h1>
                <p className="mt-2 text-sm text-zinc-400">
                    Local replies are always free. Subscriptions remove the daily limit and extend your history.
                </p>
                {currentTier && (
                    <p className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-medium border ${currentTier === "free"
                        ? "bg-zinc-500/20 text-zinc-300 border-zinc-400/20"
                        : "bg-indigo-500/20 text-indigo-300 border-indigo-400/20"
                    }`}>
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
                                    <div className="space-y-2">
                                      <button
                                          type="button"
                                          disabled={!!busy || !rzReady}
                                          onClick={() => checkout(productId!, `Imotara ${plan.name} ${annual ? "Annual" : "Monthly"}`)}
                                          className={`w-full rounded-xl py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${isPro
                                              ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                                              : "bg-sky-600 hover:bg-sky-500 text-white"
                                          }`}
                                      >
                                          {isBusy ? "Opening…" : `${plan.cta} (UPI/Cards — India)`}
                                      </button>
                                      {/* Stripe — international cards */}
                                      <button
                                          type="button"
                                          disabled={!!busy}
                                          onClick={async () => {
                                            if (!productId) return;
                                            setBusy(productId + "_stripe");
                                            try {
                                              const r = await fetch("/api/payments/stripe/checkout", {
                                                method: "POST", credentials: "same-origin",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ productId }),
                                              });
                                              const j = await r.json();
                                              if (j.url) window.location.href = j.url;
                                              else setStatus({ type: "error", msg: j.error ?? "Stripe checkout unavailable." });
                                            } finally { setBusy(null); }
                                          }}
                                          className="w-full rounded-xl border border-white/15 bg-white/5 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10 disabled:opacity-50"
                                      >
                                          💳 Pay with international card (Stripe)
                                      </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Enterprise & Institutional */}
            <div className="mt-8 rounded-2xl border border-violet-400/20 bg-violet-500/8 p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-base font-semibold text-zinc-100">Enterprise &amp; Institutional</h2>
                            <span className="rounded-full bg-violet-500/20 border border-violet-400/20 px-2 py-0.5 text-[10px] font-semibold text-violet-300 uppercase tracking-wide">Custom pricing</span>
                        </div>
                        <p className="text-sm text-zinc-400 mb-4">
                            Built for organisations, healthcare platforms, schools, and HR teams that need managed deployments, admin controls, and compliance features.
                        </p>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-zinc-300">
                            {[
                                "Everything in Pro",
                                "Admin dashboard & analytics",
                                "Multi-profile management",
                                "Child-safe mode",
                                "SSO / SAML integration",
                                "Data residency options",
                                "Bulk seat management",
                                "Dedicated onboarding & support",
                                "Custom companion persona",
                                "SLA & compliance docs",
                            ].map((f) => (
                                <li key={f} className="flex items-start gap-2">
                                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
                                    {f}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="sm:shrink-0 sm:self-start">
                        <a
                            href="mailto:info@imotara.com?subject=Enterprise%20inquiry"
                            className="inline-flex items-center rounded-xl bg-violet-600 hover:bg-violet-500 transition px-5 py-2.5 text-sm font-semibold text-white"
                        >
                            Contact us →
                        </a>
                        <p className="mt-2 text-xs text-zinc-500 text-center">We typically reply within 24 h</p>
                    </div>
                </div>
            </div>

            {/* Feature comparison table */}
            <div className="mt-14">
                <h2 className="text-lg font-semibold mb-1 text-center">Compare plans</h2>
                <p className="text-sm text-zinc-400 text-center mb-6">Every feature, side by side.</p>

                <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="py-3 px-4 text-left font-medium text-zinc-400 w-[40%]">Feature</th>
                                <th className="py-3 px-3 text-center font-medium text-zinc-400">Free</th>
                                <th className="py-3 px-3 text-center font-medium text-sky-400">Plus</th>
                                <th className="py-3 px-3 text-center font-medium text-indigo-400">Pro</th>
                                <th className="py-3 px-3 text-center font-medium text-violet-400">Enterprise</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* ── Replies & Usage ── */}
                            <tr className="bg-white/[0.03]">
                                <td colSpan={5} className="py-2 px-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                    Replies &amp; Usage
                                </td>
                            </tr>
                            {[
                                {
                                    label: "Cloud replies / day",
                                    desc: "Cloud replies backed by memory and history",
                                    free: "20/day", plus: "Unlimited", pro: "Unlimited", ent: "Unlimited",
                                },
                                {
                                    label: "On-device replies",
                                    desc: "On-device replies — always free, no login needed",
                                    free: true, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Account backup",
                                    desc: "History and settings synced across all your devices",
                                    free: true, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Cross-device sync",
                                    desc: "Seamlessly switch between phone, tablet, and web with full history",
                                    free: false, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Companion mode / personas",
                                    desc: "Themed companion personalities — Coach, Listener, Challenger, and more",
                                    free: false, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Response length control",
                                    desc: "Switch between short, medium, and detailed response modes",
                                    free: false, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Companion tone selection",
                                    desc: "Choose the mood of your companion — Warm, Direct, Playful, and more",
                                    free: "1 tone", plus: "All tones", pro: "All tones", ent: "All tones",
                                },
                                {
                                    label: "Token top-up packs",
                                    desc: "Buy one-time credit packs to extend reply capacity beyond the daily limit",
                                    free: true, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "User emoji reactions",
                                    desc: "React to any message with 20 emoji across 4 groups — love, encouragement, empathy, nature",
                                    free: true, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Companion emoji reactions",
                                    desc: "Companion auto-reacts to your messages with mood-matched emoji (~50% probability, 1–2 s delay); toggle in Settings",
                                    free: true, plus: true, pro: true, ent: true,
                                },
                            ].map((row) => <CompareRow key={row.label} {...row} />)}

                            {/* ── History & Data ── */}
                            <tr className="bg-white/[0.03]">
                                <td colSpan={5} className="py-2 px-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                    History &amp; Data
                                </td>
                            </tr>
                            {[
                                {
                                    label: "Conversation history",
                                    desc: "How far back your cloud history is kept",
                                    free: "7 days", plus: "90 days", pro: "Unlimited", ent: "Unlimited",
                                },
                                {
                                    label: "History search across dates",
                                    desc: "Search messages older than the current session",
                                    free: false, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Data export (JSON / CSV)",
                                    desc: "Download your full conversation archive in machine-readable formats",
                                    free: false, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Export as PDF",
                                    desc: "Render your conversation history as a formatted PDF document",
                                    free: false, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "GDPR data request",
                                    desc: "Download all personal data held about your account",
                                    free: true, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Data deletion request",
                                    desc: "Request permanent deletion of all your data from Imotara servers",
                                    free: true, plus: true, pro: true, ent: true,
                                },
                            ].map((row) => <CompareRow key={row.label} {...row} />)}

                            {/* ── Voice & Search ── */}
                            <tr className="bg-white/[0.03]">
                                <td colSpan={5} className="py-2 px-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                    Voice &amp; Search
                                </td>
                            </tr>
                            {[
                                {
                                    label: "Text-to-speech (TTS)",
                                    desc: "Companion replies read aloud using a natural voice",
                                    free: "Basic", plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Voice input (speech-to-text)",
                                    desc: "Speak your message instead of typing — transcribed before sending",
                                    free: true, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Advanced TTS — voice & speed",
                                    desc: "Choose from multiple neural voices; adjust speaking rate and pitch",
                                    free: false, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Azure Neural TTS",
                                    desc: "High-quality cloud-rendered speech via Azure Cognitive Services",
                                    free: false, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Language-matched TTS voices",
                                    desc: "TTS voices automatically matched to your selected app language",
                                    free: false, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Offline TTS fallback",
                                    desc: "Uses your device's built-in TTS engine when offline",
                                    free: true, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Semantic history search",
                                    desc: "Toggle between keyword and meaning-based history search",
                                    free: false, plus: true, pro: true, ent: true,
                                },
                            ].map((row) => <CompareRow key={row.label} {...row} />)}

                            {/* ── AI Companion ── */}
                            <tr className="bg-white/[0.03]">
                                <td colSpan={5} className="py-2 px-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                    Companion &amp; Insights
                                </td>
                            </tr>
                            {[
                                {
                                    label: "Reply cadence",
                                    desc: "Control how often your companion responds and sends letters",
                                    free: false, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Streak tracking",
                                    desc: "Counts consecutive days you engaged with the app",
                                    free: true, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Session duration stats",
                                    desc: "See how long each conversation session lasted",
                                    free: false, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Emotion trends & mood graphs",
                                    desc: "Weekly and monthly charts of emotional states over time",
                                    free: false, plus: false, pro: true, ent: true,
                                },
                                {
                                    label: "Conversation insights",
                                    desc: "Per-conversation annotations — topics, emotional tone, key moments",
                                    free: false, plus: false, pro: true, ent: true,
                                },
                                {
                                    label: "Weekly emotional summary",
                                    desc: "Auto-generated narrative of the week's emotional themes",
                                    free: false, plus: false, pro: true, ent: true,
                                },
                                {
                                    label: "Companion letter",
                                    desc: "Monthly companion letter reflecting on your journey and growth",
                                    free: false, plus: false, pro: true, ent: true,
                                },
                                {
                                    label: "Letter archive",
                                    desc: "Browse and re-read all past companion letters (up to 24 saved — never overwritten)",
                                    free: false, plus: false, pro: true, ent: true,
                                },
                                {
                                    label: "Letter read-aloud",
                                    desc: "Listen to any companion letter read aloud in your companion's voice",
                                    free: false, plus: false, pro: true, ent: true,
                                },
                                {
                                    label: "Letter emoji reactions",
                                    desc: "React to any companion letter with a mood-relevant emoji — stored persistently",
                                    free: false, plus: false, pro: true, ent: true,
                                },
                                {
                                    label: "Letter personal reply",
                                    desc: "Write and save a personal reply to any companion letter — stored with the letter",
                                    free: false, plus: false, pro: true, ent: true,
                                },
                                {
                                    label: "Growth arc",
                                    desc: "Long-term emotional growth narrative tracking how you evolve over months",
                                    free: false, plus: false, pro: true, ent: true,
                                },
                            ].map((row) => <CompareRow key={row.label} {...row} />)}

                            {/* ── Notifications & Habits ── */}
                            <tr className="bg-white/[0.03]">
                                <td colSpan={5} className="py-2 px-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                    Notifications &amp; Habits
                                </td>
                            </tr>
                            {[
                                {
                                    label: "Daily check-in reminder",
                                    desc: "Push notification reminding you to open the app at a chosen time",
                                    free: true, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Streak notifications",
                                    desc: "Alert when you are at risk of breaking a streak",
                                    free: true, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Milestone celebrations",
                                    desc: "In-app celebration when you hit streaks, insights, or growth milestones",
                                    free: true, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Custom notification schedule",
                                    desc: "Set specific days and times for reminders instead of a single daily slot",
                                    free: false, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Weekly insight digest",
                                    desc: "Weekly push notification summarising your emotional highlights",
                                    free: false, plus: false, pro: true, ent: true,
                                },
                            ].map((row) => <CompareRow key={row.label} {...row} />)}

                            {/* ── Privacy & Security ── */}
                            <tr className="bg-white/[0.03]">
                                <td colSpan={5} className="py-2 px-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                    Privacy &amp; Security
                                </td>
                            </tr>
                            {[
                                {
                                    label: "Encrypted cloud storage",
                                    desc: "All cloud data encrypted at rest (AES-256) and in transit (TLS 1.3)",
                                    free: true, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Local-only / offline mode",
                                    desc: "Disable cloud sync entirely and keep all data on-device",
                                    free: true, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Session token management",
                                    desc: "View and revoke active login sessions from account security settings",
                                    free: false, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Audit logs",
                                    desc: "Immutable logs of admin actions, profile changes, and data access events",
                                    free: false, plus: false, pro: false, ent: true,
                                },
                            ].map((row) => <CompareRow key={row.label} {...row} />)}

                            {/* ── Organisation & Admin ── */}
                            <tr className="bg-white/[0.03]">
                                <td colSpan={5} className="py-2 px-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                    Organisation &amp; Admin
                                </td>
                            </tr>
                            {[
                                {
                                    label: "Multi-profile",
                                    desc: "Manage multiple user profiles under one account",
                                    free: false, plus: false, pro: false, ent: true,
                                },
                                {
                                    label: "Child-safe mode",
                                    desc: "Content filtering for younger or vulnerable users; blocks sensitive topics",
                                    free: false, plus: false, pro: false, ent: true,
                                },
                                {
                                    label: "Admin dashboard",
                                    desc: "Org-wide usage analytics, seat management, and policy controls",
                                    free: false, plus: false, pro: false, ent: true,
                                },
                                {
                                    label: "User management",
                                    desc: "Add, remove, suspend, or reassign users within your organisation",
                                    free: false, plus: false, pro: false, ent: true,
                                },
                                {
                                    label: "Bulk user provisioning",
                                    desc: "Import users via CSV or SCIM; set default tier and permissions at scale",
                                    free: false, plus: false, pro: false, ent: true,
                                },
                                {
                                    label: "SSO / SAML",
                                    desc: "Single sign-on via Okta, Google Workspace, Azure AD, or any SAML provider",
                                    free: false, plus: false, pro: false, ent: true,
                                },
                                {
                                    label: "Data residency",
                                    desc: "Choose which geographic region stores your organisation's data",
                                    free: false, plus: false, pro: false, ent: true,
                                },
                                {
                                    label: "API access",
                                    desc: "Programmatic access to conversation summaries and analytics via REST API",
                                    free: false, plus: false, pro: false, ent: true,
                                },
                                {
                                    label: "Custom integrations",
                                    desc: "Bespoke webhooks, HR system connectors, or custom integrations",
                                    free: false, plus: false, pro: false, ent: true,
                                },
                                {
                                    label: "Institution branding",
                                    desc: "Replace Imotara's logo and colours with your organisation's brand assets",
                                    free: false, plus: false, pro: false, ent: true,
                                },
                            ].map((row) => <CompareRow key={row.label} {...row} />)}

                            {/* ── Support ── */}
                            <tr className="bg-white/[0.03]">
                                <td colSpan={5} className="py-2 px-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                    Support
                                </td>
                            </tr>
                            {[
                                {
                                    label: "Community docs & FAQ",
                                    desc: "Access to public help centre, guides, and community forum",
                                    free: true, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Email support",
                                    desc: "Submit support tickets via email with a response SLA",
                                    free: false, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Priority support queue",
                                    desc: "Tickets routed to a faster queue with shorter response times",
                                    free: false, plus: true, pro: true, ent: true,
                                },
                                {
                                    label: "Dedicated account manager",
                                    desc: "Named contact for onboarding, renewals, and escalations",
                                    free: false, plus: false, pro: false, ent: true,
                                },
                                {
                                    label: "SLA guarantee",
                                    desc: "Contractual uptime and response-time commitments",
                                    free: false, plus: false, pro: false, ent: true,
                                },
                                {
                                    label: "Onboarding assistance",
                                    desc: "Guided setup session with the Imotara team for your org deployment",
                                    free: false, plus: false, pro: false, ent: true,
                                },
                            ].map((row) => <CompareRow key={row.label} {...row} />)}
                        </tbody>
                    </table>
                </div>
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
