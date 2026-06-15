"use client";
// src/app/pricing/corporate/page.tsx
// Corporate/NGO/EDU self-service seat purchase page — powered by Razorpay (INR).

import { useEffect, useState } from "react";
import Link from "next/link";

const ORG_TYPES = [
  { value: "commercial", label: "Company",     icon: "🏢", desc: "Corporate wellness / HR" },
  { value: "ngo",        label: "NGO / NPO",   icon: "🤝", desc: "Non-profit, community welfare" },
  { value: "edu",        label: "Educational", icon: "🎓", desc: "Schools, colleges, counselling" },
  { value: "govt",       label: "Government",  icon: "🏛️", desc: "Government or public sector" },
];

// Base per-seat annual price in paise (before org-type discount)
// Commercial / Govt: ₹1,999/seat/yr  |  NGO: ₹799  |  EDU: ₹999
const PER_SEAT_PAISE: Record<string, number> = {
  commercial: 199_900,
  govt:       199_900,
  ngo:         79_900,
  edu:         99_900,
};

const SEAT_OPTIONS = [
  { seats: 10,  tier: "Plus",       label: "Starter"    },
  { seats: 50,  tier: "Plus",       label: "Team"       },
  { seats: 100, tier: "Enterprise", label: "Department" },
  { seats: 500, tier: "Enterprise", label: "Enterprise" },
  { seats: 0,   tier: "Enterprise", label: "Custom"     },
];

function paiseToINR(paise: number) { return paise / 100; }
function formatINR(amount: number) {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if ((window as any).Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) { existing.addEventListener("load", () => resolve(true)); return; }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

export default function CorporatePricingPage() {
  const [orgType,   setOrgType]   = useState("commercial");
  const [selected,  setSelected]  = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [status,    setStatus]    = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => { loadRazorpayScript().catch(() => {}); }, []);

  const seatOpt    = SEAT_OPTIONS[selected];
  const perSeat    = PER_SEAT_PAISE[orgType] ?? PER_SEAT_PAISE.commercial;
  const totalPaise = seatOpt.seats > 0 ? perSeat * seatOpt.seats : 0;
  const totalINR   = paiseToINR(totalPaise);

  async function handleCheckout() {
    setStatus(null);
    if (seatOpt.seats === 0) {
      const orgLabel = ORG_TYPES.find(t => t.value === orgType)?.label ?? orgType;
      const subject  = encodeURIComponent(`Imotara Custom Org Plan — ${orgLabel}`);
      const body     = encodeURIComponent(
        `Hi Imotara team,\n\nI'd like to set up a custom organisation plan.\n\nOrganisation type: ${orgLabel}\nSeats needed: (please advise)\n\nPlease send a quote and next steps.\n\nThank you`
      );
      window.location.href = `mailto:info@imotara.com?subject=${subject}&body=${body}`;
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      if (!(window as any).Razorpay) {
        const ok = await loadRazorpayScript();
        if (!ok) { setStatus({ ok: false, msg: "Checkout is loading — please try again in a moment." }); return; }
      }

      const res = await fetch("/api/payments/razorpay/corporate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgType, seats: seatOpt.seats }),
      });

      const json = await res.json() as {
        ok: boolean; error?: string;
        razorpay?: { orderId: string; keyId: string; amount: number; currency: string };
        tier?: string;
      };

      if (!res.ok || !json.ok || !json.razorpay) {
        setStatus({ ok: false, msg: json?.error ?? "Could not create payment order. Please try again." });
        return;
      }

      const rz      = json.razorpay;
      const orgLabel = ORG_TYPES.find(t => t.value === orgType)?.label ?? orgType;

      const options: Record<string, unknown> = {
        key:         rz.keyId,
        amount:      rz.amount,
        currency:    rz.currency || "INR",
        name:        "Imotara",
        description: `${orgLabel} · ${seatOpt.seats} seats · ${seatOpt.tier} · Annual`,
        order_id:    rz.orderId,
        prefill:     {},
        notes:       { purpose: "imotara_corporate", orgType, seats: String(seatOpt.seats) },
        theme:       { color: "#38bdf8" },
        method:      { upi: true, card: true, netbanking: true, wallet: false },
        handler: function () {
          setStatus({
            ok:  true,
            msg: "Payment received! Our team will activate your organisation within 24 hours. You will receive a confirmation email shortly.",
          });
        },
        modal: {
          ondismiss: function () {
            setStatus({ ok: false, msg: "Checkout closed. No payment was made." });
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (resp: any) => {
        const msg = resp?.error?.description ?? resp?.error?.reason ?? "Please try again.";
        setStatus({ ok: false, msg: `Payment failed. ${msg}` });
      });
      rzp.open();
    } catch (e: any) {
      setStatus({ ok: false, msg: e?.message ?? "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-10 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Imotara for Organisations</p>
        <h1 className="mt-2 text-3xl font-bold text-zinc-100">Choose your plan</h1>
        <p className="mt-3 text-sm text-zinc-400 max-w-lg mx-auto">
          Deploy emotional wellness support across your whole team. NGOs and educational institutions get special pricing.
        </p>
      </div>

      {/* Org type */}
      <div className="mb-8">
        <p className="mb-3 text-sm font-medium text-zinc-300">Organisation type</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ORG_TYPES.map((t) => (
            <button key={t.value} onClick={() => setOrgType(t.value)}
              className={`rounded-2xl border px-3 py-3 text-left transition ${
                orgType === t.value
                  ? "border-indigo-400/50 bg-indigo-500/10 shadow-sm"
                  : "border-white/8 bg-white/4 hover:border-white/15"
              }`}>
              <span className="text-xl">{t.icon}</span>
              <p className="mt-1 text-sm font-medium text-zinc-100">{t.label}</p>
              <p className="text-[10px] text-zinc-500">{t.desc}</p>
            </button>
          ))}
        </div>
        {(orgType === "ngo" || orgType === "edu") && (
          <p className="mt-2 text-xs text-emerald-400">
            🎉 {orgType === "ngo" ? "60%" : "50%"} discount applied for {orgType === "ngo" ? "NGOs/NPOs" : "educational institutions"}
          </p>
        )}
      </div>

      {/* Seat options */}
      <div className="mb-8">
        <p className="mb-3 text-sm font-medium text-zinc-300">Select seats</p>
        <div className="space-y-2">
          {SEAT_OPTIONS.map((opt, i) => {
            const pSeat  = PER_SEAT_PAISE[orgType] ?? PER_SEAT_PAISE.commercial;
            const total  = opt.seats > 0 ? paiseToINR(pSeat * opt.seats) : 0;
            const perSeatINR = paiseToINR(pSeat);
            return (
              <button key={i} onClick={() => setSelected(i)}
                className={`w-full rounded-2xl border px-5 py-3 text-left transition ${
                  selected === i
                    ? "border-indigo-400/50 bg-indigo-500/10 shadow-sm"
                    : "border-white/8 bg-white/4 hover:border-white/15"
                }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-zinc-100">
                      {opt.seats > 0 ? `${opt.seats} seats` : "Custom"} · {opt.label}
                    </span>
                    <span className="ml-2 rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-zinc-400">{opt.tier}</span>
                  </div>
                  <div className="text-right">
                    {opt.seats > 0 ? (
                      <>
                        <p className="text-base font-bold text-zinc-100">{formatINR(total)}/yr</p>
                        <p className="text-[10px] text-zinc-500">{formatINR(perSeatINR)}/seat/yr</p>
                      </>
                    ) : (
                      <p className="text-sm font-semibold text-indigo-300">Get a quote →</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Status */}
      {status && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
          status.ok
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : "border-red-500/30 bg-red-500/10 text-red-300"
        }`}>
          {status.msg}
        </div>
      )}

      {/* CTA */}
      <div className="space-y-3">
        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 py-4 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60">
          {loading
            ? "Preparing checkout…"
            : seatOpt.seats === 0
              ? "Request a custom quote →"
              : `Pay ${formatINR(totalINR)}/yr — Get started →`}
        </button>
        <p className="text-center text-xs text-zinc-600">
          Secure payment via Razorpay · UPI, cards & netbanking accepted ·{" "}
          <Link href="/org/new" className="underline hover:text-zinc-400">Or apply via the form</Link>
        </p>
      </div>

      {/* Features */}
      <div className="mt-10 rounded-2xl border border-white/8 bg-white/4 px-5 py-5">
        <p className="mb-3 text-sm font-medium text-zinc-300">All org plans include</p>
        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs text-zinc-400">
          {[
            "Org admin dashboard", "Member management", "Bulk CSV import",
            "Engagement analytics", "Audit log", "Custom branding (Enterprise)",
            "API access (Enterprise)", "SSO/SAML config", "Priority support",
            "Invoice & receipts", "Unlimited org members", "Sub-teams/cohorts",
          ].map((f) => (
            <div key={f} className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span>{f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
