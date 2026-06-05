// src/app/connect/session/[id]/page.tsx
// Full-screen real-time text chat for a Connect session.
// Supabase Realtime subscription on connect_messages + connect_sessions.
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  ArrowLeft, Send, Phone, Loader2, AlertTriangle,
  Star, X, CheckCircle2,
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
  connect_consultants: {
    display_name: string;
    photo_url: string | null;
    gender: string | null;
    rate_per_min: number;
  } | null;
}

const DISCLAIMER = "Peer wellness support only — not a substitute for professional mental health care.";

export default function SessionChatPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const router = useRouter();

  const [session, setSession]       = useState<SessionData | null>(null);
  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState("");
  const [sending, setSending]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [myUserId, setMyUserId]     = useState<string | null>(null);
  const [remaining, setRemaining]   = useState<number | null>(null);
  const [showEmergency, setShowEmergency] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating]         = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewDone, setReviewDone] = useState(false);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const tickRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setMyUserId(s?.user?.id ?? null);
    });
  }, []);

  // ── Load session + messages ────────────────────────────────────────────────
  const loadSession = useCallback(async () => {
    const res = await fetch(`/api/connect/sessions`, { credentials: "include" });
    const data = await res.json();
    const s = (data.sessions ?? []).find((x: SessionData) => x.id === sessionId);
    if (s) {
      setSession(s);
      if (s.review_submitted_at) setReviewDone(true);
    }
  }, [sessionId]);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from("connect_messages")
      .select("id, sender_id, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data);
  }, [sessionId]);

  useEffect(() => {
    Promise.all([loadSession(), loadMessages()]).finally(() => setLoading(false));
  }, [loadSession, loadMessages]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`connect:session:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "connect_messages", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          setMessages((prev) => {
            const msg = payload.new as Message;
            if (prev.find((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "connect_sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          const updated = payload.new as Partial<SessionData>;
          setSession((prev) => prev ? { ...prev, ...updated } : prev);
          if (updated.status === "active" && remaining === null) setRemaining(null);
          if (updated.status === "completed" || updated.status === "declined" || updated.status === "cancelled") {
            stopTick();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
          setRemaining(d.remaining_minutes);
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
    if (session?.status === "active") startTick();
    else stopTick();
    return stopTick;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status]);

  // ── Send message ───────────────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    try {
      const { error } = await supabase.from("connect_messages").insert({
        session_id: sessionId,
        sender_id:  myUserId,
        content:    text,
      });
      if (error) setInput(text); // restore on failure
    } catch {
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  // ── Submit review ──────────────────────────────────────────────────────────
  async function submitReview() {
    if (rating === 0) return;
    const res = await fetch(`/api/connect/sessions/${sessionId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, review_text: reviewText || null }),
      credentials: "include",
    });
    const d = await res.json();
    if (d.ok) { setReviewDone(true); setShowReview(false); }
  }

  // ── Update session status ──────────────────────────────────────────────────
  async function updateStatus(action: "complete" | "cancel") {
    await fetch(`/api/connect/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
      credentials: "include",
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-violet-400" size={28} />
      </div>
    );
  }

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

  const consultant  = session.connect_consultants;
  const isActive    = session.status === "active";
  const isCompleted = session.status === "completed";
  const isPending   = session.status === "pending";
  const isMine      = session.user_id === myUserId;

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

        {/* Timer */}
        {isActive && remaining !== null && (
          <div className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium ${
            remaining <= 1 ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"
          }`}>
            {remaining.toFixed(0)} min left
          </div>
        )}

        {/* Emergency button */}
        <button
          onClick={() => setShowEmergency(true)}
          className="shrink-0 rounded-lg bg-rose-500/20 p-2 text-rose-400 transition hover:bg-rose-500/30"
          title="Emergency help"
        >
          <Phone size={14} />
        </button>
      </div>

      {/* Status banners */}
      {isPending && (
        <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-300 text-center">
          Waiting for the companion to accept your session request…
        </div>
      )}
      {isCompleted && (
        <div className="shrink-0 border-b border-zinc-700/50 bg-zinc-800/60 px-4 py-2.5 text-xs text-zinc-400 text-center">
          Session completed · {session.minutes_used.toFixed(0)} minutes
          {!reviewDone && (
            <button
              onClick={() => setShowReview(true)}
              className="ml-2 font-medium text-violet-400 hover:underline"
            >
              Leave a review
            </button>
          )}
          {reviewDone && <span className="ml-2 text-emerald-400">✓ Reviewed</span>}
        </div>
      )}

      {/* Disclaimer */}
      <div className="shrink-0 bg-zinc-900/60 px-4 py-1.5 text-center text-[10px] text-zinc-600">
        {DISCLAIMER}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !isPending && (
          <p className="py-8 text-center text-sm text-zinc-500">
            {isActive ? "Session is active. Say hello!" : "No messages yet."}
          </p>
        )}
        {messages.map((m) => {
          const isMe = m.sender_id === myUserId;
          return (
            <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                isMe
                  ? "rounded-br-sm bg-violet-600 text-white"
                  : "rounded-bl-sm bg-white/8 text-zinc-100"
              }`}>
                {m.content}
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
        <div className="shrink-0 flex gap-2 border-t border-white/8 bg-zinc-900/80 px-4 py-3 backdrop-blur-md">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Type a message…"
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
      )}

      {/* End / inactive state */}
      {!isActive && !isCompleted && !isPending && (
        <div className="shrink-0 border-t border-white/8 bg-zinc-900/80 px-4 py-3 text-center text-sm text-zinc-500">
          Session {session.status}.
          <button onClick={() => router.push("/connect")} className="ml-2 text-violet-400 hover:underline">
            Back to Connect
          </button>
        </div>
      )}
      {isActive && isMine && (
        <div className="shrink-0 border-t border-white/5 bg-zinc-900/60 px-4 pb-2 pt-1 text-center">
          <button
            onClick={() => updateStatus("complete")}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition"
          >
            End session
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
            <button
              onClick={submitReview}
              disabled={rating === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
            >
              <CheckCircle2 size={15} />
              Submit Review
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
