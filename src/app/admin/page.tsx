"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, useTransition } from "react";
import type { LicenseTier } from "@/types/license";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Comment {
  id: string;
  slug: string;
  name: string;
  message: string;
  approved: boolean;
  created_at: string;
}
type CommentTab = "pending" | "approved" | "all";

type LicenseStatus = "valid" | "invalid" | "expired" | "trial";

interface UserLicense {
  user_id: string;
  email: string;
  user_created_at: string;
  tier: LicenseTier | null;
  status: LicenseStatus | null;
  expires_at: string | null;
  token_balance: number | null;
  source: string | null;
  license_notes: string | null;
  license_created_at: string | null;
  license_updated_at: string | null;
  banned_at?: string | null;
}

interface UserDetail {
  id: string;
  email: string | null;
  emailVerified: boolean;
  lastSignInAt: string | null;
  provider: string | null;
  providers: string[];
  createdAt: string;
}

interface PaymentRecord {
  payment_id: string;
  product_id: string;
  tier: string;
  amount_paise: number;
  currency: string;
  granted_at: string;
}

interface HistoryEntry {
  id: string;
  admin_label: string;
  user_id: string;
  user_email: string;
  action: string;
  old_tier: string | null;
  new_tier: string | null;
  old_status: string | null;
  new_status: string | null;
  old_expires_at: string | null;
  new_expires_at: string | null;
  old_token_balance: number | null;
  new_token_balance: number | null;
  notes: string | null;
  created_at: string;
}

interface DetailResponse {
  user: UserDetail | null;
  license: Record<string, unknown> | null;
  history: HistoryEntry[];
  payments: PaymentRecord[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_KEY = "imotara_admin_token";

/** Returns fetch options with correct auth.
 *  Session-based login → use cookie (credentials:same-origin, no Bearer).
 *  Legacy secret key → send as Authorization Bearer header. */
function adminFetchOpts(token: string, extra?: RequestInit): RequestInit {
  const isSession = token.startsWith("session:");
  return {
    credentials: "same-origin",
    ...extra,
    headers: {
      ...(isSession ? {} : { Authorization: `Bearer ${token}` }),
      ...(extra?.headers ?? {}),
    },
  };
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 30
    ? `${days}d ago`
    : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function tierBadge(tier: string | null) {
  if (tier === "pro")         return "text-indigo-300 bg-indigo-500/15 ring-1 ring-indigo-500/20";
  if (tier === "plus")        return "text-sky-300 bg-sky-500/15 ring-1 ring-sky-500/20";
  if (tier === "family")      return "text-violet-300 bg-violet-500/15 ring-1 ring-violet-500/20";
  if (tier === "edu")         return "text-teal-300 bg-teal-500/15 ring-1 ring-teal-500/20";
  if (tier === "enterprise")  return "text-orange-300 bg-orange-500/15 ring-1 ring-orange-500/20";
  return "text-zinc-400 bg-zinc-500/10 ring-1 ring-zinc-500/20";
}

function statusBadge(status: string | null) {
  if (status === "valid")   return "text-emerald-300 bg-emerald-500/15 ring-1 ring-emerald-500/20";
  if (status === "trial")   return "text-amber-300 bg-amber-500/15 ring-1 ring-amber-500/20";
  if (status === "invalid" || status === "expired")
    return "text-rose-300 bg-rose-500/15 ring-1 ring-rose-500/20";
  return "text-zinc-400 bg-zinc-500/10 ring-1 ring-zinc-500/20";
}

function actionColor(action: string) {
  if (action === "assign")       return "text-emerald-300";
  if (action === "extend")       return "text-sky-300";
  if (action === "withdraw")     return "text-rose-300";
  if (action === "tier_change")  return "text-indigo-300";
  if (action === "token_adjust") return "text-amber-300";
  return "text-zinc-500";
}

function providerLabel(p: string | null) {
  if (!p) return "—";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Eye icon (inline SVG — no extra dep)
// ─────────────────────────────────────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-6.5 0-10-8-10-8a18.4 18.4 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LoginGate
// ─────────────────────────────────────────────────────────────────────────────

function LoginGate({ onAuth }: { onAuth: (token: string) => void }) {
  const [loginMode, setLoginMode] = useState<"email" | "secret">("email");

  // Email + password mode
  const [email, setEmail]         = useState("");
  const [emailPwd, setEmailPwd]   = useState("");
  const [showEmailPwd, setShowEmailPwd] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailPending, startEmailTransition] = useTransition();

  // Forgot password mode
  const [showForgot, setShowForgot]       = useState(false);
  const [forgotEmail, setForgotEmail]     = useState("");
  const [forgotMsg, setForgotMsg]         = useState("");
  const [forgotPending, startForgotTrans] = useTransition();

  // Password reset mode (when ?reset_token= is in URL)
  const [resetToken]                       = useState(() => typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("reset_token") : null);
  const [resetAdminName, setResetAdminName] = useState("");
  const [newPwd, setNewPwd]                = useState("");
  const [newPwd2, setNewPwd2]              = useState("");
  const [resetMsg, setResetMsg]            = useState("");
  const [resetPending, startResetTrans]    = useTransition();

  // Validate reset token on mount
  useEffect(() => {
    if (!resetToken) return;
    fetch(`/api/admin/auth/reset-password?token=${resetToken}`)
      .then((r) => r.json())
      .then((j) => { if (j.valid) setResetAdminName(j.name ?? ""); else setResetMsg(j.error ?? "Invalid link."); })
      .catch(() => setResetMsg("Could not validate reset link."));
  }, [resetToken]);

  function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    startForgotTrans(async () => {
      const r = await fetch("/api/admin/auth/forgot-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const j = await r.json().catch(() => ({}));
      setForgotMsg(j.message ?? "Request sent.");
    });
  }

  function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd !== newPwd2) { setResetMsg("Passwords do not match."); return; }
    startResetTrans(async () => {
      const r = await fetch("/api/admin/auth/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password: newPwd }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setResetMsg("Password updated! Redirecting to login…");
        setTimeout(() => { window.location.href = "/admin"; }, 2000);
      } else {
        setResetMsg(j.error ?? "Reset failed.");
      }
    });
  }

  // Secret key mode (legacy)
  const [value, setValue]       = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState("");
  const [isPending, startTransition] = useTransition();

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    startEmailTransition(async () => {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: emailPwd }),
      });
      if (res.ok) {
        const j = await res.json();
        // Use email as the "token" so existing code still works for display
        sessionStorage.setItem(SESSION_KEY, `session:${j.admin?.name ?? email}`);
        onAuth(`session:${j.admin?.name ?? email}`);
      } else {
        const j = await res.json().catch(() => ({}));
        setEmailError(j.error ?? "Invalid email or password");
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await fetch("/api/admin/comments", {
        headers: { Authorization: `Bearer ${value.trim()}` },
      });
      if (res.ok) {
        sessionStorage.setItem(SESSION_KEY, value.trim());
        onAuth(value.trim());
      } else {
        setError("Incorrect secret key. Check ADMIN_SECRET in .env.local");
      }
    });
  }

  const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-4 pr-10 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-indigo-500/40";

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-4xl flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-6">

        {/* ── LEFT: Login card ─────────────────────────────────────────────── */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col rounded-2xl border border-white/10 bg-white/5 px-6 py-8 backdrop-blur-xl gap-6">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-black/30 shadow-lg ring-1 ring-white/10">
            <Image src="/android-chrome-192.png" width={48} height={48} alt="Imotara" className="rounded-xl" priority />
          </div>
          <h1 className="mt-3 text-base font-semibold text-zinc-100">Imotara Admin</h1>
          <p className="mt-0.5 text-xs text-zinc-500">Super-admin panel</p>
        </div>

        {/* Mode switcher */}
        <div className="flex rounded-xl border border-white/8 bg-white/5 p-1">
          <button type="button" onClick={() => setLoginMode("email")}
            className={`flex-1 rounded-lg py-1.5 text-xs transition ${loginMode === "email" ? "bg-white/10 font-medium text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>
            Email / Password
          </button>
          <button type="button" onClick={() => setLoginMode("secret")}
            className={`flex-1 rounded-lg py-1.5 text-xs transition ${loginMode === "secret" ? "bg-white/10 font-medium text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>
            Secret key
          </button>
        </div>

        {/* Password reset flow — shown when ?reset_token= is in URL */}
        {resetToken && (
          <div className="space-y-3">
            {resetAdminName && <p className="text-sm text-zinc-300">Hi <strong>{resetAdminName}</strong> — set a new password.</p>}
            {resetMsg && <p className={`text-xs ${resetMsg.includes("updated") ? "text-emerald-400" : "text-rose-400"}`}>{resetMsg}</p>}
            {resetAdminName && !resetMsg.includes("updated") && (
              <form onSubmit={handleReset} className="space-y-3">
                <input type="password" placeholder="New password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required minLength={12} className={inputCls} />
                <input type="password" placeholder="Confirm password" value={newPwd2} onChange={(e) => setNewPwd2(e.target.value)} required minLength={12} className={inputCls} />
                <PasswordStrength password={newPwd} />
                <button type="submit" disabled={resetPending} className="w-full rounded-xl bg-indigo-600/80 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-60">
                  {resetPending ? "Updating…" : "Set new password"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Email + password login */}
        {!resetToken && loginMode === "email" && !showForgot && (
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <input type="email" placeholder="admin@imotara.com" value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(""); }} autoFocus required className={inputCls} />
            <div className="relative">
              <input type={showEmailPwd ? "text" : "password"} placeholder="Password" value={emailPwd} onChange={(e) => { setEmailPwd(e.target.value); setEmailError(""); }} required className={inputCls} />
              <button type="button" onClick={() => setShowEmailPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"><EyeIcon open={showEmailPwd} /></button>
            </div>
            {emailError && <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{emailError}</p>}
            <button type="submit" disabled={emailPending} className="w-full rounded-xl bg-indigo-600/80 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-60">
              {emailPending ? "Signing in…" : "Sign in"}
            </button>
            <button type="button" onClick={() => { setShowForgot(true); setForgotEmail(email); }} className="w-full text-center text-[11px] text-zinc-500 hover:text-indigo-400 transition">
              Forgot password?
            </button>
            <p className="text-center text-[11px] text-zinc-600">First time? Run <code className="text-zinc-400">POST /api/admin/auth/seed</code> to create owner account.</p>
          </form>
        )}

        {/* Forgot password flow */}
        {!resetToken && loginMode === "email" && showForgot && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-300">Enter your admin email — we&apos;ll send a reset link (expires in 15 min).</p>
            {forgotMsg ? (
              <div className="space-y-3">
                <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{forgotMsg}</p>
                <button onClick={() => { setShowForgot(false); setForgotMsg(""); }} className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition">← Back to sign in</button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-3">
                <input type="email" placeholder="Your admin email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required autoFocus className={inputCls} />
                <button type="submit" disabled={forgotPending} className="w-full rounded-xl bg-indigo-600/80 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-60">
                  {forgotPending ? "Sending…" : "Send reset link"}
                </button>
                <button type="button" onClick={() => setShowForgot(false)} className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition">← Back to sign in</button>
              </form>
            )}
          </div>
        )}

        {/* Legacy secret key login */}
        {loginMode === "secret" && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              placeholder="Enter admin secret key"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(""); }}
              autoFocus
              required
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-300"
              aria-label={showPwd ? "Hide key" : "Show key"}
            >
              <EyeIcon open={showPwd} />
            </button>
          </div>

          {error && <p className="text-[11px] text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={isPending || !value.trim()}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 py-2.5 text-sm font-medium text-white shadow-sm transition hover:brightness-110 disabled:opacity-40"
          >
            {isPending ? "Verifying…" : "Sign in"}
          </button>
        </form>
        )}

        <p className="mt-auto text-center text-[10px] text-zinc-600">
          Set <code className="text-zinc-400">ADMIN_SECRET</code> in{" "}
          <code className="text-zinc-400">.env.local</code>
        </p>
        </div>
        {/* ── RIGHT: Guide panel ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col rounded-2xl border border-indigo-400/25 bg-gradient-to-br from-indigo-500/10 via-sky-500/5 to-transparent p-5 backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-indigo-400/15 shrink-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-xl">
              📋
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-100">Admin &amp; Licensing Guide</p>
              <p className="text-xs text-zinc-400 mt-0.5">Step-by-step tutorials — open before you begin</p>
            </div>
          </div>

          {/* Guide links — 2×2 grid, each card stretches to fill equal height */}
          <div className="grid flex-1 grid-cols-2 gap-3">
            {[
              { href: "/admin/guide?s=policy",    icon: "🏷️", label: "Licensing Policy",  desc: "Tiers, pricing, priority chain, payment gateways" },
              { href: "/admin/guide?s=superadmin", icon: "👑", label: "Super-Admin Guide", desc: "Login, create orgs, issue pools, manage admins" },
              { href: "/admin/guide?s=orgadmin",   icon: "🏢", label: "Org Admin Guide",   desc: "Invite members, assign licenses, analytics" },
              { href: "/admin/guide?s=faq",        icon: "❓", label: "FAQ",               desc: "Activate pending orgs, fix tier issues & more" },
            ].map(({ href, icon, label, desc }) => (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                className="flex flex-col gap-2 rounded-xl border border-white/8 bg-white/4 px-4 py-4 transition hover:border-indigo-400/40 hover:bg-indigo-500/10 group">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{icon}</span>
                  <svg className="h-3.5 w-3.5 text-zinc-700 group-hover:text-indigo-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-zinc-200 group-hover:text-white transition">{label}</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{desc}</p>
              </a>
            ))}
          </div>

          {/* Footer hint */}
          <p className="mt-4 shrink-0 text-center text-[10px] text-zinc-600">
            All guides open in a new tab · No login required to read
          </p>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CommentCard (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function CommentCard({
  comment,
  token,
  onApproved,
  onDeleted,
}: {
  comment: Comment;
  token: string;
  onApproved: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const [approving, setApproving] = useState(false);
  const [deleting,  setDeleting]  = useState(false);

  async function approve() {
    setApproving(true);
    const res = await fetch(`/api/admin/comments/${comment.id}`, adminFetchOpts(token, { method: "PATCH" }));
    if (res.ok) onApproved(comment.id);
    else setApproving(false);
  }

  async function remove() {
    if (!confirm(`Delete comment by "${comment.name}"?`)) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/comments/${comment.id}`, adminFetchOpts(token, { method: "DELETE" }));
    if (res.ok) onDeleted(comment.id);
    else setDeleting(false);
  }

  return (
    <div className={`rounded-2xl border px-5 py-4 backdrop-blur-md transition ${
      comment.approved ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/10 bg-white/5"
    }`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-[11px] font-bold text-white">
              {comment.name.charAt(0).toUpperCase()}
            </span>
            <span className="text-sm font-medium text-zinc-200">{comment.name}</span>
            {comment.approved && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400 ring-1 ring-emerald-500/20">
                Approved
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <a href={`/blog/${comment.slug}`} target="_blank" rel="noopener noreferrer"
               className="text-[10px] text-indigo-400 transition hover:text-indigo-300">
              /blog/{comment.slug}
            </a>
            <span className="text-[10px] text-zinc-600">{timeAgo(comment.created_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!comment.approved && (
            <button onClick={approve} disabled={approving}
              className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40">
              {approving ? "Approving…" : "Approve"}
            </button>
          )}
          <button onClick={remove} disabled={deleting}
            className="flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40">
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-300">{comment.message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UserLicenseRow — enhanced with auth info, payment history, token delta
// ─────────────────────────────────────────────────────────────────────────────

function UserLicenseRow({
  user,
  token,
  onUpdated,
}: {
  user: UserLicense;
  token: string;
  onUpdated: () => void;
}) {
  const [expanded, setExpanded]       = useState(false);
  const [detail, setDetail]           = useState<DetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [form, setForm] = useState({
    tier:         (user.tier   ?? "free") as LicenseTier,
    status:       (user.status ?? "valid") as LicenseStatus,
    expiresAt:    user.expires_at ? user.expires_at.slice(0, 10) : "",
    tokenBalance: user.token_balance ?? 0,
    notes:        user.license_notes ?? "",
  });

  const [saving, setSaving]         = useState(false);
  const [savedMsg, setSavedMsg]     = useState("");
  const [tokenDeltaInput, setTokenDeltaInput] = useState("");
  const [isBanned, setIsBanned]     = useState<boolean>(!!user.banned_at);
  const [banReason, setBanReason]   = useState("");
  const [banLoading, setBanLoading] = useState(false);

  // Collapsible sub-sections
  const [showPayments, setShowPayments] = useState(false);
  const [showHistory,  setShowHistory]  = useState(false);

  // Fetch detail when expanded
  useEffect(() => {
    if (!expanded || detail) return;
    setDetailLoading(true);
    fetch(`/api/admin/licenses/${user.user_id}`, adminFetchOpts(token))
      .then((r) => r.json())
      .then((d: DetailResponse) => setDetail(d))
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, [expanded, detail, user.user_id, token]);

  // Patch the license
  async function persist(overrides?: Partial<typeof form> & { tokenDelta?: number }) {
    const payload = { ...form, ...overrides };
    setSaving(true);
    setSavedMsg("");
    const body: Record<string, unknown> = {
      userEmail: user.email,
      tier:     payload.tier,
      status:   payload.status,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt).toISOString() : null,
      notes:    payload.notes || null,
    };
    if (overrides?.tokenDelta !== undefined) {
      body.tokenDelta = overrides.tokenDelta;
    } else {
      body.tokenBalance = Number(payload.tokenBalance);
    }
    const res = await fetch(`/api/admin/licenses/${user.user_id}`, adminFetchOpts(token, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }));
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setSavedMsg(`✓ Saved (${data.action})`);
      setTimeout(() => setSavedMsg(""), 3000);
      // Refresh detail
      setDetail(null);
      onUpdated();
    } else {
      const err = await res.json().catch(() => ({}));
      setSavedMsg(`Error: ${err.error ?? "unknown"}`);
    }
  }

  function quickExtend(days: number) {
    const base    = form.expiresAt ? new Date(form.expiresAt) : new Date();
    const newExpMs = Math.max(base.getTime(), Date.now()) + days * 86_400_000;
    const updated  = { ...form, expiresAt: new Date(newExpMs).toISOString().slice(0, 10), status: "valid" as LicenseStatus };
    setForm(updated);
    persist(updated);
  }

  function withdraw() {
    if (!confirm(`Withdraw license for ${user.email}?\nThis sets status to "invalid".`)) return;
    const updated = { ...form, status: "invalid" as LicenseStatus };
    setForm(updated);
    persist(updated);
  }

  function resetToFree() {
    if (!confirm(`Reset ${user.email} to free tier with no expiry?`)) return;
    const updated: typeof form = { tier: "free", status: "valid", expiresAt: "", tokenBalance: 0, notes: form.notes };
    setForm(updated);
    persist(updated);
  }

  async function toggleBan() {
    if (!isBanned && !banReason.trim()) { setSavedMsg("Enter a ban reason first"); return; }
    if (!confirm(isBanned ? `Unban ${user.email}?` : `Ban ${user.email}? They will lose access immediately.`)) return;
    setBanLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.user_id}/ban`, {
        method: isBanned ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: isBanned ? undefined : JSON.stringify({ reason: banReason.trim() }),
      });
      const d = await res.json();
      if (d.ok) { setIsBanned(!isBanned); setBanReason(""); setSavedMsg(isBanned ? "✓ Unbanned" : "✓ Banned"); }
      else setSavedMsg(`Error: ${d.error ?? "unknown"}`);
    } catch { setSavedMsg("Network error"); }
    finally { setBanLoading(false); setTimeout(() => setSavedMsg(""), 3000); }
  }

  function addTokenDelta() {
    const delta = parseInt(tokenDeltaInput);
    if (isNaN(delta) || delta === 0) return;
    setTokenDeltaInput("");
    persist({ tokenDelta: delta });
    // Optimistic update to displayed balance
    setForm((f) => ({ ...f, tokenBalance: Math.max(0, f.tokenBalance + delta) }));
  }

  const isExpired = form.expiresAt && new Date(form.expiresAt) < new Date();
  const authUser  = detail?.user ?? null;

  return (
    <div className={`rounded-2xl border backdrop-blur-md transition ${
      expanded ? "border-indigo-500/30 bg-indigo-500/[0.04]" : "border-white/10 bg-white/5"
    }`}>
      {/* ── Summary row ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-200">{user.email}</p>
          <p className="mt-0.5 text-[10px] text-zinc-600">
            Joined {fmtDate(user.user_created_at)}
            {user.license_updated_at && ` · License updated ${timeAgo(user.license_updated_at)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${tierBadge(user.tier)}`}>
            {user.tier ?? "no license"}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusBadge(user.status)}`}>
            {user.status ?? "—"}
          </span>
          {user.expires_at && (
            <span className={`text-[10px] ${isExpired ? "text-rose-400" : "text-zinc-500"}`}>
              {isExpired ? "Expired" : "Exp"} {fmtDate(user.expires_at)}
            </span>
          )}
          {(user.token_balance ?? 0) > 0 && (
            <span className="text-[10px] text-amber-400">{user.token_balance} tokens</span>
          )}
          {isBanned && (
            <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-400">⛔ Banned</span>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-zinc-400 transition hover:text-zinc-200"
          >
            {expanded ? "Close ✕" : "Edit →"}
          </button>
        </div>
      </div>

      {/* ── Expanded panel ── */}
      {expanded && (
        <div className="border-t border-white/8 px-5 py-4 space-y-5">

          {/* Auth info strip */}
          {detailLoading ? (
            <div className="h-5 w-64 animate-pulse rounded bg-white/5" />
          ) : authUser && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
              <span className="text-[10px] text-zinc-500">
                <span className="mr-1 text-zinc-600">Provider</span>
                <span className="font-medium text-zinc-300">{providerLabel(authUser.provider)}</span>
              </span>
              <span className="text-zinc-700">·</span>
              <span className="text-[10px] text-zinc-500">
                <span className="mr-1 text-zinc-600">Last sign-in</span>
                <span className="font-medium text-zinc-300">{timeAgo(authUser.lastSignInAt)}</span>
              </span>
              <span className="text-zinc-700">·</span>
              <span className={`text-[10px] font-medium ${authUser.emailVerified ? "text-emerald-400" : "text-amber-400"}`}>
                {authUser.emailVerified ? "✓ Email verified" : "⚠ Email unverified"}
              </span>
            </div>
          )}

          {/* ── Tier quick-set ── */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Plan tier</p>
            <div className="flex flex-wrap gap-2">
              {(["free", "plus", "pro", "family", "edu", "enterprise"] as LicenseTier[]).map((t) => (
                <button key={t} type="button"
                  onClick={() => setForm((f) => ({ ...f, tier: t }))}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase transition ${
                    form.tier === t ? tierBadge(t) : "border-white/10 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* ── Quick actions ── */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Duration</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => quickExtend(31)}
                className="rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-[11px] text-sky-300 transition hover:bg-sky-500/20">
                +1 month
              </button>
              <button type="button" onClick={() => quickExtend(90)}
                className="rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-[11px] text-sky-300 transition hover:bg-sky-500/20">
                +3 months
              </button>
              <button type="button" onClick={() => quickExtend(366)}
                className="rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-[11px] text-sky-300 transition hover:bg-sky-500/20">
                +1 year
              </button>
              <button type="button" onClick={withdraw}
                className="rounded-full border border-rose-500/25 bg-rose-500/10 px-3 py-1 text-[11px] text-rose-300 transition hover:bg-rose-500/20">
                Withdraw
              </button>
              <button type="button" onClick={resetToFree}
                className="rounded-full border border-zinc-500/25 bg-zinc-500/10 px-3 py-1 text-[11px] text-zinc-400 transition hover:bg-zinc-500/20">
                Reset to free
              </button>
            </div>
          </div>

          {/* ── License fields ── */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">License details</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-[10px] text-zinc-500">Status</label>
                <select value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as LicenseStatus })}
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-indigo-500/40">
                  {(["valid", "trial", "expired", "invalid"] as LicenseStatus[]).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-zinc-500">Expires at</label>
                <input type="date" value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-indigo-500/40" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-zinc-500">Token balance (set)</label>
                <input type="number" min={0} value={form.tokenBalance}
                  onChange={(e) => setForm({ ...form, tokenBalance: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-indigo-500/40" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-zinc-500">Notes (internal)</label>
                <input value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="promo, refund…"
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-indigo-500/40" />
              </div>
            </div>
          </div>

          {/* ── Token top-up (delta mode) ── */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Add / remove tokens
              <span className="ml-2 normal-case tracking-normal text-zinc-600 font-normal">
                (current: {form.tokenBalance})
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {[100, 250, 600, 1800].map((n) => (
                <button key={n} type="button"
                  onClick={() => { persist({ tokenDelta: n }); setForm((f) => ({ ...f, tokenBalance: f.tokenBalance + n })); }}
                  className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-300 transition hover:bg-amber-500/20">
                  +{n}
                </button>
              ))}
              <span className="text-zinc-700">|</span>
              <input
                type="number"
                value={tokenDeltaInput}
                onChange={(e) => setTokenDeltaInput(e.target.value)}
                placeholder="±custom"
                className="w-20 rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-amber-500/40"
              />
              <button type="button" onClick={addTokenDelta}
                disabled={!tokenDeltaInput || isNaN(parseInt(tokenDeltaInput))}
                className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-40">
                Apply
              </button>
            </div>
          </div>

          {/* ── Save row ── */}
          <div className="flex items-center justify-between gap-3 border-t border-white/8 pt-3">
            {savedMsg && (
              <span className={`text-[11px] ${savedMsg.startsWith("✓") ? "text-emerald-400" : "text-rose-400"}`}>
                {savedMsg}
              </span>
            )}
            <button type="button" onClick={() => persist()} disabled={saving}
              className="ml-auto rounded-full bg-indigo-500/80 px-5 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>

          {/* ── Payment history (collapsible) ── */}
          <div className="border-t border-white/8 pt-3">
            <button type="button"
              onClick={() => setShowPayments((v) => !v)}
              className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition">
              <span>💳 Payment history ({detail?.payments?.length ?? "…"})</span>
              <span>{showPayments ? "▲" : "▼"}</span>
            </button>
            {showPayments && (
              <div className="mt-2">
                {!detail?.payments?.length ? (
                  <p className="text-[11px] text-zinc-600 py-2">No payment records.</p>
                ) : (
                  <table className="w-full text-xs mt-1">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-widest text-zinc-600">
                        <th className="py-1.5 pr-3">Date</th>
                        <th className="py-1.5 pr-3">Product</th>
                        <th className="py-1.5 pr-3">Tier</th>
                        <th className="py-1.5">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.payments.map((p) => (
                        <tr key={p.payment_id} className="border-t border-white/5">
                          <td className="py-1.5 pr-3 text-zinc-500 whitespace-nowrap">{fmtDate(p.granted_at)}</td>
                          <td className="py-1.5 pr-3 text-zinc-300">{p.product_id}</td>
                          <td className="py-1.5 pr-3">
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${tierBadge(p.tier)}`}>
                              {p.tier}
                            </span>
                          </td>
                          <td className="py-1.5 text-zinc-400">{fmtInr(p.amount_paise)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* ── Admin action history (collapsible) ── */}
          <div className="border-t border-white/8 pt-3">
            <button type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition">
              <span>🔑 Admin history ({detail?.history?.length ?? "…"})</span>
              <span>{showHistory ? "▲" : "▼"}</span>
            </button>
            {showHistory && (
              <div className="mt-2">
                {!detail?.history?.length ? (
                  <p className="text-[11px] text-zinc-600 py-2">No admin actions yet.</p>
                ) : (
                  <table className="w-full text-xs mt-1">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-widest text-zinc-600">
                        <th className="py-1.5 pr-3">When</th>
                        <th className="py-1.5 pr-3">Action</th>
                        <th className="py-1.5">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.history.map((h) => (
                        <tr key={h.id} className="border-t border-white/5">
                          <td className="py-1.5 pr-3 text-zinc-500 whitespace-nowrap">{timeAgo(h.created_at)}</td>
                          <td className={`py-1.5 pr-3 font-semibold ${actionColor(h.action)}`}>{h.action}</td>
                          <td className="py-1.5 text-zinc-500">
                            {h.old_tier !== h.new_tier && <span className="mr-2">{h.old_tier ?? "—"} → {h.new_tier}</span>}
                            {h.old_expires_at !== h.new_expires_at && <span className="mr-2 text-zinc-600">exp {fmtDate(h.new_expires_at)}</span>}
                            {h.old_token_balance !== h.new_token_balance && (
                              <span className="text-amber-600/70">tokens {h.old_token_balance ?? 0}→{h.new_token_balance ?? 0}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* ── Ban / Unban ── */}
          <div className="border-t border-white/8 pt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-rose-500/70">Account Ban</p>
            {isBanned ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-rose-300">This account is banned.</span>
                <button
                  onClick={toggleBan}
                  disabled={banLoading}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
                >{banLoading ? "…" : "Unban user"}</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Ban reason (required)…"
                  className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-rose-500/50"
                />
                <button
                  onClick={toggleBan}
                  disabled={banLoading || !banReason.trim()}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40"
                >{banLoading ? "…" : "⛔ Ban user"}</button>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HistoryTable — global history tab
// ─────────────────────────────────────────────────────────────────────────────

function HistoryTable({ rows }: { rows: HistoryEntry[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 px-5 py-12 text-center">
        <p className="text-2xl">📋</p>
        <p className="mt-2 text-sm text-zinc-500">No admin actions recorded yet.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/8 bg-white/5">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/8 text-left text-[10px] uppercase tracking-widest text-zinc-600">
            <th className="px-4 py-2.5 whitespace-nowrap">When</th>
            <th className="px-4 py-2.5">User</th>
            <th className="px-4 py-2.5">Action</th>
            <th className="px-4 py-2.5">Change</th>
            <th className="px-4 py-2.5">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => (
            <tr key={h.id} className="border-b border-white/5 transition hover:bg-white/[0.03]">
              <td className="whitespace-nowrap px-4 py-2.5 text-zinc-500">{timeAgo(h.created_at)}</td>
              <td className="px-4 py-2.5 text-zinc-300">{h.user_email}</td>
              <td className={`px-4 py-2.5 font-semibold ${actionColor(h.action)}`}>{h.action}</td>
              <td className="px-4 py-2.5 text-zinc-500">
                {h.old_tier !== h.new_tier && <span className="mr-1">{h.old_tier ?? "—"} → {h.new_tier}</span>}
                {h.old_status !== h.new_status && <span className="mr-1 text-zinc-600">({h.old_status} → {h.new_status})</span>}
                {h.old_expires_at !== h.new_expires_at && <span className="mr-1 text-zinc-600">exp {fmtDate(h.new_expires_at)}</span>}
                {h.old_token_balance !== h.new_token_balance && (
                  <span className="text-amber-600/70">tokens {h.old_token_balance ?? 0}→{h.new_token_balance ?? 0}</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-zinc-600">{h.notes ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// OrgMembersPanel — embedded inside org edit panel
// ─────────────────────────────────────────────────────────────────────────────

function OrgMembersPanel({ orgId, token }: { orgId: string; token: string }) {
  interface OM { userId: string; email: string; role: string; joinedAt: string; override_tier?: string | null }
  const [members, setMembers]   = useState<OM[]>([]);
  const [orgTier, setOrgTier]   = useState("enterprise");
  const [loaded, setLoaded]     = useState(false);
  const [show, setShow]         = useState(false);
  const [working, setWorking]   = useState<string | null>(null);

  async function load() {
    if (loaded) return;
    const [r1, r2] = await Promise.all([
      fetch(`/api/admin/organizations/${orgId}`, adminFetchOpts(token)),
      fetch(`/api/admin/organizations/${orgId}`, adminFetchOpts(token)),
    ]);
    if (r1.ok) {
      const j = await r1.json();
      setMembers(j.members ?? []);
      setOrgTier(j.org?.tier ?? "enterprise");
      setLoaded(true);
    }
    void r2; // r2 was redundant, just satisfy TS
  }

  async function patch(userId: string, body: object) {
    setWorking(userId);
    await fetch(`/api/admin/organizations/${orgId}/members`, adminFetchOpts(token, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...body }),
    }));
    setWorking(null);
  }

  async function changeRole(userId: string, role: string) {
    await patch(userId, { role });
    setMembers((p) => p.map((m) => m.userId === userId ? { ...m, role } : m));
  }

  async function changeTier(userId: string, overrideTier: string | null) {
    await patch(userId, { overrideTier });
    setMembers((p) => p.map((m) => m.userId === userId ? { ...m, override_tier: overrideTier } : m));
  }

  async function removeMember(userId: string) {
    if (!confirm("Remove this member? Their license will be revoked.")) return;
    setWorking(userId);
    await fetch(`/api/admin/organizations/${orgId}/members?userId=${userId}`, adminFetchOpts(token, { method: "DELETE" }));
    setWorking(null);
    setMembers((p) => p.filter((m) => m.userId !== userId));
  }

  const TIERS = ["free","plus","pro","edu","enterprise"];

  return (
    <div className="border-t border-white/8 pt-3">
      <button onClick={async () => { setShow((v) => !v); if (!show && !loaded) await load(); }} className="text-xs text-indigo-400 hover:text-indigo-300 transition">
        {show ? "▲ Hide members" : "▼ Manage members + licenses"}
      </button>
      {show && (
        <div className="mt-3 space-y-1.5">
          {members.length === 0 && loaded && <p className="text-xs text-zinc-500">No members yet.</p>}
          {members.map((m) => (
            <div key={m.userId} className="rounded-xl border border-white/8 bg-white/3 px-3 py-2 space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-xs text-zinc-200 truncate flex-1">{m.email}</p>
                {/* Role */}
                <select value={m.role} disabled={working === m.userId}
                  onChange={(e) => changeRole(m.userId, e.target.value)}
                  className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-zinc-300 outline-none">
                  <option value="owner">owner</option>
                  <option value="admin">admin</option>
                  <option value="member">member</option>
                </select>
                <button onClick={() => removeMember(m.userId)} disabled={working === m.userId}
                  className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-40">
                  {working === m.userId ? "…" : "Remove"}
                </button>
              </div>
              {/* Per-member license tier override */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-600">License tier:</span>
                <select value={m.override_tier ?? "__org__"} disabled={working === m.userId}
                  onChange={(e) => changeTier(m.userId, e.target.value === "__org__" ? null : e.target.value)}
                  className="rounded-lg border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-zinc-300 outline-none">
                  <option value="__org__">Org default ({orgTier})</option>
                  {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {m.override_tier && <span className="text-[9px] text-amber-400">override active</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OrgPoolsPanel — super-admin issues license pools to an org
// ─────────────────────────────────────────────────────────────────────────────

function OrgPoolsPanel({ orgId, token }: { orgId: string; token: string }) {
  interface Pool { id:string; tier:string; quantity_total:number; quantity_used:number; label:string|null; expires_at:string|null; active:boolean }
  const [pools, setPools]   = useState<Pool[]>([]);
  const [show, setShow]     = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tier, setTier]     = useState("plus");
  const [qty, setQty]       = useState("10");
  const [label, setLabel]   = useState("");
  const [exp, setExp]       = useState("");
  const [notes, setNotes]   = useState("");
  const [msg, setMsg]       = useState("");

  async function load() {
    if (loaded) return;
    const r = await fetch(`/api/admin/organizations/${orgId}/pools`, adminFetchOpts(token));
    if (r.ok) { setPools((await r.json()).pools ?? []); setLoaded(true); }
  }

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg("");
    const r = await fetch(`/api/admin/organizations/${orgId}/pools`, adminFetchOpts(token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, quantity: Number(qty), label: label||undefined, expires_at: exp||undefined, notes: notes||undefined }),
    }));
    setSaving(false);
    if (r.ok) {
      const j = await r.json();
      setPools((p) => [j.pool, ...p]);
      setMsg(`✓ Issued ${qty} ${tier} licenses`);
      setQty("10"); setLabel(""); setExp(""); setNotes("");
    } else {
      setMsg((await r.json().catch(()=>({}))).error ?? "Failed");
    }
  }

  async function handleToggle(poolId: string, active: boolean) {
    await fetch(`/api/admin/organizations/${orgId}/pools?poolId=${poolId}`, adminFetchOpts(token, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    }));
    setPools((p) => p.map((x) => x.id === poolId ? { ...x, active } : x));
  }

  const inCls = "rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs text-zinc-100 outline-none";

  return (
    <div className="border-t border-white/8 pt-3 mt-2">
      <button onClick={async () => { setShow((v) => !v); if (!show && !loaded) await load(); }} className="text-xs text-amber-400 hover:text-amber-300 transition">
        {show ? "▲ Hide license pools" : "▼ Manage license pools"}
      </button>
      {show && (
        <div className="mt-3 space-y-3">
          {/* Issue form */}
          <form onSubmit={handleIssue} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
            <p className="text-xs font-medium text-amber-300">Issue license pool to this org</p>
            <div className="flex flex-wrap gap-2">
              <select value={tier} onChange={(e) => setTier(e.target.value)} className={inCls}>
                {["free","plus","pro","edu","enterprise"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" className={`${inCls} w-20`} />
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" className={`${inCls} flex-1`} />
              <input type="date" value={exp} onChange={(e) => setExp(e.target.value)} className={inCls} />
            </div>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes (optional)" className={`${inCls} w-full`} />
            {msg && <p className={`text-[11px] ${msg.startsWith("✓") ? "text-emerald-400" : "text-rose-400"}`}>{msg}</p>}
            <button type="submit" disabled={saving} className="rounded-lg bg-amber-500/80 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-500 disabled:opacity-50">
              {saving ? "Issuing…" : "Issue pool"}
            </button>
          </form>

          {/* Pool list */}
          {pools.length === 0 && loaded && <p className="text-xs text-zinc-500">No license pools yet.</p>}
          {pools.map((p) => (
            <div key={p.id} className={`flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 px-3 py-2 ${!p.active ? "opacity-50" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-zinc-200 capitalize">{p.tier} · {p.quantity_used}/{p.quantity_total} assigned</p>
                <p className="text-[10px] text-zinc-500">{p.label ?? "No label"}{p.expires_at ? ` · exp ${fmtDate(p.expires_at)}` : ""}</p>
              </div>
              <div className="flex-shrink-0">
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full bg-amber-400/70 rounded-full" style={{ width: `${Math.round(p.quantity_used/Math.max(p.quantity_total,1)*100)}%` }} />
                </div>
              </div>
              <button onClick={() => handleToggle(p.id, !p.active)} className="text-[10px] text-zinc-500 hover:text-zinc-300 transition shrink-0">
                {p.active ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OrganizationsSection
// ─────────────────────────────────────────────────────────────────────────────

interface OrgRow {
  orgId: string; name: string; slug: string; billingType: string;
  tier: string; status: string; seatsPurchased: number; seatsUsed: number;
  ownerEmail: string | null; expiresAt: string | null; createdAt: string; memberCount: number;
}

const BILLING_COLORS: Record<string, string> = {
  commercial: "text-indigo-300 bg-indigo-500/15",
  ngo:        "text-emerald-300 bg-emerald-500/15",
  edu:        "text-teal-300 bg-teal-500/15",
  govt:       "text-amber-300 bg-amber-500/15",
};

const STATUS_COLORS: Record<string, string> = {
  active:    "text-emerald-300 bg-emerald-500/15",
  pending:   "text-amber-300 bg-amber-500/15",
  suspended: "text-rose-300 bg-rose-500/15",
  cancelled: "text-zinc-400 bg-zinc-500/10",
};

function OrgBadge({ label, colors }: { label: string; colors: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-white/10 ${colors}`}>{label}</span>;
}

function OrganizationsSection({ token }: { token: string }) {
  const [orgs, setOrgs]               = useState<OrgRow[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [search, setSearch]           = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [saving, setSaving]           = useState(false);

  // Edit state for the expanded org
  const [editFields, setEditFields] = useState<Record<string, string>>({});

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: "", slug: "", billing_type: "commercial", tier: "enterprise",
    status: "pending", seats_purchased: "10", expires_at: "", notes: "", owner_email: "",
  });

  const authHeader = { Authorization: `Bearer ${token}` };

  const fetchOrgs = useCallback(async (q: string, s: string) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (q) params.set("search", q);
      if (s) params.set("status", s);
      const res = await fetch(`/api/admin/organizations?${params}`, adminFetchOpts(token));
      if (!res.ok) { setError("Failed to load organizations."); return; }
      setOrgs((await res.json()).orgs ?? []);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { void fetchOrgs(search, statusFilter); }, [fetchOrgs, search, statusFilter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST", headers: { "Content-Type": "application/json", ...(token.startsWith("session:") ? {} : { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ ...createForm, seats_purchased: Number(createForm.seats_purchased), expires_at: createForm.expires_at || null }),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Create failed."); return; }
      setShowCreate(false);
      setCreateForm({ name: "", slug: "", billing_type: "commercial", tier: "enterprise", status: "pending", seats_purchased: "10", expires_at: "", notes: "", owner_email: "" });
      void fetchOrgs(search, statusFilter);
    } finally { setSaving(false); }
  }

  async function handleSave(orgId: string) {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      Object.entries(editFields).forEach(([k, v]) => {
        payload[k] = k === "seats_purchased" ? Number(v) : (v === "" ? null : v);
      });
      const res = await fetch(`/api/admin/organizations/${orgId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", ...(token.startsWith("session:") ? {} : { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Save failed."); return; }
      void fetchOrgs(search, statusFilter);
      setExpandedId(null); setEditFields({});
    } finally { setSaving(false); }
  }

  const inputCls = "w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/50";
  const labelCls = "block text-[11px] text-zinc-400 mb-1";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); }} className="flex flex-1 gap-2">
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, slug, or owner email…"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-indigo-400/50" />
          <button type="submit" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-300 transition hover:bg-white/10">Search</button>
        </form>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300 outline-none">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button onClick={() => setShowCreate((v) => !v)}
          className="rounded-xl border border-indigo-400/30 bg-indigo-500/15 px-4 py-2 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/25">
          {showCreate ? "✕ Cancel" : "+ New Org"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-indigo-400/20 bg-indigo-500/5 p-5 space-y-4">
          <p className="text-sm font-semibold text-indigo-200">Create Organization</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {[
              { key: "name",        label: "Name *",        placeholder: "Acme Corp" },
              { key: "slug",        label: "Slug *",        placeholder: "acme-corp" },
              { key: "owner_email", label: "Owner email",   placeholder: "admin@acme.com" },
            ].map(({ key, label, placeholder }) => (
              <label key={key}>
                <span className={labelCls}>{label}</span>
                <input required={key === "name" || key === "slug"} value={(createForm as Record<string,string>)[key]}
                  onChange={(e) => setCreateForm((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder} className={inputCls} />
              </label>
            ))}
            <label>
              <span className={labelCls}>Type</span>
              <select value={createForm.billing_type} onChange={(e) => setCreateForm((p) => ({ ...p, billing_type: e.target.value }))} className={inputCls}>
                {["commercial","ngo","edu","govt"].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label>
              <span className={labelCls}>Tier</span>
              <select value={createForm.tier} onChange={(e) => setCreateForm((p) => ({ ...p, tier: e.target.value }))} className={inputCls}>
                {["edu","enterprise"].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label>
              <span className={labelCls}>Status</span>
              <select value={createForm.status} onChange={(e) => setCreateForm((p) => ({ ...p, status: e.target.value }))} className={inputCls}>
                {["pending","active"].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label>
              <span className={labelCls}>Seats</span>
              <input type="number" min={1} value={createForm.seats_purchased}
                onChange={(e) => setCreateForm((p) => ({ ...p, seats_purchased: e.target.value }))} className={inputCls} />
            </label>
            <label>
              <span className={labelCls}>Expires at</span>
              <input type="date" value={createForm.expires_at}
                onChange={(e) => setCreateForm((p) => ({ ...p, expires_at: e.target.value }))} className={inputCls} />
            </label>
          </div>
          <label>
            <span className={labelCls}>Internal notes</span>
            <textarea rows={2} value={createForm.notes}
              onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))}
              className={`${inputCls} resize-none`} placeholder="Billing contact, discount reason, etc." />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="rounded-xl bg-indigo-500/80 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50">
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {/* Org list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />)}</div>
      ) : orgs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-5 py-12 text-center">
          <p className="text-2xl">🏢</p>
          <p className="mt-2 text-sm text-zinc-500">No organizations yet. Create one above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orgs.map((org) => {
            const isOpen = expandedId === org.orgId;
            return (
              <div key={org.orgId} className="rounded-2xl border border-white/8 bg-white/5 overflow-hidden">
                {/* Summary row */}
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-100">{org.name}</p>
                    <p className="text-[11px] text-zinc-500">{org.slug} · {org.ownerEmail ?? "no owner"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <OrgBadge label={org.billingType} colors={BILLING_COLORS[org.billingType] ?? "text-zinc-400 bg-zinc-500/10"} />
                    <OrgBadge label={org.tier}        colors={tierBadge(org.tier)} />
                    <OrgBadge label={org.status}      colors={STATUS_COLORS[org.status] ?? "text-zinc-400 bg-zinc-500/10"} />
                    <span className="text-[11px] text-zinc-500">{org.seatsUsed}/{org.seatsPurchased} seats · {org.memberCount} members</span>
                    {org.expiresAt && <span className="text-[11px] text-zinc-500">exp {fmtDate(org.expiresAt)}</span>}
                  </div>
                  <button onClick={() => {
                    setExpandedId(isOpen ? null : org.orgId);
                    setEditFields({
                      name: org.name, billing_type: org.billingType, tier: org.tier,
                      status: org.status, seats_purchased: String(org.seatsPurchased),
                      expires_at: org.expiresAt ? org.expiresAt.split("T")[0] : "",
                      notes: "",
                    });
                  }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200">
                    {isOpen ? "Close" : "Edit"}
                  </button>
                </div>

                {/* Edit panel */}
                {isOpen && (
                  <div className="border-t border-white/8 px-4 py-4 space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                      {[
                        { key: "name",            label: "Name",    type: "text" },
                        { key: "seats_purchased", label: "Seats",   type: "number" },
                        { key: "expires_at",      label: "Expires", type: "date" },
                      ].map(({ key, label, type }) => (
                        <label key={key}>
                          <span className={labelCls}>{label}</span>
                          <input type={type} value={editFields[key] ?? ""}
                            onChange={(e) => setEditFields((p) => ({ ...p, [key]: e.target.value }))}
                            className={inputCls} />
                        </label>
                      ))}
                      {[
                        { key: "billing_type", label: "Type",   opts: ["commercial","ngo","edu","govt"] },
                        { key: "tier",         label: "Tier",   opts: ["edu","enterprise"] },
                        { key: "status",       label: "Status", opts: ["pending","active","suspended","cancelled"] },
                      ].map(({ key, label, opts }) => (
                        <label key={key}>
                          <span className={labelCls}>{label}</span>
                          <select value={editFields[key] ?? ""}
                            onChange={(e) => setEditFields((p) => ({ ...p, [key]: e.target.value }))}
                            className={inputCls}>
                            {opts.map((v) => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </label>
                      ))}
                    </div>
                    <label>
                      <span className={labelCls}>Internal notes</span>
                      <textarea rows={2} value={editFields.notes ?? ""}
                        onChange={(e) => setEditFields((p) => ({ ...p, notes: e.target.value }))}
                        className={`${inputCls} resize-none`} placeholder="Add a note…" />
                    </label>
                    <div className="flex gap-2">
                      <button onClick={() => handleSave(org.orgId)} disabled={saving}
                        className="rounded-xl bg-indigo-500/80 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50">
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                      <button onClick={() => { setExpandedId(null); setEditFields({}); }}
                        className="rounded-xl border border-white/10 px-4 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200">
                        Cancel
                      </button>
                    </div>
                    {/* Member management */}
                    <OrgMembersPanel orgId={org.orgId} token={token} />
                    {/* License pool issuance */}
                    <OrgPoolsPanel orgId={org.orgId} token={token} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SuperAdminsSection
// ─────────────────────────────────────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "12+ chars",   ok: password.length >= 12 },
    { label: "Uppercase",   ok: /[A-Z]/.test(password) },
    { label: "Number",      ok: /[0-9]/.test(password) },
    { label: "Special (!@#…)", ok: /[!@#$%^&*()\-_=+]/.test(password) },
  ];
  if (!password) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {checks.map((c) => (
        <span key={c.label} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-400"}`}>
          {c.ok ? "✓" : "✗"} {c.label}
        </span>
      ))}
    </div>
  );
}

function SuperAdminsSection({ token }: { token: string }) {
  interface SuperAdmin {
    id: string; email: string; name: string; role: string; active: boolean;
    last_login_at: string | null; created_at: string;
    failed_attempts?: number; locked_until?: string | null;
    totp_enabled?: boolean;
  }
  interface Session { id: string; ip_address: string|null; user_agent: string|null; created_at: string; expires_at: string; isCurrent: boolean }

  const [admins, setAdmins]       = useState<SuperAdmin[]>([]);
  const [sessions, setSessions]   = useState<Session[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [saving, setSaving]       = useState(false);
  const [newEmail, setNewEmail]   = useState("");
  const [newName, setNewName]     = useState("");
  const [newPwd, setNewPwd]       = useState("");
  const [newRole, setNewRole]     = useState("admin");
  const [msg, setMsg]             = useState("");
  const [showSessions, setShowSessions] = useState(false);
  const [revokingSession, setRevokingSession] = useState<string|null>(null);

  // 2FA state
  const [show2FA, setShow2FA]             = useState(false);
  const [twoFASecret, setTwoFASecret]     = useState("");
  const [twoFAQR, setTwoFAQR]             = useState("");
  const [twoFACode, setTwoFACode]         = useState("");
  const [twoFALoading, setTwoFALoading]   = useState(false);
  const [twoFAMsg, setTwoFAMsg]           = useState("");
  const [twoFAErr, setTwoFAErr]           = useState("");
  const [backupCodes, setBackupCodes]     = useState<string[]>([]);
  const [disableCode, setDisableCode]     = useState("");
  const [myAdmin, setMyAdmin]             = useState<SuperAdmin | null>(null);

  // Legacy key status
  const legacyKeyActive = !token.startsWith("session:");

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/super-admins", adminFetchOpts(token));
      if (!r.ok) { setError("Not authorized or no super-admin accounts yet."); return; }
      const list: SuperAdmin[] = (await r.json()).admins ?? [];
      setAdmins(list);
      void refreshMyAdmin();
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchSessions = useCallback(async () => {
    const r = await fetch("/api/admin/auth/sessions", adminFetchOpts(token));
    if (r.ok) setSessions((await r.json()).sessions ?? []);
  }, [token]);

  useEffect(() => { void fetchAdmins(); }, [fetchAdmins]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg(""); setError("");
    const r = await fetch("/api/admin/super-admins", adminFetchOpts(token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail, name: newName, password: newPwd, role: newRole }),
    }));
    const j = await r.json();
    setSaving(false);
    if (!r.ok) { setError(j.error ?? "Failed"); return; }
    setMsg(`✓ ${j.admin.name} added as ${j.admin.role}`);
    setNewEmail(""); setNewName(""); setNewPwd(""); setNewRole("admin");
    void fetchAdmins();
  }

  async function handleResetPwd(id: string, name: string) {
    const pwd = prompt(`New password for ${name}\n\nRequirements: 12+ chars, uppercase, number, special char (!@#$%^&*)`);
    if (!pwd) return;
    const r = await fetch(`/api/admin/super-admins/${id}`, adminFetchOpts(token, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pwd }),
    }));
    const j = await r.json();
    if (r.ok) { alert("Password updated successfully."); }
    else { alert(`Failed: ${j.error ?? "Unknown error"}`); }
  }

  async function handleUnlock(id: string, name: string) {
    if (!confirm(`Unlock ${name}'s account?`)) return;
    const r = await fetch(`/api/admin/super-admins/${id}/unlock`, adminFetchOpts(token, { method: "POST" }));
    if (r.ok) { setMsg(`✓ ${name}'s account unlocked`); void fetchAdmins(); }
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Deactivate this admin? They will lose all access immediately.")) return;
    const r = await fetch(`/api/admin/super-admins/${id}`, adminFetchOpts(token, { method: "DELETE" }));
    if (r.ok) void fetchAdmins(); else alert("Failed to deactivate.");
  }

  async function handleRevokeSession(sessionId: string, isCurrent: boolean) {
    if (isCurrent && !confirm("Revoking your current session will sign you out. Continue?")) return;
    setRevokingSession(sessionId);
    await fetch(`/api/admin/auth/sessions?sessionId=${sessionId}`, adminFetchOpts(token, { method: "DELETE" }));
    setRevokingSession(null);
    if (isCurrent) { window.location.reload(); }
    else { void fetchSessions(); }
  }

  async function handleRevokeAllOther() {
    if (!confirm("Revoke all other sessions? Only your current session will remain.")) return;
    await fetch("/api/admin/auth/sessions?all=true", adminFetchOpts(token, { method: "DELETE" }));
    void fetchSessions();
    setMsg("✓ All other sessions revoked");
  }

  async function refreshMyAdmin() {
    const r = await fetch("/api/admin/auth/me", { credentials: "same-origin" });
    if (r.ok) {
      const d = await r.json();
      if (d.admin) setMyAdmin(d.admin as SuperAdmin);
    }
  }

  async function handle2FASetup() {
    setTwoFALoading(true); setTwoFAErr(""); setTwoFAMsg(""); setBackupCodes([]);
    const r = await fetch("/api/admin/auth/2fa/setup", adminFetchOpts(token, { method: "POST" }));
    const j = await r.json();
    setTwoFALoading(false);
    if (!r.ok) { setTwoFAErr(j.error ?? "Setup failed"); return; }
    setTwoFASecret(j.secret); setTwoFAQR(j.qrDataUrl); setTwoFACode("");
  }

  async function handle2FAVerify() {
    setTwoFALoading(true); setTwoFAErr(""); setTwoFAMsg("");
    const r = await fetch("/api/admin/auth/2fa/verify", adminFetchOpts(token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: twoFACode }),
    }));
    const j = await r.json();
    setTwoFALoading(false);
    if (!r.ok) { setTwoFAErr(j.error ?? "Verification failed"); return; }
    if (j.backupCodes) setBackupCodes(j.backupCodes);
    setTwoFAMsg("✓ 2FA enabled! Save your backup codes below.");
    setTwoFAQR(""); setTwoFASecret(""); setTwoFACode("");
    void fetchAdmins();
  }

  async function handle2FADisable() {
    if (!disableCode || !/^\d{6}$/.test(disableCode)) { setTwoFAErr("Enter your 6-digit code to disable 2FA"); return; }
    if (!confirm("Disable 2FA on your account?")) return;
    setTwoFALoading(true); setTwoFAErr(""); setTwoFAMsg("");
    const r = await fetch("/api/admin/auth/2fa/disable", adminFetchOpts(token, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: disableCode }),
    }));
    const j = await r.json();
    setTwoFALoading(false);
    if (!r.ok) { setTwoFAErr(j.error ?? "Failed to disable 2FA"); return; }
    setTwoFAMsg("2FA disabled."); setDisableCode(""); setBackupCodes([]);
    void fetchAdmins();
  }

  const inputCls = "rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-400/50";

  return (
    <div className="space-y-6">

      {/* Security status banner */}
      <div className={`rounded-2xl border px-4 py-3 text-xs space-y-1 ${legacyKeyActive ? "border-amber-500/25 bg-amber-500/8" : "border-emerald-500/25 bg-emerald-500/8"}`}>
        <p className="font-semibold text-zinc-300">Security status</p>
        <p className={legacyKeyActive ? "text-amber-300" : "text-emerald-300"}>
          {legacyKeyActive
            ? "⚠ You are logged in via legacy secret key. Set ADMIN_SECRET_DISABLED=true in Vercel env vars to disable this fallback once all admins are on email/password."
            : "✓ Logged in via secure email/password session. Legacy secret key is your emergency fallback."}
        </p>
        <p className="text-zinc-500">Password policy: 12+ chars · 1 uppercase · 1 number · 1 special character. Accounts lock for 15 minutes after 5 failed attempts.</p>
      </div>

      {/* Add new admin */}
      <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-5 space-y-4">
        <p className="text-sm font-medium text-zinc-300">Add super-admin</p>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" className={`${inputCls} w-full`} />
            <input required type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email" className={`${inputCls} w-full`} />
            <div className="sm:col-span-2">
              <input required type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
                placeholder="Password (12+ chars, uppercase, number, special)" className={`${inputCls} w-full`} />
              <PasswordStrength password={newPwd} />
            </div>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className={`${inputCls} w-full`}>
              <option value="admin">Admin — full access</option>
              <option value="owner">Owner — full access + manage admins</option>
              <option value="connect_reviewer">Connect Reviewer — review Connect applications only</option>
            </select>
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          {msg   && <p className="text-xs text-emerald-400">{msg}</p>}
          <button type="submit" disabled={saving} className="rounded-xl bg-indigo-500/80 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50">
            {saving ? "Adding…" : "Add admin"}
          </button>
        </form>
      </div>

      {/* Admin list */}
      {loading ? (
        <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/5" />)}</div>
      ) : admins.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center">
          <p className="text-2xl">👑</p>
          <p className="mt-2 text-sm text-zinc-500">No super-admins yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {admins.map((a) => {
            const isLocked = a.locked_until && new Date(a.locked_until) > new Date();
            return (
              <div key={a.id} className={`rounded-2xl border border-white/8 bg-white/4 px-4 py-3 ${!a.active ? "opacity-50" : ""}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-100">{a.name}</p>
                    <p className="text-[11px] text-zinc-500">{a.email} · last login: {a.last_login_at ? timeAgo(a.last_login_at) : "never"}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                    a.role === "owner"            ? "bg-amber-500/15 text-amber-300" :
                    a.role === "connect_reviewer" ? "bg-teal-500/15 text-teal-300" :
                                                   "bg-indigo-500/15 text-indigo-300"
                  }`}>{a.role === "connect_reviewer" ? "connect reviewer" : a.role}</span>
                  {isLocked && <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[10px] font-medium text-rose-300">🔒 Locked</span>}
                  {!a.active && <span className="text-[11px] text-zinc-600">inactive</span>}
                  {a.active && (
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => handleResetPwd(a.id, a.name)} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-white/10">Reset pwd</button>
                      {isLocked && <button onClick={() => handleUnlock(a.id, a.name)} className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300 transition hover:bg-amber-500/20">Unlock</button>}
                      <button onClick={() => handleDeactivate(a.id)} className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-400 transition hover:bg-rose-500/20">Deactivate</button>
                    </div>
                  )}
                </div>
                {(a.failed_attempts ?? 0) > 0 && !isLocked && (
                  <p className="mt-1 text-[10px] text-amber-400">{a.failed_attempts} failed login attempt{a.failed_attempts !== 1 ? "s" : ""} — locks after {5 - (a.failed_attempts ?? 0)} more</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Session management */}
      <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-300">My active sessions</p>
          <button onClick={async () => { setShowSessions((v) => !v); if (!showSessions) await fetchSessions(); }}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition">
            {showSessions ? "Hide" : "View sessions"}
          </button>
        </div>
        {showSessions && (
          <>
            <button onClick={handleRevokeAllOther} className="text-xs text-rose-400 hover:text-rose-300 transition">Revoke all other sessions</button>
            <div className="space-y-1.5">
              {sessions.map((s) => (
                <div key={s.id} className={`flex items-start justify-between rounded-xl border px-3 py-2 ${s.isCurrent ? "border-indigo-400/30 bg-indigo-500/8" : "border-white/8 bg-white/3"}`}>
                  <div className="min-w-0 text-[11px] text-zinc-400 space-y-0.5">
                    <p className="font-medium text-zinc-200">{s.isCurrent ? "Current session" : "Session"}</p>
                    <p>IP: {s.ip_address ?? "unknown"}</p>
                    <p className="truncate max-w-[180px] sm:max-w-[320px]">{s.user_agent ? s.user_agent.slice(0, 60) + (s.user_agent.length > 60 ? "…" : "") : "unknown"}</p>
                    <p>Created: {timeAgo(s.created_at)} · Expires: {new Date(s.expires_at).toLocaleTimeString()}</p>
                  </div>
                  <button onClick={() => handleRevokeSession(s.id, s.isCurrent)} disabled={revokingSession === s.id}
                    className={`ml-2 shrink-0 rounded-lg border px-2 py-1 text-[11px] transition disabled:opacity-40 ${s.isCurrent ? "border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20" : "border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"}`}>
                    {revokingSession === s.id ? "…" : s.isCurrent ? "Sign out" : "Revoke"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 2FA management */}
      <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-300">Two-factor authentication (2FA)</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {myAdmin?.totp_enabled
                ? "✓ 2FA is enabled on your account."
                : "2FA is not enabled. Enable it for extra security."}
            </p>
          </div>
          <button onClick={() => { setShow2FA((v) => !v); setTwoFAMsg(""); setTwoFAErr(""); }}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition">
            {show2FA ? "Hide" : "Manage"}
          </button>
        </div>

        {show2FA && (
          <div className="space-y-4">
            {twoFAErr && <p className="text-xs text-rose-400">{twoFAErr}</p>}
            {twoFAMsg && <p className="text-xs text-emerald-400">{twoFAMsg}</p>}

            {/* Setup flow */}
            {!myAdmin?.totp_enabled && (
              <div className="space-y-3">
                {!twoFAQR ? (
                  <button onClick={handle2FASetup} disabled={twoFALoading}
                    className="rounded-xl bg-indigo-500/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50">
                    {twoFALoading ? "Generating…" : "Set up 2FA"}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[11px] text-zinc-400">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={twoFAQR} alt="2FA QR Code" className="w-40 h-40 rounded-xl border border-white/10 bg-white p-1" />
                    <p className="text-[11px] text-zinc-400">Or enter this secret manually:</p>
                    <code className="block rounded-xl bg-black/30 px-3 py-2 text-xs font-mono text-zinc-300 tracking-widest break-all">{twoFASecret}</code>
                    <div className="flex gap-2 items-center">
                      <input
                        value={twoFACode} onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="Enter 6-digit code"
                        className={`${inputCls} w-40 font-mono tracking-widest`}
                        maxLength={6}
                      />
                      <button onClick={handle2FAVerify} disabled={twoFALoading || twoFACode.length !== 6}
                        className="rounded-xl bg-emerald-500/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50">
                        {twoFALoading ? "Verifying…" : "Verify & enable"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Backup codes after setup */}
            {backupCodes.length > 0 && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-amber-300">Save these backup codes — they won&apos;t be shown again:</p>
                <div className="grid grid-cols-2 gap-1">
                  {backupCodes.map((c) => (
                    <code key={c} className="rounded-lg bg-black/30 px-2 py-1 text-xs font-mono text-zinc-300 text-center tracking-widest">{c}</code>
                  ))}
                </div>
                <button onClick={() => navigator.clipboard.writeText(backupCodes.join("\n"))}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 transition">Copy all</button>
              </div>
            )}

            {/* Disable flow */}
            {myAdmin?.totp_enabled && (
              <div className="space-y-2">
                <p className="text-[11px] text-zinc-400">Enter your current 6-digit code to disable 2FA:</p>
                <div className="flex gap-2 items-center">
                  <input
                    value={disableCode} onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                    className={`${inputCls} w-40 font-mono tracking-widest`}
                    maxLength={6}
                  />
                  <button onClick={handle2FADisable} disabled={twoFALoading || disableCode.length !== 6}
                    className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-50">
                    {twoFALoading ? "Disabling…" : "Disable 2FA"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatsSection — aggregate licensing dashboard
// ─────────────────────────────────────────────────────────────────────────────

function StatsSection({ token }: { token: string }) {
  interface Stats {
    orgs:         { total:number; active:number; pending:number; suspended:number };
    members:      { total:number; admins:number; users:number };
    pools:        { totalPools:number; activePools:number; totalIssued:number; totalAssigned:number; totalAvailable:number; byTier:Record<string,{issued:number;assigned:number}> };
    orgBreakdown: { orgId:string; name:string; billingType:string; tier:string; status:string; seatsPurchased:number; seatsUsed:number; memberCount:number; poolLicenses:{issued:number;assigned:number;available:number} }[];
    superAdmins:  { total:number; owners:number; admins:number; inactive:number };
    recentAudit:  { action:string; org_id:string; created_at:string; actor_role:string }[];
  }
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    fetch("/api/admin/dashboard", adminFetchOpts(token))
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setStats)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [token]);

  const TIER_COLOR: Record<string,string> = { free:"text-zinc-400", plus:"text-sky-300", pro:"text-indigo-300", edu:"text-teal-300", enterprise:"text-orange-300" };

  if (loading) return <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />)}</div>;
  if (error)   return <p className="text-sm text-rose-400">{error}</p>;
  if (!stats)  return null;

  return (
    <div className="space-y-6">

      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total orgs",       value: stats.orgs.total,           sub: `${stats.orgs.active} active`,       color: "text-indigo-300" },
          { label: "Total members",    value: stats.members.total,         sub: `${stats.members.admins} admins`,    color: "text-sky-300"    },
          { label: "Pool licenses",    value: stats.pools.totalIssued,     sub: `${stats.pools.totalAvailable} free`, color: "text-emerald-300"},
          { label: "Assigned licenses",value: stats.pools.totalAssigned,   sub: `${stats.pools.activePools} pools`,  color: "text-amber-300"  },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-zinc-400">{s.label}</p>
            <p className="text-[10px] text-zinc-600">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* License pool breakdown by tier */}
      {Object.keys(stats.pools.byTier).length > 0 && (
        <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-4 space-y-3">
          <p className="text-sm font-medium text-zinc-300">Pool licenses by tier (all orgs)</p>
          {Object.entries(stats.pools.byTier).map(([tier, data]) => {
            const pct = data.issued > 0 ? Math.round(data.assigned / data.issued * 100) : 0;
            return (
              <div key={tier}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className={`font-medium capitalize ${TIER_COLOR[tier] ?? "text-zinc-300"}`}>{tier}</span>
                  <span className="text-zinc-500">{data.assigned} / {data.issued} assigned ({data.issued - data.assigned} free)</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                  <div className={`h-full rounded-full ${pct >= 90 ? "bg-rose-500" : "bg-indigo-400"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Per-org breakdown table */}
      <div className="overflow-x-auto rounded-2xl border border-white/8">
        <p className="border-b border-white/8 px-5 py-3 text-sm font-medium text-zinc-300">Per-organisation breakdown</p>
        <table className="w-full text-xs">
          <thead className="border-b border-white/8 bg-white/4 text-zinc-500">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Organisation</th>
              <th className="px-4 py-2.5 text-left font-medium">Type / Tier</th>
              <th className="px-4 py-2.5 text-right font-medium">Seats</th>
              <th className="px-4 py-2.5 text-right font-medium hidden sm:table-cell">Members</th>
              <th className="px-4 py-2.5 text-right font-medium hidden md:table-cell">Pool issued</th>
              <th className="px-4 py-2.5 text-right font-medium hidden md:table-cell">Pool free</th>
            </tr>
          </thead>
          <tbody>
            {stats.orgBreakdown.map((org) => (
              <tr key={org.orgId} className="border-b border-white/5 hover:bg-white/3">
                <td className="px-4 py-2.5">
                  <p className="text-zinc-200 font-medium truncate max-w-[140px]">{org.name}</p>
                  <p className="text-[10px] text-zinc-600">{org.status}</p>
                </td>
                <td className="px-4 py-2.5">
                  <span className="capitalize text-zinc-400">{org.billingType}</span>
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${TIER_COLOR[org.tier] ?? "text-zinc-400"} bg-white/8`}>{org.tier}</span>
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-300">{org.seatsUsed}/{org.seatsPurchased}</td>
                <td className="px-4 py-2.5 text-right text-zinc-400 hidden sm:table-cell">{org.memberCount}</td>
                <td className="px-4 py-2.5 text-right text-zinc-400 hidden md:table-cell">{org.poolLicenses.issued}</td>
                <td className={`px-4 py-2.5 text-right font-medium hidden md:table-cell ${org.poolLicenses.available === 0 && org.poolLicenses.issued > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                  {org.poolLicenses.available}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Super-admins + recent audit */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-4 space-y-2">
          <p className="text-sm font-medium text-zinc-300">Super-admins</p>
          {[
            { label: "Total",    value: stats.superAdmins.total,    color: "text-zinc-200" },
            { label: "Owners",  value: stats.superAdmins.owners,   color: "text-amber-300" },
            { label: "Admins",  value: stats.superAdmins.admins,   color: "text-indigo-300" },
            { label: "Inactive",value: stats.superAdmins.inactive, color: "text-zinc-500" },
          ].map((r) => (
            <div key={r.label} className="flex justify-between text-xs">
              <span className="text-zinc-500">{r.label}</span>
              <span className={`font-semibold ${r.color}`}>{r.value}</span>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/4 px-5 py-4 space-y-2">
          <p className="text-sm font-medium text-zinc-300">Recent activity</p>
          {stats.recentAudit.slice(0, 6).map((a, i) => (
            <div key={i} className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">{a.action.replace(/_/g," ")}</span>
              <span className="text-zinc-600">{timeAgo(a.created_at)}</span>
            </div>
          ))}
          {stats.recentAudit.length === 0 && <p className="text-xs text-zinc-600">No recent activity.</p>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LicensesSection
// ─────────────────────────────────────────────────────────────────────────────

function LicensesSection({ token }: { token: string }) {
  type LicTab = "users" | "history";
  const [licTab, setLicTab]           = useState<LicTab>("users");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch]           = useState("");
  const [users, setUsers]             = useState<UserLicense[]>([]);
  const [history, setHistory]         = useState<HistoryEntry[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  const fetchUsers = useCallback(async (q: string) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (q) params.set("search", q);
      const res = await fetch(`/api/admin/licenses?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setError("Failed to load users."); return; }
      setUsers((await res.json()).users ?? []);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [token]);

  const fetchHistory = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/licenses/history?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setError("Failed to load history."); return; }
      setHistory((await res.json()).history ?? []);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    if (licTab === "users") fetchUsers(search);
    else fetchHistory();
  }, [licTab, search, fetchUsers, fetchHistory]);

  return (
    <div>
      {/* Sub-tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-white/8 bg-white/5 p-1">
        {([
          { key: "users" as LicTab,   label: "User Licenses"  },
          { key: "history" as LicTab, label: "Action History" },
        ]).map((t) => (
          <button key={t.key} onClick={() => setLicTab(t.key)}
            className={`flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-xs transition ${
              licTab === t.key ? "bg-white/10 font-medium text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-xs text-rose-400">
          {error}
        </p>
      )}

      {licTab === "users" ? (
        <>
          {/* Search */}
          <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); }}
            className="mb-4 flex gap-2">
            <input value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by email…"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-indigo-500/40" />
            <button type="submit"
              className="rounded-xl bg-indigo-500/80 px-5 py-2.5 text-xs font-medium text-white transition hover:bg-indigo-500">
              Search
            </button>
            {search && (
              <button type="button"
                onClick={() => { setSearch(""); setSearchInput(""); }}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-zinc-500 transition hover:text-zinc-300">
                Clear
              </button>
            )}
          </form>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />)}
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-5 py-12 text-center">
              <p className="text-2xl">🔍</p>
              <p className="mt-2 text-sm text-zinc-500">
                {search ? `No users found for "${search}"` : "Search by email, or browse recent below."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((u) => (
                <UserLicenseRow key={u.user_id} user={u} token={token}
                  onUpdated={() => fetchUsers(search)} />
              ))}
              <p className="text-center text-[10px] text-zinc-700">
                {users.length} result{users.length !== 1 ? "s" : ""}
                {search ? ` for "${search}"` : " (most recently updated)"}
              </p>
            </div>
          )}
        </>
      ) : (
        loading
          ? <div className="space-y-2">{[1,2,3,4,5].map((i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-white/5" />)}</div>
          : <HistoryTable rows={history} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Connect helpers
// ─────────────────────────────────────────────────────────────────────────────

function ARow({ label, value, link }: { label: string; value: string; link?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-[11px] text-zinc-500">{label}</span>
      {link
        ? <a href={value} target="_blank" rel="noreferrer" className="truncate max-w-[220px] text-right text-[11px] text-violet-400 underline underline-offset-2 hover:text-violet-300">{value}</a>
        : <span className="text-right text-[11px] text-zinc-300 break-all">{value || "—"}</span>
      }
    </div>
  );
}
function hasMinLetters(s: string, min = 2): boolean {
  return (s.match(/[a-zA-Z]/g) ?? []).length >= min;
}
function maskEnd(s: string): string {
  if (!s || s.length <= 4) return s;
  return "*".repeat(s.length - 4) + s.slice(-4);
}
function maskEmail(s: string): string {
  const [local, domain] = s.split("@");
  if (!domain) return maskEnd(s);
  return `${local.slice(0, 2)}***@${domain}`;
}
const LANG_NAMES: Record<string, string> = {
  en:"English", hi:"Hindi", bn:"Bengali", mr:"Marathi", ta:"Tamil",
  te:"Telugu", gu:"Gujarati", pa:"Punjabi", kn:"Kannada", ml:"Malayalam",
  ur:"Urdu", ar:"Arabic", es:"Spanish", fr:"French", de:"German", pt:"Portuguese",
};

// ConnectSection
// ─────────────────────────────────────────────────────────────────────────────

type ConnectTab = "pending" | "all" | "payouts" | "sessions";

interface ConnectConsultant {
  id: string; display_name: string; gender: string | null; status: string;
  photo_url: string | null;
  rate_per_min: number; currency_code: string; is_online: boolean;
  rating_avg: number; sessions_completed: number; bio: string | null;
  expertise_tags: string[] | null; languages: string[] | null;
  availability_note: string | null; availability_windows: unknown[] | null;
  contact_email: string | null; contact_phone: string | null;
  website_url: string | null; social_links: string[] | null;
  payout_info: Record<string, string> | null;
  digital_signature: string | null;
  rejection_reason?: string | null; approval_note?: string | null;
  created_at: string; email?: string | null;
}

interface EarningsConsultant extends ConnectConsultant {
  earned_amount: number; pending_payout: number; earned_currency: string;
}
interface PayoutRecord {
  id: string; consultant_user_id: string; amount: number; currency_code: string;
  payout_method: string | null; status: string; admin_note: string | null;
  created_at: string; processed_at: string | null;
}
interface ActiveSession {
  id: string; type: string; status: string; started_at: string | null; ended_at: string | null;
  minutes_used: number; amount_charged: number; currency_code: string; rate_per_min: number;
  created_at: string;
  connect_consultants: { display_name: string; photo_url: string | null } | null;
}

function ConnectSection({ token }: { token: string }) {
  const [ctab, setCtab]             = useState<ConnectTab>("pending");
  const [consultants, setConsultants] = useState<ConnectConsultant[]>([]);
  const [earnings, setEarnings]     = useState<EarningsConsultant[]>([]);
  const [payouts, setPayouts]       = useState<PayoutRecord[]>([]);
  const [sessions, setSessions]     = useState<ActiveSession[]>([]);
  const [loading, setLoading]       = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionReason, setActionReason]   = useState<Record<string, string>>({});
  const [detailsOpen, setDetailsOpen]     = useState<Record<string, boolean>>({});
  const [error, setError]           = useState("");
  const [docsOpen, setDocsOpen]     = useState<Record<string, boolean>>({});
  const [docsData, setDocsData]     = useState<Record<string, Record<string, { url: string; name: string } | null>>>({});
  const [docsLoading, setDocsLoading] = useState<Record<string, boolean>>({});
  const [payoutUpdating, setPayoutUpdating] = useState<string | null>(null);

  const fetchConsultants = useCallback(async (tab: ConnectTab) => {
    setLoading(true); setError("");
    try {
      if (tab === "payouts") {
        const res = await fetch("/api/admin/connect/earnings", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) { setError("Failed to load earnings."); return; }
        const d = await res.json();
        setEarnings(d.consultants ?? []);
        setPayouts(d.payouts ?? []);
      } else if (tab === "sessions") {
        const res = await fetch("/api/admin/connect/active-sessions", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) { setError("Failed to load sessions."); return; }
        const d = await res.json();
        setSessions(d.sessions ?? []);
      } else {
        const path = tab === "pending" ? "/api/admin/connect/pending" : "/api/admin/connect/consultants";
        const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) { setError("Failed to load."); return; }
        const d = await res.json();
        setConsultants(d.consultants ?? []);
      }
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }, [token]);

  async function updatePayoutStatus(id: string, status: string, note?: string) {
    setPayoutUpdating(id);
    try {
      const res = await fetch(`/api/admin/connect/payouts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, admin_note: note }),
      });
      const d = await res.json();
      if (d.ok) {
        setPayouts((prev) => prev.map((p) => p.id === id ? { ...p, status, admin_note: note ?? p.admin_note } : p));
      } else { setError(d.error ?? "Update failed"); }
    } catch { setError("Network error."); }
    finally { setPayoutUpdating(null); }
  }

  useEffect(() => { fetchConsultants(ctab); }, [ctab, fetchConsultants]);

  async function handleAction(id: string, action: "approve" | "reject" | "suspend" | "reinstate") {
    const reason = actionReason[id]?.trim() ?? "";
    if (!hasMinLetters(reason)) { setError("Please enter a reason with at least 2 letters before taking action."); return; }
    setActionLoading(id);
    try {
      const isAdminAction = action === "suspend" || action === "reinstate";
      const url = isAdminAction
        ? "/api/admin/connect/consultants"
        : `/api/admin/connect/${id}/approve`;

      const body = isAdminAction
        ? { id, action, reason }
        : {
            action: action === "approve" ? "approve" : "reject",
            reason,
            approval_note: action === "approve" ? reason : null,
          };

      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.ok) { fetchConsultants(ctab); }
      else { setError(d.error ?? "Action failed"); }
    } catch { setError("Network error."); }
    finally { setActionLoading(null); }
  }

  async function handleDelete(id: string, name: string) {
    const reason = actionReason[id]?.trim() ?? "";
    if (!hasMinLetters(reason)) { setError("Please enter a reason with at least 2 letters before deleting."); return; }
    if (!confirm(`Permanently delete "${name}"? This cannot be undone.`)) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/connect/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (d.ok) { setConsultants(prev => prev.filter(c => c.id !== id)); }
      else { setError(d.error ?? "Delete failed"); }
    } catch { setError("Network error."); }
    finally { setActionLoading(null); }
  }

  async function loadDocs(id: string) {
    if (docsData[id]) { setDocsOpen(p => ({ ...p, [id]: !p[id] })); return; }
    setDocsOpen(p => ({ ...p, [id]: true }));
    setDocsLoading(p => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`/api/admin/connect/${id}/docs`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (d.ok) setDocsData(p => ({ ...p, [id]: d.docs ?? {} }));
    } catch { /* silent */ }
    finally { setDocsLoading(p => ({ ...p, [id]: false })); }
  }

  const STATUS_COLORS: Record<string, string> = {
    pending:   "bg-amber-500/20 text-amber-300",
    approved:  "bg-emerald-500/20 text-emerald-400",
    rejected:  "bg-rose-500/20 text-rose-300",
    suspended: "bg-orange-500/20 text-orange-300",
  };

  return (
    <div>
      <div className="mb-5 flex gap-1 rounded-xl border border-white/8 bg-white/5 p-1 overflow-x-auto">
        {([
          ["pending",  "Pending"],
          ["all",      "All Companions"],
          ["payouts",  "💰 Earnings & Payouts"],
          ["sessions", "📡 Session Monitor"],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setCtab(key)}
            className={`flex flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs transition ${
              ctab === key ? "bg-white/10 font-medium text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-xs text-rose-400">{error}</p>}

      {/* ── Earnings & Payouts Tab ── */}
      {ctab === "payouts" && !loading && (
        <div className="space-y-6">
          {/* Consultant earnings table */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Consultant Earnings</p>
            {earnings.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">No approved consultants yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/8 text-left">
                      {["Consultant", "Sessions", "Total Earned", "Pending Payout", "Status"].map((h) => (
                        <th key={h} className="px-3 py-2 text-zinc-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {earnings.map((c) => (
                      <tr key={c.id} className="border-b border-white/5 hover:bg-white/3 transition">
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-zinc-200">{c.display_name}</p>
                          <p className="text-zinc-600">{c.currency_code}/min · ★{c.rating_avg?.toFixed(1) ?? "—"}</p>
                        </td>
                        <td className="px-3 py-2.5 text-zinc-300">{c.sessions_completed}</td>
                        <td className="px-3 py-2.5 text-emerald-400 font-medium">{c.earned_currency} {c.earned_amount.toFixed(2)}</td>
                        <td className="px-3 py-2.5">
                          {c.pending_payout > 0
                            ? <span className="text-amber-400 font-medium">{c.earned_currency} {c.pending_payout.toFixed(2)}</span>
                            : <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            c.status === "approved" ? "bg-emerald-500/20 text-emerald-400" : "bg-orange-500/20 text-orange-300"
                          }`}>{c.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payout requests */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Payout Requests</p>
            {payouts.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">No payout requests yet.</p>
            ) : (
              <div className="space-y-2">
                {payouts.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/3 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{p.currency_code} {Number(p.amount).toFixed(2)}</p>
                      <p className="text-[11px] text-zinc-500">{p.payout_method?.toUpperCase() ?? "—"} · {new Date(p.created_at).toLocaleDateString()}</p>
                      {p.admin_note && <p className="text-[11px] text-zinc-600 italic">Note: {p.admin_note}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        p.status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
                        p.status === "processing" ? "bg-blue-500/20 text-blue-300" :
                        p.status === "failed" ? "bg-rose-500/20 text-rose-300" :
                        "bg-amber-500/20 text-amber-300"
                      }`}>{p.status}</span>
                      {p.status === "pending" && (
                        <button
                          onClick={() => updatePayoutStatus(p.id, "processing")}
                          disabled={payoutUpdating === p.id}
                          className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] text-blue-300 transition hover:bg-blue-500/20 disabled:opacity-40"
                        >{payoutUpdating === p.id ? "…" : "Mark Processing"}</button>
                      )}
                      {p.status === "processing" && (
                        <button
                          onClick={() => updatePayoutStatus(p.id, "completed")}
                          disabled={payoutUpdating === p.id}
                          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
                        >{payoutUpdating === p.id ? "…" : "✓ Mark Paid"}</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Session Monitor Tab ── */}
      {ctab === "sessions" && !loading && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Live &amp; Recent Sessions</p>
            <button onClick={() => fetchConsultants("sessions")} className="text-xs text-indigo-400 hover:text-indigo-300 transition">↻ Refresh</button>
          </div>
          {sessions.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">No active sessions right now.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/8 text-left">
                    {["Companion", "Type", "Status", "Started", "Duration", "Charged"].map((h) => (
                      <th key={h} className="px-3 py-2 text-zinc-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b border-white/5 hover:bg-white/3 transition">
                      <td className="px-3 py-2.5 font-medium text-zinc-200">
                        {s.connect_consultants?.display_name ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-400">{s.type}</td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          s.status === "active" ? "bg-emerald-500/20 text-emerald-400" :
                          s.status === "pending" ? "bg-amber-500/20 text-amber-300" :
                          "bg-zinc-500/20 text-zinc-400"
                        }`}>{s.status}</span>
                      </td>
                      <td className="px-3 py-2.5 text-zinc-500">
                        {s.started_at ? new Date(s.started_at).toLocaleTimeString() : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-300">{s.minutes_used > 0 ? `${s.minutes_used} min` : "—"}</td>
                      <td className="px-3 py-2.5 text-zinc-300">
                        {s.amount_charged > 0 ? `${s.currency_code} ${Number(s.amount_charged).toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><span className="text-zinc-500 text-sm">Loading…</span></div>
      ) : (ctab === "pending" || ctab === "all") && consultants.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">
          {ctab === "pending" ? "No pending applications." : "No consultants found."}
        </p>
      ) : (ctab === "pending" || ctab === "all") && (
        <div className="space-y-3">
          {consultants.map((c) => (
            <div key={c.id} className="imotara-glass-card rounded-xl p-4 space-y-3">

              {/* ── Header ── */}
              <div className="flex items-start gap-3">
                {c.photo_url
                  ? <img src={c.photo_url} alt={c.display_name} className="h-11 w-11 shrink-0 rounded-full object-cover border border-white/10" /> // eslint-disable-line @next/next/no-img-element
                  : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg">👤</div>
                }
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-zinc-100">{c.display_name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[c.status] ?? "bg-zinc-700/40 text-zinc-400"}`}>
                      {c.status}
                    </span>
                    {c.is_online && <span className="text-[10px] text-emerald-400">● Online</span>}
                  </div>
                  {c.email && <p className="text-[11px] text-zinc-500">{c.email}</p>}
                  <p className="text-[11px] text-zinc-500">
                    {c.rate_per_min} {c.currency_code}/min
                    {c.sessions_completed > 0 && ` · ${c.sessions_completed} sessions`}
                    {c.rating_avg > 0 && ` · ★ ${c.rating_avg}`}
                  </p>
                </div>
                <p className="shrink-0 text-[10px] text-zinc-600">{new Date(c.created_at).toLocaleDateString()}</p>
              </div>

              {/* ── Full Application toggle ── */}
              <button
                onClick={() => setDetailsOpen(p => ({ ...p, [c.id]: !p[c.id] }))}
                className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-400 transition hover:text-zinc-200"
              >
                <span>📋 Full Application Details</span>
                <span>{detailsOpen[c.id] ? "▲" : "▼"}</span>
              </button>

              {detailsOpen[c.id] && (
                <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-4 text-xs">
                  {/* Personal */}
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Personal</p>
                    <div className="space-y-1.5">
                      <ARow label="Gender"        value={c.gender ?? "—"} />
                      <ARow label="Contact Email"  value={c.contact_email ?? "—"} />
                      <ARow label="Contact Phone"  value={c.contact_phone ?? "—"} />
                      {c.website_url && <ARow label="Website" value={c.website_url} link />}
                      {c.social_links && c.social_links.length > 0 && (
                        <div className="flex items-start justify-between gap-3">
                          <span className="shrink-0 text-zinc-500">Social Links</span>
                          <div className="text-right space-y-0.5">
                            {c.social_links.map((l, i) => (
                              <a key={i} href={l} target="_blank" rel="noreferrer" className="block truncate max-w-[220px] text-violet-400 underline underline-offset-2 hover:text-violet-300">{l}</a>
                            ))}
                          </div>
                        </div>
                      )}
                      <ARow label="Expertise" value={c.expertise_tags?.join(", ") ?? "—"} />
                      <ARow label="Languages" value={c.languages?.map(code => LANG_NAMES[code] ?? code).join(", ") ?? "—"} />
                    </div>
                  </div>

                  {/* Bio */}
                  {c.bio && (
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Bio</p>
                      <p className="text-zinc-300 leading-relaxed">{c.bio}</p>
                    </div>
                  )}

                  {/* Availability */}
                  {c.availability_note && (
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Availability</p>
                      <p className="text-zinc-400 leading-relaxed whitespace-pre-wrap">{c.availability_note}</p>
                    </div>
                  )}

                  {/* Payout */}
                  {c.payout_info && (
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Payout Method</p>
                      <div className="space-y-1.5">
                        <ARow label="Method" value={c.payout_info.method ?? "—"} />
                        {c.payout_info.upi_id        && <ARow label="UPI ID"           value={maskEnd(c.payout_info.upi_id)} />}
                        {c.payout_info.paypal_email   && <ARow label="PayPal Email"     value={maskEmail(c.payout_info.paypal_email)} />}
                        {c.payout_info.account_holder && <ARow label="Account Holder"   value={c.payout_info.account_holder} />}
                        {c.payout_info.bank_name      && <ARow label="Bank"             value={c.payout_info.bank_name} />}
                        {c.payout_info.account_number && <ARow label="Account Number"   value={maskEnd(c.payout_info.account_number)} />}
                        {c.payout_info.ifsc_code      && <ARow label="IFSC"             value={c.payout_info.ifsc_code} />}
                        {c.payout_info.swift_code     && <ARow label="SWIFT"            value={c.payout_info.swift_code} />}
                        {c.payout_info.iban           && <ARow label="IBAN"             value={maskEnd(c.payout_info.iban)} />}
                      </div>
                    </div>
                  )}

                  {/* Digital Signature */}
                  {c.digital_signature && (
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Digital Signature</p>
                      <p className="italic text-violet-300" style={{ fontFamily: "'Georgia', serif" }}>{c.digital_signature}</p>
                    </div>
                  )}

                  {/* Prior decision notes */}
                  {c.rejection_reason && <ARow label="Rejection Reason" value={c.rejection_reason} />}
                  {c.approval_note    && <ARow label="Approval Note"    value={c.approval_note} />}
                </div>
              )}

              {/* ── Documents ── */}
              <div>
                <button onClick={() => loadDocs(c.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-400 transition hover:text-zinc-200">
                  <span>{docsLoading[c.id] ? "Loading…" : "📄 View Documents"}</span>
                  <span>{docsLoading[c.id] ? "" : docsOpen[c.id] ? "▲" : "▼"}</span>
                </button>
                {docsOpen[c.id] && docsData[c.id] && (
                  <div className="mt-2 space-y-1.5 rounded-lg border border-white/8 bg-white/3 p-3">
                    {Object.keys(docsData[c.id]).length === 0
                      ? <p className="text-[11px] text-zinc-600">No documents uploaded.</p>
                      : Object.entries(docsData[c.id]).map(([dtype, doc]) => (
                          <div key={dtype} className="flex items-center justify-between gap-2">
                            <span className="text-[11px] capitalize text-zinc-500">{dtype.replace(/_/g," ")}</span>
                            {doc
                              ? <a href={doc.url} target="_blank" rel="noreferrer"
                                  className="truncate max-w-[200px] text-[11px] text-violet-400 underline underline-offset-2 hover:text-violet-300">{doc.name}</a>
                              : <span className="text-[11px] text-rose-400">Not uploaded</span>}
                          </div>
                        ))
                    }
                  </div>
                )}
              </div>

              {/* ── Actions: single reason field + buttons ── */}
              <div className="space-y-2 rounded-xl border border-white/10 bg-white/3 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  Admin Action
                </p>

                {/* Previous note — shown read-only when one exists */}
                {(c.status === "approved" && c.approval_note) && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 space-y-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500">Previous note (at approval)</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">{c.approval_note}</p>
                  </div>
                )}
                {(c.status === "suspended" && c.rejection_reason) && (
                  <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2 space-y-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-400">Previous note (at suspension)</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">{c.rejection_reason}</p>
                  </div>
                )}
                {(c.status === "rejected" && c.rejection_reason) && (
                  <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 space-y-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-400">Previous note (at rejection)</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">{c.rejection_reason}</p>
                  </div>
                )}

                <textarea
                  rows={2}
                  placeholder={
                    c.status === "pending"
                      ? "Reason / note — required for Approve, Reject, and Delete"
                      : "Fresh reason — required for this action (shown separately from previous note)"
                  }
                  value={actionReason[c.id] ?? ""}
                  onChange={(e) => setActionReason((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500"
                />
                <div className="flex gap-2">
                  {c.status === "pending" && (<>
                    <button
                      onClick={() => handleAction(c.id, "approve")}
                      disabled={actionLoading === c.id || !hasMinLetters(actionReason[c.id] ?? "")}
                      className="flex-1 rounded-lg bg-emerald-600/80 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-40"
                    >
                      {actionLoading === c.id ? "…" : "✓ Approve"}
                    </button>
                    <button
                      onClick={() => handleAction(c.id, "reject")}
                      disabled={actionLoading === c.id || !hasMinLetters(actionReason[c.id] ?? "")}
                      className="flex-1 rounded-lg bg-rose-700/80 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-40"
                    >
                      {actionLoading === c.id ? "…" : "✗ Reject"}
                    </button>
                  </>)}
                  {c.status === "approved" && (
                    <button
                      onClick={() => handleAction(c.id, "suspend")}
                      disabled={actionLoading === c.id || !hasMinLetters(actionReason[c.id] ?? "")}
                      className="flex-1 rounded-lg border border-orange-500/30 bg-orange-500/10 py-2 text-xs font-medium text-orange-300 transition hover:bg-orange-500/20 disabled:opacity-40"
                    >
                      {actionLoading === c.id ? "…" : "Suspend"}
                    </button>
                  )}
                  {c.status === "suspended" && (
                    <button
                      onClick={() => handleAction(c.id, "reinstate")}
                      disabled={actionLoading === c.id || !hasMinLetters(actionReason[c.id] ?? "")}
                      className="flex-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
                    >
                      {actionLoading === c.id ? "…" : "Reinstate"}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(c.id, c.display_name)}
                    disabled={actionLoading === c.id || !hasMinLetters(actionReason[c.id] ?? "")}
                    className="rounded-lg border border-rose-500/25 bg-rose-500/8 px-3 py-2 text-xs font-medium text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-40"
                  >
                    {actionLoading === c.id ? "…" : "🗑 Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main AdminPage
// ─────────────────────────────────────────────────────────────────────────────

type Section = "comments" | "licenses" | "organizations" | "superadmins" | "stats" | "connect";

export default function AdminPage() {
  const [token, setToken]     = useState<string | null>(null);
  const [myRole, setMyRole]   = useState<string | null>(null);
  const [section, setSection] = useState<Section>("comments");

  const [tab, setTab]           = useState<CommentTab>("pending");
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingC, setLoadingC] = useState(false);
  const [counts, setCounts]     = useState({ pending: 0, approved: 0, all: 0 });

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) setToken(saved);
  }, []);

  // Fetch logged-in admin's role and restrict view for connect_reviewer
  useEffect(() => {
    if (!token) return;
    fetch("/api/admin/auth/me", { credentials: "same-origin" })
      .then(r => r.json())
      .then(d => {
        const role = d.admin?.role as string | undefined;
        if (role) {
          setMyRole(role);
          if (role === "connect_reviewer") setSection("connect");
        }
      })
      .catch(() => {});
  }, [token]);

  const fetchComments = useCallback(async (status: CommentTab, tok: string) => {
    setLoadingC(true);
    try {
      const res = await fetch(`/api/admin/comments?status=${status}`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (res.status === 401) { setToken(null); sessionStorage.removeItem(SESSION_KEY); return; }
      setComments((await res.json()).comments ?? []);
    } finally { setLoadingC(false); }
  }, []);

  const fetchCounts = useCallback(async (tok: string) => {
    const [pRes, aRes] = await Promise.all([
      fetch("/api/admin/comments?status=pending",  { headers: { Authorization: `Bearer ${tok}` } }),
      fetch("/api/admin/comments?status=approved", { headers: { Authorization: `Bearer ${tok}` } }),
    ]);
    const [pData, aData] = await Promise.all([pRes.json(), aRes.json()]);
    const p = (pData.comments ?? []).length;
    const a = (aData.comments ?? []).length;
    setCounts({ pending: p, approved: a, all: p + a });
  }, []);

  useEffect(() => {
    if (!token || section !== "comments") return;
    fetchComments(tab, token);
    fetchCounts(token);
  }, [token, section, tab, fetchComments, fetchCounts]);

  if (!token) return <LoginGate onAuth={(t) => setToken(t)} />;

  const COMMENT_TABS: { key: CommentTab; label: string; count: number }[] = [
    { key: "pending",  label: "Pending Review", count: counts.pending  },
    { key: "approved", label: "Approved",        count: counts.approved },
    { key: "all",      label: "All",             count: counts.all      },
  ];

  return (
    <main className="mx-auto w-full max-w-4xl px-3 py-6 sm:px-6 sm:py-10">
      {/* Header — stacks on mobile */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Image src="/android-chrome-192.png" width={32} height={32} alt="Imotara" className="rounded-xl" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">Imotara · Admin</p>
            <h1 className="text-lg font-semibold text-zinc-100">
              {section === "comments" ? "Blog Comments" : section === "licenses" ? "License Management" : section === "organizations" ? "Organizations" : section === "superadmins" ? "Super Admins" : section === "connect" ? "Connect" : "Dashboard"}
            </h1>
          </div>
        </div>
        <button
          onClick={async () => {
            if (token?.startsWith("session:")) {
              await fetch("/api/admin/auth/logout", { method: "DELETE", credentials: "same-origin" }).catch(() => {});
            }
            sessionStorage.removeItem(SESSION_KEY);
            setToken(null);
          }}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-500 transition hover:text-zinc-300">
          Sign out
        </button>
      </div>

      {/* Tab bar — scrollable on mobile so all tabs fit */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex min-w-max gap-1 rounded-xl border border-white/8 bg-white/5 p-1">
          {([
            ["comments",      "💬", "Comments"],
            ["licenses",      "🔑", "Licenses"],
            ["organizations", "🏢", "Orgs"],
            ["connect",       "🤝", "Connect"],
            ["superadmins",   "👑", "Admins"],
            ["stats",         "📊", "Dashboard"],
          ] as const)
            .filter(([key]) => myRole !== "connect_reviewer" || key === "connect")
            .map(([key, icon, label]) => (
            <button key={key} onClick={() => setSection(key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs whitespace-nowrap transition ${
                section === key ? "bg-white/10 font-semibold text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}>
              <span>{icon}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Comments section */}
      {section === "comments" && (
        <>
          <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: "Pending",  value: counts.pending,  color: "text-amber-400"   },
              { label: "Approved", value: counts.approved, color: "text-emerald-400" },
              { label: "Total",    value: counts.all,      color: "text-indigo-400"  },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-center backdrop-blur-md">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-zinc-600">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="mb-5 flex gap-1 rounded-xl border border-white/8 bg-white/5 p-1">
            {COMMENT_TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs transition ${
                  tab === t.key ? "bg-white/10 font-medium text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                }`}>
                {t.label}
                {t.count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    tab === t.key ? "bg-indigo-500/30 text-indigo-300" : "bg-white/8 text-zinc-500"
                  }`}>{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {loadingC ? (
            <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />)}</div>
          ) : comments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-5 py-12 text-center">
              <p className="text-2xl">{tab === "pending" ? "✅" : tab === "approved" ? "💬" : "📭"}</p>
              <p className="mt-2 text-sm text-zinc-500">
                {tab === "pending" ? "No comments pending." : tab === "approved" ? "No approved comments." : "No comments yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <CommentCard key={c.id} comment={c} token={token}
                  onApproved={(id) => {
                    setComments((prev) => prev.map((x) => x.id === id ? { ...x, approved: true } : x));
                    setCounts((prev) => ({ ...prev, pending: prev.pending - 1, approved: prev.approved + 1 }));
                    if (tab === "pending") setComments((prev) => prev.filter((x) => x.id !== id));
                  }}
                  onDeleted={(id) => {
                    setComments((prev) => prev.filter((x) => x.id !== id));
                    setCounts((prev) => {
                      const wasApproved = comments.find((x) => x.id === id)?.approved ?? false;
                      return { ...prev, pending: wasApproved ? prev.pending : prev.pending - 1, approved: wasApproved ? prev.approved - 1 : prev.approved, all: prev.all - 1 };
                    });
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {section === "licenses"      && <LicensesSection      token={token} />}
      {section === "organizations" && <OrganizationsSection token={token} />}
      {section === "connect"       && <ConnectSection       token={token} />}
      {section === "superadmins"   && <SuperAdminsSection   token={token} />}
      {section === "stats"         && <StatsSection         token={token} />}
    </main>
  );
}
