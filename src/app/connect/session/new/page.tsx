// src/app/connect/session/new/page.tsx
// Creates a new session and redirects to the chat page.
// Query params: consultant_id, type (instant | scheduled), scheduled_note?
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";

export default function NewSessionPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const consultantId = searchParams.get("consultant_id") ?? "";
  const type         = (searchParams.get("type") ?? "instant") as "instant" | "scheduled";

  const [note, setNote]   = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);

  // For instant sessions: auto-submit
  useEffect(() => {
    if (type === "instant" && consultantId && !started) {
      setStarted(true);
      createSession("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createSession(scheduledNote: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/connect/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultant_id:  consultantId,
          type,
          scheduled_note: scheduledNote || null,
        }),
        credentials: "include",
      });
      const data = await res.json();

      if (data.needs_recharge) {
        router.replace(`/connect?tab=wallet`);
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

  if (type === "instant") {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        {loading ? (
          <>
            <Loader2 className="animate-spin text-violet-400 mb-4" size={32} />
            <p className="text-zinc-400">Connecting you with a companion…</p>
          </>
        ) : error ? (
          <div className="imotara-glass-card max-w-sm rounded-2xl p-6">
            <AlertCircle className="mx-auto mb-3 text-rose-400" size={24} />
            <p className="text-sm text-zinc-300">{error}</p>
            <button
              onClick={() => router.back()}
              className="mt-4 rounded-xl border border-white/15 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition"
            >
              Go back
            </button>
          </div>
        ) : null}
      </main>
    );
  }

  // Scheduled — show note input
  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <div className="imotara-glass-card rounded-2xl p-6">
        <h1 className="mb-1 text-lg font-semibold text-zinc-50">Request a Meeting</h1>
        <p className="mb-5 text-sm text-zinc-400">
          Let the companion know your preferred time or any other details.
        </p>

        <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-zinc-500">
          Preferred time / note
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Weekday evenings IST, around 7–9 PM"
          rows={4}
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500 resize-none mb-4"
        />

        {error && (
          <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </p>
        )}

        <button
          onClick={() => createSession(note)}
          disabled={loading || !note.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          Send Request
        </button>
      </div>
    </main>
  );
}
