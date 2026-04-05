"use client";

import { useEffect, useState, useTransition } from "react";

interface Comment {
  id: string;
  name: string;
  message: string;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function BlogComments({ slug }: { slug: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetch(`/api/blog/comments?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => setComments(d.comments ?? []))
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [slug]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/blog/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, name: name.trim(), message: message.trim() }),
        });

        if (res.ok) {
          setStatus("success");
          setName("");
          setMessage("");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    });
  }

  return (
    <section className="space-y-6">
      {/* Heading */}
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Comments &amp; Thoughts
      </h2>

      {/* Existing comments */}
      {loading ? (
        <p className="text-xs text-zinc-600">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-zinc-600">
          No comments yet — be the first to share your thoughts.
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div
              key={c.id}
              className="imotara-glass-soft rounded-xl px-4 py-3 backdrop-blur-md"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-200">{c.name}</span>
                <span className="text-[10px] text-zinc-600">{timeAgo(c.created_at)}</span>
              </div>
              <p className="mt-1 text-xs leading-6 text-zinc-400">{c.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Submission notice */}
      {status === "success" && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
          Thanks for sharing! Your comment is under review and will appear shortly.
        </div>
      )}
      {status === "error" && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
          Something went wrong — please try again.
        </div>
      )}

      {/* Form */}
      {status !== "success" && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Leave a comment
          </p>

          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none ring-0 transition focus:border-white/20 focus:bg-white/8"
          />

          <textarea
            placeholder="Share your thoughts or suggestions…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            rows={4}
            required
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none ring-0 transition focus:border-white/20 focus:bg-white/8"
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] text-zinc-600">
              Comments are reviewed before appearing publicly.
            </p>
            <button
              type="submit"
              disabled={isPending || !name.trim() || !message.trim()}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              {isPending ? "Sending…" : "Post comment"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
