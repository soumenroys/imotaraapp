// src/components/connect/TranslationToggleModal.tsx
// Confirmation modal for the mid-session auto-translation toggle. Mirrors the
// shell/cost-breakdown/loading-button pattern of RechargeModal.tsx.
"use client";

import { useState } from "react";
import { X, Globe, Loader2 } from "lucide-react";

interface Props {
  sessionId: string;
  targetEnabled: boolean;
  baseRate: number;
  currentRate: number;
  currencyCode: string;
  // True when the confirming viewer is the session's paying user (session.user_id).
  // False means they're the companion — the rate change affects the OTHER party's bill.
  isPayer: boolean;
  onSuccess: (enabled: boolean, ratePerMin: number) => void;
  onClose: () => void;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ", SGD: "S$", AUD: "A$",
};

export default function TranslationToggleModal({
  sessionId, targetEnabled, baseRate, currentRate, currencyCode, isPayer, onSuccess, onClose,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sym = CURRENCY_SYMBOLS[currencyCode] ?? currencyCode;
  const newRate = targetEnabled ? +(baseRate * 1.10).toFixed(4) : baseRate;

  async function handleConfirm() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/connect/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "toggle_translation", enabled: targetEnabled }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.ok) {
        setError(d?.error ?? "Could not update translation setting. Please try again.");
        return;
      }
      onSuccess(d.translation_enabled, Number(d.rate_per_min));
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={loading ? undefined : onClose}
    >
      <div
        className="imotara-glass-card w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">Auto-Translation</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-50">
              {targetEnabled ? "Turn On Auto-Translation" : "Turn Off Auto-Translation"}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={16} />
          </button>
        </div>

        {/* Rate breakdown */}
        <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4 space-y-2 text-sm">
          <div className="flex justify-between text-zinc-300">
            <span>Current rate</span>
            <span className="font-medium">{sym}{currentRate.toFixed(2)}/min</span>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-2 font-semibold text-zinc-50">
            <span>New rate</span>
            <span>{sym}{newRate.toFixed(2)}/min</span>
          </div>
          <p className="text-xs text-zinc-500 text-center pt-1">
            <Globe size={11} className="inline -mt-0.5 mr-1" />
            Takes effect from your next billing minute — not immediately.
          </p>
        </div>

        {!isPayer && (
          <p className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-300">
            This changes the rate the other person is charged, not you.
          </p>
        )}

        <p className="mb-4 text-xs text-zinc-500 text-center">
          Messages already sent keep their translation. Either of you can toggle this again at any time.
        </p>

        {error && (
          <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </p>
        )}

        <button
          onClick={handleConfirm}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
          {loading ? "Updating…" : targetEnabled ? "Turn On" : "Turn Off"}
        </button>
      </div>
    </div>
  );
}
