"use client";

// src/app/unsubscribe/UnsubscribeClient.tsx
// The page a person lands on from the footer link in a broadcast (BC-27).

import Link from "next/link";
import { useState } from "react";

export default function UnsubscribeClient({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">(token ? "idle" : "error");

  async function go() {
    setState("busy");
    try {
      const res = await fetch(`/api/unsubscribe?t=${encodeURIComponent(token)}`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      setState(j.ok ? "done" : "error");
    } catch { setState("error"); }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/8 p-6 text-center">
        <p className="text-2xl">✓</p>
        <h2 className="mt-2 text-base font-semibold text-zinc-100">You are unsubscribed.</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
          That took effect immediately, including anything already queued to go
          out. You will still receive essential messages about your account —
          a password reset, or a change to the terms — because those are not
          promotional and cannot be opted out of.
        </p>
        <Link href="/" className="mt-4 inline-block text-xs text-indigo-400 hover:underline">Back to Imotara</Link>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-2xl border border-amber-400/25 bg-amber-500/8 p-6 text-center">
        <h2 className="text-base font-semibold text-zinc-100">This link did not work</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
          It may have been broken across two lines by your email program. Try
          clicking it again from the message, or write to{" "}
          <a href="mailto:suchismita.sen@imotara.com" className="text-indigo-400 hover:underline">
            suchismita.sen@imotara.com
          </a>{" "}
          and we will remove you by hand. We will not ask you why.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
      <p className="text-2xl">✉️</p>
      <h2 className="mt-2 text-base font-semibold text-zinc-100">Stop receiving these emails?</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
        One press and we stop. No questions, no survey, and nothing to log in to.
      </p>
      <button
        onClick={() => void go()}
        disabled={state === "busy"}
        className="mt-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {state === "busy" ? "One moment…" : "Yes, unsubscribe me"}
      </button>
      <p className="mt-3 text-[11px] text-zinc-600">
        Changed your mind? Just close this page — nothing has happened yet.
      </p>
    </div>
  );
}
