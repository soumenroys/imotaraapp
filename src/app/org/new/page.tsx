"use client";
// src/app/org/new/page.tsx
// User-facing org creation request form.
// Authenticated users submit their org details; Imotara admin manually approves.

import { useState, useEffect } from "react";
import Link from "next/link";

type BillingType = "commercial" | "ngo" | "edu" | "govt";

const TYPE_OPTIONS: { value: BillingType; label: string; desc: string; icon: string }[] = [
  { value: "commercial", label: "Company",     desc: "Corporate wellness or HR deployment",       icon: "🏢" },
  { value: "ngo",        label: "NGO / NPO",   desc: "Non-profit or community welfare program",   icon: "🤝" },
  { value: "edu",        label: "Educational", desc: "School, college, or counselling institute", icon: "🎓" },
  { value: "govt",       label: "Government",  desc: "Government or public sector programme",     icon: "🏛️" },
];

type Step = "form" | "submitted" | "stripe_paid";

export default function OrgNewPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Detect Stripe payment success redirect (?stripe_paid=1)
  const [stripePaid] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("stripe_paid") === "1"
  );

  const [step, setStep]       = useState<Step>(stripePaid ? "stripe_paid" : "form");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState("");

  const [orgName,      setOrgName]      = useState("");
  const [billingType,  setBillingType]  = useState<BillingType>("commercial");
  const [contactEmail, setContactEmail] = useState("");
  const [description,  setDescription]  = useState("");

  // Check auth via /api/license/status
  useEffect(() => {
    fetch("/api/license/status", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((json) => {
        setUserEmail(json?.user?.email ?? null);
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSubmitting(true);
    try {
      const res = await fetch("/api/org/new", {
        method:  "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:          orgName.trim(),
          billing_type:  billingType,
          contact_email: contactEmail.trim() || undefined,
          description:   description.trim()  || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Something went wrong."); return; }
      setStep("submitted");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Loading
  if (!authChecked) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-indigo-400" />
      </div>
    );
  }

  // Not signed in
  if (!userEmail) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-4xl">🔐</p>
        <h1 className="mt-4 text-xl font-semibold text-zinc-100">Sign in required</h1>
        <p className="mt-2 text-sm text-zinc-400">You need to be signed in to submit an organisation request.</p>
        <Link href="/settings" className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-500/80 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500">
          Sign in →
        </Link>
      </div>
    );
  }

  // Payment/enquiry sent — org being activated
  if (step === "stripe_paid") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/15 ring-1 ring-indigo-500/30">
          <span className="text-3xl">🎉</span>
        </div>
        <h1 className="mt-5 text-xl font-semibold text-zinc-100">Request received!</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Thank you! Our team will get in touch within <strong className="text-zinc-200">24–48 hours</strong> with payment details and account activation steps.
        </p>
        <div className="mt-5 rounded-2xl border border-indigo-400/20 bg-indigo-500/8 px-5 py-4 text-sm text-zinc-400 text-left space-y-2">
          <p>✅ Enquiry sent to info@imotara.com</p>
          <p>⏳ Team will activate your org account after payment</p>
          <p>📧 You&apos;ll receive an email at <strong className="text-zinc-200">{userEmail ?? "your email"}</strong> with next steps</p>
          <p>🏢 After activation, access your dashboard at <strong className="text-zinc-200">/org/dashboard</strong></p>
        </div>
        <p className="mt-4 text-xs text-zinc-600">
          Questions? Email <a href="mailto:info@imotara.com" className="underline hover:text-zinc-400">info@imotara.com</a>
        </p>
      </div>
    );
  }

  // Submitted confirmation
  if (step === "submitted") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <span className="text-3xl">✅</span>
        </div>
        <h1 className="mt-5 text-xl font-semibold text-zinc-100">Request submitted!</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Your organisation request for <span className="font-medium text-zinc-200">{orgName}</span> has been
          received. We&apos;ll review it and email{" "}
          <span className="font-medium text-zinc-200">{userEmail}</span> within 24–48 hours.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Once approved, you&apos;ll be able to invite your team from the org dashboard.
        </p>
        <Link href="/" className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-zinc-300 transition hover:bg-white/10">
          Back to home
        </Link>
      </div>
    );
  }

  // Form
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Imotara for Organisations</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-100">Set up your organisation</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Deploy Imotara for your company, NGO, or institution. Submit your details
          and our team will set up your account within 24–48 hours.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Org name */}
        <div>
          <label className="block text-sm font-medium text-zinc-200 mb-1.5">
            Organisation name <span className="text-rose-400">*</span>
          </label>
          <input
            required
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="e.g. Acme Wellness, Hope Foundation"
            maxLength={80}
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-500/40"
          />
        </div>

        {/* Org type */}
        <div>
          <label className="block text-sm font-medium text-zinc-200 mb-2">
            Organisation type <span className="text-rose-400">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setBillingType(opt.value)}
                className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  billingType === opt.value
                    ? "border-indigo-400/50 bg-indigo-500/10 shadow-sm"
                    : "border-white/8 bg-white/4 hover:border-white/15 hover:bg-white/8"
                }`}
              >
                <span className="mt-0.5 text-lg leading-none">{opt.icon}</span>
                <div>
                  <p className="text-sm font-medium text-zinc-100">{opt.label}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Contact email */}
        <div>
          <label className="block text-sm font-medium text-zinc-200 mb-1.5">
            Billing / contact email
            <span className="ml-1.5 text-[11px] font-normal text-zinc-500">(if different from your account email)</span>
          </label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder={userEmail ?? "billing@yourorg.com"}
            className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-500/40"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-zinc-200 mb-1.5">
            Brief description
            <span className="ml-1.5 text-[11px] font-normal text-zinc-500">(optional — helps us tailor your setup)</span>
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 200-person company, need Pro tier for HR team. Or: NGO supporting 500 rural students in West Bengal."
            maxLength={500}
            className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-500/40"
          />
        </div>

        {/* Signed-in as */}
        <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-2.5 text-xs text-zinc-500">
          Submitting as <span className="font-medium text-zinc-300">{userEmail}</span>.
          You&apos;ll be set as the organisation owner.
        </div>

        {error && (
          <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !orgName.trim()}
          className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit organisation request"}
        </button>

        <p className="text-center text-xs text-zinc-600">
          Questions? Email{" "}
          <a href="mailto:info@imotara.com" className="underline hover:text-zinc-400">info@imotara.com</a>
        </p>
      </form>
    </div>
  );
}
