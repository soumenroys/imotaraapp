// src/app/connect/session/[id]/page.tsx
// Full-screen real-time text chat for a Connect session.
// Supabase Realtime subscription on connect_messages + connect_sessions.
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  ArrowLeft, Send, Phone, Loader2, AlertTriangle,
  Star, X, CheckCircle2, Globe,
} from "lucide-react";
import EmergencyModal from "@/components/connect/EmergencyModal";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Message {
  id: string;
  sender_id: string;
  content: string;
  translated_content: string | null;
  created_at: string;
}

interface SessionData {
  id: string;
  user_id: string;
  consultant_id: string;
  status: string;
  minutes_used: number;
  rating: number | null;
  review_submitted_at: string | null;
  started_at: string | null;
  amount_charged: number | null;
  currency_code: string;
  rate_per_min: number | null;
  user_timezone: string;
  consultant_timezone: string;
  translation_enabled: boolean;
  user_lang: string | null;
  consultant_lang: string | null;
  connect_consultants: {
    display_name: string;
    photo_url: string | null;
    gender: string | null;
    rate_per_min: number;
  } | null;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ", SGD: "S$", AUD: "A$",
};

function tzLabel(tz: string): string {
  try {
    const parts = Intl.DateTimeFormat("en", { timeZoneName: "short", timeZone: tz })
      .formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch { return tz; }
}

function formatClock(date: Date, tz: string): string {
  try {
    return date.toLocaleString("en-IN", {
      timeZone: tz,
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
  } catch { return date.toLocaleString(); }
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const DISCLAIMER = "Peer wellness support only — not a substitute for professional mental health care.";

const CHAT_LANGUAGES = [
  { code: "en", label: "English",    flag: "🇬🇧" },
  { code: "hi", label: "Hindi",      flag: "🇮🇳" },
  { code: "bn", label: "Bengali",    flag: "🇧🇩" },
  { code: "mr", label: "Marathi",    flag: "🇮🇳" },
  { code: "ta", label: "Tamil",      flag: "🇮🇳" },
  { code: "te", label: "Telugu",     flag: "🇮🇳" },
  { code: "gu", label: "Gujarati",   flag: "🇮🇳" },
  { code: "pa", label: "Punjabi",    flag: "🇮🇳" },
  { code: "kn", label: "Kannada",    flag: "🇮🇳" },
  { code: "ml", label: "Malayalam",  flag: "🇮🇳" },
  { code: "ur", label: "Urdu",       flag: "🇵🇰" },
  { code: "ar", label: "Arabic",     flag: "🇸🇦" },
  { code: "es", label: "Spanish",    flag: "🇪🇸" },
  { code: "fr", label: "French",     flag: "🇫🇷" },
  { code: "de", label: "German",     flag: "🇩🇪" },
  { code: "pt", label: "Portuguese", flag: "🇵🇹" },
] as const;
type LangCode = typeof CHAT_LANGUAGES[number]["code"];

export default function SessionChatPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const router = useRouter();

  const [session, setSession]       = useState<SessionData | null>(null);
  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState("");
  const [sending, setSending]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [myUserId, setMyUserId]     = useState<string | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [remaining, setRemaining]     = useState<number | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState<number | null>(null);
  const [showEmergency, setShowEmergency] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating]         = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewDone, setReviewDone] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [ending, setEnding]         = useState(false);
  const [endError, setEndError]     = useState<string | null>(null);
  const [sendError, setSendError]   = useState<string | null>(null);
  // Dual-panel state
  const [totalCreditedMin, setTotalCreditedMin] = useState<number | null>(null);
  const [elapsedSecs, setElapsedSecs]           = useState(0);
  const [now, setNow]                     = useState(() => new Date());
  const [panelOpen, setPanelOpen]         = useState(true);
  // Translation state
  const [chatLang, setChatLang]           = useState<LangCode | "">("");
  const [translations, setTranslations]   = useState<Map<string, string>>(new Map());
  const [translating, setTranslating]     = useState<Set<string>>(new Set());
  const [showLangPicker, setShowLangPicker] = useState(false);
  const langPickerRef                     = useRef<HTMLDivElement>(null);
  const chatLangRef                       = useRef<LangCode | "">("");
  const myUserIdRef                       = useRef<string | null>(null);
  const reviewAutoOpenedRef              = useRef(false);

  const bottomRef     = useRef<HTMLDivElement>(null);
  const tickRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        const uid = s?.user?.id ?? null;
        setMyUserId(uid);
        myUserIdRef.current = uid;
        setAuthLoaded(true);
      })
      .catch(() => {
        setMyUserId(null);
        myUserIdRef.current = null;
        setAuthLoaded(true);
      });
  }, []);

  // Redirect unauthenticated users to Connect
  useEffect(() => {
    if (authLoaded && !myUserId) router.replace("/connect");
  }, [authLoaded, myUserId, router]);

  // ── Close lang picker on outside click ────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langPickerRef.current && !langPickerRef.current.contains(e.target as Node)) {
        setShowLangPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Load session + messages ────────────────────────────────────────────────
  // Direct Supabase query so both the user AND the consultant can load the page
  // (RLS allows SELECT when auth.uid() = user_id OR user_id = consultant.user_id)
  const loadSession = useCallback(async () => {
    const { data: raw } = await supabase
      .from("connect_sessions")
      .select(
        "id, user_id, consultant_id, status, minutes_used, rating, review_submitted_at, " +
        "started_at, amount_charged, currency_code, rate_per_min, " +
        "user_timezone, consultant_timezone, " +
        "translation_enabled, user_lang, consultant_lang, " +
        "connect_consultants(display_name, photo_url, gender, rate_per_min)"
      )
      .eq("id", sessionId)
      .single();
    const s = raw as unknown as SessionData | null;
    if (s) {
      setSession(s);
      if (s.review_submitted_at) setReviewDone(true);
      // If the session is already active when the page loads (e.g., consultant accepted before
      // we got here), the tick useEffect may have already evaluated with session=null and skipped.
      // Explicitly start the tick now so billing continues without waiting for the next Realtime event.
      if (s.status === "active" && s.user_id === myUserIdRef.current) startTick();
    }
  }, [sessionId]);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from("connect_messages")
      .select("id, sender_id, content, translated_content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as Message[]);
  }, [sessionId]);

  // Gate initial load on auth: avoids a race where loadSession runs before the cookie
  // is applied and returns null for a valid participant, showing a false "not found" screen.
  useEffect(() => {
    if (!authLoaded) return;
    Promise.all([loadSession(), loadMessages()]).finally(() => setLoading(false));
  }, [authLoaded, loadSession, loadMessages]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`connect:session:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "connect_messages", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          // auto-translate incoming messages (skip own sent messages — no value in round-tripping)
          if (chatLangRef.current && msg.sender_id !== myUserIdRef.current) {
            const lang = chatLangRef.current;
            const key = `${msg.id}::${lang}`;
            fetch("/api/connect/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: msg.content, targetLang: lang }),
              credentials: "include",
            }).then((r) => r.json()).then((d) => {
              if (d.ok && d.translatedText && d.translatedText.trim() !== msg.content.trim()) {
                setTranslations((prev) => new Map(prev).set(key, d.translatedText));
              }
            }).catch(() => {});
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "connect_sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          const updated = payload.new as Partial<SessionData>;
          setSession((prev) => prev ? { ...prev, ...updated } : prev);
          // Consultant side: recompute remaining from server-authoritative minutes_used.
          // (User side: remaining is updated directly by tick responses.)
          if (updated.minutes_used !== undefined) {
            setTotalCreditedMin((tc) => {
              if (tc !== null) setRemaining(Math.max(0, tc - Number(updated.minutes_used)));
              return tc;
            });
          }
          if (updated.status === "completed" || updated.status === "declined" || updated.status === "cancelled") {
            // Call stopTick outside the setSession updater — side effects inside
            // React state setters are not safe in concurrent mode.
            setTimeout(stopTick, 0);
            // Zero out the countdown immediately — otherwise the remaining-time display
            // keeps ticking after the consultant ends the session via PATCH (which does
            // not return a tick response, so remaining/displaySeconds would stay stale).
            setRemaining(0);
            setDisplaySeconds(0);
            // Auto-open review prompt for the session user when session completes
            if (updated.status === "completed" && myUserIdRef.current) {
              setSession((s) => {
                // reviewAutoOpenedRef prevents duplicate Realtime UPDATE events (reconnect,
                // channel re-subscribe) from scheduling multiple setShowReview(true) timeouts.
                if (s && myUserIdRef.current === s.user_id && !s.review_submitted_at && !reviewAutoOpenedRef.current) {
                  reviewAutoOpenedRef.current = true;
                  setTimeout(() => setShowReview(true), 800);
                }
                return s;
              });
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── Session balance (remaining minutes + total credited) ───────────────────
  // Called by both user (on mount) and consultant (on mount).
  // User also gets remaining_minutes from tick responses; consultant infers from Realtime.
  useEffect(() => {
    if (!sessionId) return;
    // Reset remaining to null before the async fetch so that if this effect fires for a
    // new sessionId, leftover state from the previous session is cleared immediately.
    setRemaining(null);
    fetch(`/api/connect/sessions/${sessionId}/balance`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        setTotalCreditedMin(Number(d.total_credited_minutes ?? 0));
        setRemaining(Number(d.remaining_minutes ?? 0));
      })
      .catch(() => {});
  }, [sessionId]);

  // ── Live clock + elapsed counter (1 s tick) ────────────────────────────────
  useEffect(() => {
    clockRef.current = setInterval(() => {
      const tick = new Date();
      setNow(tick);
      setElapsedSecs((prev) => {
        const startedAt = session?.started_at;
        if (!startedAt || session?.status !== "active") return prev;
        return Math.max(0, Math.floor((tick.getTime() - new Date(startedAt).getTime()) / 1000));
      });
    }, 1000);
    return () => { if (clockRef.current) { clearInterval(clockRef.current); clockRef.current = null; } };
  }, [session?.started_at, session?.status]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Per-second visual countdown synced to API tick ────────────────────────
  useEffect(() => {
    if (remaining === null) { setDisplaySeconds(null); return; }
    const secs = Math.round(remaining * 60);
    setDisplaySeconds(secs);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setDisplaySeconds((prev) => (prev === null || prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return () => {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    };
  }, [remaining]);

  // ── 60-second billing tick ─────────────────────────────────────────────────
  function startTick() {
    if (tickRef.current) return;
    tickRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/connect/sessions/${sessionId}/tick`, {
          method: "POST",
          credentials: "include",
        });
        const d = await res.json();
        if (d.ok) {
          setRemaining(Math.max(0, d.remaining_minutes));
          if (d.status === "completed") { stopTick(); setSession((p) => p ? { ...p, status: "completed" } : p); }
        }
      } catch {
        // network hiccup — keep ticking
      }
    }, 60_000);
  }

  function stopTick() {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }

  useEffect(() => {
    const isSessionMine = myUserId !== null && session?.user_id === myUserId;
    if (session?.status === "active" && isSessionMine) startTick();
    else stopTick();
    return stopTick;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status, session?.user_id, myUserId]);

  // ── Send message ───────────────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.trim();
    if (!text || sending || !myUserId) return;
    setSending(true);
    setInput("");
    try {
      setSendError(null);
      if (session?.translation_enabled) {
        // Route through API for server-side translation
        const res = await fetch(`/api/connect/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content: text }),
        });
        const d = await res.json().catch(() => null);
        if (!res.ok || !d?.ok) {
          setInput(text);
          setSendError(d?.error ?? "Failed to send — please try again.");
        }
      } else {
        const { error } = await supabase.from("connect_messages").insert({
          session_id: sessionId,
          sender_id:  myUserId,
          content:    text,
        });
        if (error) {
          setInput(text);
          setSendError("Failed to send — please try again.");
        }
      }
    } catch {
      setInput(text);
      setSendError("Network error — please try again.");
    } finally {
      setSending(false);
    }
  }

  // ── Submit review ──────────────────────────────────────────────────────────
  async function submitReview() {
    if (rating === 0 || submittingReview || reviewDone) return;
    setSubmittingReview(true);
    setReviewError(null);
    try {
      const res = await fetch(`/api/connect/sessions/${sessionId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, review_text: reviewText || null }),
        credentials: "include",
      });
      const d = await res.json();
      if (d.ok) {
        setReviewDone(true);
        setShowReview(false);
        setSession((s) => s ? { ...s, rating, review_text: reviewText || null, review_submitted_at: new Date().toISOString() } : s);
      }
      else setReviewError(d.error ?? "Could not submit review. Please try again.");
    } catch {
      setReviewError("Network error — please try again.");
    } finally {
      setSubmittingReview(false);
    }
  }

  // ── Update session status ──────────────────────────────────────────────────
  async function updateStatus(action: "complete" | "cancel" | "userEnd") {
    if (ending) return;
    setEnding(true);
    setEndError(null);
    try {
      const res = await fetch(`/api/connect/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        credentials: "include",
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.ok) {
        setEndError(d?.error ?? "Could not end session. Please try again.");
      } else if (action === "complete" || action === "userEnd") {
        stopTick();
        setSession((prev) => prev ? { ...prev, status: "completed" } : prev);
      }
    } catch {
      setEndError("Network error — please try again.");
    } finally {
      setEnding(false);
    }
  }

  // ── Translation ────────────────────────────────────────────────────────────
  async function translateMessage(msgId: string, text: string, lang: LangCode) {
    const key = `${msgId}::${lang}`;
    if (translations.has(key) || translating.has(msgId)) return;
    setTranslating((prev) => { const s = new Set(prev); s.add(msgId); return s; });
    try {
      const res = await fetch("/api/connect/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLang: lang }),
        credentials: "include",
      });
      const d = await res.json();
      if (d.ok && d.translatedText && d.translatedText.trim() !== text.trim()) {
        setTranslations((prev) => new Map(prev).set(key, d.translatedText));
      }
    } catch { /* silent */ }
    finally {
      setTranslating((prev) => { const s = new Set(prev); s.delete(msgId); return s; });
    }
  }

  function translateAll(lang: LangCode, msgs: Message[]) {
    msgs.forEach((m) => {
      if (!translations.has(`${m.id}::${lang}`)) {
        translateMessage(m.id, m.content, lang);
      }
    });
  }

  function handleLangChange(lang: LangCode | "") {
    chatLangRef.current = lang;
    setChatLang(lang);
    setShowLangPicker(false);
    if (lang) translateAll(lang, messages);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading || !authLoaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-violet-400" size={28} />
      </div>
    );
  }

  // authLoaded && !myUserId → redirect effect will fire; render nothing in the meantime
  if (!myUserId) return null;

  if (!session) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-zinc-400">Session not found.</p>
        <button onClick={() => router.push("/connect")} className="text-sm text-violet-400 hover:underline">
          Back to Connect
        </button>
      </div>
    );
  }

  const consultant   = session.connect_consultants;
  const isActive     = session.status === "active";
  const isCompleted  = session.status === "completed";
  const isPending    = session.status === "pending";
  const isMine           = session.user_id === myUserId;
  const isConsultantView = !isMine && myUserId !== null;
  const isLowBalance     = displaySeconds !== null && displaySeconds <= 120 && isActive;

  const sym          = CURRENCY_SYMBOLS[session.currency_code ?? "INR"] ?? "₹";
  const rate         = Number(session.rate_per_min ?? consultant?.rate_per_min ?? 0);
  // Use server-authoritative amount_charged (updated via Realtime on every tick).
  const consumed     = Number(session.amount_charged ?? 0);
  // Remaining balance in currency = remaining minutes × rate (server-authoritative remaining).
  const sessionBalance = remaining !== null ? remaining * rate : null;

  // Which timezone label to show as "You" vs "Companion"
  const userTz       = session.user_timezone || "Asia/Kolkata";
  const consultantTz = session.consultant_timezone || "Asia/Kolkata";
  const myTz         = isMine ? userTz : consultantTz;
  const theirTz      = isMine ? consultantTz : userTz;
  const theirLabel   = isMine ? (consultant?.display_name ?? "Companion") : "User";

  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/8 bg-zinc-900/80 px-4 py-3 backdrop-blur-md">
        <button
          onClick={() => router.push("/connect")}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 transition"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-violet-500/20 flex items-center justify-center">
          {consultant?.photo_url
            ? <img src={consultant.photo_url} className="h-full w-full object-cover" alt="" />
            : (consultant?.gender === "female" ? "👩" : "👨")}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-100">
            {consultant?.display_name ?? "Companion"}
          </p>
          <p className={`text-xs ${isActive ? "text-emerald-400" : "text-zinc-500"}`}>
            {isActive ? "Session active" : isPending ? "Waiting for companion…" : session.status}
          </p>
        </div>

        {/* Compact timer pill + panel toggle */}
        {isActive && (
          <button
            onClick={() => setPanelOpen((v) => !v)}
            className={`shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-mono font-medium tabular-nums transition ${
              isLowBalance ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"
            }`}
            title={panelOpen ? "Collapse session panel" : "Expand session panel"}
          >
            {formatDuration(elapsedSecs)}
            <span className="opacity-60 text-[10px] font-sans">{panelOpen ? "▲" : "▼"}</span>
          </button>
        )}

        {/* Language picker — hidden when session-level translation is active */}
        {!session.translation_enabled && <div className="relative shrink-0" ref={langPickerRef}>
          <button
            onClick={() => setShowLangPicker((v) => !v)}
            className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
              chatLang ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "bg-white/5 text-zinc-400 hover:bg-white/10"
            }`}
            title="Translate messages"
          >
            <Globe size={13} />
            {chatLang
              ? <span className="font-semibold uppercase">{chatLang}</span>
              : <span className="hidden sm:inline">Translate</span>
            }
          </button>
          {showLangPicker && (
            <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Translate messages to
              </p>
              <button
                onClick={() => handleLangChange("")}
                className={`mb-2 w-full rounded-lg border px-3 py-1.5 text-xs text-left transition ${
                  !chatLang ? "border-zinc-500 bg-zinc-700 text-zinc-200" : "border-white/10 text-zinc-400 hover:bg-white/5"
                }`}
              >
                Off — show original only
              </button>
              <div className="grid grid-cols-2 gap-1.5">
                {CHAT_LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => handleLangChange(l.code)}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                      chatLang === l.code
                        ? "border-blue-500 bg-blue-500/20 text-blue-300 font-medium"
                        : "border-white/8 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                    }`}
                  >
                    <span>{l.flag}</span>
                    <span>{l.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>}

        {/* Emergency button */}
        <button
          onClick={() => setShowEmergency(true)}
          className="shrink-0 rounded-lg bg-rose-500/20 p-2 text-rose-400 transition hover:bg-rose-500/30"
          title="Emergency help"
        >
          <Phone size={14} />
        </button>
      </div>

      {/* ── Dual session panel ──────────────────────────────────────────────── */}
      {(isActive || isCompleted) && panelOpen && (
        <div className="shrink-0 border-b border-white/6 bg-zinc-950/70 backdrop-blur-sm px-3 py-2.5">
          {/* Metrics row */}
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            {/* Elapsed */}
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-2.5 py-2 text-center">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-amber-500/70 mb-0.5">Elapsed</p>
              <p className="text-sm font-mono font-bold text-amber-400 tabular-nums">{formatDuration(elapsedSecs)}</p>
            </div>
            {/* Remaining */}
            <div className={`rounded-xl border px-2.5 py-2 text-center ${
              isLowBalance ? "bg-rose-500/10 border-rose-500/20" : "bg-emerald-500/10 border-emerald-500/20"
            }`}>
              <p className={`text-[9px] font-semibold uppercase tracking-widest mb-0.5 ${isLowBalance ? "text-rose-400/70" : "text-emerald-500/70"}`}>
                Remaining
              </p>
              <p className={`text-sm font-mono font-bold tabular-nums ${isLowBalance ? "text-rose-400" : "text-emerald-400"}`}>
                {displaySeconds !== null ? formatDuration(displaySeconds) : "—"}
              </p>
            </div>
            {/* Consumed */}
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-2.5 py-2 text-center">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-rose-400/70 mb-0.5">Used</p>
              <p className="text-sm font-mono font-bold text-rose-400 tabular-nums">{sym}{consumed.toFixed(2)}</p>
            </div>
            {/* Session balance remaining */}
            <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 px-2.5 py-2 text-center">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-violet-400/70 mb-0.5">Balance</p>
              <p className="text-sm font-mono font-bold text-violet-400 tabular-nums">
                {sessionBalance !== null ? `${sym}${sessionBalance.toFixed(2)}` : "—"}
              </p>
            </div>
          </div>

          {/* Dual clock row */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex items-center gap-2 rounded-xl bg-white/4 border border-white/6 px-2.5 py-1.5">
              <span className="text-base leading-none">🙋</span>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">
                  You · {tzLabel(myTz)}
                </p>
                <p className="text-[11px] font-mono text-zinc-200 tabular-nums truncate">{formatClock(now, myTz)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white/4 border border-white/6 px-2.5 py-1.5">
              <span className="text-base leading-none">{isConsultantView ? "👤" : "🧑‍💼"}</span>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">
                  {theirLabel} · {tzLabel(theirTz)}
                </p>
                <p className="text-[11px] font-mono text-zinc-200 tabular-nums truncate">{formatClock(now, theirTz)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status banners */}
      {isPending && (
        <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-300 text-center">
          Waiting for the companion to accept your session request…
        </div>
      )}
      {isLowBalance && (
        <div className="shrink-0 border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-center text-xs font-medium text-rose-300">
          Less than 2 minutes remaining.{" "}
          <button
            onClick={() => router.push("/connect?tab=wallet")}
            className="underline hover:text-rose-200"
          >
            Top up wallet
          </button>
          {" "}to continue.
        </div>
      )}
      {isCompleted && (
        <div className="shrink-0 border-b border-zinc-700/50 bg-zinc-800/60 px-4 py-2.5 text-xs text-zinc-400 text-center">
          Session completed · {(session.minutes_used ?? 0).toFixed(0)} minutes
          {isMine && !reviewDone && (
            <button
              onClick={() => setShowReview(true)}
              className="ml-2 font-medium text-violet-400 hover:underline"
            >
              Leave a review
            </button>
          )}
          {reviewDone && (
            <span className="ml-2 text-emerald-400">
              ✓ Reviewed{session.rating ? ` · ${session.rating}/5` : ""}
            </span>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="shrink-0 bg-zinc-900/60 px-4 py-1.5 text-center text-[10px] text-zinc-600">
        {DISCLAIMER}
      </div>

      {/* Translation active banner */}
      {session.translation_enabled && (
        <div className="shrink-0 flex items-center justify-center gap-1.5 border-b border-blue-500/20 bg-blue-500/8 px-4 py-1.5 text-[10px] text-blue-400">
          <Globe size={10} />
          Auto-translation active — 1–3s delay per message · Machine translation only
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !isPending && (
          <p className="py-8 text-center text-sm text-zinc-500">
            {isActive ? "Session is active. Say hello!" : "No messages yet."}
          </p>
        )}
        {messages.map((m) => {
          const isMe = m.sender_id === myUserId;

          // Session-level translation: dual-language display
          if (session.translation_enabled) {
            const primaryText   = isMe ? m.content : (m.translated_content ?? m.content);
            const secondaryText = isMe ? m.translated_content : m.content;
            return (
              <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  isMe ? "rounded-br-sm bg-violet-600 text-white" : "rounded-bl-sm bg-white/8 text-zinc-100"
                }`}>
                  <p>{primaryText}</p>
                  {secondaryText && secondaryText !== primaryText && (
                    <div className={`mt-2 pt-2 ${isMe ? "border-t border-violet-400/30" : "border-t border-white/10"}`}>
                      <p className={`text-[10px] mb-0.5 flex items-center gap-1 ${isMe ? "text-violet-200/50" : "text-zinc-600"}`}>
                        <Globe size={9} /> {isMe ? "Their language" : "Original"}
                      </p>
                      <p className={`text-[13px] leading-relaxed italic ${isMe ? "text-violet-100/80" : "text-zinc-400"}`}>
                        {secondaryText}
                      </p>
                    </div>
                  )}
                  <p className={`mt-1 text-[10px] ${isMe ? "text-violet-200" : "text-zinc-500"}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          }

          // Standard (manual) translation via globe picker
          const transKey = chatLang ? `${m.id}::${chatLang}` : null;
          const translatedText = transKey ? translations.get(transKey) : undefined;
          const isTranslating  = chatLang ? translating.has(m.id) : false;
          const langLabel      = chatLang ? CHAT_LANGUAGES.find((l) => l.code === chatLang) : null;
          return (
            <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                isMe
                  ? "rounded-br-sm bg-violet-600 text-white"
                  : "rounded-bl-sm bg-white/8 text-zinc-100"
              }`}>
                {m.content}

                {chatLang && (
                  <div className={`mt-2 pt-2 ${isMe ? "border-t border-violet-400/30" : "border-t border-white/10"}`}>
                    {isTranslating && !translatedText ? (
                      <p className={`text-[11px] flex items-center gap-1 ${isMe ? "text-violet-200/60" : "text-zinc-500"}`}>
                        <Loader2 size={10} className="animate-spin" />
                        Translating…
                      </p>
                    ) : translatedText ? (
                      <>
                        <p className={`text-[10px] mb-0.5 ${isMe ? "text-violet-200/50" : "text-zinc-600"}`}>
                          🌐 {langLabel?.flag} {langLabel?.label}
                        </p>
                        <p className={`text-[13px] leading-relaxed italic ${isMe ? "text-violet-100/90" : "text-zinc-300"}`}>
                          {translatedText}
                        </p>
                      </>
                    ) : (
                      <p className={`text-[10px] ${isMe ? "text-violet-200/40" : "text-zinc-600"}`}>
                        — same language
                      </p>
                    )}
                  </div>
                )}

                <p className={`mt-1 text-[10px] ${isMe ? "text-violet-200" : "text-zinc-500"}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {isActive && (
        <div className="shrink-0 border-t border-white/8 bg-zinc-900/80 backdrop-blur-md">
          {sendError && (
            <p className="px-4 pt-2 text-xs text-rose-400">{sendError}</p>
          )}
        <div className="flex gap-2 px-4 py-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Type a message…"
            maxLength={2000}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500"
          />
          <button
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        </div>
      )}

      {/* End / inactive state */}
      {!isActive && !isCompleted && !isPending && (
        <div className="shrink-0 border-t border-white/8 bg-zinc-900/80 px-4 py-3 text-center text-sm text-zinc-500">
          Session {session.status}.
          <button
            onClick={() => router.push(isConsultantView ? "/connect?tab=dashboard" : "/connect")}
            className="ml-2 text-violet-400 hover:underline"
          >
            {isConsultantView ? "Back to Dashboard" : "Back to Connect"}
          </button>
        </div>
      )}
      {isCompleted && isConsultantView && (
        <div className="shrink-0 border-t border-white/5 bg-zinc-900/60 px-4 pb-2 pt-1 text-center">
          <button
            onClick={() => router.push("/connect?tab=dashboard")}
            className="text-xs text-violet-400 hover:text-violet-300 transition"
          >
            ← Return to Dashboard
          </button>
        </div>
      )}
      {isCompleted && isMine && (
        <div className="shrink-0 border-t border-white/5 bg-zinc-900/60 px-4 pb-2 pt-1 text-center">
          <button
            onClick={() => router.push("/connect")}
            className="text-xs text-violet-400 hover:text-violet-300 transition"
          >
            ← Back to Connect
          </button>
        </div>
      )}
      {isActive && isConsultantView && (
        <div className="shrink-0 border-t border-white/5 bg-zinc-900/60 px-4 pb-2 pt-1 text-center">
          {endError && <p className="mb-1 text-xs text-red-400">{endError}</p>}
          <button
            onClick={() => updateStatus("complete")}
            disabled={ending}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition disabled:opacity-50"
          >
            {ending ? "Ending…" : "End session"}
          </button>
        </div>
      )}
      {isActive && isMine && (
        <div className="shrink-0 border-t border-white/5 bg-zinc-900/60 px-4 pb-2 pt-1 text-center">
          {endError && <p className="mb-1 text-xs text-red-400">{endError}</p>}
          <button
            onClick={() => updateStatus("userEnd")}
            disabled={ending}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition disabled:opacity-50"
          >
            {ending ? "Ending…" : "End session early"}
          </button>
        </div>
      )}

      {/* Emergency modal */}
      {showEmergency && <EmergencyModal onClose={() => setShowEmergency(false)} />}

      {/* Review modal */}
      {showReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="imotara-glass-card w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-lg font-semibold text-zinc-50">How was the session?</h2>
              <button onClick={() => setShowReview(false)} className="p-1.5 text-zinc-400 hover:text-zinc-200">
                <X size={16} />
              </button>
            </div>
            <div className="mb-4 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  className={`text-2xl transition ${n <= rating ? "scale-110" : "opacity-30"}`}
                >
                  ⭐
                </button>
              ))}
            </div>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Optional: share your experience (max 200 chars)"
              maxLength={200}
              rows={3}
              className="mb-4 w-full resize-none rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500"
            />
            {reviewError && <p className="text-xs text-red-400 text-center">{reviewError}</p>}
            <button
              onClick={submitReview}
              disabled={rating === 0 || submittingReview}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
            >
              {submittingReview ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {submittingReview ? "Submitting…" : "Submit Review"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
