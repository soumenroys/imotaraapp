"use client";

// /admin/social — what needs you today.
//
// 🔴 THE FIRST VERSION OPENED WITH FOUR COUNTERS AND A BANNER, then schedules,
// then the queue. So the one thing a person came to do — read a draft and say
// yes — was below two sections they had already read yesterday.
//
// ⇒ Drafts first, and if there are none it says so in one line instead of
// showing four zeros. The counters moved below, where a number is a thing you
// glance at rather than the first thing you are handed.

import { useCallback, useEffect, useState } from "react";
import { SignedOut } from "@/app/admin/social/_components/SignedOut";
import { SocialPage, Chip, Explain, HowItWorks, POST_STATUS } from "@/app/admin/social/_components/ui";

type Finding = { list: string; rule: string; matched: string; because: string };
type GateResult = {
  listsRun?: string[];
  listsUnavailable?: string[];
  findings?: Finding[];
  houseStyle?: string[];
  notes?: string[];
  rejectedDrafts?: { attempt: number; subject: string; body: string; why: string }[];
};
type Post = {
  id: string;
  origin: "generated" | "written";
  schedule_id: string | null;
  platform: string;
  language: string;
  scheduled_for: string | null;
  status: string;
  subject: string;
  body: string;
  media_kind: string;
  visual_recipe: Record<string, unknown> | null;
  gate_result: GateResult | null;
  created_at: string;
};

const LIST_LABEL: Record<string, string> = {
  clinical: "Clinical claims",
  abuse: "Abuse",
  careless: "Careless language",
};

const VIEWS = [
  { key: "queue", label: "Waiting for you" },
  { key: "approved", label: "Ready to go" },
  { key: "published", label: "Posted" },
  { key: "trouble", label: "Problems" },
  { key: "all", label: "Everything" },
] as const;

export default function Today() {
  const [view, setView] = useState<string>("queue");
  const [posts, setPosts] = useState<Post[]>([]);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [scheduleNames, setScheduleNames] = useState<Record<string, string>>({});
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState<string>("");
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/social/posts?view=${view}`, { credentials: "same-origin" });
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    const json = await res.json();
    setPosts(json.posts ?? []);
    setByStatus(json.byStatus ?? {});
    setScheduleNames(json.scheduleNames ?? {});
  }, [view]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: string, payload?: Record<string, unknown>) {
    setBusy(id);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/social/posts/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const json = await res.json();
      setMessage(res.ok ? json.note ?? "Done." : json.error ?? "That did not work.");
      if (res.ok) {
        setDraft(null);
        setOpen("");
        await load();
      }
    } finally {
      setBusy("");
    }
  }

  const waiting = byStatus.needs_review ?? 0;

  return (
    <SocialPage
      here="/admin/social"
      title="Social posting"
      lede="Posts are written for you. Nothing goes out until you have read it."
      waiting={waiting}
      actions={
        <a
          href="/admin/social/compose"
          className="flex min-h-11 items-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold hover:bg-indigo-500"
        >
          Write a post
        </a>
      }
    >
      {authed === null && <p className="text-sm text-zinc-500">Checking the admin session…</p>}
      {authed === false && <SignedOut />}

      {authed === true && (
        <>
          {message && (
            <div className="rounded-xl border border-indigo-900 bg-indigo-950/30 p-4 text-sm text-indigo-200">
              {message}
            </div>
          )}

          {/* 🔑 The first thing on the page is the answer to "is there anything
              for me?" — not a dashboard. */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            {waiting > 0 ? (
              <p className="text-sm">
                <strong className="text-base">
                  {waiting} draft{waiting === 1 ? "" : "s"} waiting for you.
                </strong>{" "}
                <span className="text-zinc-400">Read each one, then approve it or change the words.</span>
              </p>
            ) : (
              <p className="text-sm text-zinc-400">
                <strong className="text-zinc-200">Nothing is waiting for you.</strong> New drafts appear
                here two hours before a schedule&rsquo;s time.
              </p>
            )}
          </section>

          <div className="flex flex-wrap gap-2">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                className={`min-h-11 rounded-lg border px-3 text-sm ${
                  view === v.key
                    ? "border-indigo-600 bg-indigo-950/40 text-indigo-200"
                    : "border-zinc-800 text-zinc-400 hover:bg-zinc-900"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {posts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
              Nothing here.
            </p>
          ) : (
            <ul className="space-y-3">
              {posts.map((post) => {
                const gate = post.gate_result ?? {};
                const isOpen = open === post.id;
                const status = POST_STATUS[post.status] ?? { label: post.status, tone: "zinc" as const, means: "" };
                return (
                  <li key={post.id} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(isOpen ? "" : post.id);
                        setDraft(null);
                      }}
                      className="flex w-full flex-wrap items-center gap-3 p-4 text-left hover:bg-zinc-900/70"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip tone={status.tone} title={status.means}>{status.label}</Chip>
                          <span className="text-xs text-zinc-500">
                            {post.platform} · {post.language}
                            {post.media_kind === "graphic" && " · with a picture"}
                            {post.origin === "written" && " · you wrote this"}
                          </span>
                        </div>
                        <div className="font-medium">{post.subject}</div>
                        {status.means && <div className="text-xs text-zinc-500">{status.means}</div>}
                      </div>
                      <span className="text-xs text-zinc-500">{isOpen ? "Close" : "Read it"}</span>
                    </button>

                    {isOpen && (
                      <div className="space-y-5 border-t border-zinc-800 p-4">
                        {draft ? (
                          <div className="space-y-3">
                            <label className="block text-xs font-semibold text-zinc-400" htmlFor={`s-${post.id}`}>
                              What it is about
                            </label>
                            <input
                              id={`s-${post.id}`}
                              value={draft.subject}
                              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                              className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm"
                            />
                            <label className="block text-xs font-semibold text-zinc-400" htmlFor={`b-${post.id}`}>
                              The post
                            </label>
                            <textarea
                              id={`b-${post.id}`}
                              rows={10}
                              value={draft.body}
                              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm leading-relaxed"
                            />
                            <p className="text-xs text-zinc-500">
                              Saving puts it back in the queue — approving belongs to the words, not to
                              the row.
                            </p>
                          </div>
                        ) : (
                          <article className="whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm leading-7 text-zinc-200">
                            {post.body}
                          </article>
                        )}

                        {post.media_kind === "graphic" && (
                          <div className="space-y-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/admin/social/picture/${post.id}`}
                              alt={`The picture for “${post.subject}”`}
                              className="w-full max-w-xl rounded-lg border border-zinc-800"
                            />
                            <Explain q="Where did this picture come from?">
                              <p>
                                The headline is your opening sentence. The style — the colours, the
                                layout, the shapes — is picked from a set and recorded, so no two posts
                                ever look the same.
                              </p>
                              <p>
                                ⛔ Nothing in a picture is written separately, so there is no way for a
                                picture to say something the word check has not read.
                              </p>
                            </Explain>
                          </div>
                        )}

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <div className="text-xs font-semibold text-zinc-400">The word check</div>
                            <div className="flex flex-wrap gap-1.5">
                              {(gate.listsRun ?? []).map((l) => (
                                <Chip key={l} tone="green">{LIST_LABEL[l] ?? l} ✓</Chip>
                              ))}
                              {(gate.listsUnavailable ?? []).map((l) => (
                                <Chip key={l} tone="amber" title={`There is no word list for ${post.language}.`}>
                                  {LIST_LABEL[l] ?? l} — not run
                                </Chip>
                              ))}
                            </div>
                            {(gate.findings ?? []).length > 0 && (
                              <ul className="space-y-1 text-xs text-rose-300">
                                {(gate.findings ?? []).map((f, i) => (
                                  <li key={i}>“{f.matched}” — {f.because}</li>
                                ))}
                              </ul>
                            )}
                            {(gate.houseStyle ?? []).length > 0 && (
                              <ul className="space-y-1 text-xs text-amber-300">
                                {(gate.houseStyle ?? []).map((p, i) => <li key={i}>{p}</li>)}
                              </ul>
                            )}
                          </div>

                          <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                            <div className="text-xs font-semibold text-zinc-400">What only you can judge</div>
                            <ul className="space-y-1.5 text-xs text-zinc-300">
                              <li>Is this written for everyone?</li>
                              <li>How would it land on somebody having a bad day?</li>
                              <li>Does it leave the reader something to think?</li>
                            </ul>
                          </div>
                        </div>

                        {(gate.notes ?? []).length > 0 && (
                          <Explain q="Notes on this draft">
                            <ul className="space-y-1">
                              {(gate.notes ?? []).map((n, i) => <li key={i}>· {n}</li>)}
                            </ul>
                          </Explain>
                        )}

                        {(gate.rejectedDrafts ?? []).length > 0 && (
                          <Explain q={`${(gate.rejectedDrafts ?? []).length} earlier draft(s) were thrown away`}>
                            <ul className="space-y-3">
                              {(gate.rejectedDrafts ?? []).map((d) => (
                                <li key={d.attempt}>
                                  <div className="text-rose-300">{d.why}</div>
                                  <div className="mt-1 whitespace-pre-wrap">{d.body}</div>
                                </li>
                              ))}
                            </ul>
                          </Explain>
                        )}

                        <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
                          {post.status === "needs_review" &&
                            (draft ? (
                              <>
                                <button type="button" disabled={busy === post.id}
                                  onClick={() => void act(post.id, "edit", draft)}
                                  className="min-h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50">
                                  Save the changes
                                </button>
                                <button type="button" onClick={() => setDraft(null)}
                                  className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm hover:bg-zinc-800">
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button type="button" disabled={busy === post.id}
                                  onClick={() => void act(post.id, "approve")}
                                  className="min-h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50">
                                  Approve
                                </button>
                                <button type="button"
                                  onClick={() => setDraft({ subject: post.subject, body: post.body })}
                                  className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm hover:bg-zinc-800">
                                  Change the words
                                </button>
                                <button type="button" disabled={busy === post.id}
                                  onClick={() => void act(post.id, "skip")}
                                  className="ml-auto min-h-11 rounded-lg border border-rose-900 px-4 text-sm text-rose-300 hover:bg-rose-950/40 disabled:opacity-50">
                                  Skip it
                                </button>
                              </>
                            ))}
                          {post.status === "approved" && (
                            <button type="button" disabled={busy === post.id}
                              onClick={() => void act(post.id, "unapprove")}
                              className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm hover:bg-zinc-800 disabled:opacity-50">
                              Put it back
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Waiting for you", byStatus.needs_review ?? 0],
              ["Ready to go", byStatus.approved ?? 0],
              ["Posted", byStatus.published ?? 0],
              ["Blocked", byStatus.rejected_by_gate ?? 0],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
              </div>
            ))}
          </section>

          <HowItWorks />

          <p className="text-xs text-zinc-500">
            ⛔ Nothing publishes yet — no channel is connected, so an approved post waits. You can post
            it by hand from here in the meantime.{" "}
            <a href="/admin/social/channels" className="underline">Connect a channel</a>.
          </p>
        </>
      )}
    </SocialPage>
  );
}
