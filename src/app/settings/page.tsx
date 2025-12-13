"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAnalysisConsent } from "@/hooks/useAnalysisConsent";
import { saveHistory } from "@/lib/imotara/historyPersist";

const CHAT_STORAGE_KEY = "imotara.chat.v1";
const IMOTARA_VERSION = "Imotara Web Beta v0.9.7";

/** Razorpay Checkout (web) */
declare global {
    interface Window {
        Razorpay?: any;
    }
}

type DonationIntentResponse = {
    ok: boolean;
    razorpay?: {
        orderId: string;
        keyId: string;
        amount: number; // paise
        currency: string; // INR
    };
    error?: string;
};

type LicenseStatusResponse = {
    ok?: boolean;
    tier?: string; // "FREE" | "PREMIUM" ...
    mode?: string; // "off" | "log" | "enforce"
    message?: string;
    error?: string;
};

function formatINRFromPaise(paise: number) {
    const rupees = paise / 100;
    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        }).format(rupees);
    } catch {
        return `₹${Math.round(rupees)}`;
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
            existing.addEventListener("error", () => resolve(false));
            return;
        }

        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

export default function SettingsPage() {
    const { mode } = useAnalysisConsent();

    // ✅ Hydration-safe: render certain sections only after mount
    const [mounted, setMounted] = useState(false);

    const consentLabel =
        mode === "allow-remote"
            ? "Remote analysis allowed"
            : mode === "local-only"
                ? "On-device only (local analysis)"
                : "Analysis mode: unknown";

    const consentBadgeClass =
        mode === "allow-remote"
            ? "border-emerald-300/70 bg-emerald-500/10 text-emerald-200"
            : mode === "local-only"
                ? "border-zinc-400/70 bg-zinc-900/40 text-zinc-100"
                : "border-zinc-600/70 bg-zinc-900/60 text-zinc-300";

    const [busy, setBusy] = useState<"chat" | "history" | "all" | null>(null);
    const [status, setStatus] = useState<string | null>(null);

    // Donations (web)
    const [donating, setDonating] = useState(false);
    const [donateStatus, setDonateStatus] = useState<string | null>(null);

    // Licensing (web)
    const [lic, setLic] = useState<LicenseStatusResponse | null>(null);
    const [licLoading, setLicLoading] = useState(false);

    // Recent donations (web)
    const [donLoading, setDonLoading] = useState(false);
    const [donations, setDonations] = useState<any[]>([]);
    const [donError, setDonError] = useState<string | null>(null);

    const licenseMode = useMemo(() => {
        // This is a PUBLIC env var and is safe to display.
        return process.env.NEXT_PUBLIC_IMOTARA_LICENSE_MODE || "off";
    }, []);

    const DONATION_PRESETS = useMemo(
        () => [
            { id: "d-99", label: "₹99", amount: 9900 },
            { id: "d-199", label: "₹199", amount: 19900 },
            { id: "d-499", label: "₹499", amount: 49900 },
            { id: "d-999", label: "₹999", amount: 99900 },
        ],
        []
    );

    async function handleClearChat() {
        if (typeof window === "undefined") return;

        const ok = window.confirm(
            "Clear all chat conversations on this device? This cannot be undone."
        );
        if (!ok) return;

        try {
            setBusy("chat");
            setStatus(null);
            window.localStorage.removeItem(CHAT_STORAGE_KEY);
            setStatus("Chat conversations cleared on this device.");
        } catch (err) {
            console.error("[imotara] failed to clear chat conversations:", err);
            setStatus("Something went wrong while clearing chat.");
        } finally {
            setBusy(null);
        }
    }

    async function handleClearHistory() {
        const ok =
            typeof window !== "undefined"
                ? window.confirm(
                    "Clear all emotion history on this device? This cannot be undone."
                )
                : true;
        if (!ok) return;

        try {
            setBusy("history");
            setStatus(null);
            await saveHistory([]);
            setStatus("Emotion history cleared on this device.");
        } catch (err) {
            console.error("[imotara] failed to clear emotion history:", err);
            setStatus("Something went wrong while clearing emotion history.");
        } finally {
            setBusy(null);
        }
    }

    async function handleClearAll() {
        if (typeof window === "undefined") return;

        const ok = window.confirm(
            "Clear ALL local Imotara data (chat + emotion history) on this device? This cannot be undone."
        );
        if (!ok) return;

        try {
            setBusy("all");
            setStatus(null);
            window.localStorage.removeItem(CHAT_STORAGE_KEY);
            await saveHistory([]);
            setStatus(
                "All local Imotara data (chat + emotion history) cleared on this device."
            );
        } catch (err) {
            console.error("[imotara] failed to clear all local data:", err);
            setStatus("Something went wrong while clearing local data.");
        } finally {
            setBusy(null);
        }
    }

    async function refreshLicenseStatus() {
        try {
            setLicLoading(true);
            const res = await fetch("/api/license/status", { method: "GET" });
            const json = (await res.json()) as LicenseStatusResponse;
            setLic(json);
        } catch (e: any) {
            setLic({ ok: false, error: e?.message || "Failed to read license status" });
        } finally {
            setLicLoading(false);
        }
    }

    async function refreshDonations() {
        try {
            setDonLoading(true);
            setDonError(null);

            const res = await fetch("/api/donations/recent?limit=10", { method: "GET" });
            const json = await res.json();

            if (!res.ok || !json?.ok) {
                setDonError(json?.error || "Failed to load donations");
                setDonations([]);
                return;
            }

            setDonations(Array.isArray(json.items) ? json.items : []);
        } catch (e: any) {
            setDonError(e?.message || "Failed to load donations");
            setDonations([]);
        } finally {
            setDonLoading(false);
        }
    }

    useEffect(() => {
        // ✅ ensure client-only rendering for locale-dependent content
        setMounted(true);

        // Read-only licensing status on page load
        refreshLicenseStatus();

        // Recent donations (read-only)
        refreshDonations();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function handleDonate(amount: number) {
        if (typeof window === "undefined") return;

        try {
            setDonating(true);
            setDonateStatus(null);

            const scriptOk = await loadRazorpayScript();
            if (!scriptOk) {
                setDonateStatus("Failed to load Razorpay checkout script.");
                return;
            }

            const res = await fetch("/api/payments/donation-intent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount,
                    currency: "inr",
                    purpose: "imotara_donation",
                    platform: "web",
                }),
            });

            const json = (await res.json()) as DonationIntentResponse;

            if (!res.ok || !json.ok || !json.razorpay) {
                setDonateStatus(json?.error || "Donation order failed.");
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
                    card: false,
                    netbanking: false,
                    wallet: false,
                },
                notes: {
                    purpose: "imotara_donation",
                },
                theme: { color: "#38bdf8" },
                handler: function (response: any) {
                    // Note: real verification is via webhook on server; this is only UX feedback.
                    setDonateStatus(
                        `Thank you 🙏 Donation initiated successfully. Payment ID: ${response?.razorpay_payment_id || "—"
                        }`
                    );
                    // Refresh list (it may still remain empty until webhook records it)
                    refreshDonations();
                },
                modal: {
                    ondismiss: function () {
                        setDonateStatus("Donation cancelled.");
                    },
                },
            };

            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (e: any) {
            setDonateStatus(e?.message || "Donation failed.");
        } finally {
            setDonating(false);
        }
    }

    const tierLabel = useMemo(() => {
        const t = (lic?.tier || "FREE").toUpperCase();
        if (t === "PREMIUM") return "Premium";
        if (t === "FAMILY") return "Family";
        if (t === "EDU") return "Education";
        if (t === "ENTERPRISE") return "Enterprise";
        return "Free";
    }, [lic?.tier]);

    return (
        <main className="mx-auto w-full max-w-5xl px-4 py-10 text-zinc-50 sm:px-6">
            <div className="space-y-6 text-sm text-zinc-100">
                {/* Page header */}
                <header className="imotara-glass-card rounded-2xl px-4 py-5 sm:px-5 sm:py-6">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
                        Imotara · Settings
                    </p>
                    <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
                        Settings &amp; Data
                    </h1>
                    <p className="mt-2 text-xs leading-6 text-zinc-400 sm:text-sm">
                        A single place to see your current analysis mode and manage how
                        Imotara stores data on this device.
                    </p>
                </header>

                {/* Analysis mode overview */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">
                        Emotion analysis mode
                    </h2>
                    <p className="mt-1 text-xs leading-6 text-zinc-400 sm:text-sm">
                        This mode is shared between Chat and History and is stored only in
                        this browser.
                    </p>

                    <div className="mt-3 inline-flex flex-wrap items-center gap-2">
                        <span
                            className={[
                                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] backdrop-blur-sm",
                                consentBadgeClass,
                            ].join(" ")}
                        >
                            <span
                                className={`h-1.5 w-1.5 rounded-full ${mode === "allow-remote" ? "bg-emerald-400" : "bg-zinc-500"
                                    }`}
                            />
                            {consentLabel}
                        </span>

                        <span className="text-[11px] text-zinc-400">
                            Change this from the Chat page using the toggle.
                        </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
                        <Link
                            href="/chat"
                            className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-zinc-100 shadow-sm transition hover:bg-white/20"
                        >
                            Go to Chat
                        </Link>
                        <Link
                            href="/history"
                            className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-zinc-100 shadow-sm transition hover:bg-white/20"
                        >
                            View Emotion History
                        </Link>
                    </div>
                </section>

                {/* NEW: Licensing status */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">
                                Licensing
                            </h2>
                            <p className="mt-1 text-xs leading-6 text-zinc-400 sm:text-sm">
                                Current plan status for this web session. Enforcement is
                                controlled by license mode.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={refreshLicenseStatus}
                            disabled={licLoading}
                            className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-zinc-100 shadow-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {licLoading ? "Refreshing…" : "Refresh"}
                        </button>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                                Plan
                            </p>
                            <p className="mt-1 text-sm font-semibold text-zinc-50">
                                {tierLabel}
                            </p>
                            <p className="mt-2 text-xs leading-6 text-zinc-400">
                                {lic?.message ||
                                    "Upgrade flows will appear here once web purchase is enabled."}
                            </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                                License mode
                            </p>
                            <p className="mt-1 text-sm font-semibold text-zinc-50">
                                {String(lic?.mode || licenseMode)}
                            </p>
                            <p className="mt-2 text-xs leading-6 text-zinc-400">
                                off = disabled, log = observe only, enforce = block gated features.
                            </p>
                        </div>
                    </div>

                    {lic?.error && (
                        <p className="mt-3 text-[11px] text-rose-200/90">
                            {lic.error}
                        </p>
                    )}
                </section>

                {/* NEW: Donations (web) */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">
                        Support Imotara (Donate)
                    </h2>
                    <p className="mt-1 text-xs leading-6 text-zinc-400 sm:text-sm">
                        Imotara is privacy-first and non-commercial. Donations help keep it
                        running and improving. (UPI preferred)
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
                        {DONATION_PRESETS.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => handleDonate(p.amount)}
                                disabled={donating}
                                className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-zinc-100 shadow-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                                title={`Donate ${formatINRFromPaise(p.amount)}`}
                            >
                                {donating ? "Opening…" : p.label}
                            </button>
                        ))}
                    </div>

                    {donateStatus && (
                        <p className="mt-3 text-[11px] text-zinc-400">{donateStatus}</p>
                    )}

                    <p className="mt-3 text-[11px] text-zinc-500">
                        Note: Final confirmation is recorded via secure server webhook after payment.
                    </p>
                </section>

                {/* NEW: Recent donations (web) — rendered client-only to avoid hydration mismatch */}
                {mounted && (
                    <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">
                                    Recent Donations
                                </h2>
                                <p className="mt-1 text-xs leading-6 text-zinc-400 sm:text-sm">
                                    Receipts appear here after the secure server webhook records the payment.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={refreshDonations}
                                disabled={donLoading}
                                className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-zinc-100 shadow-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {donLoading ? "Refreshing…" : "Refresh"}
                            </button>
                        </div>

                        {donError && (
                            <p className="mt-3 text-[11px] text-rose-200/90">{donError}</p>
                        )}

                        {!donError && donations.length === 0 && (
                            <p className="mt-3 text-[11px] text-zinc-400">
                                No receipts yet. (This is expected until production webhooks are hitting your deployed backend.)
                            </p>
                        )}

                        {donations.length > 0 && (
                            <div className="mt-4 space-y-2">
                                {donations.map((d) => (
                                    <div
                                        key={d.id}
                                        className="rounded-2xl border border-white/10 bg-white/5 p-4"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-sm font-semibold text-zinc-50">
                                                {formatINRFromPaise(Number(d.amount_paise || 0))}
                                            </p>
                                            <p className="text-[11px] text-zinc-400">
                                                {String(d.status || "—").toUpperCase()}
                                                {d.is_test ? " · TEST" : ""}
                                            </p>
                                        </div>
                                        <p className="mt-1 text-[11px] text-zinc-400">
                                            Payment: {d.razorpay_payment_id || "—"}
                                        </p>
                                        <p className="mt-1 text-[11px] text-zinc-500">
                                            {d.created_at ? new Date(d.created_at).toLocaleString() : ""}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* Local data controls */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">
                        Local data controls
                    </h2>
                    <p className="mt-1 text-xs leading-6 text-zinc-400 sm:text-sm">
                        These actions affect only this browser on this device. They do not
                        touch any future cloud backups or accounts.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs sm:text-sm">
                        <button
                            type="button"
                            onClick={handleClearChat}
                            disabled={busy !== null}
                            className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-zinc-100 shadow-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {busy === "chat" || busy === "all"
                                ? "Clearing chat…"
                                : "Clear Chat conversations"}
                        </button>

                        <button
                            type="button"
                            onClick={handleClearHistory}
                            disabled={busy !== null}
                            className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-zinc-100 shadow-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {busy === "history" || busy === "all"
                                ? "Clearing history…"
                                : "Clear Emotion History"}
                        </button>

                        <button
                            type="button"
                            onClick={handleClearAll}
                            disabled={busy !== null}
                            className="rounded-xl border border-rose-400/50 bg-rose-600/20 px-3 py-1.5 text-zinc-100 shadow-sm transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {busy === "all" ? "Clearing all…" : "Clear ALL local Imotara data"}
                        </button>
                    </div>

                    {status && <p className="mt-3 text-[11px] text-zinc-400">{status}</p>}
                </section>

                {/* Data & privacy copy */}
                <section className="imotara-glass-soft rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
                    <h2 className="text-sm font-semibold text-zinc-50 sm:text-base">
                        Data &amp; privacy
                    </h2>
                    <p className="mt-1 text-xs leading-6 text-zinc-400 sm:text-sm">
                        Imotara is designed as a quiet, local-first experiment. Most data is
                        stored only in this browser unless you explicitly allow remote
                        analysis or sync.
                    </p>
                    <p className="mt-2 text-xs leading-6 text-zinc-400 sm:text-sm">
                        In upcoming steps, this page will let you download richer exports
                        and review how your information is used across devices.
                    </p>

                    <p className="mt-3 text-[11px] text-zinc-500">
                        For full details, see our{" "}
                        <Link
                            href="/privacy"
                            className="underline underline-offset-2 hover:text-zinc-300"
                        >
                            Privacy
                        </Link>{" "}
                        and{" "}
                        <Link
                            href="/terms"
                            className="underline underline-offset-2 hover:text-zinc-300"
                        >
                            Terms
                        </Link>{" "}
                        pages.
                    </p>
                </section>

                {/* Version footer */}
                <footer className="pt-6 pb-2 text-center text-[11px] text-zinc-500">
                    <span className="opacity-80">{IMOTARA_VERSION}</span>
                </footer>
            </div>
        </main>
    );
}
