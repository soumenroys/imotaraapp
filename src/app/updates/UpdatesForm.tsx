"use client";

// src/app/updates/UpdatesForm.tsx
// The public opt-in form (BC-25, BC-28).

import Link from "next/link";
import { useState } from "react";

export default function UpdatesForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");   // honeypot
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, message, website, consent }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.error ?? "Something went wrong. Please try again."); return; }
      setDone(true);
    } catch { setError("Could not reach us — check your connection and try again."); }
    finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/8 p-6 text-center">
        <p className="text-2xl">🌸</p>
        <h2 className="mt-2 text-base font-semibold text-zinc-100">Thank you — we have your address.</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
          We write rarely, and only about Imotara. Every email carries a one-click
          unsubscribe link, and using it takes effect immediately — you never have
          to ask us twice.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-400">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            autoComplete="name"
            className="w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-indigo-500/50"
            placeholder="Optional"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-400">
            Email address <span className="text-rose-400">*</span>
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            autoComplete="email"
            className="w-full rounded-xl border border-white/10 bg-zinc-900/70 px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-indigo-500/50"
            placeholder="you@example.com"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-zinc-400">
          What would you like to hear about?
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={2000}
          className="w-full resize-y rounded-xl border border-white/10 bg-zinc-900/70 px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-indigo-500/50"
          placeholder="Optional — tell us what interests you, and we will keep that in mind."
        />
      </label>

      {/* Honeypot: never shown, never announced. A person cannot fill this in;
          a naive bot fills every field it finds. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-500"
        />
        <span className="text-xs leading-relaxed text-zinc-400">
          Imotara may email me about the app, new features and occasional offers.
          I can unsubscribe at any time using the link in any email. My address is
          stored by Imotara and processed by Resend, our email provider — it is
          never sold or shared with anyone else.
        </span>
      </label>

      {error && (
        <p className="rounded-xl border border-rose-400/25 bg-rose-500/8 px-3.5 py-2.5 text-xs text-rose-300">{error}</p>
      )}

      <button
        type="submit"
        disabled={busy || !email.trim() || !consent}
        className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "Sending…" : "Keep me posted"}
      </button>

      <p className="text-center text-[11px] leading-relaxed text-zinc-600">
        We record the time and the connection this was sent from, as evidence
        that the consent above was actually given. See our{" "}
        <Link href="/privacy" className="text-indigo-400 hover:underline">privacy policy</Link>.
      </p>
    </form>
  );
}
