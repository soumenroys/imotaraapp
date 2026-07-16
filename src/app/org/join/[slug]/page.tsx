"use client";
// src/app/org/join/[slug]/page.tsx
// Public, durable, repeatable domain-auto-join landing page — any number of
// users whose email domain matches can use this URL, unlike a single-use
// invite link. Org admins share this link directly (e.g. with their whole
// school/organisation) instead of sending individual invites.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Step = "loading" | "preview" | "signin_required" | "joining" | "joined" | "error";

interface JoinInfo {
  org: { name: string; billingType: string; tier: string };
  allowedDomains: string[];
}

const TYPE_LABELS: Record<string, string> = {
  commercial: "Company", ngo: "NGO / NPO", edu: "Educational", govt: "Government",
};

export default function JoinByDomainPage() {
  const { slug } = useParams<{ slug: string }>();

  const [step, setStep]           = useState<Step>("loading");
  const [info, setInfo]           = useState<JoinInfo | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [errorMsg, setErrorMsg]   = useState("");

  useEffect(() => {
    async function load() {
      const [joinRes, authRes] = await Promise.all([
        fetch(`/api/org/join-by-domain?slug=${encodeURIComponent(slug)}`),
        fetch("/api/license/status", { credentials: "same-origin" }),
      ]);

      const joinJson = await joinRes.json();
      const authJson = await authRes.json().catch(() => null);

      if (!joinRes.ok) {
        setErrorMsg(joinJson.error ?? "This organisation doesn't support domain auto-join.");
        setStep("error");
        return;
      }

      setInfo(joinJson);
      const email = authJson?.user?.email ?? null;
      setUserEmail(email);
      setStep(email ? "preview" : "signin_required");
    }
    void load();
  }, [slug]);

  async function handleJoin() {
    setStep("joining");
    const r = await fetch("/api/org/join-by-domain", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgSlug: slug }),
    });
    const j = await r.json();
    if (!r.ok) { setErrorMsg(j.error ?? "Failed to join."); setStep("error"); return; }
    setStep("joined");
  }

  const domainQualifies = !!(userEmail && info?.allowedDomains.some((d) => {
    const domain = userEmail.toLowerCase().split("@")[1] ?? "";
    return domain === d || domain.endsWith("." + d);
  }));

  if (step === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-indigo-400" />
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-4xl">⚠️</p>
        <h1 className="mt-4 text-xl font-semibold text-zinc-100">Can&apos;t join</h1>
        <p className="mt-2 text-sm text-zinc-400">{errorMsg}</p>
        <Link href="/" className="mt-6 inline-flex rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-zinc-300 transition hover:bg-white/10">
          Go to Imotara
        </Link>
      </div>
    );
  }

  if (step === "signin_required") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-4xl">🔐</p>
        <h1 className="mt-4 text-xl font-semibold text-zinc-100">Sign in to join</h1>
        {info && (
          <p className="mt-2 text-sm text-zinc-400">
            <strong className="text-zinc-200">{info.org.name}</strong> lets anyone with a matching email domain join automatically.
            Sign in to check if your account qualifies.
          </p>
        )}
        <Link href={`/settings?redirect=/org/join/${slug}`}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-500/80 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500">
          Sign in →
        </Link>
      </div>
    );
  }

  if (step === "joined") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <span className="text-3xl">🎉</span>
        </div>
        <h1 className="mt-5 text-xl font-semibold text-zinc-100">Welcome to {info?.org.name}!</h1>
        <p className="mt-2 text-sm text-zinc-400">Your account has been upgraded to the organisation plan.</p>
        <Link href="/org/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-500/80 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500">
          Open dashboard →
        </Link>
      </div>
    );
  }

  // preview / joining
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      {info && (
        <>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-8 text-center">
            <p className="text-4xl">🤝</p>
            <h1 className="mt-4 text-xl font-semibold text-zinc-100">Join {info.org.name}</h1>
            <p className="mt-2 text-sm text-zinc-400">
              {TYPE_LABELS[info.org.billingType] ?? info.org.billingType} on Imotara — open to anyone with a matching email domain.
            </p>

            <div className="mt-5 space-y-2 text-left">
              <div className="flex justify-between rounded-xl border border-white/8 bg-white/4 px-4 py-2.5 text-sm">
                <span className="text-zinc-500">Your account</span>
                <span className="font-medium text-zinc-200">{userEmail ?? "—"}</span>
              </div>
              <div className="flex justify-between rounded-xl border border-white/8 bg-white/4 px-4 py-2.5 text-sm">
                <span className="text-zinc-500">Qualifying domains</span>
                <span className="font-medium text-zinc-200">{info.allowedDomains.join(", ")}</span>
              </div>
            </div>

            {domainQualifies ? (
              <button onClick={handleJoin} disabled={step === "joining"}
                className="mt-6 w-full rounded-2xl bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60">
                {step === "joining" ? "Joining…" : `Join ${info.org.name}`}
              </button>
            ) : (
              <p className="mt-6 text-xs text-rose-400">
                Your account ({userEmail}) doesn&apos;t match any qualifying domain for this organisation.
              </p>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-zinc-600">
            Wrong account?{" "}
            <Link href="/settings" className="underline hover:text-zinc-400">Sign in with a different account</Link>
          </p>
        </>
      )}
    </div>
  );
}
