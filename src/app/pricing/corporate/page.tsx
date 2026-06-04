"use client";
// src/app/pricing/corporate/page.tsx
// Corporate/NGO/EDU self-service seat purchase page.
// Users choose org type, number of seats, and checkout via Stripe or request quote.

import { useState } from "react";
import Link from "next/link";

const ORG_TYPES = [
  { value: "commercial", label: "Company",     icon: "🏢", desc: "Corporate wellness / HR deployment" },
  { value: "ngo",        label: "NGO / NPO",   icon: "🤝", desc: "Non-profit, community welfare" },
  { value: "edu",        label: "Educational", icon: "🎓", desc: "Schools, colleges, counselling" },
  { value: "govt",       label: "Government",  icon: "🏛️", desc: "Government or public sector" },
];

// Tiers MUST match server-side tierForSeats() in /api/payments/stripe/checkout:
//   < 100 seats → "plus", >= 100 seats → "enterprise", edu → "edu"
const SEAT_TIERS = [
  { seats: 10,    price_usd: 49,   price_inr: 4_000,  tier: "plus",       label: "Starter"    },
  { seats: 50,    price_usd: 199,  price_inr: 16_500,  tier: "plus",       label: "Team"       },
  { seats: 100,   price_usd: 349,  price_inr: 29_000,  tier: "enterprise", label: "Department" },
  { seats: 500,   price_usd: 999,  price_inr: 83_000,  tier: "enterprise", label: "Enterprise" },
  { seats: 0,     price_usd: 0,    price_inr: 0,        tier: "enterprise", label: "Custom"     },
];

const NGO_DISCOUNT = 0.6; // 60% discount for NGOs
const EDU_DISCOUNT = 0.5; // 50% discount for EDU

function getDiscount(orgType: string) {
  if (orgType === "ngo")  return NGO_DISCOUNT;
  if (orgType === "edu")  return EDU_DISCOUNT;
  return 0;
}

function formatINR(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}
function formatUSD(amount: number) {
  return `$${amount.toFixed(0)}`;
}

export default function CorporatePricingPage() {
  const [orgType, setOrgType]     = useState("commercial");
  const [selected, setSelected]   = useState(1); // index in SEAT_TIERS
  const [currency, setCurrency]   = useState<"inr"|"usd">("inr");
  const [checking, setChecking]   = useState(false);
  const [error, setError]         = useState("");

  const discount = getDiscount(orgType);
  const seatTier = SEAT_TIERS[selected];
  const basePrice = currency === "inr" ? seatTier.price_inr : seatTier.price_usd;
  const finalPrice = Math.round(basePrice * (1 - discount));

  async function handleCheckout() {
    if (seatTier.seats === 0) {
      window.location.href = "/org/new";
      return;
    }
    setChecking(true); setError("");
    try {
      // Send orgType + seats — server uses price_data (no pre-configured price ID needed)
      const r = await fetch("/api/payments/stripe/checkout", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgType, seats: seatTier.seats, currency }),
      });
      const j = await r.json();
      if (r.ok && j.url) { window.location.href = j.url; }
      else { setError(j.error ?? "Failed to create checkout session. Please try again."); }
    } finally { setChecking(false); }
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

      {/* Org type selector */}
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
        {discount > 0 && (
          <p className="mt-2 text-xs text-emerald-400">
            🎉 {Math.round(discount * 100)}% discount applied for {orgType === "ngo" ? "NGOs/NPOs" : "educational institutions"}
          </p>
        )}
      </div>

      {/* Seat tier selector */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-300">Select seats</p>
          <div className="flex gap-1 rounded-xl border border-white/8 bg-white/5 p-0.5">
            {(["inr","usd"] as const).map((c) => (
              <button key={c} onClick={() => setCurrency(c)}
                className={`rounded-lg px-3 py-1 text-[11px] transition ${currency === c ? "bg-white/10 font-medium text-zinc-100" : "text-zinc-500"}`}>
                {c === "inr" ? "₹ INR" : "$ USD"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {SEAT_TIERS.map((tier, i) => {
            const base   = currency === "inr" ? tier.price_inr : tier.price_usd;
            const final  = Math.round(base * (1 - discount));
            const perSeat = tier.seats > 0 ? Math.round(final / tier.seats) : 0;
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
                      {tier.seats > 0 ? `${tier.seats} seats` : "Custom"} · {tier.label}
                    </span>
                    <span className="ml-2 rounded-full bg-white/8 px-2 py-0.5 text-[10px] capitalize text-zinc-400">{tier.tier}</span>
                  </div>
                  <div className="text-right">
                    {tier.seats > 0 ? (
                      <>
                        <p className={`text-base font-bold ${discount > 0 ? "text-emerald-300" : "text-zinc-100"}`}>
                          {currency === "inr" ? formatINR(final) : formatUSD(final)}/yr
                        </p>
                        {discount > 0 && base > 0 && (
                          <p className="text-[10px] text-zinc-500 line-through">{currency === "inr" ? formatINR(base) : formatUSD(base)}/yr</p>
                        )}
                        <p className="text-[10px] text-zinc-500">{currency === "inr" ? formatINR(perSeat) : formatUSD(perSeat)}/seat/yr</p>
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

      {/* CTA */}
      <div className="space-y-3">
        {error && <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">{error}</p>}
        <button onClick={handleCheckout} disabled={checking}
          className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 py-4 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60">
          {checking ? "Preparing checkout…"
            : seatTier.seats === 0 ? "Request a custom quote →"
            : `Proceed to checkout — ${currency === "inr" ? formatINR(finalPrice) : formatUSD(finalPrice)}/yr`}
        </button>
        <p className="text-center text-xs text-zinc-600">
          Secure payment via Stripe · Cancel anytime · Invoice provided ·{" "}
          <Link href="/org/new" className="underline hover:text-zinc-400">Or apply for manual approval</Link>
        </p>
      </div>

      {/* Features included */}
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
