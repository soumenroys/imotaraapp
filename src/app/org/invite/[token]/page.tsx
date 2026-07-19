"use client";
// src/app/org/invite/[token]/page.tsx
// Public invite acceptance page — user clicks link from email, signs in if needed, joins org.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import GoogleGIcon from "@/components/imotara/GoogleGIcon";

type Step = "loading" | "preview" | "signin_required" | "accepting" | "accepted" | "error";

interface InviteInfo {
  email: string; role: string; expiresAt: string;
  org: { name: string; billing_type: string; tier: string };
  orgSlug: string | null;
  domainAutoJoin: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  commercial: "Company", ngo: "NGO / NPO", edu: "Educational", govt: "Government",
};

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();

  const [step, setStep]         = useState<Step>("loading");
  const [invite, setInvite]     = useState<InviteInfo | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // 1. Load invite details + check auth state
  useEffect(() => {
    async function load() {
      const [inviteRes, authRes] = await Promise.all([
        fetch(`/api/org/invite/${token}`),
        fetch("/api/license/status", { credentials: "same-origin" }),
      ]);

      const invJson = await inviteRes.json();
      const authJson = await authRes.json().catch(() => null);

      if (!inviteRes.ok) {
        const msg =
          invJson.error === "invite already accepted" ? "This invite has already been accepted." :
          invJson.error === "invite expired"           ? "This invite link has expired. Ask your admin to resend." :
          invJson.error === "invite not found"         ? "Invite not found. The link may be invalid." :
          invJson.error ?? "Invalid invite link.";
        setErrorMsg(msg); setStep("error"); return;
      }

      setInvite(invJson.invite);
      const email = authJson?.user?.email ?? null;
      setUserEmail(email);
      setStep(email ? "preview" : "signin_required");
    }
    void load();
  }, [token]);

  // 2. Accept invite
  async function handleAccept() {
    setStep("accepting");
    const r = await fetch(`/api/org/invite/${token}`, { method: "POST", credentials: "same-origin" });
    const j = await r.json();
    if (!r.ok) {
      if (r.status === 401 || j.error === "unauthenticated") {
        setUserEmail(null);
        setStep("signin_required");
        return;
      }
      setErrorMsg(j.error ?? "Failed to join."); setStep("error"); return;
    }
    setStep("accepted");
  }

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
        <h1 className="mt-4 text-xl font-semibold text-zinc-100">Invite unavailable</h1>
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
        {invite && (
          <p className="mt-2 text-sm text-zinc-400">
            You&apos;ve been invited to join <strong className="text-zinc-200">{invite.org.name}</strong> as a {invite.role}.
            Sign in to continue.
          </p>
        )}
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href={`/settings?redirect=/org/invite/${token}`}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-white/10">
            <GoogleGIcon />
            Sign in
          </Link>
          <Link href={`/login?redirect=/org/invite/${token}`}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-white/10">
            Sign in with email &amp; password
          </Link>
        </div>
        <p className="mt-4 text-xs text-zinc-500">
          Was your account set up by an Imotara admin? Use email &amp; password. Everyone else uses the Google option.
        </p>
      </div>
    );
  }

  if (step === "accepted") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <span className="text-3xl">🎉</span>
        </div>
        <h1 className="mt-5 text-xl font-semibold text-zinc-100">Welcome to {invite?.org.name}!</h1>
        <p className="mt-2 text-sm text-zinc-400">
          You&apos;ve joined as a <strong className="text-zinc-200">{invite?.role}</strong>.
          Your account has been upgraded to the organisation plan.
        </p>
        <Link href="/org/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-500/80 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500">
          Open dashboard →
        </Link>
      </div>
    );
  }

  // preview / accepting
  const emailMismatch = !!(userEmail && invite && userEmail.toLowerCase() !== invite.email.toLowerCase());

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      {invite && (
        <>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-8 text-center">
            <p className="text-4xl">🤝</p>
            <h1 className="mt-4 text-xl font-semibold text-zinc-100">You&apos;re invited!</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Join <strong className="text-zinc-200">{invite.org.name}</strong> on Imotara
              as a <strong className="text-zinc-200">{invite.role}</strong>.
            </p>

            <div className="mt-5 space-y-2 text-left">
              {[
                { label: "Organisation", value: invite.org.name },
                { label: "Type",         value: TYPE_LABELS[invite.org.billing_type] ?? invite.org.billing_type },
                { label: "Your role",    value: invite.role.charAt(0).toUpperCase() + invite.role.slice(1) },
                { label: "Your account", value: userEmail ?? "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between rounded-xl border border-white/8 bg-white/4 px-4 py-2.5 text-sm">
                  <span className="text-zinc-500">{label}</span>
                  <span className="font-medium text-zinc-200">{value}</span>
                </div>
              ))}
            </div>

            {emailMismatch ? (
              invite.domainAutoJoin && invite.orgSlug ? (
                <>
                  <p className="mt-6 text-xs text-amber-400">
                    This invite was sent to {invite.email}, but {invite.org.name} also accepts anyone signing in with a matching email domain.
                  </p>
                  <Link href={`/org/join/${invite.orgSlug}`}
                    className="mt-3 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110">
                    Check if your email qualifies →
                  </Link>
                </>
              ) : (
                <p className="mt-6 text-xs text-rose-400">
                  This invite was sent to {invite.email}. Please sign in with that email to accept it.
                </p>
              )
            ) : (
              <button onClick={handleAccept} disabled={step === "accepting"}
                className="mt-6 w-full rounded-2xl bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60">
                {step === "accepting" ? "Joining…" : `Join ${invite.org.name}`}
              </button>
            )}

            <p className="mt-3 text-[11px] text-zinc-600">
              Expires {new Date(invite.expiresAt).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })}
            </p>
          </div>

          <p className="mt-4 text-center text-xs text-zinc-600">
            Wrong account?{" "}
            <Link href="/settings" className="underline hover:text-zinc-400">Sign in with a different account</Link>
            {" "}or{" "}
            <Link href={`/login?redirect=/org/invite/${token}`} className="underline hover:text-zinc-400">use email &amp; password instead</Link>
          </p>
        </>
      )}
    </div>
  );
}
