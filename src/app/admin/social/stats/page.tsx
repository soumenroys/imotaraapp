"use client";

// /admin/social/stats — is any of this working, and which part?
//
// 🔑 THE OWNER'S ASK, 18 Oct: "we will connect multiple social media from
// this… you are not showing the social media name or post language or post
// type etc. is the dashboard okay from all perspective to get insight and
// take actions accordingly?"
//
// ⛔ IT WAS NOT. The first version was single-channel shaped: one followers
// figure taken from whichever row happened to be last, one chart mixing every
// account, and no language, shape or angle anywhere. With two channels
// recording it would not have looked broken — it would have looked fine and
// been wrong, which is worse.
//
// ⛔ AND THE RULE THE SCREEN IS BUILT ON, unchanged: never show a number more
// confident than the measurement behind it. A gap is "—", never 0. A day with
// no reading is dropped, not plotted at zero. Fewer than three readings says
// so in words.

import { useCallback, useEffect, useState } from "react";
import { SignedOut } from "@/app/admin/social/_components/SignedOut";
import { SocialPage, Chip, Explain } from "@/app/admin/social/_components/ui";
import { LineChart } from "@/app/admin/_components/charts";

type Channel = { id: string; platform: string; display_name: string; status: string };
type Day = {
  account_id: string;
  platform: string;
  captured_on: string;
  is_baseline: boolean;
  followers: number | null;
  impressions: number | null;
  reach: number | null;
  posts_live: number | null;
};
type Stats = { reactions: number | null; comments: number | null; shares: number | null; impressions: number | null };
type Post = {
  id: string; platform: string; language: string; angle: string | null; shape: string;
  subject: string; publishedAt: string | null; url: string | null; hadCard: boolean; stats: Stats | null;
};

/** ⛔ "—", never 0. A figure nobody captured is not a measurement of nothing. */
const n = (v: number | null | undefined) => (typeof v === "number" ? v.toLocaleString() : "—");

/** Reactions + comments + shares. ⚠️ null unless at least one was measured. */
function engagement(s: Stats | null): number | null {
  if (!s) return null;
  const parts = [s.reactions, s.comments, s.shares].filter((x): x is number => typeof x === "number");
  return parts.length === 0 ? null : parts.reduce((a, b) => a + b, 0);
}

/**
 * 🔑 GROUP POSTS BY A DIMENSION AND REPORT WHAT IS MEASURABLE.
 *
 * ⛔ `measured` is carried separately from `count`. "3 posts, 2 measured,
 * 7 engagements" is honest; dividing 7 by 3 would quietly average in a post
 * nobody has figures for yet and under-report every recent angle.
 */
function groupBy(posts: Post[], key: (p: Post) => string | null) {
  const out = new Map<string, { count: number; measured: number; engagement: number; views: number | null }>();
  for (const p of posts) {
    const k = key(p) ?? "(not recorded)";
    const row = out.get(k) ?? { count: 0, measured: 0, engagement: 0, views: null as number | null };
    row.count += 1;
    const e = engagement(p.stats);
    if (e !== null) { row.measured += 1; row.engagement += e; }
    if (typeof p.stats?.impressions === "number") row.views = (row.views ?? 0) + p.stats.impressions;
    out.set(k, row);
  }
  return [...out.entries()].sort((a, b) => b[1].engagement - a[1].engagement || b[1].count - a[1].count);
}

export default function SocialStats() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [authed, setAuthed] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/social/stats", { credentials: "same-origin" });
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    const json = await res.json();
    setChannels(json.channels ?? []);
    setDays(json.days ?? []);
    setPosts(json.posts ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** ⛔ Only channels that have actually been measured. A channel with no
   *  readings is reported as such rather than drawn as a flat line at zero. */
  const measured = channels.filter((c) => days.some((d) => d.account_id === c.id));

  return (
    <SocialPage
      here="/admin/social/stats"
      title="Is it working?"
      lede="Per channel, and then by language, shape and angle — so a number can be acted on."
    >
      {authed === null && <p className="text-sm text-zinc-500">Checking the admin session…</p>}
      {authed === false && <SignedOut />}

      {authed === true && (
        <>
          {measured.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/8 p-8 text-center text-sm text-zinc-500">
              Nothing has been measured yet. Connecting a channel takes its opening figures, and the
              daily run takes them again at 19:30.
            </p>
          )}

          {/* 🔑 ONE SECTION PER CHANNEL. The first version of this screen had
              one set of figures for everything, which with two channels would
              have shown whichever row happened to be last. */}
          {measured.map((c) => {
            const mine = days.filter((d) => d.account_id === c.id);
            const base = mine.find((d) => d.is_baseline) ?? mine[0];
            const now = mine[mine.length - 1];
            const moved =
              base && now && base.followers !== null && now.followers !== null
                ? now.followers - base.followers
                : null;
            const withFollowers = mine.filter((d) => d.followers !== null);
            const withReach = mine.filter((d) => d.reach !== null);
            const mineP = posts.filter((p) => p.platform === c.platform);

            return (
              <section key={c.id} className="space-y-4 rounded-xl border border-white/8 bg-white/5 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold">{c.display_name}</h2>
                  <Chip tone="indigo">{c.platform}</Chip>
                  <span className="text-xs text-zinc-500">{mine.length} day(s) measured · {mineP.length} post(s)</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <Tile label="Followers now" value={n(now?.followers)} />
                  <Tile
                    label="Since the baseline"
                    value={moved === null ? "—" : moved > 0 ? `+${moved}` : String(moved)}
                    hint={base ? `from ${n(base.followers)} on ${base.captured_on}` : undefined}
                  />
                  <Tile label="Reach yesterday" value={n(now?.reach)} hint="distinct people" />
                  <Tile label="Views yesterday" value={n(now?.impressions)} hint="times shown" />
                </div>

                {mine.length < 3 && (
                  <p className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-200">
                    ⚠️ {mine.length === 1 ? "One day" : `${mine.length} days`} of readings — not a trend.
                    {now?.followers !== null && now && now.followers! < 500 &&
                      ` On ${now.followers} followers, one person is about ${(100 / now.followers!).toFixed(1)}%.`}
                  </p>
                )}

                {withFollowers.length > 1 && (
                  <LineChart
                    lines={[{ label: "followers", color: "#818CF8", points: withFollowers.map((d) => d.followers as number) }]}
                    xFirst={withFollowers[0].captured_on}
                    xLast={withFollowers[withFollowers.length - 1].captured_on}
                  />
                )}
                {withReach.length > 1 && (
                  <LineChart
                    lines={[
                      { label: "reach", color: "#4ADE80", points: withReach.map((d) => d.reach as number) },
                      { label: "views", color: "#38BDF8", points: withReach.map((d) => d.impressions ?? 0) },
                    ]}
                    xFirst={withReach[0].captured_on}
                    xLast={withReach[withReach.length - 1].captured_on}
                  />
                )}

                <Breakdown title="By angle" rows={groupBy(mineP, (p) => p.angle)} />
                <Breakdown title="By language" rows={groupBy(mineP, (p) => p.language)} />
                <Breakdown title="By shape" rows={groupBy(mineP, (p) => p.shape)} />
              </section>
            );
          })}

          <section className="overflow-x-auto rounded-xl border border-white/8 bg-white/5 p-5">
            <h2 className="mb-1 text-sm font-semibold">Every post, best first</h2>
            <p className="mb-3 text-xs text-zinc-500">
              Sorted by reactions + comments + shares. ⚠️ A post measured today and one published an
              hour ago are not comparable — the figures keep moving for days.
            </p>
            {posts.length === 0 ? (
              <p className="text-sm text-zinc-500">Nothing has been published yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-zinc-500">
                  <tr>
                    <th className="py-1">Post</th><th>Channel</th><th>Lang</th><th>Angle</th><th>Shape</th>
                    <th>Reactions</th><th>Comments</th><th>Shares</th><th>Views</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {[...posts]
                    .sort((a, b) => (engagement(b.stats) ?? -1) - (engagement(a.stats) ?? -1))
                    .map((p) => (
                      <tr key={p.id} className="border-t border-white/5">
                        <td className="max-w-sm py-2 pr-4">
                          <span className="text-zinc-200">{p.subject}</span>
                          <span className="block text-[11px] text-zinc-500">
                            {p.publishedAt ? new Date(p.publishedAt).toLocaleString() : "—"}
                            {p.url && <> · <a href={p.url} target="_blank" rel="noreferrer" className="underline">see it</a></>}
                          </span>
                        </td>
                        <td className="text-xs">{p.platform}</td>
                        <td className="text-xs">{p.language}</td>
                        {/* ⛔ "not recorded" is not a pool. Posts written before
                            18 Oct have no angle and must not be filed under one. */}
                        <td className="text-xs">{p.angle ?? <span className="text-zinc-600">not recorded</span>}</td>
                        <td className="text-xs">{p.hadCard ? "card" : p.shape === "none" ? "text" : p.shape}</td>
                        <td>{n(p.stats?.reactions)}</td><td>{n(p.stats?.comments)}</td>
                        <td>{n(p.stats?.shares)}</td><td>{n(p.stats?.impressions)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </section>

          <Explain q="Why does it say “—” instead of 0, and “not recorded” instead of an angle?">
            <p>
              They are different facts. A dash means nobody asked, or the platform declined to
              answer. A zero would mean we asked and nothing happened — and a column of invented
              zeros drags every average down and reads as a collapse.
            </p>
            <p>
              ⛔ “Not recorded” means the post was written before the angle was stored, on 18 Oct.
              It cannot be filled in: the rotation is computed from a post count that has since
              moved, so any value now would be a guess wearing a fact’s clothes.
            </p>
            <p>
              ⚠️ A breakdown shows how many posts it covers AND how many have figures yet. Three
              posts with two measured is not the same as three measured, and averaging over the
              larger number would quietly under-report anything recent.
            </p>
          </Explain>
        </>
      )}
    </SocialPage>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/20 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-zinc-500">{hint}</p>}
    </div>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: [string, { count: number; measured: number; engagement: number; views: number | null }][];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-zinc-400">{title}</h3>
      <table className="w-full text-left text-xs">
        <thead className="text-zinc-500">
          <tr><th className="py-1">&nbsp;</th><th>Posts</th><th>Measured</th><th>Engagement</th><th>Views</th></tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map(([k, v]) => (
            <tr key={k} className="border-t border-white/5">
              <td className="py-1 text-zinc-300">{k}</td>
              <td>{v.count}</td>
              {/* ⚠️ Said out loud: how many of those posts have any figures. */}
              <td className={v.measured < v.count ? "text-amber-300" : ""}>{v.measured}</td>
              <td>{v.measured === 0 ? "—" : v.engagement}</td>
              <td>{v.views === null ? "—" : v.views}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
