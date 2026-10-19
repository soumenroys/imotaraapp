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
import { PageTutorial, TUTORIALS } from "@/app/admin/social/_components/PageTutorial";
import { SocialPage, Chip, Explain, HowItWorks, POST_STATUS } from "@/app/admin/social/_components/ui";
import { publishingSentence } from "@/lib/social/platforms";
import { cardsForPost } from "@/lib/social/cards";

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
  /** 🔑 A carousel's cards after the subject. Null on every other shape. */
  slides: string[] | null;
  media_kind: string;
  visual_recipe: Record<string, unknown> | null;
  gate_result: GateResult | null;
  created_at: string;
};

/**
 * The card numbers this post publishes, in order.
 *
 * ⛔ FROM `cardsForPost`, the same function the renderer and the publisher
 * use. A second count here would be a reviewer approving five cards while
 * six go out — and nothing on the screen would say so.
 */
function cardIndexes(post: { subject: string; slides: string[] | null; media_kind: string }): number[] {
  if (post.media_kind !== "carousel") return [0];
  return cardsForPost(post).map((_, i) => i);
}

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

/**
 * The reason a card is missing, or null.
 *
 * 🔑 DERIVED FROM THE NOTE THE PIPELINE ALREADY WROTE rather than from a new
 * column. `buildPicture` says exactly why it refused — "the opening sentence
 * is too long to set as a headline", "that recipe has been used" — and that
 * sentence is more useful on the row than any flag could be.
 *
 * ⛔ Matches the start of the note, not a substring anywhere: a post whose
 * BODY happens to say "no picture" must not be flagged as missing one.
 */
function missingPicture(gate: { notes?: string[] }, mediaKind?: string | null): string | null {
  /**
   * 🔴 THE NOTE IS HISTORY, NOT STATE. It was written when the post was
   * composed. A post can gain a card afterwards — four of them did on 18 Oct,
   * when the headline started coming from the subject — and the chip went on
   * reading "Asked for a picture — none made" directly above the card itself.
   *
   * ⛔ Same shape as the eight screens that said "nothing publishes yet" an
   * hour after it did ⇒ trap_a_sentence_that_states_the_world_goes_stale. A
   * STORED SENTENCE describing the world is stale the moment the world moves;
   * the only safe reading of it is alongside what is true now.
   */
  if (mediaKind && mediaKind !== "none") return null;
  return (gate.notes ?? []).find((n) => n.startsWith("No picture:")) ?? null;
}

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
  /** The post whose time is being changed, and the value in the field. */
  const [when, setWhen] = useState<{ id: string; value: string } | null>(null);

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
          <PageTutorial id="today" {...TUTORIALS.today} />

          {message && (
            <div className="rounded-xl border border-indigo-900 bg-indigo-950/30 p-4 text-sm text-indigo-200">
              {message}
            </div>
          )}

          {/* 🔑 The first thing on the page is the answer to "is there anything
              for me?" — not a dashboard. */}
          <section className="rounded-xl border border-white/8 bg-white/5 p-5">
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
                    : "border-white/8 text-zinc-400 hover:bg-white/5"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {posts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/8 p-8 text-center text-sm text-zinc-500">
              Nothing here.
            </p>
          ) : (
            <ul className="space-y-3">
              {posts.map((post) => {
                const gate = post.gate_result ?? {};
                const isOpen = open === post.id;
                const status = POST_STATUS[post.status] ?? { label: post.status, tone: "zinc" as const, means: "" };
                return (
                  <li key={post.id} className="overflow-hidden rounded-xl border border-white/8 bg-white/5">
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(isOpen ? "" : post.id);
                        setDraft(null);
                      }}
                      className="flex w-full flex-wrap items-center gap-3 p-4 text-left hover:bg-white/10"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip tone={status.tone} title={status.means}>{status.label}</Chip>
                          {/* 🔴 A POST THAT LOST ITS CARD USED TO READ EXACTLY LIKE A
                              TEXT POST. The reason was written into the notes and the
                              notes are three clicks down; the row itself said nothing,
                              so a schedule set to "words and a picture" quietly
                              produced words. ⇒ Found on 18 Oct when the new, more
                              specific opening sentence ran past the headline limit. */}
                          {missingPicture(gate, post.media_kind) && (
                            <Chip tone="amber" title={missingPicture(gate, post.media_kind) as string}>
                              Asked for a picture — none made
                            </Chip>
                          )}
                          <span className="text-xs text-zinc-500">
                            {post.platform} · {post.language}
                            {post.media_kind === "graphic" && " · with a picture"}
                            {post.media_kind === "short_video" && " · a short video"}
                            {post.media_kind === "animated_gif" && " · an animated GIF"}
                            {post.origin === "written"
                              ? " · you wrote this"
                              : /* 🔴 The API has always sent scheduleNames and this screen
                                   stored them and never showed them — so a queue with three
                                   schedules running gave no way to tell which one wrote a
                                   draft, which is the first thing you want when the voice
                                   is off. */
                                post.schedule_id && scheduleNames[post.schedule_id]
                                ? ` · from “${scheduleNames[post.schedule_id]}”`
                                : ""}
                          </span>
                        </div>
                        <div className="font-medium">{post.subject}</div>
                        {status.means && <div className="text-xs text-zinc-500">{status.means}</div>}
                      </div>
                      <span className="text-xs text-zinc-500">{isOpen ? "Close" : "Read it"}</span>
                    </button>

                    {isOpen && (
                      <div className="space-y-5 border-t border-white/8 p-4">
                        {draft ? (
                          <div className="space-y-3">
                            <label className="block text-xs font-semibold text-zinc-400" htmlFor={`s-${post.id}`}>
                              What it is about
                            </label>
                            <input
                              id={`s-${post.id}`}
                              value={draft.subject}
                              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                              className="min-h-11 w-full rounded-lg border border-white/15 bg-black/30 px-3 text-sm"
                            />
                            <label className="block text-xs font-semibold text-zinc-400" htmlFor={`b-${post.id}`}>
                              The post
                            </label>
                            <textarea
                              id={`b-${post.id}`}
                              rows={10}
                              value={draft.body}
                              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                              className="w-full rounded-lg border border-white/15 bg-black/30 p-3 text-sm leading-relaxed"
                            />
                            <p className="text-xs text-zinc-500">
                              Saving puts it back in the queue — approving belongs to the words, not to
                              the row.
                            </p>
                          </div>
                        ) : (
                          <article className="whitespace-pre-wrap rounded-lg border border-white/8 bg-black/30 p-4 text-sm leading-7 text-zinc-200">
                            {post.body}
                          </article>
                        )}

                        {(post.media_kind === "graphic" || post.media_kind === "carousel") && (
                          <div className="space-y-2">
                            {/*
                              🔴 EVERY CARD, NOT THE FIRST ONE.
                              Approving a carousel from its opening card is
                              approving five public cards having seen one —
                              and the four unseen ones are the ones a reader
                              swipes to. ⛔ They are shown side by side, in
                              the order they publish, so "which card is which"
                              is answered by looking rather than by trusting.
                            */}
                            <div className={post.media_kind === "carousel" ? "flex gap-3 overflow-x-auto pb-2" : ""}>
                              {cardIndexes(post).map((slide) => (
                                <figure key={slide} className="shrink-0">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={
                                      slide === 0
                                        ? `/api/admin/social/picture/${post.id}`
                                        : `/api/admin/social/picture/${post.id}?slide=${slide}`
                                    }
                                    alt={
                                      post.media_kind === "carousel"
                                        ? `Card ${slide + 1} of ${cardIndexes(post).length} for “${post.subject}”`
                                        : `The picture for “${post.subject}”`
                                    }
                                    className={
                                      post.media_kind === "carousel"
                                        ? "h-56 w-56 rounded-lg border border-white/8 object-cover"
                                        : "w-full max-w-xl rounded-lg border border-white/8"
                                    }
                                  />
                                  {post.media_kind === "carousel" && (
                                    <figcaption className="mt-1 text-center text-xs text-zinc-500">
                                      {slide + 1} / {cardIndexes(post).length}
                                    </figcaption>
                                  )}
                                </figure>
                              ))}
                            </div>
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

                          <div className="space-y-2 rounded-lg border border-white/8 bg-black/20 p-3">
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

                        <div className="flex flex-wrap gap-2 border-t border-white/8 pt-4">
                          {post.status === "needs_review" &&
                            (draft ? (
                              <>
                                <button type="button" disabled={busy === post.id}
                                  onClick={() => void act(post.id, "edit", draft)}
                                  className="min-h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50">
                                  Save the changes
                                </button>
                                <button type="button" onClick={() => setDraft(null)}
                                  className="min-h-11 rounded-lg border border-white/15 px-4 text-sm hover:bg-white/10">
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
                                  className="min-h-11 rounded-lg border border-white/15 px-4 text-sm hover:bg-white/10">
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
                              className="min-h-11 rounded-lg border border-white/15 px-4 text-sm hover:bg-white/10 disabled:opacity-50">
                              Put it back
                            </button>
                          )}

                          {/* 🔴 THERE WAS NO WAY TO CHANGE A POST'S TIME. Six
                              posts approved at once with no time all became due
                              immediately, and spreading them took a direct
                              database update — which left the owner unable to
                              do the same thing. */}
                          {post.status !== "published" && (
                            <button type="button" disabled={busy === post.id}
                              onClick={() => setWhen(when?.id === post.id ? null : {
                                id: post.id,
                                // ⚠️ A datetime-local input wants the LOCAL
                                // wall clock with no zone, so the stored UTC
                                // instant is shifted into the browser's zone
                                // before it is shown — otherwise an Indian
                                // 09:30 displays as 04:00 and looks wrong.
                                value: post.scheduled_for
                                  ? new Date(new Date(post.scheduled_for).getTime()
                                      - new Date().getTimezoneOffset() * 60000)
                                      .toISOString().slice(0, 16)
                                  : "",
                              })}
                              className="min-h-11 rounded-lg border border-white/15 px-4 text-sm hover:bg-white/10 disabled:opacity-50">
                              {when?.id === post.id ? "Close" : "Change the time"}
                            </button>
                          )}
                        </div>

                      {when?.id === post.id && (
                        <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
                          <label htmlFor={`when-${post.id}`} className="block text-[11px] font-semibold text-zinc-400">
                            When should it go out?
                          </label>
                          <input
                            id={`when-${post.id}`}
                            type="datetime-local"
                            value={when.value}
                            onChange={(e) => setWhen({ id: post.id, value: e.target.value })}
                            className="min-h-10 w-full rounded-lg border border-white/15 bg-black/30 px-3 text-sm"
                          />
                          <p className="text-[11px] text-zinc-500">
                            In your own time zone. ⚠️ Leave it empty for “as soon as it is approved” —
                            which means a run within the minute, so several undated posts all go out
                            at once.
                          </p>
                          <div className="flex gap-2">
                            <button type="button" disabled={busy === post.id}
                              onClick={() => void act(post.id, "reschedule", {
                                // ⛔ null, not "", because null is the real
                                // value for "as soon as approved" and an empty
                                // string is not a date.
                                scheduledFor: when.value ? new Date(when.value).toISOString() : null,
                              })}
                              className="min-h-9 rounded-lg bg-indigo-600 px-3 text-xs font-semibold hover:bg-indigo-500 disabled:opacity-40">
                              Save the time
                            </button>
                            <button type="button" onClick={() => setWhen(null)}
                              className="min-h-9 rounded-lg border border-white/15 px-3 text-xs font-semibold hover:bg-white/10">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
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
              <div key={label as string} className="rounded-xl border border-white/8 bg-white/5 p-3">
                <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
              </div>
            ))}
          </section>

          <HowItWorks />

          <p className="text-xs text-zinc-500">
            {/* ⚠️ DERIVED, not written here. This sentence said "no channel is
                connected" for an hour after one was ⇒ publishingSentence. */}
            {publishingSentence()}{" "}
            <a href="/admin/social/channels" className="underline">Connect a channel</a>.
          </p>
        </>
      )}
    </SocialPage>
  );
}
