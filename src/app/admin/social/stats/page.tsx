"use client";

// /admin/social/stats — is any of this working?
//
// 🔑 THE OWNER'S ASK, 18 Oct: "whether likes/dislikes/followers are increasing
// or decreasing or how the posts are effecting that specific social media."
//
// ⛔ THE RULE THIS SCREEN IS BUILT ON: never show a number more confident than
// the measurement behind it. A gap is drawn as “—”, not as zero; one day is
// called one day, not a trend; and the follower count is shown against the
// size of the audience rather than as a bare figure, because on a page this
// small one person is two per cent.

import { useCallback, useEffect, useState } from "react";
import { SignedOut } from "@/app/admin/social/_components/SignedOut";
import { SocialPage, Chip, Explain } from "@/app/admin/social/_components/ui";
import { LineChart } from "@/app/admin/_components/charts";

type Day = {
  captured_on: string;
  is_baseline: boolean;
  followers: number | null;
  impressions: number | null;
  reach: number | null;
  posts_live: number | null;
};
type Post = {
  id: string;
  subject: string;
  publishedAt: string | null;
  url: string | null;
  hadCard: boolean;
  stats: { reactions: number | null; comments: number | null; shares: number | null; impressions: number | null; captured_on: string } | null;
};

/** ⛔ “—”, never 0. A figure nobody captured is not a measurement of nothing. */
const n = (v: number | null | undefined) => (typeof v === "number" ? v.toLocaleString() : "—");

export default function SocialStats() {
  const [days, setDays] = useState<Day[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [authed, setAuthed] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/social/stats", { credentials: "same-origin" });
    // ⚠️ A block, not `return setAuthed(...)`. Returning the state update
    // reads to the linter as a synchronous setState — and it is how every
    // other screen here is written.
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    const json = await res.json();
    setDays(json.days ?? []);
    setPosts(json.posts ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const baseline = days.find((d) => d.is_baseline) ?? days[0];
  const today = days[days.length - 1];
  const moved =
    baseline && today && baseline.followers !== null && today.followers !== null
      ? today.followers - baseline.followers
      : null;

  /**
   * ⚠️ ONLY DAYS WITH A READING. Dropping a missing day entirely is honest;
   * plotting it as zero would draw a cliff that never happened.
   */
  const withFollowers = days.filter((d) => d.followers !== null);
  const withReach = days.filter((d) => d.reach !== null);

  return (
    <SocialPage
      here="/admin/social/stats"
      title="Is it working?"
      lede="What the channel looked like before any of this, and what it looks like now."
    >
      {authed === null && <p className="text-sm text-zinc-500">Checking the admin session…</p>}
      {authed === false && <SignedOut />}

      {authed === true && (
        <>
          {days.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/8 p-8 text-center text-sm text-zinc-500">
              Nothing has been measured yet. The daily run takes the figures at 19:30, and connecting
              a channel takes its opening numbers straight away.
            </p>
          ) : (
            <>
              {/* ⚠️ The headline is the CHANGE, with the starting point beside
                  it. A bare "50 followers" says nothing about whether any of
                  this is doing anything. */}
              <section className="grid gap-3 sm:grid-cols-4">
                <Tile label="Followers now" value={n(today?.followers)} />
                <Tile
                  label="Since the baseline"
                  value={moved === null ? "—" : moved > 0 ? `+${moved}` : String(moved)}
                  hint={baseline ? `from ${n(baseline.followers)} on ${baseline.captured_on}` : undefined}
                />
                <Tile label="Reach yesterday" value={n(today?.reach)} hint="distinct people" />
                <Tile label="Views yesterday" value={n(today?.impressions)} hint="times shown" />
              </section>

              {days.length < 3 && (
                <p className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-200">
                  ⚠️ {days.length === 1 ? "One day" : `${days.length} days`} of readings. That is not a
                  trend yet — and on a page this size one person is about two per cent, so a line
                  will look dramatic long before it means anything.
                </p>
              )}

              {withFollowers.length > 1 && (
                <section className="space-y-2 rounded-xl border border-white/8 bg-white/5 p-5">
                  <h2 className="text-sm font-semibold">Followers</h2>
                  <LineChart
                    lines={[{ label: "followers", color: "#818CF8", points: withFollowers.map((d) => d.followers as number) }]}
                    xFirst={withFollowers[0].captured_on}
                    xLast={withFollowers[withFollowers.length - 1].captured_on}
                  />
                </section>
              )}

              {withReach.length > 1 && (
                <section className="space-y-2 rounded-xl border border-white/8 bg-white/5 p-5">
                  <h2 className="text-sm font-semibold">Reach and views</h2>
                  <LineChart
                    lines={[
                      { label: "reach", color: "#4ADE80", points: withReach.map((d) => d.reach as number) },
                      { label: "views", color: "#38BDF8", points: withReach.map((d) => d.impressions ?? 0) },
                    ]}
                    xFirst={withReach[0].captured_on}
                    xLast={withReach[withReach.length - 1].captured_on}
                  />
                </section>
              )}

              {/* 🔑 Day by day, because a chart with three points hides more
                  than it shows. The table is the honest view early on. */}
              <section className="overflow-x-auto rounded-xl border border-white/8 bg-white/5 p-5">
                <h2 className="mb-3 text-sm font-semibold">Every day measured</h2>
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-zinc-500">
                    <tr>
                      <th className="py-1">Day</th><th>Followers</th><th>Reach</th><th>Views</th><th>Posts live</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {[...days].reverse().map((d) => (
                      <tr key={d.captured_on} className="border-t border-white/5">
                        <td className="py-2">
                          {d.captured_on} {d.is_baseline && <Chip tone="indigo" title="Before the scheduler had done anything.">baseline</Chip>}
                        </td>
                        <td>{n(d.followers)}</td><td>{n(d.reach)}</td><td>{n(d.impressions)}</td><td>{n(d.posts_live)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}

          <section className="overflow-x-auto rounded-xl border border-white/8 bg-white/5 p-5">
            <h2 className="mb-3 text-sm font-semibold">Each post</h2>
            {posts.length === 0 ? (
              <p className="text-sm text-zinc-500">Nothing has been published yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-zinc-500">
                  <tr><th className="py-1">Post</th><th>Reactions</th><th>Comments</th><th>Shares</th><th>Views</th></tr>
                </thead>
                <tbody className="tabular-nums">
                  {posts.map((p) => (
                    <tr key={p.id} className="border-t border-white/5">
                      <td className="max-w-md py-2 pr-4">
                        <span className="text-zinc-200">{p.subject}</span>
                        {!p.hadCard && <Chip tone="amber" title="It went out as plain text.">no card</Chip>}
                        <span className="block text-[11px] text-zinc-500">
                          {p.publishedAt ? new Date(p.publishedAt).toLocaleString() : "—"}
                          {p.url && <> · <a href={p.url} target="_blank" rel="noreferrer" className="underline">see it</a></>}
                        </span>
                      </td>
                      <td>{n(p.stats?.reactions)}</td><td>{n(p.stats?.comments)}</td>
                      <td>{n(p.stats?.shares)}</td><td>{n(p.stats?.impressions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <Explain q="Why does it say “—” instead of 0?">
            <p>
              Because they are different facts. A dash means nobody asked, or the platform declined
              to answer. A zero would mean we asked and nothing happened — and a column of invented
              zeros drags every average down and reads as a collapse.
            </p>
            <p>
              ⛔ Page reach needs a permission called <code>read_insights</code> on the token. Post
              figures are collected once a day at 19:30, so a post published this evening has no
              numbers until tomorrow.
            </p>
          </Explain>
        </>
      )}
    </SocialPage>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/5 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-zinc-500">{hint}</p>}
    </div>
  );
}
