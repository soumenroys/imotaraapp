// src/app/connect/session/new/page.tsx
"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2, AlertCircle, MessageSquare, Mic, Video,
  Calendar, Clock, ChevronDown, ChevronUp, Wallet,
} from "lucide-react";
import RechargeModal from "@/components/connect/RechargeModal";

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";
const PLATFORM_FEE_PCT = 20;

const DURATION_OPTIONS = [
  { value: 15,  label: "15 min"  },
  { value: 30,  label: "30 min"  },
  { value: 45,  label: "45 min"  },
  { value: 60,  label: "1 hour"  },
  { value: 90,  label: "1.5 hrs" },
  { value: 120, label: "2 hours" },
];

const SESSION_MODES = [
  { key: "chat",  label: "Text Chat",  Icon: MessageSquare, available: true  },
  { key: "audio", label: "Audio Call", Icon: Mic,           available: false },
  { key: "video", label: "Video Call", Icon: Video,         available: false },
] as const;

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ", SGD: "S$", AUD: "A$",
};

// ── today's date as yyyy-mm-dd ──────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

// ── default time 1 hour from now, rounded to 30 min ────────────────────────
function defaultTime() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const h = d.getHours();
  const m = d.getMinutes() < 30 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
}

function NewSessionInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const consultantId    = searchParams.get("consultant_id") ?? "";
  const type            = (searchParams.get("type") ?? "instant") as "instant" | "scheduled";
  const ratePerMin      = parseFloat(searchParams.get("rate") ?? "0");
  const currency        = searchParams.get("currency") ?? "INR";
  const companionName   = searchParams.get("name") ?? "Companion";
  const prefillRecharge = searchParams.get("needs_recharge") === "true";
  const sym            = CURRENCY_SYMBOLS[currency] ?? currency;

  // ── form state ─────────────────────────────────────────────────────────────
  const [mode, setMode]         = useState<"chat" | "audio" | "video">("chat");
  const [date, setDate]         = useState(todayStr());
  const [time, setTime]         = useState(defaultTime());
  const [duration, setDuration] = useState(30);
  const [note, setNote]         = useState("");
  const [showAlt, setShowAlt]   = useState(false);
  const [altDate, setAltDate]   = useState("");
  const [altTime, setAltTime]   = useState("");

  // ── wallet / recharge ───────────────────────────────────────────────────────
  const [balanceMin, setBalanceMin]         = useState<number | null>(null);
  const [walletLoading, setWalletLoading]   = useState(true);
  const [showRecharge, setShowRecharge]     = useState(false);
  const [rechargedMinutes, setRechargedMinutes] = useState(0);

  // ── submit state ───────────────────────────────────────────────────────────
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);

  // ── cost calc ──────────────────────────────────────────────────────────────
  const sessionFee  = ratePerMin * duration;
  const platformFee = sessionFee * (PLATFORM_FEE_PCT / 100);
  const totalCost   = sessionFee + platformFee;
  const balanceAmt  = balanceMin !== null ? balanceMin * ratePerMin : null;
  const shortfall   = balanceAmt !== null ? Math.max(0, totalCost - balanceAmt) : null;
  const hasEnough   = shortfall !== null && shortfall === 0;

  // fetch per-consultant balance minutes
  useEffect(() => {
    if (!consultantId) return;
    fetch(`/api/connect/wallet?consultant_id=${consultantId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          const entry = (d.wallets ?? []).find((w: { consultant_id: string }) => w.consultant_id === consultantId);
          setBalanceMin(entry?.balance_minutes ?? 0);
        } else {
          setBalanceMin(0);
        }
      })
      .catch(() => setBalanceMin(0))
      .finally(() => setWalletLoading(false));
  }, [consultantId, rechargedMinutes]); // re-check after a recharge succeeds

  // ── instant session: auto-submit (or jump to recharge when prefilled) ──────
  useEffect(() => {
    if (type === "instant" && consultantId && !started) {
      if (prefillRecharge) {
        setShowRecharge(true);
      } else {
        setStarted(true);
        createSession("");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createSession(scheduledNote: string) {
    setLoading(true);
    setError("");
    try {
      const scheduledAt = type === "scheduled"
        ? new Date(`${date}T${time}`).toISOString()
        : null;

      const res = await fetch("/api/connect/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultant_id:          consultantId,
          type,
          scheduled_note:         scheduledNote || null,
          scheduled_at:           scheduledAt,
          scheduled_duration_min: type === "scheduled" ? duration : null,
          user_timezone:          Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
        credentials: "include",
      });
      const data = await res.json();

      if (data.needs_recharge) {
        // Show RechargeModal inline — don't redirect away
        setShowRecharge(true);
        setLoading(false);
        return;
      }
      if (data.redirect && data.existing_session_id) {
        router.replace(`/connect/session/${data.existing_session_id}`);
        return;
      }
      if (!data.ok) {
        setError(data.error ?? "Failed to create session");
        setLoading(false);
        return;
      }
      router.replace(`/connect/session/${data.session.id}`);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  // Called when RechargeModal completes successfully
  function handleRechargeSuccess(minutes: number) {
    setShowRecharge(false);
    setRechargedMinutes((prev) => prev + minutes); // triggers wallet re-fetch
    setStarted(false); // allow createSession to be called again
    createSession(""); // retry session creation immediately
  }

  function handleSubmit() {
    const dateLabel = new Date(`${date}T${time}`).toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const timeLabel = new Date(`${date}T${time}`).toLocaleTimeString("en-IN", {
      hour: "2-digit", minute: "2-digit",
    });
    const altLabel = (altDate && altTime)
      ? `\nAlt slot: ${new Date(`${altDate}T${altTime}`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} at ${new Date(`${altDate}T${altTime}`).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
      : "";
    const modeLabel = SESSION_MODES.find((m) => m.key === mode)?.label ?? mode;

    const structured = [
      `Mode: ${modeLabel}`,
      `Date: ${dateLabel}`,
      `Time: ${timeLabel}`,
      `Duration: ${duration} min`,
      altLabel,
      note.trim() ? `\nNote: ${note.trim()}` : "",
    ].filter(Boolean).join("\n");

    createSession(structured);
  }

  // ── Recharge modal (shared between instant + scheduled) ────────────────────
  const rechargeModal = showRecharge && consultantId ? (
    <RechargeModal
      consultant={{ id: consultantId, display_name: companionName, rate_per_min: ratePerMin, currency_code: currency }}
      razorpayKeyId={RAZORPAY_KEY_ID}
      onSuccess={handleRechargeSuccess}
      onClose={() => {
        setShowRecharge(false);
        if (type === "instant") router.back();
      }}
    />
  ) : null;

  // ── instant session UI ─────────────────────────────────────────────────────
  if (type === "instant") {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        {rechargeModal}
        {loading && !showRecharge ? (
          <>
            <Loader2 className="animate-spin text-violet-400 mb-4" size={32} />
            <p className="text-zinc-400">Connecting you with a companion…</p>
          </>
        ) : error ? (
          <div className="imotara-glass-card max-w-sm rounded-2xl p-6">
            <AlertCircle className="mx-auto mb-3 text-rose-400" size={24} />
            <p className="text-sm text-zinc-300">{error}</p>
            <button onClick={() => router.back()} className="mt-4 rounded-xl border border-white/15 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition">
              Go back
            </button>
          </div>
        ) : null}
      </main>
    );
  }

  // ── scheduled session UI ───────────────────────────────────────────────────
  return (
    <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      {rechargeModal}
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Connect</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-50">Request a Meeting</h1>
        {companionName && (
          <p className="mt-0.5 text-sm text-zinc-400">with <span className="text-zinc-200">{companionName}</span></p>
        )}
      </div>

      <div className="space-y-4">

        {/* ── Session Mode ────────────────────────────────────────────────── */}
        <div className="imotara-glass-card rounded-2xl p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Session Mode</p>
          <div className="grid grid-cols-3 gap-2">
            {SESSION_MODES.map(({ key, label, Icon, available }) => (
              <button
                key={key}
                type="button"
                disabled={!available}
                onClick={() => available && setMode(key)}
                className={`relative flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-medium transition
                  ${mode === key
                    ? "border-violet-500 bg-violet-500/15 text-violet-300"
                    : available
                      ? "border-white/10 text-zinc-400 hover:border-white/20"
                      : "border-white/5 text-zinc-600 cursor-not-allowed opacity-50"
                  }`}
              >
                <Icon size={16} />
                {label}
                {!available && (
                  <span className="absolute -top-1.5 right-1.5 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-500 border border-white/10">Soon</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Date & Time ─────────────────────────────────────────────────── */}
        <div className="imotara-glass-card rounded-2xl p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Preferred Date & Time</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs text-zinc-500">
                <Calendar size={11} /> Date
              </label>
              <input
                type="date"
                value={date}
                min={todayStr()}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-violet-500 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs text-zinc-500">
                <Clock size={11} /> Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-violet-500 [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Duration */}
          <p className="mb-2 mt-4 text-xs text-zinc-500">Duration</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDuration(opt.value)}
                className={`rounded-xl border py-2 text-xs font-medium transition
                  ${duration === opt.value
                    ? "border-violet-500 bg-violet-500/20 text-violet-300"
                    : "border-white/10 text-zinc-400 hover:border-white/20"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Alternative Slot ────────────────────────────────────────────── */}
        <div className="imotara-glass-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAlt((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-3.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition"
          >
            <span>+ Add alternative date/time (optional)</span>
            {showAlt ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showAlt && (
            <div className="grid grid-cols-2 gap-3 border-t border-white/8 px-5 pb-5 pt-3">
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs text-zinc-500"><Calendar size={11} /> Alt Date</label>
                <input type="date" value={altDate} min={todayStr()} onChange={(e) => setAltDate(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-violet-500 [color-scheme:dark]" />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs text-zinc-500"><Clock size={11} /> Alt Time</label>
                <input type="time" value={altTime} onChange={(e) => setAltTime(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-violet-500 [color-scheme:dark]" />
              </div>
            </div>
          )}
        </div>

        {/* ── Additional Note ──────────────────────────────────────────────── */}
        <div className="imotara-glass-card rounded-2xl p-5">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Additional Note (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything you'd like the companion to know in advance…"
            rows={3}
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500 resize-none"
          />
        </div>

        {/* ── Cost Breakdown ───────────────────────────────────────────────── */}
        {ratePerMin > 0 && (
          <div className="imotara-glass-card rounded-2xl p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Cost Estimate</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-zinc-400">
                <span>{sym}{ratePerMin}/min × {duration} min</span>
                <span>{sym}{sessionFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Platform fee ({PLATFORM_FEE_PCT}%)</span>
                <span>{sym}{platformFee.toFixed(2)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-white/10 pt-2 font-semibold text-zinc-100">
                <span>Total</span>
                <span className="text-violet-300">{sym}{totalCost.toFixed(2)}</span>
              </div>
            </div>

            {/* Balance check */}
            <div className="mt-4 rounded-xl border p-3">
              {walletLoading ? (
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 size={12} className="animate-spin" /> Checking balance…
                </div>
              ) : hasEnough ? (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <Wallet size={13} />
                  <span>You have sufficient balance for this session.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-xs text-amber-300">
                    <Wallet size={13} className="mt-0.5 shrink-0" />
                    <span>
                      You need <strong>{sym}{(shortfall ?? totalCost).toFixed(2)}</strong> more to book this session.
                      {balanceAmt !== null && balanceAmt > 0 && ` (Current balance: ${sym}${balanceAmt.toFixed(2)})`}
                    </span>
                  </div>
                  {/* Open RechargeModal inline instead of navigating away */}
                  <button
                    type="button"
                    onClick={() => setShowRecharge(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600/20 border border-violet-500/40 px-3 py-2 text-xs font-semibold text-violet-300 transition hover:bg-violet-600/30"
                  >
                    <Wallet size={12} /> Add Session Balance
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </p>
        )}

        {/* ── Submit ───────────────────────────────────────────────────────── */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border border-white/15 px-4 py-3 text-sm text-zinc-400 transition hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !date || !time}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            Send Request
          </button>
        </div>

      </div>
    </main>
  );
}

export default function NewSessionPage() {
  return (
    <Suspense>
      <NewSessionInner />
    </Suspense>
  );
}
