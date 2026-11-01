"use client";

// /admin/social/comments — comments under our posts, and the replies waiting for approval.
//
// 🔑 #51 (owner, 31 Oct + 1 Nov 2026): spam is hidden and crisis words get the
// crisis line by themselves; a genuine comment gets a DRAFT that waits here.
// ⛔ Nothing on this page sends without the owner pressing Send.

import { useCallback, useEffect, useState } from "react";
import { SignedOut } from "@/app/admin/social/_components/SignedOut";
import { SocialPage, Chip, Explain } from "@/app/admin/social/_components/ui";

type Row = {
  id: string;
  platform: string;
  post_snippet: string | null;
  author: string | null;
  text: string;
  commented_at: string | null;
  kind: string;
  status: string;
  draft: string | null;
  note: string | null;
  decided_by: string | null;
  updated_at: string;
};

const DONE: Record<string, { label: string; tone: "zinc" | "green" | "amber" | "rose" }> = {
  hidden: { label: "Spam — hidden", tone: "zinc" },
  skipped: { label: "Left alone", tone: "zinc" },
  crisis_replied: { label: "Crisis line sent", tone: "rose" },
  sent: { label: "Replied", tone: "green" },
  rejected: { label: "Rejected", tone: "zinc" },
  failed: { label: "Failed", tone: "amber" },
};

const when = (s: string | null) => (s ? new Date(s).toLocaleString() : "");

export default function Comments() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [waiting, setWaiting] = useState<Row[]>([]);
  const [handled, setHandled] = useState<Row[]>([]);
  const [role, setRole] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/social/comments", { credentials: "same-origin" });
    if (res.status === 401) return setAuthed(false);
    setAuthed(true);
    const json = await res.json();
    if (!res.ok) return setMessage(json.error ?? "Could not load the comments.");
    setWaiting(json.waiting ?? []);
    setHandled(json.handled ?? []);
    setRole(json.actorRole ?? "");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, action: "approve" | "reject") {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/social/comments/${id}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, text: edits[id] }),
      });
      const json = await res.json();
      setMessage(res.ok ? json.note : json.error);
      if (res.ok) await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <SocialPage here="/admin/social/comments" title="Comments" lede="What people wrote under our posts. Spam is hidden by itself; a reply to anyone else waits here for you.">
      {authed === null && <p className="text-sm text-zinc-500">Checking the admin session…</p>}
      {authed === false && <SignedOut />}
      {authed === true && (
        <>
          <Explain q="What happens to a comment by itself?">
            Every 15 minutes: a repost scam (“send me this post in DM”) is hidden — not deleted, and it can be un-hidden on the post. Crisis words get
            the crisis line at once (local emergency number and findahelpline.com) and an email to social@. Our team’s comments are left alone.
            Everyone else gets a drafted reply below — nothing is sent until you press Send. “Stop everything” on Channels stops this too.
          </Explain>

          {message && <div className="rounded-xl border border-indigo-900 bg-indigo-950/30 p-4 text-sm text-indigo-200">{message}</div>}

          <h2 className="text-lg font-semibold">Waiting for you ({waiting.length})</h2>
          {waiting.length === 0 && <p className="text-sm text-zinc-500">No reply is waiting.</p>}
          <ul className="space-y-3">
            {waiting.map((r) => (
              <li key={r.id} className="space-y-2 rounded-xl border border-white/8 bg-white/5 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                  <Chip>{r.platform}</Chip>
                  <span>{r.author ?? "(name hidden by Facebook)"}</span>
                  <span>· {when(r.commented_at)}</span>
                  <span className="truncate">· on “{r.post_snippet}”</span>
                </div>
                <p className="text-sm">“{r.text}”</p>
                {r.note && <p className="text-xs text-amber-300">{r.note}</p>}
                <textarea
                  className="w-full rounded-lg border border-white/15 bg-black/30 p-2 text-sm"
                  rows={3}
                  maxLength={280}
                  value={edits[r.id] ?? r.draft ?? ""}
                  onChange={(e) => setEdits((m) => ({ ...m, [r.id]: e.target.value }))}
                />
                {role === "owner" ? (
                  <div className="flex gap-2">
                    <button type="button" disabled={busy === r.id} onClick={() => decide(r.id, "approve")} className="min-h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50">
                      Send this reply
                    </button>
                    <button type="button" disabled={busy === r.id} onClick={() => decide(r.id, "reject")} className="min-h-11 rounded-lg border border-white/15 px-4 text-sm hover:bg-white/10 disabled:opacity-50">
                      Don’t reply
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">Only the owner can send a reply.</p>
                )}
              </li>
            ))}
          </ul>

          <h2 className="pt-4 text-lg font-semibold">Handled</h2>
          {handled.length === 0 && <p className="text-sm text-zinc-500">Nothing yet.</p>}
          <ul className="space-y-2">
            {handled.map((r) => (
              <li key={r.id} className="rounded-xl border border-white/8 bg-white/5 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                  <Chip tone={DONE[r.status]?.tone}>{DONE[r.status]?.label ?? r.status}</Chip>
                  <Chip>{r.platform}</Chip>
                  <span>{r.author ?? "(name hidden)"}</span>
                  <span>· {when(r.updated_at)}</span>
                </div>
                <p className="mt-1 text-zinc-300">“{r.text}”</p>
                {r.draft && (r.status === "sent" || r.status === "crisis_replied") && <p className="mt-1 text-zinc-400">↳ {r.draft}</p>}
                {r.note && <p className="mt-1 text-xs text-amber-300">{r.note}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </SocialPage>
  );
}
