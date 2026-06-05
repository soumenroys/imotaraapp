// src/components/connect/RechargeModal.tsx
"use client";

import { useState } from "react";
import { X, Clock, CreditCard, Loader2 } from "lucide-react";

interface Consultant {
  id: string;
  display_name: string;
  rate_per_min: number;
  currency_code: string;
}

interface Props {
  consultant: Consultant;
  razorpayKeyId: string;
  onSuccess: (minutes: number) => void;
  onClose: () => void;
}

const PRESET_MINUTES = [15, 30, 60];
const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ", SGD: "S$", AUD: "A$",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RazorpayConstructor = new (opts: Record<string, any>) => { open(): void };

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export default function RechargeModal({ consultant, razorpayKeyId, onSuccess, onClose }: Props) {
  const [minutes, setMinutes] = useState(30);
  const [customMinutes, setCustomMinutes] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedMinutes = isCustom ? Math.max(1, parseInt(customMinutes) || 1) : minutes;
  const sym = CURRENCY_SYMBOLS[consultant.currency_code] ?? consultant.currency_code;
  const consultantFee = consultant.rate_per_min * selectedMinutes;
  const platformFee   = consultantFee * 0.20;
  const total         = consultantFee; // user pays total; platform fee is internal

  async function handlePay() {
    setLoading(true);
    setError("");

    try {
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error("Payment gateway unavailable. Please try again.");

      const res = await fetch("/api/connect/wallet/recharge/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultant_id: consultant.id, minutes: selectedMinutes }),
        credentials: "include",
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Failed to create order");

      const { razorpay_order_id, amount_paise } = data;

      await new Promise<void>((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const RazorpayClass = (window as any).Razorpay as RazorpayConstructor;
        const rz = new RazorpayClass({
          key:      razorpayKeyId,
          order_id: razorpay_order_id,
          amount:   amount_paise,
          currency: "INR",
          name:     "Imotara Connect",
          description: `${selectedMinutes} min session with ${consultant.display_name}`,
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id:   string;
            razorpay_signature:  string;
          }) => {
            try {
              const verifyRes = await fetch("/api/connect/wallet/recharge/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id:  response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature:  response.razorpay_signature,
                }),
                credentials: "include",
              });
              const vData = await verifyRes.json();
              if (!vData.ok) reject(new Error(vData.error ?? "Payment verification failed"));
              else resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
          theme: { color: "#6366f1" },
        });
        rz.open();
      });

      onSuccess(selectedMinutes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setLoading(false);
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
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">Recharge</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-50">Add Session Time</h2>
            <p className="mt-0.5 text-sm text-zinc-400">{consultant.display_name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 transition">
            <X size={16} />
          </button>
        </div>

        {/* Duration picker */}
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-500">Duration</p>
        <div className="mb-3 flex gap-2">
          {PRESET_MINUTES.map((m) => (
            <button
              key={m}
              onClick={() => { setIsCustom(false); setMinutes(m); }}
              className={`flex flex-1 items-center justify-center gap-1 rounded-xl border py-2.5 text-sm transition ${
                !isCustom && minutes === m
                  ? "border-violet-500 bg-violet-500/20 font-semibold text-violet-300"
                  : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
              }`}
            >
              <Clock size={12} />
              {m}m
            </button>
          ))}
          <button
            onClick={() => setIsCustom(true)}
            className={`flex flex-1 items-center justify-center rounded-xl border py-2.5 text-sm transition ${
              isCustom
                ? "border-violet-500 bg-violet-500/20 font-semibold text-violet-300"
                : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
            }`}
          >
            Custom
          </button>
        </div>

        {isCustom && (
          <input
            type="number"
            min={1}
            placeholder="Minutes"
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
            className="mb-3 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500"
          />
        )}

        {/* Cost breakdown */}
        <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4 space-y-2 text-sm">
          <div className="flex justify-between text-zinc-300">
            <span>{selectedMinutes} min × {sym}{consultant.rate_per_min}/min</span>
            <span className="font-medium">{sym}{consultantFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-zinc-500">
            <span>Platform fee (20%)</span>
            <span>{sym}{platformFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-2 font-semibold text-zinc-50">
            <span>Total</span>
            <span>{sym}{total.toFixed(2)}</span>
          </div>
          <p className="text-xs text-zinc-500 text-center">You get {selectedMinutes} minutes with {consultant.display_name}</p>
        </div>

        {error && (
          <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </p>
        )}

        <button
          onClick={handlePay}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
          {loading ? "Processing…" : `Pay ${sym}${total.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
