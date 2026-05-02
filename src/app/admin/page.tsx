"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, useTransition } from "react";

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

type LicenseTier   = "free" | "plus" | "pro" | "family" | "edu" | "enterprise";
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
  const [value, setValue]       = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState("");
  const [isPending, startTransition] = useTransition();

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

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-white/10 bg-white/5 px-6 py-8 backdrop-blur-xl">
        <div className="text-center">
          {/* Imotara logo */}
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-black/30 shadow-lg ring-1 ring-white/10">
            <Image
              src="/android-chrome-192.png"
              width={48}
              height={48}
              alt="Imotara"
              className="rounded-xl"
              priority
            />
          </div>
          <h1 className="mt-3 text-base font-semibold text-zinc-100">Imotara Admin</h1>
          <p className="mt-0.5 text-xs text-zinc-500">Super-admin panel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Password field with show/hide toggle */}
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              placeholder="Enter admin secret key"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(""); }}
              autoFocus
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-4 pr-10 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-indigo-500/40"
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

        <p className="text-center text-[10px] text-zinc-600">
          Set <code className="text-zinc-400">ADMIN_SECRET</code> in{" "}
          <code className="text-zinc-400">.env.local</code>
        </p>
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
    const res = await fetch(`/api/admin/comments/${comment.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) onApproved(comment.id);
    else setApproving(false);
  }

  async function remove() {
    if (!confirm(`Delete comment by "${comment.name}"?`)) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/comments/${comment.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
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

  // Collapsible sub-sections
  const [showPayments, setShowPayments] = useState(false);
  const [showHistory,  setShowHistory]  = useState(false);

  // Fetch detail when expanded
  useEffect(() => {
    if (!expanded || detail) return;
    setDetailLoading(true);
    fetch(`/api/admin/licenses/${user.user_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
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
    const res = await fetch(`/api/admin/licenses/${user.user_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
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
// Main AdminPage
// ─────────────────────────────────────────────────────────────────────────────

type Section = "comments" | "licenses";

export default function AdminPage() {
  const [token, setToken]     = useState<string | null>(null);
  const [section, setSection] = useState<Section>("comments");

  const [tab, setTab]           = useState<CommentTab>("pending");
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingC, setLoadingC] = useState(false);
  const [counts, setCounts]     = useState({ pending: 0, approved: 0, all: 0 });

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) setToken(saved);
  }, []);

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
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image src="/android-chrome-192.png" width={32} height={32} alt="Imotara" className="rounded-xl" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Imotara · Admin</p>
            <h1 className="text-xl font-semibold text-zinc-100">
              {section === "comments" ? "Blog Comments" : "License Management"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-white/8 bg-white/5 p-1">
            <button onClick={() => setSection("comments")}
              className={`rounded-lg px-3 py-1.5 text-xs transition ${section === "comments" ? "bg-white/10 font-medium text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>
              💬 Comments
            </button>
            <button onClick={() => setSection("licenses")}
              className={`rounded-lg px-3 py-1.5 text-xs transition ${section === "licenses" ? "bg-white/10 font-medium text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>
              🔑 Licenses
            </button>
          </div>
          <button
            onClick={() => { sessionStorage.removeItem(SESSION_KEY); setToken(null); }}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-500 transition hover:text-zinc-300">
            Sign out
          </button>
        </div>
      </div>

      {/* Comments section */}
      {section === "comments" && (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3">
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

      {section === "licenses" && <LicensesSection token={token} />}
    </main>
  );
}
