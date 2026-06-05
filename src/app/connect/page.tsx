// src/app/connect/page.tsx
// Imotara Connect — human consultancy marketplace
// Tabs: Browse | My Sessions | Wallet | Dashboard (if consultant)
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users, MessageCircle, Wallet, LayoutDashboard,
  Loader2, RefreshCw, Star, Clock, ChevronRight, AlertCircle,
} from "lucide-react";
import ConsultantCard from "@/components/connect/ConsultantCard";
import { getImotaraProfile } from "@/lib/imotara/profile";

type Tab = "browse" | "sessions" | "wallet" | "dashboard";

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Consultant {
  id: string;
  display_name: string;
  gender: "male" | "female" | null;
  photo_url: string | null;
  bio: string | null;
  expertise_tags: string[];
  languages: string[];
  rate_per_min: number;
  currency_code: string;
  is_online: boolean;
  rating_avg: number;
  rating_count: number;
  sessions_completed: number;
}

interface Session {
  id: string;
  consultant_id: string;
  type: string;
  status: string;
  scheduled_note: string | null;
  started_at: string | null;
  ended_at: string | null;
  minutes_used: number;
  rating: number | null;
  created_at: string;
  connect_consultants: { display_name: string; photo_url: string | null; gender: string | null } | null;
}

interface WalletData {
  balances: Record<string, { minutes: number; currency: string }>;
  earned_amount: number;
  earned_currency: string;
  pending_payout: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ", SGD: "S$", AUD: "A$",
};

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Pending",   cls: "bg-amber-500/20 text-amber-300"   },
  accepted:  { label: "Accepted",  cls: "bg-blue-500/20 text-blue-300"     },
  active:    { label: "Active",    cls: "bg-emerald-500/20 text-emerald-300" },
  completed: { label: "Completed", cls: "bg-zinc-600/40 text-zinc-400"     },
  declined:  { label: "Declined",  cls: "bg-rose-500/20 text-rose-300"     },
  cancelled: { label: "Cancelled", cls: "bg-zinc-700/40 text-zinc-500"     },
};

// ── Age Gate ──────────────────────────────────────────────────────────────────

function AgeGatePage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-20 text-center">
      <div className="imotara-glass-card rounded-2xl p-8">
        <div className="mb-4 text-4xl">🔒</div>
        <h1 className="text-xl font-semibold text-zinc-50">Age Restriction</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          Imotara Connect is available to users aged 18 and above only.
        </p>
        <p className="mt-4 text-xs text-zinc-500">
          Our AI companion is always available for free.
        </p>
        <a
          href="/chat"
          className="mt-6 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          Return to Chat
        </a>
      </div>
    </main>
  );
}

// ── Browse Tab ────────────────────────────────────────────────────────────────

function BrowseTab({ razorpayKeyId }: { razorpayKeyId: string }) {
  const router = useRouter();
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ gender: "", online: false });

  const fetchConsultants = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter.gender) params.set("gender", filter.gender);
    if (filter.online) params.set("online", "true");
    try {
      const res = await fetch(`/api/connect/consultants?${params}`);
      const data = await res.json();
      if (data.ok) setConsultants(data.consultants);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchConsultants(); }, [fetchConsultants]);

  function handleTalkNow(consultantId: string) {
    router.push(`/connect/session/new?consultant_id=${consultantId}&type=instant`);
  }
  function handleRequestMeeting(consultantId: string) {
    router.push(`/connect/session/new?consultant_id=${consultantId}&type=scheduled`);
  }

  return (
    <div>
      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        <AlertCircle size={15} className="mt-0.5 shrink-0" />
        <span>
          Companions provide peer wellness support only — not licensed therapy. For emergencies, use the help button inside any active session.
        </span>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <select
          value={filter.gender}
          onChange={(e) => setFilter((f) => ({ ...f, gender: e.target.value }))}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-violet-500"
        >
          <option value="">All companions</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
        </select>

        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 select-none">
          <input
            type="checkbox"
            checked={filter.online}
            onChange={(e) => setFilter((f) => ({ ...f, online: e.target.checked }))}
            className="accent-violet-500"
          />
          Online now
        </label>

        <button
          onClick={fetchConsultants}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-400 transition hover:text-zinc-200"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-violet-400" size={24} />
        </div>
      ) : consultants.length === 0 ? (
        <div className="imotara-glass-card rounded-2xl py-16 text-center">
          <p className="text-zinc-400">No companions found. Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {consultants.map((c) => (
            <ConsultantCard
              key={c.id}
              consultant={c}
              razorpayKeyId={razorpayKeyId}
              onTalkNow={handleTalkNow}
              onRequestMeeting={handleRequestMeeting}
            />
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-white/8 bg-white/3 p-6 text-center">
        <p className="text-sm text-zinc-400">Want to become an Imotara Wellness Companion?</p>
        <a
          href="/connect/register"
          className="rounded-xl bg-violet-600/80 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600"
        >
          Apply to be a Companion
        </a>
      </div>
    </div>
  );
}

// ── My Sessions Tab ───────────────────────────────────────────────────────────

function SessionsTab() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/connect/sessions", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setSessions(d.sessions); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" size={24} /></div>;
  }
  if (sessions.length === 0) {
    return (
      <div className="imotara-glass-card rounded-2xl py-16 text-center">
        <MessageCircle size={32} className="mx-auto mb-3 text-zinc-600" />
        <p className="text-zinc-400">No sessions yet. Browse companions to start.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((s) => {
        const badge = STATUS_BADGES[s.status] ?? { label: s.status, cls: "bg-zinc-600/40 text-zinc-400" };
        const consultant = s.connect_consultants;
        return (
          <button
            key={s.id}
            onClick={() => router.push(`/connect/session/${s.id}`)}
            className="imotara-glass-card flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-left transition hover:bg-white/8"
          >
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-violet-500/20 flex items-center justify-center text-lg">
              {consultant?.photo_url
                ? <img src={consultant.photo_url} className="h-full w-full object-cover" alt="" />
                : (consultant?.gender === "female" ? "👩" : "👨")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-100">
                {consultant?.display_name ?? "Companion"}
              </p>
              <p className="text-xs text-zinc-500">
                {new Date(s.created_at).toLocaleDateString()} · {s.type}
                {s.minutes_used > 0 && ` · ${s.minutes_used.toFixed(0)} min`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {s.rating && (
                <div className="flex items-center gap-0.5 text-xs text-amber-400">
                  <Star size={11} className="fill-current" />
                  {s.rating}
                </div>
              )}
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                {badge.label}
              </span>
              <ChevronRight size={14} className="text-zinc-600" />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Wallet Tab ────────────────────────────────────────────────────────────────

function WalletTab() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/connect/wallet", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setWallet(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" size={24} /></div>;
  }

  const balanceEntries = Object.entries(wallet?.balances ?? {}).filter(([, v]) => v.minutes > 0);

  return (
    <div className="space-y-4">
      <div className="imotara-glass-card rounded-2xl p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Clock size={14} className="text-violet-400" />
          Session Balance
        </h3>
        {balanceEntries.length === 0 ? (
          <p className="text-sm text-zinc-500">No balance yet. Recharge from a companion&apos;s card to start a session.</p>
        ) : (
          <div className="space-y-2">
            {balanceEntries.map(([id, bal]) => (
              <div key={id} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                <span className="text-sm text-zinc-300">Balance</span>
                <span className="text-base font-semibold text-violet-300">
                  {Math.max(0, Math.floor(bal.minutes))} min remaining
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="imotara-glass-card rounded-2xl p-5">
        <p className="text-sm text-zinc-400">
          Recharge using the <strong className="text-zinc-200">+ Balance</strong> button on any companion card, or click <strong className="text-zinc-200">Talk Now</strong> when a companion is online.
        </p>
      </div>
    </div>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────

interface ConsultantSession {
  id: string;
  user_id: string;
  type: string;
  status: string;
  scheduled_note: string | null;
  started_at: string | null;
  minutes_used: number;
  created_at: string;
}

function DashboardTab() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ status: string; is_online: boolean; display_name: string } | null>(null);
  const [earnings, setEarnings] = useState<{ earned_amount: number; earned_currency: string; sessions_completed: number } | null>(null);
  const [incomingSessions, setIncomingSessions] = useState<ConsultantSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, e, s] = await Promise.all([
      fetch("/api/connect/consultant/profile", { credentials: "include" }).then((r) => r.json()).catch(() => ({})),
      fetch("/api/connect/consultant/earnings", { credentials: "include" }).then((r) => r.json()).catch(() => ({})),
      fetch("/api/connect/consultant/sessions", { credentials: "include" }).then((r) => r.json()).catch(() => ({})),
    ]);
    if (p.ok) setProfile(p.consultant);
    if (e.ok) setEarnings(e);
    if (s.ok) setIncomingSessions(s.sessions ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll every 15s while Dashboard is visible so new requests appear promptly
  useEffect(() => {
    const t = setInterval(() => {
      fetch("/api/connect/consultant/sessions", { credentials: "include" })
        .then((r) => r.json())
        .then((d) => { if (d.ok) setIncomingSessions(d.sessions ?? []); })
        .catch(() => {});
    }, 15_000);
    return () => clearInterval(t);
  }, []);

  async function handleAction(sessionId: string, action: "accept" | "decline") {
    setActionLoading(sessionId);
    try {
      const res = await fetch(`/api/connect/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        credentials: "include",
      });
      const d = await res.json();
      if (d.ok) {
        if (action === "accept") {
          router.push(`/connect/session/${sessionId}`);
        } else {
          setIncomingSessions((prev) => prev.filter((s) => s.id !== sessionId));
        }
      }
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  }

  async function toggleOnline() {
    if (!profile) return;
    setToggling(true);
    try {
      const res = await fetch("/api/connect/consultant/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_online: !profile.is_online }),
        credentials: "include",
      });
      const d = await res.json();
      if (d.ok) setProfile((p) => p ? { ...p, is_online: d.is_online } : p);
    } catch {
      // silent
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" size={24} /></div>;
  }
  if (!profile) {
    return (
      <div className="imotara-glass-card rounded-2xl py-12 text-center">
        <p className="text-zinc-400">No consultant profile found.</p>
      </div>
    );
  }

  const sym = CURRENCY_SYMBOLS[earnings?.earned_currency ?? "INR"] ?? "₹";
  const pending = incomingSessions.filter((s) => s.status === "pending");
  const active  = incomingSessions.filter((s) => s.status === "active");

  return (
    <div className="space-y-4">
      {/* Status + online toggle */}
      <div className="imotara-glass-card rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">Your Status</p>
            <p className="mt-1 text-base font-semibold text-zinc-100">{profile.display_name}</p>
            <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
              profile.status === "approved"  ? "bg-emerald-500/20 text-emerald-400"
              : profile.status === "pending" ? "bg-amber-500/20 text-amber-400"
              : "bg-rose-500/20 text-rose-400"
            }`}>
              {profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
            </span>
          </div>

          {profile.status === "approved" && (
            <button
              onClick={toggleOnline}
              disabled={toggling}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                profile.is_online
                  ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                  : "bg-zinc-700/40 text-zinc-400 hover:bg-zinc-700/60"
              }`}
            >
              {toggling && <Loader2 size={13} className="animate-spin" />}
              {profile.is_online ? "● Online" : "○ Go Online"}
            </button>
          )}
        </div>
      </div>

      {/* Active sessions — rejoin */}
      {active.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-400">Active Sessions</p>
          <div className="space-y-2">
            {active.map((s) => (
              <div key={s.id} className="imotara-glass-card flex items-center justify-between rounded-xl p-4">
                <div>
                  <p className="text-sm font-medium text-zinc-100">Session in progress</p>
                  <p className="text-xs text-zinc-500">{s.type} · {s.minutes_used.toFixed(0)} min used</p>
                </div>
                <button
                  onClick={() => router.push(`/connect/session/${s.id}`)}
                  className="rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 transition"
                >
                  Rejoin Chat
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending requests */}
      {pending.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber-400">
            Incoming Requests ({pending.length})
          </p>
          <div className="space-y-2">
            {pending.map((s) => (
              <div key={s.id} className="imotara-glass-card rounded-xl p-4">
                <div className="mb-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                      {s.type === "instant" ? "Instant" : "Scheduled"}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {s.scheduled_note && (
                    <p className="mt-2 text-sm text-zinc-300 italic">"{s.scheduled_note}"</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction(s.id, "accept")}
                    disabled={actionLoading === s.id}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600/80 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {actionLoading === s.id ? <Loader2 size={12} className="animate-spin" /> : null}
                    Accept & Chat
                  </button>
                  <button
                    onClick={() => handleAction(s.id, "decline")}
                    disabled={actionLoading === s.id}
                    className="flex flex-1 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length === 0 && active.length === 0 && profile.status === "approved" && (
        <div className="imotara-glass-card rounded-xl p-5 text-center">
          <p className="text-sm text-zinc-500">No incoming requests right now.</p>
          <p className="mt-1 text-xs text-zinc-600">Make sure you're online to receive requests.</p>
        </div>
      )}

      {/* Earnings */}
      {earnings && (
        <div className="grid grid-cols-2 gap-3">
          <div className="imotara-glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-violet-300">{sym}{Number(earnings.earned_amount).toFixed(2)}</p>
            <p className="mt-1 text-xs text-zinc-500">Total earned</p>
          </div>
          <div className="imotara-glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-zinc-100">{earnings.sessions_completed}</p>
            <p className="mt-1 text-xs text-zinc-500">Sessions</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ConnectPage() {
  const [mounted, setMounted]             = useState(false);
  const [isUnder18, setIsUnder18]         = useState(false);
  const [activeTab, setActiveTab]         = useState<Tab>("browse");
  const [isConsultant, setIsConsultant]   = useState(false);

  useEffect(() => {
    setMounted(true);
    const profile = getImotaraProfile();
    const age = profile?.user?.ageRange;
    if (age === "under_13" || age === "13_17") { setIsUnder18(true); return; }

    fetch("/api/connect/consultant/profile", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setIsConsultant(true); })
      .catch(() => {});
  }, []);

  if (!mounted) return null;
  if (isUnder18) return <AgeGatePage />;

  const tabs: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
    { key: "browse",   label: "Browse",      icon: <Users size={15} />         },
    { key: "sessions", label: "My Sessions", icon: <MessageCircle size={15} /> },
    { key: "wallet",   label: "Wallet",      icon: <Wallet size={15} />        },
    ...(isConsultant
      ? [{ key: "dashboard" as Tab, label: "Dashboard", icon: <LayoutDashboard size={15} /> }]
      : []),
  ];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 text-zinc-50 sm:px-6">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">Imotara · Connect</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Talk to a Human Companion</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
          Verified wellness companions — real people — available to listen and support. Pay only for the time you use.
        </p>
      </header>

      <div className="mb-6 flex gap-1 rounded-xl border border-white/8 bg-white/5 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm transition ${
              activeTab === t.key
                ? "bg-white/10 font-semibold text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "browse"    && <BrowseTab razorpayKeyId={RAZORPAY_KEY_ID} />}
      {activeTab === "sessions"  && <SessionsTab />}
      {activeTab === "wallet"    && <WalletTab />}
      {activeTab === "dashboard" && <DashboardTab />}
    </main>
  );
}
