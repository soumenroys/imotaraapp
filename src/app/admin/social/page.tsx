"use client";

// /admin/social — what is waiting, what went out, and what the gate refused.
//
// Same auth as the other admin sub-pages: the httpOnly session cookie set by
// logging in at /admin, sent on these same-origin fetches. No login form here.
//
// 🔑 THE ONE THING THIS SCREEN IS FOR: reading a draft properly before saying
// yes. So the words get the room, the gate's findings sit next to them, and
// ⛔ the two questions no check can answer — is this written for everyone, and
// how would it land on a bad day — are printed where they cannot be skipped.

import { useCallback, useEffect, useState } from "react";
import { SignedOut } from "@/app/admin/social/_components/SignedOut";

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

type Schedule = {
  id: string;
  name: string;
  platforms: string[];
  content_type: string;
  languages: string[];
  post_at: string;
  timezone: string;
  days: number[];
  active: boolean;
  auto_publish: boolean;
};

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const VIEWS = [
  { key: "queue", label: "Waiting for you" },
  { key: "approved", label: "Approved" },
  { key: "published", label: "Published" },
  { key: "trouble", label: "Refused" },
  { key: "all", label: "Everything" },
] as const;

const LIST_LABEL: Record<string, string> = {
  clinical: "clinical claim",
  abuse: "abuse",
  careless: "careless language",
};

function Pill({ children, tone = "zinc" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    zinc: "border-zinc-700 text-zinc-300",
    green: "border-emerald-800 bg-emerald-950/40 text-emerald-300",
    amber: "border-amber-800 bg-amber-950/40 text-amber-300",
    rose: "border-rose-900 bg-rose-950/40 text-rose-300",
    indigo: "border-indigo-800 bg-indigo-950/40 text-indigo-300",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone] ?? tones.zinc}`}>
      {children}
    </span>
  );
}

export default function SocialAdmin() {
  const [view, setView] = useState<string>("queue");
  const [posts, setPosts] = useState<Post[]>([]);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [scheduleNames, setScheduleNames] = useState<Record<string, string>>({});
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  /** null = not yet known. ⛔ Never assumed true: that is what made the page
   *  render its defaults as though they were data. */
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState<string>("");
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [p, s] = await Promise.all([
        fetch(`/api/admin/social/posts?view=${view}`, { credentials: "same-origin" }),
        fetch("/api/admin/social/schedules", { credentials: "same-origin" }),
      ]);
      if (p.status === 401 || s.status === 401) {
        setAuthed(false);
        return;
      }
      setAuthed(true);
      if (p.status === 403) {
        setError((await p.json()).error ?? "Not permitted.");
        return;
      }
      const pj = await p.json();
      const sj = await s.json();
      if (!p.ok) {
        setError(pj.error ?? "Could not load the queue.");
        return;
      }
      setPosts(pj.posts ?? []);
      setByStatus(pj.byStatus ?? {});
      setScheduleNames(pj.scheduleNames ?? {});
      setRole(pj.actorRole ?? "");
      setSchedules(sj.schedules ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
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
      if (!res.ok) {
        setMessage(json.error ?? "That did not work.");
        return;
      }
      setMessage(json.note ?? "Done.");
      setDraft(null);
      await load();
    } finally {
      setBusy("");
    }
  }

  async function generateNow(scheduleId: string) {
    setBusy(scheduleId);
    setMessage("");
    try {
      const res = await fetch("/api/admin/social/generate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scheduleId }),
      });
      const json = await res.json();
      setMessage(
        res.ok
          ? `Written: “${json.subject}” in ${json.language}. ${(json.notes ?? []).join(" ")}`
          : json.error ?? "Nothing was written.",
      );
      if (res.ok) await load();
    } finally {
      setBusy("");
    }
  }

  const waiting = byStatus.needs_review ?? 0;

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <a href="/admin" className="text-xs text-zinc-500 hover:text-zinc-300">
              ← Admin
            </a>
            <h1 className="text-2xl font-semibold tracking-tight">Social posting</h1>
            <p className="max-w-2xl text-sm text-zinc-400">
              Written on a schedule, or by you, in any of the 22 languages. Nothing reaches a timeline
              until you have read it — unless you say otherwise, schedule by schedule.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/admin/social/channels"
              className="flex min-h-11 items-center rounded-lg border border-zinc-700 px-4 text-sm hover:bg-zinc-900"
            >
              Channels
            </a>
            <a
              href="/admin/social/compose"
              className="flex min-h-11 items-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold hover:bg-indigo-500"
            >
              Write a post
            </a>
          </div>
        </header>

        {authed === false && <SignedOut />}

        {authed !== false && (
          <>
        {/* ⛔ Said on every visit, because the single most consequential fact
            about this feature right now is that it does not publish. */}
        <div className="mb-8 rounded-xl border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-200">
          <strong className="font-semibold">Phase 1: nothing publishes yet.</strong> Posts are written,
          checked and queued. There is no channel adapter, so an approved post waits rather than going
          out — and you can post it by hand in two clicks from here.
          {role && role !== "owner" && (
            <>
              {" "}
              You are signed in as an <strong>admin</strong>: you can read, approve, edit and write
              posts. Connecting a channel, replacing a token and switching auto-publish on are the
              owner tier.
            </>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200">{error}</div>
        )}
        {message && (
          <div className="rounded-xl border border-indigo-900 bg-indigo-950/30 p-4 text-sm text-indigo-200">
            {message}
          </div>
        )}

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Waiting for you", value: waiting },
            { label: "Approved, unpublished", value: byStatus.approved ?? 0 },
            { label: "Published", value: byStatus.published ?? 0 },
            { label: "Refused by the gate", value: byStatus.rejected_by_gate ?? 0 },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="text-xs uppercase tracking-wide text-zinc-500">{s.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</div>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-300">Schedules</h2>
          {schedules.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-800 p-6 text-sm text-zinc-500">
              No schedules yet. One schedule decides when something is written, for which channel, in
              what shape, and in which languages.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
              {schedules.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 bg-zinc-900/40 p-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{s.name}</span>
                      {!s.active && <Pill tone="zinc">paused</Pill>}
                      <Pill tone={s.auto_publish ? "amber" : "indigo"}>
                        {s.auto_publish ? "posts unattended" : "waits for you"}
                      </Pill>
                    </div>
                    <div className="text-xs text-zinc-500">
                      {s.platforms.join(", ")} · {s.content_type.replace("_", " + ")} ·{" "}
                      <span className="tabular-nums">{s.post_at}</span> {s.timezone} ·{" "}
                      {s.days.map((d) => DAY[d]).join(" ")} · {s.languages.join(" / ")}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void generateNow(s.id)}
                    disabled={busy === s.id}
                    className="min-h-11 rounded-lg border border-zinc-700 px-3 text-sm hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {busy === s.id ? "Writing…" : "Write one now"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
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

          {loading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : posts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-800 p-6 text-sm text-zinc-500">
              Nothing here.
            </p>
          ) : (
            <ul className="space-y-4">
              {posts.map((post) => {
                const gate = post.gate_result ?? {};
                const isOpen = open === post.id;
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
                          <Pill
                            tone={
                              post.status === "published"
                                ? "green"
                                : post.status === "needs_review"
                                  ? "indigo"
                                  : post.status === "approved"
                                    ? "amber"
                                    : post.status === "failed" || post.status === "rejected_by_gate"
                                      ? "rose"
                                      : "zinc"
                            }
                          >
                            {post.status.replace(/_/g, " ")}
                          </Pill>
                          <Pill>{post.platform}</Pill>
                          <Pill>{post.language}</Pill>
                          <Pill>{post.origin === "written" ? "written by hand" : "generated"}</Pill>
                          {post.media_kind === "graphic" && <Pill>has a picture</Pill>}
                        </div>
                        <div className="font-medium">{post.subject}</div>
                        <div className="text-xs text-zinc-500">
                          {post.schedule_id ? scheduleNames[post.schedule_id] ?? "a deleted schedule" : "no schedule"}
                          {post.scheduled_for && ` · slot ${new Date(post.scheduled_for).toLocaleString()}`}
                        </div>
                      </div>
                      <span className="text-xs text-zinc-500">{isOpen ? "Close" : "Read it"}</span>
                    </button>

                    {isOpen && (
                      <div className="space-y-5 border-t border-zinc-800 p-4">
                        {draft ? (
                          <div className="space-y-3">
                            <label className="block text-xs font-semibold text-zinc-400" htmlFor={`s-${post.id}`}>
                              Subject
                            </label>
                            <input
                              id={`s-${post.id}`}
                              value={draft.subject}
                              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm"
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
                              Saving puts it back in the queue — approval belongs to the words, not to the
                              row.
                            </p>
                          </div>
                        ) : (
                          <article className="whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm leading-7 text-zinc-200">
                            {post.body}
                          </article>
                        )}

                        {post.media_kind === "graphic" && (
                          <div className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                              The picture
                            </div>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/admin/social/picture/${post.id}`}
                              alt={`The composed picture for “${post.subject}”`}
                              className="w-full max-w-xl rounded-lg border border-zinc-800"
                            />
                            {post.visual_recipe && (
                              <div className="flex flex-wrap gap-1.5 font-mono text-[11px] text-zinc-500">
                                {["layout", "palette", "typeTreatment", "motif", "script"].map((k) => (
                                  <span key={k} className="rounded border border-zinc-800 px-1.5 py-0.5">
                                    {k}·{String((post.visual_recipe as Record<string, unknown>)[k] ?? "?")}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                              What the gate checked
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {(gate.listsRun ?? []).map((l) => (
                                <Pill key={l} tone="green">
                                  {LIST_LABEL[l] ?? l} ✓
                                </Pill>
                              ))}
                              {(gate.listsUnavailable ?? []).map((l) => (
                                <Pill key={l} tone="amber">
                                  {LIST_LABEL[l] ?? l} — no list for {post.language}
                                </Pill>
                              ))}
                            </div>
                            {(gate.findings ?? []).length > 0 && (
                              <ul className="space-y-1 text-xs text-rose-300">
                                {(gate.findings ?? []).map((f, i) => (
                                  <li key={i}>
                                    “{f.matched}” — {f.because}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {(gate.houseStyle ?? []).length > 0 && (
                              <ul className="space-y-1 text-xs text-amber-300">
                                {(gate.houseStyle ?? []).map((p, i) => (
                                  <li key={i}>{p}</li>
                                ))}
                              </ul>
                            )}
                          </div>

                          {/* ⛔ Printed on every draft, not hidden behind a toggle.
                              These two are the reason a person is looking at all. */}
                          <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                              What only you can check
                            </div>
                            <ul className="space-y-1.5 text-xs text-zinc-300">
                              <li>Is this written for everyone, or has it drifted towards one group?</li>
                              <li>How would it land on somebody having a bad day?</li>
                              <li>Does it leave the reader something to think?</li>
                            </ul>
                            <p className="text-[11px] text-zinc-500">
                              None of these is a word list, and no check can be written for them.
                            </p>
                          </div>
                        </div>

                        {(gate.notes ?? []).length > 0 && (
                          <ul className="space-y-1 text-xs text-zinc-400">
                            {(gate.notes ?? []).map((n, i) => (
                              <li key={i}>· {n}</li>
                            ))}
                          </ul>
                        )}

                        {(gate.rejectedDrafts ?? []).length > 0 && (
                          <details className="rounded-lg border border-zinc-800 p-3">
                            <summary className="cursor-pointer text-xs text-zinc-400">
                              {(gate.rejectedDrafts ?? []).length} earlier draft(s) were thrown away
                            </summary>
                            <ul className="mt-2 space-y-3 text-xs text-zinc-500">
                              {(gate.rejectedDrafts ?? []).map((d) => (
                                <li key={d.attempt}>
                                  <div className="text-rose-300">{d.why}</div>
                                  <div className="mt-1 whitespace-pre-wrap">{d.body}</div>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}

                        <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
                          {post.status === "needs_review" &&
                            (draft ? (
                              <>
                                <button
                                  type="button"
                                  disabled={busy === post.id}
                                  onClick={() => void act(post.id, "edit", draft)}
                                  className="min-h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50"
                                >
                                  Save the changes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDraft(null)}
                                  className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm hover:bg-zinc-800"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  disabled={busy === post.id}
                                  onClick={() => void act(post.id, "approve")}
                                  className="min-h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDraft({ subject: post.subject, body: post.body })}
                                  className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm hover:bg-zinc-800"
                                >
                                  Edit the words
                                </button>
                                <button
                                  type="button"
                                  disabled={busy === post.id}
                                  onClick={() => void act(post.id, "skip")}
                                  className="ml-auto min-h-11 rounded-lg border border-rose-900 px-4 text-sm text-rose-300 hover:bg-rose-950/40 disabled:opacity-50"
                                >
                                  Skip it
                                </button>
                              </>
                            ))}
                          {post.status === "approved" && (
                            <button
                              type="button"
                              disabled={busy === post.id}
                              onClick={() => void act(post.id, "unapprove")}
                              className="min-h-11 rounded-lg border border-zinc-700 px-4 text-sm hover:bg-zinc-800 disabled:opacity-50"
                            >
                              Put it back in the queue
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
        </section>
          </>
        )}
      </div>
    </main>
  );
}
