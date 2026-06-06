// src/app/connect/page.tsx
// Imotara Connect — human consultancy marketplace
// Tabs: Browse | My Sessions | Wallet | Dashboard (if consultant)
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  Users, MessageCircle, Wallet, LayoutDashboard,
  Loader2, RefreshCw, Star, Clock, ChevronRight, AlertCircle,
  Bell, History, TrendingUp, Plus, Minus, Heart, Calendar,
  FileText, Ban, ChevronDown, ChevronUp, Shield,
} from "lucide-react";
import ConsultantCard from "@/components/connect/ConsultantCard";
import { getImotaraProfile } from "@/lib/imotara/profile";

type Tab = "browse" | "sessions" | "wallet" | "dashboard";

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";

const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Types ─────────────────────────────────────────────────────────────────────

interface AvailabilityWindow {
  day: string;
  start: string;
  end: string;
}

interface Consultant {
  id: string;
  display_name: string;
  gender: "male" | "female" | null;
  photo_url: string | null;
  bio: string | null;
  expertise_tags: string[];
  languages: string[];
  session_types: string[];
  role_category: string;
  rate_per_min: number;
  currency_code: string;
  availability_note: string | null;
  availability_windows: AvailabilityWindow[] | null;
  is_online: boolean;
  is_busy: boolean;
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
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  minutes_used: number;
  amount_charged: number | null;
  currency_code: string | null;
  rate_per_min: number | null;
  rating: number | null;
  review_text: string | null;
  review_submitted_at: string | null;
  created_at: string;
  connect_consultants: { display_name: string; photo_url: string | null; gender: string | null; rate_per_min?: number } | null;
}

interface WalletEntry {
  consultant_id: string;
  display_name: string;
  photo_url: string | null;
  gender: string | null;
  balance_minutes: number;
  currency_code: string;
}

interface WalletData {
  wallets: WalletEntry[];
  earned_amount: number;
  earned_currency: string;
  pending_payout: number;
}

interface Transaction {
  id: string;
  type: "recharge" | "session";
  consultant_name: string;
  consultant_id: string;
  minutes: number;
  amount: number | null;
  currency_code: string | null;
  created_at: string;
}

interface ConsultantSession {
  id: string;
  user_id: string;
  type: string;
  status: string;
  scheduled_note: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  minutes_used: number;
  rate_per_min: number | null;
  amount_charged: number | null;
  rating: number | null;
  review_text: string | null;
  created_at: string;
  user_preview: { email: string } | null;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ", SGD: "S$", AUD: "A$",
};

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Pending",   cls: "bg-amber-500/20 text-amber-300"     },
  accepted:  { label: "Accepted",  cls: "bg-blue-500/20 text-blue-300"       },
  active:    { label: "Active",    cls: "bg-emerald-500/20 text-emerald-300" },
  completed: { label: "Completed", cls: "bg-zinc-600/40 text-zinc-400"       },
  declined:  { label: "Declined",  cls: "bg-rose-500/20 text-rose-300"       },
  cancelled: { label: "Cancelled", cls: "bg-zinc-700/40 text-zinc-500"       },
};

const EXPERTISE_TAGS = [
  "Anxiety", "Depression", "Stress", "Relationships", "Grief", "Trauma",
  "Career", "Self-esteem", "Parenting", "Life transitions", "Mindfulness", "Sleep",
];

const ROLE_CATEGORIES = [
  { key: "wellness_companion", label: "Wellness Companion", icon: "🧘", phase: 1 },
  { key: "friend",             label: "Friend",             icon: "🤝", phase: 2 },
  { key: "dad",                label: "Dad",                icon: "👨", phase: 2 },
  { key: "mom",                label: "Mom",                icon: "👩", phase: 2 },
  { key: "sister",             label: "Sister",             icon: "👧", phase: 2 },
  { key: "brother",            label: "Brother",            icon: "👦", phase: 2 },
  { key: "grandfather",        label: "Grandfather",        icon: "👴", phase: 2 },
  { key: "grandmother",        label: "Grandmother",        icon: "👵", phase: 2 },
  { key: "yoga_instructor",    label: "Yoga Instructor",    icon: "🧘", phase: 3 },
  { key: "fitness_companion",  label: "Fitness Companion",  icon: "💪", phase: 3 },
] as const;

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ── Browse Tab ────────────────────────────────────────────────────────────────

function BrowseTab({ razorpayKeyId }: { razorpayKeyId: string }) {
  const router = useRouter();
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ gender: "", online: false, tag: "", category: "" });
  const [sort, setSort] = useState<"rating" | "price_asc" | "price_desc" | "sessions">("rating");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favLoading, setFavLoading] = useState<string | null>(null);

  const fetchConsultants = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter.gender)   params.set("gender", filter.gender);
    if (filter.online)   params.set("online", "true");
    if (filter.category) params.set("category", filter.category);
    try {
      const [cRes, fRes] = await Promise.all([
        fetch(`/api/connect/consultants?${params}`),
        fetch("/api/connect/favorites", { credentials: "include" }),
      ]);
      const cData = await cRes.json();
      const fData = await fRes.json();
      if (cData.ok) setConsultants(cData.consultants);
      if (fData.ok) setFavorites(new Set(fData.favorites ?? []));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filter.gender, filter.online, filter.category]);

  useEffect(() => { fetchConsultants(); }, [fetchConsultants]);

  async function toggleFavorite(consultantId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const isFav = favorites.has(consultantId);
    setFavLoading(consultantId);
    try {
      await fetch("/api/connect/favorites", {
        method: isFav ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultant_id: consultantId }),
        credentials: "include",
      });
      setFavorites((prev) => {
        const next = new Set(prev);
        if (isFav) next.delete(consultantId); else next.add(consultantId);
        return next;
      });
    } catch { /* silent */ }
    finally { setFavLoading(null); }
  }

  function handleTalkNow(consultantId: string) {
    router.push(`/connect/session/new?consultant_id=${consultantId}&type=instant`);
  }
  function handleRequestMeeting(consultantId: string) {
    router.push(`/connect/session/new?consultant_id=${consultantId}&type=scheduled`);
  }

  const displayed = consultants
    .filter((c) => !filter.tag || c.expertise_tags.includes(filter.tag))
    .sort((a, b) => {
      if (sort === "rating")     return (b.rating_avg || 0) - (a.rating_avg || 0);
      if (sort === "price_asc")  return a.rate_per_min - b.rate_per_min;
      if (sort === "price_desc") return b.rate_per_min - a.rate_per_min;
      if (sort === "sessions")   return b.sessions_completed - a.sessions_completed;
      return 0;
    });

  return (
    <div>
      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        <AlertCircle size={15} className="mt-0.5 shrink-0" />
        <span>
          Companions provide peer wellness support only — not licensed therapy. For emergencies, use the help button inside any active session.
        </span>
      </div>

      {/* Category chips */}
      <div className="mb-3 -mx-1">
        <div className="flex gap-2 overflow-x-auto pb-2 px-1" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => setFilter((f) => ({ ...f, category: "" }))}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition whitespace-nowrap
              ${!filter.category ? "border-violet-500 bg-violet-500/20 text-violet-300" : "border-white/10 text-zinc-400 hover:border-white/20"}`}
          >
            All
          </button>
          {ROLE_CATEGORIES.map((rc) => (
            <button
              key={rc.key}
              disabled={rc.phase > 1}
              onClick={() => rc.phase === 1 && setFilter((f) => ({ ...f, category: f.category === rc.key ? "" : rc.key }))}
              className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm whitespace-nowrap transition
                ${filter.category === rc.key
                  ? "border-violet-500 bg-violet-500/20 text-violet-300"
                  : rc.phase === 1
                    ? "border-white/10 text-zinc-400 hover:border-white/20 cursor-pointer"
                    : "border-white/5 text-zinc-600 cursor-not-allowed"}`}
            >
              <span>{rc.icon}</span>
              <span>{rc.label}</span>
              {rc.phase > 1 && <span className="ml-0.5 text-[10px] text-zinc-600">Soon</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Filters + Sort */}
      <div className="mb-5 flex flex-wrap gap-2">
        <select
          value={filter.gender}
          onChange={(e) => setFilter((f) => ({ ...f, gender: e.target.value }))}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-violet-500"
        >
          <option value="">All genders</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
        </select>

        <select
          value={filter.tag}
          onChange={(e) => setFilter((f) => ({ ...f, tag: e.target.value }))}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-violet-500"
        >
          <option value="">All specialties</option>
          {EXPERTISE_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-violet-500"
        >
          <option value="rating">Sort: Top rated</option>
          <option value="price_asc">Sort: Price ↑</option>
          <option value="price_desc">Sort: Price ↓</option>
          <option value="sessions">Sort: Most sessions</option>
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
      ) : displayed.length === 0 ? (
        <div className="imotara-glass-card rounded-2xl py-16 text-center">
          <p className="text-zinc-400">No companions found. Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayed.map((c) => (
            <ConsultantCard
              key={c.id}
              consultant={c}
              razorpayKeyId={razorpayKeyId}
              isFavorite={favorites.has(c.id)}
              favLoading={favLoading === c.id}
              onToggleFavorite={(e) => toggleFavorite(c.id, e)}
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
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [summaryId, setSummaryId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/connect/sessions", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setSessions(d.sessions); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function cancelSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setCancelling(id);
    try {
      const res = await fetch(`/api/connect/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
        credentials: "include",
      });
      const d = await res.json();
      if (d.ok) setSessions((prev) => prev.map((s) => s.id === id ? { ...s, status: "cancelled" } : s));
    } catch { /* silent */ }
    finally { setCancelling(null); }
  }

  function buildSummary(s: Session) {
    const companion = s.connect_consultants?.display_name ?? "Companion";
    const date = new Date(s.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const duration = s.minutes_used > 0 ? `${Math.round(s.minutes_used)} min` : "< 1 min";
    const sym = CURRENCY_SYMBOLS[s.currency_code ?? "INR"] ?? "₹";
    const cost = s.amount_charged != null ? `${sym}${Number(s.amount_charged).toFixed(2)}` : "—";
    const rating = s.rating ? `${s.rating}/5 ★` : "Not rated";
    return [
      `Imotara Connect — Session Summary`,
      `Date: ${date}`,
      `Companion: ${companion}`,
      `Type: ${s.type === "instant" ? "Instant" : "Scheduled"}`,
      `Duration: ${duration}`,
      `Cost: ${cost}`,
      `Your rating: ${rating}`,
      s.review_text ? `Your note: "${s.review_text}"` : "",
      ``,
      `Imotara — Mindful wellness with human connection`,
    ].filter(Boolean).join("\n");
  }

  async function copySummary(s: Session, e: React.MouseEvent) {
    e.stopPropagation();
    const text = buildSummary(s);
    try {
      await navigator.clipboard.writeText(text);
      setSummaryId(s.id);
      setTimeout(() => setSummaryId(null), 2000);
    } catch { /* silent */ }
  }

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
        const canCancel = s.status === "pending";
        const isCompleted = s.status === "completed";
        const sym = CURRENCY_SYMBOLS[s.currency_code ?? "INR"] ?? "₹";
        return (
          <div
            key={s.id}
            className="imotara-glass-card flex w-full items-center gap-4 rounded-xl px-4 py-3.5"
          >
            <button
              onClick={() => router.push(`/connect/session/${s.id}`)}
              className="flex flex-1 items-center gap-4 text-left min-w-0"
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
                  {s.minutes_used > 0 && ` · ${Math.round(s.minutes_used)} min`}
                  {s.amount_charged != null && s.amount_charged > 0 && ` · ${sym}${Number(s.amount_charged).toFixed(2)}`}
                </p>
                {s.scheduled_at && s.status === "pending" && (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-violet-400">
                    <Calendar size={10} />
                    {new Date(s.scheduled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                )}
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
            <div className="flex shrink-0 flex-col gap-1.5">
              {canCancel && (
                <button
                  onClick={(e) => cancelSession(s.id, e)}
                  disabled={cancelling === s.id}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[10px] font-medium text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-50"
                >
                  {cancelling === s.id ? <Loader2 size={10} className="animate-spin" /> : "Cancel"}
                </button>
              )}
              {isCompleted && (
                <button
                  onClick={(e) => copySummary(s, e)}
                  className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-[10px] font-medium text-violet-400 transition hover:bg-violet-500/20"
                  title="Copy session summary"
                >
                  {summaryId === s.id ? "Copied!" : <FileText size={11} />}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Wallet Tab ────────────────────────────────────────────────────────────────

function WalletTab() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetch("/api/connect/wallet", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setWallet(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function loadHistory() {
    if (transactions.length > 0) { setShowHistory((v) => !v); return; }
    setHistoryLoading(true);
    setShowHistory(true);
    try {
      const res = await fetch("/api/connect/wallet/history", { credentials: "include" });
      const d = await res.json();
      if (d.ok) setTransactions(d.transactions ?? []);
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" size={24} /></div>;
  }

  const entries = wallet?.wallets ?? [];

  return (
    <div className="space-y-4">
      <div className="imotara-glass-card rounded-2xl p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Clock size={14} className="text-violet-400" />
          Session Balance
        </h3>
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-500">No balance yet. Recharge from a companion&apos;s card to start a session.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.consultant_id} className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-violet-500/20 flex items-center justify-center text-base">
                  {e.photo_url
                    ? <img src={e.photo_url} className="h-full w-full object-cover" alt="" />
                    : (e.gender === "female" ? "👩" : "👨")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-100">{e.display_name}</p>
                  <p className="text-xs text-zinc-500">{e.currency_code}</p>
                </div>
                <span className="shrink-0 text-base font-semibold text-violet-300">
                  {e.balance_minutes} min
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

      {/* Transaction History */}
      <div className="imotara-glass-card rounded-2xl overflow-hidden">
        <button
          onClick={loadHistory}
          className="flex w-full items-center justify-between p-5 text-left hover:bg-white/3 transition"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <History size={14} className="text-violet-400" />
            Transaction History
          </span>
          <span className="text-zinc-500">{showHistory ? "▲" : "▼"}</span>
        </button>

        {showHistory && (
          <div className="border-t border-white/8 px-5 pb-5">
            {historyLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-violet-400" size={20} /></div>
            ) : transactions.length === 0 ? (
              <p className="pt-4 text-center text-sm text-zinc-500">No transactions yet.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {transactions.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl bg-white/3 px-3 py-2.5">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      t.type === "recharge" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                    }`}>
                      {t.type === "recharge" ? <Plus size={13} /> : <Minus size={13} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-zinc-200">
                        {t.type === "recharge" ? "Recharged" : "Session"} · {t.consultant_name}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        {new Date(t.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-xs font-semibold ${t.type === "recharge" ? "text-emerald-400" : "text-rose-400"}`}>
                        {t.type === "recharge" ? "+" : "-"}{t.minutes} min
                      </p>
                      {t.amount != null && t.currency_code && (
                        <p className="text-[10px] text-zinc-500">
                          {CURRENCY_SYMBOLS[t.currency_code] ?? t.currency_code}{t.amount.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Availability Window Editor ────────────────────────────────────────────────

function AvailabilityEditor({
  windows,
  onChange,
}: {
  windows: AvailabilityWindow[];
  onChange: (w: AvailabilityWindow[]) => void;
}) {
  function addWindow() {
    onChange([...windows, { day: "Monday", start: "09:00", end: "17:00" }]);
  }
  function removeWindow(i: number) {
    onChange(windows.filter((_, idx) => idx !== i));
  }
  function updateWindow(i: number, field: keyof AvailabilityWindow, value: string) {
    onChange(windows.map((w, idx) => idx === i ? { ...w, [field]: value } : w));
  }

  return (
    <div className="space-y-2">
      {windows.map((w, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-white/3 p-3">
          <select
            value={w.day}
            onChange={(e) => updateWindow(i, "day", e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-violet-500"
          >
            {DAYS_OF_WEEK.map((d) => <option key={d}>{d}</option>)}
          </select>
          <input
            type="time"
            value={w.start}
            onChange={(e) => updateWindow(i, "start", e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-violet-500"
          />
          <span className="text-xs text-zinc-500">to</span>
          <input
            type="time"
            value={w.end}
            onChange={(e) => updateWindow(i, "end", e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-violet-500"
          />
          <button
            onClick={() => removeWindow(i)}
            className="ml-auto rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[10px] text-rose-400 hover:bg-rose-500/20"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        onClick={addWindow}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition"
      >
        <Plus size={11} /> Add window
      </button>
    </div>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTab() {
  const router = useRouter();
  const [profile, setProfile] = useState<{
    id: string; status: string; is_online: boolean; display_name: string;
    availability_windows: AvailabilityWindow[] | null;
  } | null>(null);
  const [earnings, setEarnings] = useState<{
    earned_amount: number; earned_currency: string;
    pending_payout: number; sessions_completed: number;
    rate_per_min?: number;
  } | null>(null);
  const [incomingSessions, setIncomingSessions] = useState<ConsultantSession[]>([]);
  const [history, setHistory]     = useState<ConsultantSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [toggling, setToggling]   = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showPayout, setShowPayout]       = useState(false);
  const [payoutMethod, setPayoutMethod]   = useState<"upi" | "bank" | "paypal">("upi");
  const [payoutDetails, setPayoutDetails] = useState("");
  const [payoutAmount, setPayoutAmount]   = useState("");
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutMsg, setPayoutMsg]         = useState<{ ok: boolean; text: string } | null>(null);
  const [newRequestAlert, setNewRequestAlert] = useState(false);
  const prevPendingCount = useRef(0);

  // Availability windows editor state
  const [editingAvail, setEditingAvail] = useState(false);
  const [availWindows, setAvailWindows] = useState<AvailabilityWindow[]>([]);
  const [availSaving, setAvailSaving]   = useState(false);

  // Session notes (per session in history)
  const [openNoteSessionId, setOpenNoteSessionId] = useState<string | null>(null);
  const [noteContent, setNoteContent]   = useState("");
  const [noteSaving, setNoteSaving]     = useState(false);
  const [noteMsg, setNoteMsg]           = useState("");

  // Block user
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, e, s] = await Promise.all([
      fetch("/api/connect/consultant/profile", { credentials: "include" }).then((r) => r.json()).catch(() => ({})),
      fetch("/api/connect/consultant/earnings", { credentials: "include" }).then((r) => r.json()).catch(() => ({})),
      fetch("/api/connect/consultant/sessions", { credentials: "include" }).then((r) => r.json()).catch(() => ({})),
    ]);
    if (p.ok) {
      setProfile(p.consultant);
      setAvailWindows(p.consultant?.availability_windows ?? []);
    }
    if (e.ok) setEarnings(e);
    if (s.ok) {
      setIncomingSessions(s.sessions ?? []);
      prevPendingCount.current = (s.sessions ?? []).filter((x: ConsultantSession) => x.status === "pending").length;
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll every 15s
  useEffect(() => {
    const t = setInterval(() => {
      fetch("/api/connect/consultant/sessions", { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            const sessions = d.sessions ?? [];
            const newPendingCount = sessions.filter((x: ConsultantSession) => x.status === "pending").length;
            if (newPendingCount > prevPendingCount.current) setNewRequestAlert(true);
            prevPendingCount.current = newPendingCount;
            setIncomingSessions(sessions);
          }
        })
        .catch(() => {});
    }, 15_000);
    return () => clearInterval(t);
  }, []);

  // Supabase Realtime: instant alert
  useEffect(() => {
    if (!profile?.id) return;
    const consultantId = profile.id;
    const channel = supabaseBrowser
      .channel(`dashboard:${consultantId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "connect_sessions",
        filter: `consultant_id=eq.${consultantId}`,
      }, (payload) => {
        const newSession = payload.new as ConsultantSession;
        if (newSession.status === "pending") {
          setIncomingSessions((prev) => {
            if (prev.find((s) => s.id === newSession.id)) return prev;
            setNewRequestAlert(true);
            return [newSession, ...prev];
          });
        }
      })
      .subscribe();
    return () => { supabaseBrowser.removeChannel(channel); };
  }, [profile?.id]);

  async function loadHistory() {
    if (historyLoaded) { setShowHistory((v) => !v); return; }
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/connect/consultant/sessions?status=history", { credentials: "include" });
      const d = await res.json();
      if (d.ok) { setHistory(d.sessions ?? []); setHistoryLoaded(true); }
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  }

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
    } catch { /* silent */ }
    finally { setActionLoading(null); }
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
    } catch { /* silent */ }
    finally { setToggling(false); }
  }

  async function requestPayout() {
    const amount = parseFloat(payoutAmount);
    if (!amount || amount <= 0 || !payoutDetails.trim()) return;
    setPayoutLoading(true);
    setPayoutMsg(null);
    try {
      const res = await fetch("/api/connect/consultant/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency_code:  earnings?.earned_currency ?? "INR",
          payout_method:  payoutMethod,
          payout_details: payoutMethod === "upi"  ? { upi_id: payoutDetails }
                        : payoutMethod === "bank"  ? { account_number: payoutDetails }
                        : { paypal_email: payoutDetails },
        }),
        credentials: "include",
      });
      const d = await res.json();
      if (d.ok) {
        setPayoutMsg({ ok: true, text: "Request submitted. Admin will process within 2 business days." });
        setPayoutAmount(""); setPayoutDetails("");
        setEarnings((e) => e ? { ...e, pending_payout: (e.pending_payout ?? 0) + amount } : e);
      } else {
        setPayoutMsg({ ok: false, text: d.error ?? "Request failed." });
      }
    } catch {
      setPayoutMsg({ ok: false, text: "Network error." });
    } finally {
      setPayoutLoading(false);
    }
  }

  async function saveAvailability() {
    setAvailSaving(true);
    try {
      await fetch("/api/connect/consultant/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability_windows: availWindows }),
        credentials: "include",
      });
      setProfile((p) => p ? { ...p, availability_windows: availWindows } : p);
      setEditingAvail(false);
    } catch { /* silent */ }
    finally { setAvailSaving(false); }
  }

  async function openNote(sessionId: string) {
    if (openNoteSessionId === sessionId) { setOpenNoteSessionId(null); return; }
    setOpenNoteSessionId(sessionId);
    setNoteContent("");
    setNoteMsg("");
    try {
      const res = await fetch(`/api/connect/sessions/${sessionId}/notes`, { credentials: "include" });
      const d = await res.json();
      if (d.ok) setNoteContent(d.content ?? "");
    } catch { /* silent */ }
  }

  async function saveNote(sessionId: string) {
    setNoteSaving(true);
    try {
      await fetch(`/api/connect/sessions/${sessionId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteContent }),
        credentials: "include",
      });
      setNoteMsg("Saved");
      setTimeout(() => setNoteMsg(""), 2000);
    } catch { /* silent */ }
    finally { setNoteSaving(false); }
  }

  async function blockUser(userId: string) {
    if (!confirm("Block this user? They will no longer be able to request sessions with you.")) return;
    setBlockingUserId(userId);
    try {
      await fetch("/api/connect/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocked_user_id: userId, reason: "Reported by companion" }),
        credentials: "include",
      });
      // Remove from history UI
      setHistory((prev) => prev.filter((s) => s.user_id !== userId));
    } catch { /* silent */ }
    finally { setBlockingUserId(null); }
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

  function secondsUntilExpiry(createdAt: string) {
    const created = new Date(createdAt).getTime();
    const elapsed = (Date.now() - created) / 1000;
    return Math.max(0, Math.round(300 - elapsed));
  }

  function userInitial(session: ConsultantSession) {
    const email = session.user_preview?.email;
    if (!email) return "?";
    return email.charAt(0).toUpperCase();
  }
  function userDisplayName(session: ConsultantSession) {
    const email = session.user_preview?.email;
    if (!email) return "Anonymous user";
    return email.split("@")[0];
  }

  return (
    <div className="space-y-4">

      {/* New request alert */}
      {newRequestAlert && (
        <div
          onClick={() => setNewRequestAlert(false)}
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-3 text-sm text-amber-300"
        >
          <Bell size={15} className="shrink-0 animate-pulse" />
          <span className="font-semibold">New session request received!</span>
          <span className="ml-auto text-xs opacity-60">tap to dismiss</span>
        </div>
      )}

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

      {/* Availability Windows */}
      <div className="imotara-glass-card rounded-2xl overflow-hidden">
        <button
          onClick={() => { setEditingAvail((v) => !v); setAvailWindows(profile.availability_windows ?? []); }}
          className="flex w-full items-center justify-between p-5 text-left hover:bg-white/3 transition"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Calendar size={14} className="text-violet-400" />
            Availability Windows
          </span>
          {editingAvail ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
        </button>
        {editingAvail && (
          <div className="border-t border-white/8 p-5 space-y-3">
            <p className="text-xs text-zinc-500">Set the days and times you&apos;re usually available. Shown on your profile.</p>
            <AvailabilityEditor windows={availWindows} onChange={setAvailWindows} />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingAvail(false)}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={saveAvailability}
                disabled={availSaving}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
              >
                {availSaving && <Loader2 size={11} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Active sessions */}
      {active.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-400">Active Sessions</p>
          <div className="space-y-2">
            {active.map((s) => (
              <div key={s.id} className="imotara-glass-card flex items-center justify-between rounded-xl p-4">
                <div>
                  <p className="text-sm font-medium text-zinc-100">Session in progress</p>
                  <p className="text-xs text-zinc-500">{s.type} · {Math.round(s.minutes_used)} min used</p>
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

      {/* Pending requests with user preview */}
      {pending.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber-400">
            Incoming Requests ({pending.length})
          </p>
          <div className="space-y-2">
            {pending.map((s) => {
              const secs = secondsUntilExpiry(s.created_at);
              return (
                <div key={s.id} className="imotara-glass-card rounded-xl p-4">
                  {/* User preview card */}
                  <div className="mb-3 flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm font-semibold text-violet-300">
                      {userInitial(s)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-zinc-100">{userDisplayName(s)}</span>
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                          {s.type === "instant" ? "Instant" : "Scheduled"}
                        </span>
                        {secs <= 60 && (
                          <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-medium text-rose-400">
                            Expires in {secs}s
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">
                        {new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {s.scheduled_at && ` · Scheduled: ${new Date(s.scheduled_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}`}
                      </p>
                    </div>
                  </div>
                  {s.scheduled_note && (
                    <p className="mb-3 rounded-lg bg-white/5 px-3 py-2 text-xs text-zinc-300 italic">
                      &ldquo;{s.scheduled_note}&rdquo;
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(s.id, "accept")}
                      disabled={actionLoading === s.id}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600/80 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                    >
                      {actionLoading === s.id ? <Loader2 size={12} className="animate-spin" /> : null}
                      Accept &amp; Chat
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
              );
            })}
          </div>
        </div>
      )}

      {pending.length === 0 && active.length === 0 && profile.status === "approved" && (
        <div className="imotara-glass-card rounded-xl p-5 text-center">
          <p className="text-sm text-zinc-500">No incoming requests right now.</p>
          <p className="mt-1 text-xs text-zinc-600">Make sure you&apos;re online to receive requests.</p>
        </div>
      )}

      {/* Earnings + payout */}
      {earnings && (
        <div className="imotara-glass-card rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/5 p-4 text-center">
              <p className="text-2xl font-bold text-violet-300">{sym}{Number(earnings.earned_amount).toFixed(2)}</p>
              <p className="mt-1 text-xs text-zinc-500">Total earned</p>
            </div>
            <div className="rounded-xl bg-white/5 p-4 text-center">
              <p className="text-2xl font-bold text-zinc-100">{earnings.sessions_completed}</p>
              <p className="mt-1 text-xs text-zinc-500">Sessions</p>
            </div>
          </div>
          {Number(earnings.pending_payout) > 0 && (
            <p className="text-center text-xs text-amber-400">
              {sym}{Number(earnings.pending_payout).toFixed(2)} payout pending processing
            </p>
          )}
          {(() => {
            const available = Number(earnings.earned_amount) - Number(earnings.pending_payout ?? 0);
            return available > 0 ? (
              <button
                onClick={() => { setShowPayout((v) => !v); setPayoutMsg(null); }}
                className="w-full rounded-xl border border-violet-500/30 bg-violet-500/10 py-2.5 text-sm font-semibold text-violet-300 transition hover:bg-violet-500/20"
              >
                {showPayout ? "Cancel" : `Request Payout · ${sym}${available.toFixed(2)} available`}
              </button>
            ) : null;
          })()}
          {showPayout && (
            <div className="space-y-3 border-t border-white/10 pt-3">
              <div className="flex gap-2">
                {(["upi", "bank", "paypal"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPayoutMethod(m)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-medium transition ${
                      payoutMethod === m
                        ? "border-violet-500 bg-violet-500/20 text-violet-300"
                        : "border-white/10 text-zinc-400 hover:border-white/20"
                    }`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
              <input
                value={payoutDetails}
                onChange={(e) => setPayoutDetails(e.target.value)}
                placeholder={payoutMethod === "upi" ? "UPI ID" : payoutMethod === "bank" ? "Account number" : "PayPal email"}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500"
              />
              <input
                type="number"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder={`Amount in ${earnings.earned_currency}`}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500"
              />
              {payoutMsg && (
                <p className={`text-xs ${payoutMsg.ok ? "text-emerald-400" : "text-rose-400"}`}>{payoutMsg.text}</p>
              )}
              <button
                onClick={requestPayout}
                disabled={payoutLoading || !payoutDetails.trim() || !payoutAmount}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
              >
                {payoutLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                Submit Request
              </button>
            </div>
          )}
        </div>
      )}

      {/* Session History + Reviews + Notes + Block */}
      <div className="imotara-glass-card rounded-2xl overflow-hidden">
        <button
          onClick={loadHistory}
          className="flex w-full items-center justify-between p-5 text-left hover:bg-white/3 transition"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <History size={14} className="text-violet-400" />
            Session History &amp; Reviews
          </span>
          <span className="text-zinc-500">{showHistory ? "▲" : "▼"}</span>
        </button>

        {showHistory && (
          <div className="border-t border-white/8 px-5 pb-5">
            {historyLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-violet-400" size={20} /></div>
            ) : history.length === 0 ? (
              <p className="pt-4 text-center text-sm text-zinc-500">No completed sessions yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {history.map((s) => (
                  <div key={s.id} className="rounded-xl border border-white/8 bg-white/3">
                    <div className="flex items-start gap-3 px-4 py-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700/50 text-xs font-bold text-zinc-400">
                        {userInitial(s)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-zinc-300">{userDisplayName(s)}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            STATUS_BADGES[s.status]?.cls ?? "bg-zinc-600/40 text-zinc-400"
                          }`}>{s.status}</span>
                          {s.rating && (
                            <span className="flex items-center gap-0.5 text-xs text-amber-400">
                              <Star size={10} className="fill-current" />{s.rating}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500">
                          {new Date(s.created_at).toLocaleDateString()} · {s.type} · {Math.round(s.minutes_used)} min
                          {(() => {
                            const rate = s.rate_per_min ?? earnings?.rate_per_min;
                            const earned = rate ? rate * (s.minutes_used ?? 0) * 0.80 : null;
                            return earned ? (
                              <span className="ml-1.5 font-medium text-emerald-400">
                                · {sym}{earned.toFixed(2)} earned
                              </span>
                            ) : null;
                          })()}
                        </p>
                        {s.review_text && (
                          <p className="mt-1 text-[11px] italic text-zinc-400">&ldquo;{s.review_text}&rdquo;</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          onClick={() => openNote(s.id)}
                          className="flex items-center gap-1 rounded-lg border border-violet-500/20 bg-violet-500/10 px-2 py-1 text-[10px] text-violet-400 hover:bg-violet-500/20 transition"
                          title="Private notes"
                        >
                          <FileText size={10} /> Notes
                        </button>
                        <button
                          onClick={() => blockUser(s.user_id)}
                          disabled={blockingUserId === s.user_id}
                          className="flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-400 hover:bg-rose-500/20 transition disabled:opacity-50"
                          title="Block this user"
                        >
                          {blockingUserId === s.user_id
                            ? <Loader2 size={10} className="animate-spin" />
                            : <><Ban size={10} /> Block</>
                          }
                        </button>
                      </div>
                    </div>
                    {/* Inline notes editor */}
                    {openNoteSessionId === s.id && (
                      <div className="border-t border-white/8 px-4 pb-3 pt-3 space-y-2">
                        <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                          <Shield size={9} className="text-violet-500" /> Private — only visible to you
                        </p>
                        <textarea
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          maxLength={2000}
                          rows={3}
                          placeholder="Add a private note about this session..."
                          className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-violet-500"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-zinc-600">{noteContent.length}/2000</span>
                          <div className="flex items-center gap-2">
                            {noteMsg && <span className="text-[10px] text-emerald-400">{noteMsg}</span>}
                            <button
                              onClick={() => saveNote(s.id)}
                              disabled={noteSaving}
                              className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition"
                            >
                              {noteSaving ? <Loader2 size={10} className="animate-spin" /> : null}
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <p className="flex items-center gap-1.5 pt-1 text-center text-[10px] text-zinc-600">
                  <TrendingUp size={11} />
                  {history.filter((s) => s.rating).length} reviewed · avg{" "}
                  {history.filter((s) => s.rating).length > 0
                    ? (history.filter((s) => s.rating).reduce((a, s) => a + (s.rating ?? 0), 0) /
                       history.filter((s) => s.rating).length).toFixed(1)
                    : "—"} ★
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

const VALID_TABS: Tab[] = ["browse", "sessions", "wallet", "dashboard"];

export default function ConnectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted]           = useState(false);
  const [activeTab, setActiveTab]       = useState<Tab>("browse");
  const [isConsultant, setIsConsultant] = useState(false);

  useEffect(() => {
    setMounted(true);
    const profile = getImotaraProfile();
    const age = profile?.user?.ageRange;
    if (age === "under_13" || age === "13_17") {
      router.replace("/connect/age-restricted");
      return;
    }
    const tabParam = searchParams.get("tab") as Tab | null;
    if (tabParam && VALID_TABS.includes(tabParam)) setActiveTab(tabParam);

    fetch("/api/connect/consultant/profile", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setIsConsultant(true); })
      .catch(() => {});
  }, [router, searchParams]);

  if (!mounted) return null;

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
