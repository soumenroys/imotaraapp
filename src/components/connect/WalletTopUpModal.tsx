"use client";

import { useState } from "react";
import { X, CreditCard, Loader2, Wallet } from "lucide-react";

const TOPUP_PRESETS = [1000, 2000, 5000, 10000];
const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ", SGD: "S$", AUD: "A$",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RazorpayConstructor = new (opts: Record<string, any>) => { open(): void };

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

interface Props {
  walletBalance: number;
  walletCurrency: string;
  razorpayKeyId: string;
  onSuccess: (newBalance: number) => void;
  onClose: () => void;
}

export default function WalletTopUpModal({
  walletBalance, walletCurrency, razorpayKeyId, onSuccess, onClose,
}: Props) {
  const [selectedAmount, setSelectedAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount]     = useState<string>("");
  const [isCustom, setIsCustom]             = useState(false);
  const [termsAccepted, setTermsAccepted]   = useState(false);
  const [paying, setPaying]                 = useState(false);
  const [error, setError]                   = useState("");

  const sym       = CURRENCY_SYMBOLS[walletCurrency] ?? walletCurrency;
  const topupAmt  = isCustom ? Math.max(1, parseFloat(customAmount) || 0) : selectedAmount;

  async function handleTopUp() {
    if (topupAmt < 1) { setError("Please enter a valid amount"); return; }
    if (!termsAccepted) { setError("Please accept the Wallet Terms to continue"); return; }
    setPaying(true);
    setError("");
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Payment gateway unavailable. Please try again.");

      const res = await fetch("/api/connect/wallet/topup/create", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ amount: topupAmt, terms_accepted: true }),
        credentials: "include",
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Failed to create order");

      await new Promise<void>((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const RazorpayClass = (window as any).Razorpay as RazorpayConstructor;
        const rz = new RazorpayClass({
          key:      razorpayKeyId,
          order_id: data.razorpay_order_id,
          amount:   data.amount_paise,
          currency: "INR",
          name:     "Imotara",
          description: `Add ${sym}${topupAmt} to Imotara Wallet`,
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id:   string;
            razorpay_signature:  string;
          }) => {
            try {
              const vRes = await fetch("/api/connect/wallet/topup/verify", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({
                  razorpay_order_id:   response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature:  response.razorpay_signature,
                }),
                credentials: "include",
              });
              const vData = await vRes.json();
              if (!vData.ok) reject(new Error(vData.error ?? "Payment verification failed"));
              else { onSuccess(Number(vData.new_balance ?? 0)); resolve(); }
            } catch (err) { reject(err); }
          },
          modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
          theme: { color: "#6366f1" },
        });
        rz.open();
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      if (msg !== "Payment cancelled") setError(msg);
    } finally {
      setPaying(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="imotara-glass-card w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">Imotara Wallet</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-50">Add Balance</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 transition">
            <X size={16} />
          </button>
        </div>

        {/* Current balance */}
        <div className="mb-5 flex items-center justify-between rounded-xl border border-violet-500/20 bg-violet-500/8 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Wallet size={14} className="text-violet-400" />
            <span>Current balance</span>
          </div>
          <span className="text-xl font-bold text-violet-300">{sym}{walletBalance.toFixed(2)}</span>
        </div>

        {/* Amount presets */}
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Choose amount</p>
        <div className="mb-3 grid grid-cols-4 gap-2">
          {TOPUP_PRESETS.map((amt) => (
            <button
              key={amt}
              onClick={() => { setIsCustom(false); setSelectedAmount(amt); }}
              className={`rounded-xl border py-2.5 text-sm font-medium transition ${
                !isCustom && selectedAmount === amt
                  ? "border-violet-500 bg-violet-500/20 text-violet-300"
                  : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
              }`}
            >
              {sym}{(amt / 1000).toFixed(0)}K
            </button>
          ))}
        </div>
        <button
          onClick={() => setIsCustom(true)}
          className={`mb-3 w-full rounded-xl border py-2.5 text-sm font-medium transition ${
            isCustom
              ? "border-violet-500 bg-violet-500/20 text-violet-300"
              : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
          }`}
        >
          Custom amount
        </button>

        {isCustom && (
          <div className="mb-3 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">{sym}</span>
            <input
              type="number"
              min={1}
              placeholder="Enter amount"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/5 pl-7 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500"
            />
          </div>
        )}

        {/* Summary */}
        <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
          <div className="flex justify-between text-zinc-300">
            <span>Top-up amount</span>
            <span className="font-semibold">{sym}{topupAmt.toFixed(2)}</span>
          </div>
          <div className="mt-1.5 flex justify-between text-zinc-500 text-xs">
            <span>New balance after top-up</span>
            <span>{sym}{(walletBalance + topupAmt).toFixed(2)}</span>
          </div>
        </div>

        {/* Consent */}
        <label className="mb-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 accent-violet-500"
          />
          <span className="text-xs leading-relaxed text-zinc-400">
            I agree to the{" "}
            <a href="/connect/wallet-terms" target="_blank" rel="noopener noreferrer"
              className="text-violet-400 underline underline-offset-2 hover:text-violet-300">
              Wallet Terms
            </a>
            . I understand my balance is valid for 2 years of inactivity and is non-transferable.
          </span>
        </label>

        {error && (
          <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </p>
        )}

        <button
          onClick={handleTopUp}
          disabled={paying || topupAmt < 1}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
        >
          {paying ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
          {paying ? "Processing…" : `Add ${sym}${topupAmt.toFixed(0)} to Wallet`}
        </button>

        <p className="mt-3 text-center text-[10px] text-zinc-600">
          Secured by Razorpay · Balance used across all Imotara Connect sessions
        </p>
      </div>
    </div>
  );
}
