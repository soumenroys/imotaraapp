"use client";

import { useState, useEffect, useCallback, useTransition } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Comment {
  id: string;
  slug: string;
  name: string;
  message: string;
  approved: boolean;
  created_at: string;
}

type Tab = "pending" | "approved" | "all";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SESSION_KEY = "imotara_admin_token";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 30 ? `${days}d ago` :
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Login gate ────────────────────────────────────────────────────────────────

function LoginGate({ onAuth }: { onAuth: (token: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
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
        setError("Incorrect secret key. Check your ADMIN_SECRET env var.");
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-white/10 bg-white/5 px-6 py-8 backdrop-blur-xl">
        <div className="text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 text-lg font-bold text-white shadow-lg mx-auto">
            I
          </span>
          <h1 className="mt-3 text-base font-semibold text-zinc-100">Imotara Admin</h1>
          <p className="mt-1 text-xs text-zinc-500">Blog comment moderation</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            placeholder="Enter admin secret key"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(""); }}
            autoFocus
            required
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition focus:border-indigo-500/40 focus:bg-white/8"
          />
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
          Set <code className="text-zinc-400">ADMIN_SECRET</code> in your <code className="text-zinc-400">.env.local</code> file.
        </p>
      </div>
    </div>
  );
}

// ── Comment card ──────────────────────────────────────────────────────────────

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
  const [deleting, setDeleting] = useState(false);

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
      comment.approved
        ? "border-emerald-500/20 bg-emerald-500/5"
        : "border-white/10 bg-white/5"
    }`}>
      {/* Header */}
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
            <a
              href={`/blog/${comment.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-indigo-400 hover:text-indigo-300 transition"
            >
              /blog/{comment.slug}
            </a>
            <span className="text-[10px] text-zinc-600">{timeAgo(comment.created_at)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {!comment.approved && (
            <button
              onClick={approve}
              disabled={approving}
              className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden>
                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0Z" />
              </svg>
              {approving ? "Approving…" : "Approve"}
            </button>
          )}
          <button
            onClick={remove}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden>
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6Z" />
              <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1ZM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118ZM2.5 3h11V2h-11v1Z" />
            </svg>
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {/* Message */}
      <p className="mt-3 text-sm leading-6 text-zinc-300">{comment.message}</p>
    </div>
  );
}

// ── Main admin page ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("pending");
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, all: 0 });

  // Restore session
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) setToken(saved);
  }, []);

  const fetchComments = useCallback(
    async (status: Tab, tok: string) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/comments?status=${status}`, {
          headers: { Authorization: `Bearer ${tok}` },
        });
        if (res.status === 401) { setToken(null); sessionStorage.removeItem(SESSION_KEY); return; }
        const data = await res.json();
        setComments(data.comments ?? []);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const fetchCounts = useCallback(async (tok: string) => {
    const [pRes, aRes] = await Promise.all([
      fetch("/api/admin/comments?status=pending", { headers: { Authorization: `Bearer ${tok}` } }),
      fetch("/api/admin/comments?status=approved", { headers: { Authorization: `Bearer ${tok}` } }),
    ]);
    const [pData, aData] = await Promise.all([pRes.json(), aRes.json()]);
    const p = (pData.comments ?? []).length;
    const a = (aData.comments ?? []).length;
    setCounts({ pending: p, approved: a, all: p + a });
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchComments(tab, token);
    fetchCounts(token);
  }, [token, tab, fetchComments, fetchCounts]);

  if (!token) {
    return <LoginGate onAuth={(t) => setToken(t)} />;
  }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "pending",  label: "Pending Review", count: counts.pending },
    { key: "approved", label: "Approved",        count: counts.approved },
    { key: "all",      label: "All",             count: counts.all },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Imotara · Admin
          </p>
          <h1 className="mt-1 text-xl font-semibold text-zinc-100">
            Blog Comment Moderation
          </h1>
        </div>
        <button
          onClick={() => { sessionStorage.removeItem(SESSION_KEY); setToken(null); }}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
        >
          Sign out
        </button>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: "Pending", value: counts.pending, color: "text-amber-400" },
          { label: "Approved", value: counts.approved, color: "text-emerald-400" },
          { label: "Total", value: counts.all, color: "text-indigo-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-center backdrop-blur-md">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-zinc-600">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-white/8 bg-white/5 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs transition ${
              tab === t.key
                ? "bg-white/10 font-medium text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                tab === t.key ? "bg-indigo-500/30 text-indigo-300" : "bg-white/8 text-zinc-500"
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Comment list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-5 py-12 text-center">
          <p className="text-2xl">
            {tab === "pending" ? "✅" : tab === "approved" ? "💬" : "📭"}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            {tab === "pending"
              ? "No comments pending review."
              : tab === "approved"
              ? "No approved comments yet."
              : "No comments yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              token={token}
              onApproved={(id) => {
                setComments((prev) => prev.map((x) => x.id === id ? { ...x, approved: true } : x));
                setCounts((prev) => ({ ...prev, pending: prev.pending - 1, approved: prev.approved + 1 }));
                if (tab === "pending") setComments((prev) => prev.filter((x) => x.id !== id));
              }}
              onDeleted={(id) => {
                setComments((prev) => prev.filter((x) => x.id !== id));
                setCounts((prev) => {
                  const wasApproved = comments.find((x) => x.id === id)?.approved ?? false;
                  return {
                    ...prev,
                    pending: wasApproved ? prev.pending : prev.pending - 1,
                    approved: wasApproved ? prev.approved - 1 : prev.approved,
                    all: prev.all - 1,
                  };
                });
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}
