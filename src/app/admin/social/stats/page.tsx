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
import { LineChart, Bars, Proportion, Donut } from "@/app/admin/_components/charts";

type Channel = { id: string; platform: string; display_name: string; status: string };
type Day = {
  account_id: string;
  platform: string;
  captured_on: string;
  is_baseline: boolean;
  followers: number | null;
  impressions: number | null;
  reach: number | null;
  /** ⚠️ SIGNED. Instagram reports net new followers for a day and it can be
   *  negative; Facebook does not report it at all ⇒ null. */
  follower_change: number | null;
  posts_live: number | null;
};
type Stats = {
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  impressions: number | null;
  /** 🔑 Instagram's own. `saves` is what that channel ranks on, and what its
   *  voice was written for ⇒ platforms.ts. Facebook does not report either. */
  saves: number | null;
  reach: number | null;
};
type Post = {
  id: string; platform: string; language: string; angle: string | null; shape: string;
  subject: string; publishedAt: string | null; url: string | null; hadCard: boolean; stats: Stats | null;
};

/** ⛔ "—", never 0. A figure nobody captured is not a measurement of nothing. */
const n = (v: number | null | undefined) => (typeof v === "number" ? v.toLocaleString() : "—");

/**
 * Everything somebody actually DID, summed over whatever was measured.
 *
 * ⚠️ SAVES ARE INCLUDED, and they are Instagram-only. ⛔ Which means this
 * number is not strictly comparable between channels — Facebook cannot report
 * a save and Instagram does not report a share here. That is said on the
 * screen rather than hidden, because the alternative is dropping the one
 * figure the Instagram voice was written to earn.
 *
 * ⚠️ null unless at least one part was measured: a post nobody has read
 * figures for is not a post with no engagement.
 */
function engagement(s: Stats | null): number | null {
  if (!s) return null;
  const parts = [s.reactions, s.comments, s.shares, s.saves].filter(
    (x): x is number => typeof x === "number",
  );
  return parts.length === 0 ? null : parts.reduce((a, b) => a + b, 0);
}

/** ⛔ Sums only what was measured, and returns null when nothing was. A zero
 *  here would be indistinguishable from "we asked and nobody did anything". */
function sumMeasured(values: (number | null | undefined)[]): number | null {
  const real = values.filter((v): v is number => typeof v === "number");
  return real.length === 0 ? null : real.reduce((a, b) => a + b, 0);
}

/** A stable colour per channel, so the same channel is the same colour in
 *  every chart on the page. ⚠️ Keyed by platform, not by row order. */
const CHANNEL_COLOUR: Record<string, string> = {
  facebook: "#60A5FA",
  instagram: "#F472B6",
  linkedin: "#38BDF8",
  x: "#A3A3A3",
  youtube: "#F87171",
};
const colourFor = (platform: string) => CHANNEL_COLOUR[platform] ?? "#A5B4FC";

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
  /**
   * 🔑 THE OWNER, 18 Oct: "create separate filter to see different social
   * media reports and create a consolidated report or overview as well with a
   * filter all."
   *
   * ⚠️ "all" is the default and shows the consolidated view FIRST, because
   * the question somebody opens this page with is usually "is any of this
   * working", not "how is Instagram doing".
   */
  const [only, setOnly] = useState<string>("all");

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
  /** ⚠️ What the filter is actually showing. "all" means every measured one. */
  const shown = only === "all" ? measured : measured.filter((c) => c.id === only);
  const shownPlatforms = new Set(shown.map((c) => c.platform));
  const shownPosts = posts.filter((p) => shownPlatforms.has(p.platform));

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

          {measured.length > 0 && (
            <ChannelFilter channels={measured} only={only} onChange={setOnly} posts={posts} />
          )}

          {/* 🔑 THE CONSOLIDATED VIEW, and only when there is something to
              consolidate. ⛔ With one channel it would be the same numbers
              twice, which teaches somebody to skip the top of the page. */}
          {only === "all" && measured.length > 1 && (
            <Consolidated channels={measured} days={days} posts={posts} />
          )}

          {/* 🔑 ONE SECTION PER CHANNEL. The first version of this screen had
              one set of figures for everything, which with two channels would
              have shown whichever row happened to be last. */}
          {shown.map((c) => {
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
                  {/* 🔑 Instagram ranks on SAVES far more than on likes, and
                      the channel's voice was rewritten for exactly that, so
                      the figure that judges the writing sits beside the rest.
                      ⛔ Only where the channel reports one. */}
                  {mineP.some((p) => typeof p.stats?.saves === "number") ? (
                    <Tile
                      label="Saves"
                      value={n(sumMeasured(mineP.map((p) => p.stats?.saves ?? null)))}
                      hint="people who kept it"
                    />
                  ) : (
                    <Tile label="Views yesterday" value={n(now?.impressions)} hint="times shown" />
                  )}
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

                {/* 🔑 THE TWO FIGURES THAT MEAN SOMETHING ON DAY ONE.
                    A line chart needs weeks; a proportion needs one reading.
                    ⛔ So these are shown first and always, and the lines above
                    only once there is more than a single point to join. */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 rounded-lg border border-white/8 bg-black/20 p-3">
                    <h3 className="text-xs font-semibold text-zinc-400">How far it reached</h3>
                    <Proportion value={now?.reach ?? null} of={now?.followers ?? null} label="Of your own audience" />
                    <p className="text-[11px] text-zinc-500">
                      ⚠️ Reach is distinct people. Going past 100% is the interesting day — it means
                      people who do not follow the page were shown something.
                    </p>
                  </div>
                  <div className="space-y-2 rounded-lg border border-white/8 bg-black/20 p-3">
                    <h3 className="text-xs font-semibold text-zinc-400">How often each person saw it</h3>
                    {/* ⚠️ views ÷ reach. ⛔ Null unless BOTH were measured —
                        a ratio built on one real number is not a ratio. */}
                    {typeof now?.impressions === "number" && typeof now?.reach === "number" && now.reach > 0 ? (
                      <>
                        <p className="text-2xl font-semibold tabular-nums">
                          {(now.impressions / now.reach).toFixed(1)}×
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {n(now.impressions)} views spread across {n(now.reach)} people. Much above
                          ~2× usually means the same small group seeing it repeatedly rather than it
                          travelling.
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-zinc-500">— (not measured)</p>
                    )}
                  </div>
                </div>

                {/* 🔑 BARS, NOT A LINE. A line implies an order between its
                    points; "by angle" and "by language" have none, and drawing
                    them joined invites somebody to read a slope that is not
                    there. */}
                <Breakdown title="By angle" rows={groupBy(mineP, (p) => p.angle)} />
                <Breakdown title="By language" rows={groupBy(mineP, (p) => p.language)} />
                <Breakdown title="By shape" rows={groupBy(mineP, (p) => p.shape)} />

                {mineP.some((p) => engagement(p.stats) !== null) && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-zinc-400">Engagement per post</h3>
                    <Bars
                      unit="reactions + comments + shares"
                      rows={mineP.slice(0, 12).map((p) => ({
                        label: p.subject,
                        value: engagement(p.stats),
                        note: p.hadCard ? "card" : "text",
                      }))}
                    />
                  </div>
                )}
              </section>
            );
          })}

          <section className="overflow-x-auto rounded-xl border border-white/8 bg-white/5 p-5">
            <h2 className="mb-1 text-sm font-semibold">Every post, best first</h2>
            <p className="mb-3 text-xs text-zinc-500">
              Sorted by reactions + comments + shares. ⚠️ A post measured today and one published an
              hour ago are not comparable — the figures keep moving for days.
            </p>
            {shownPosts.length === 0 ? (
              <p className="text-sm text-zinc-500">
                {posts.length === 0
                  ? "Nothing has been published yet."
                  : "Nothing published on this channel yet."}
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-zinc-500">
                  <tr>
                    <th className="py-1">Post</th><th>Channel</th><th>Lang</th><th>Angle</th><th>Shape</th>
                    {/* 🔑 Saves is Instagram's number and the one its voice
                        was written to earn. ⛔ "—" on Facebook, which cannot
                        report one — not 0, which would read as nobody saved it. */}
                    <th>Reactions</th><th>Comments</th><th>Shares</th><th>Saves</th><th>Reach</th><th>Views</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {[...shownPosts]
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
                        <td>{n(p.stats?.shares)}</td>
                        <td className={typeof p.stats?.saves === "number" ? "text-pink-300" : ""}>
                          {n(p.stats?.saves)}
                        </td>
                        <td>{n(p.stats?.reach)}</td><td>{n(p.stats?.impressions)}</td>
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
      {/* ⚠️ The bars compare at a glance; the table keeps the exact figures
          and the `measured` count, which a bar cannot show without lying. */}
      <Bars
        unit="posts"
        color="#A5B4FC"
        rows={rows.map(([k, v]) => ({ label: k, value: v.count, note: v.measured < v.count ? `${v.measured} measured` : undefined }))}
      />
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

/**
 * The channel filter.
 *
 * 🔑 THE OWNER, 18 Oct: "create separate filter to see different social media
 * reports and create a consolidated report or overview as well with a filter
 * all."
 *
 * ⚠️ Each pill carries its own post count, so choosing is informed rather
 * than a guess — "Instagram (1)" tells you there is almost nothing there yet
 * before you click and find an empty page.
 */
function ChannelFilter({
  channels,
  only,
  onChange,
  posts,
}: {
  channels: Channel[];
  only: string;
  onChange: (v: string) => void;
  posts: Post[];
}) {
  const options = [
    { id: "all", label: "All channels", platform: null as string | null, count: posts.length },
    ...channels.map((c) => ({
      id: c.id,
      label: c.display_name,
      platform: c.platform,
      count: posts.filter((p) => p.platform === c.platform).length,
    })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Which channel to report on">
      {options.map((o) => {
        const active = only === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm transition ${
              active
                ? "border-indigo-500 bg-indigo-950/40 text-zinc-100"
                : "border-white/8 text-zinc-400 hover:bg-white/5"
            }`}
          >
            {o.platform && (
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: colourFor(o.platform) }}
              />
            )}
            {o.label}
            <span className="text-xs text-zinc-500">{o.count}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Everything, together.
 *
 * ⛔ THE HONESTY PROBLEM THIS SECTION HAS AND THE PER-CHANNEL ONES DO NOT:
 * some of these figures CANNOT BE ADDED UP without lying, and the ones that
 * cannot are labelled rather than quietly summed:
 *
 *   • followers add correctly — they are different accounts;
 *   • reach does NOT. The same person may follow both, so summing counts them
 *     twice. It is shown as "across channels", never as distinct people;
 *   • engagement is summed over DIFFERENT metrics per channel — Facebook has
 *     no save, Instagram reports no share here.
 *
 * ⚠️ And a channel with no reading is left out of every total rather than
 * entered as zero, which would read as a collapse.
 */
function Consolidated({ channels, days, posts }: { channels: Channel[]; days: Day[]; posts: Post[] }) {
  const latestFor = (c: Channel) => {
    const mine = days.filter((d) => d.account_id === c.id);
    return { now: mine[mine.length - 1], base: mine.find((d) => d.is_baseline) ?? mine[0], all: mine };
  };

  const rows = channels.map((c) => {
    const { now, base, all } = latestFor(c);
    const mineP = posts.filter((p) => p.platform === c.platform);
    return {
      channel: c,
      colour: colourFor(c.platform),
      followers: now?.followers ?? null,
      baseline: base?.followers ?? null,
      reach: now?.reach ?? null,
      posts: mineP.length,
      engagement: sumMeasured(mineP.map((p) => engagement(p.stats))),
      series: all.filter((d) => d.followers !== null),
    };
  });

  const followers = sumMeasured(rows.map((r) => r.followers));
  const baseline = sumMeasured(rows.map((r) => r.baseline));
  const grew = followers !== null && baseline !== null ? followers - baseline : null;
  const reach = sumMeasured(rows.map((r) => r.reach));
  const totalPosts = rows.reduce((a, r) => a + r.posts, 0);
  const totalEngagement = sumMeasured(rows.map((r) => r.engagement));

  const audience = rows
    .filter((r) => typeof r.followers === "number" && r.followers > 0)
    .map((r) => ({ label: r.channel.display_name, value: r.followers as number, color: r.colour }));

  return (
    <section className="space-y-5 rounded-xl border border-indigo-500/25 bg-indigo-950/10 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">Everything together</h2>
        <Chip tone="indigo">{channels.length} channels</Chip>
        <span className="text-xs text-zinc-500">{totalPosts} post(s) published</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Tile label="Followers, all channels" value={n(followers)} hint={`across ${audience.length} measured`} />
        <Tile
          label="Since the baselines"
          value={grew === null ? "—" : grew > 0 ? `+${grew}` : String(grew)}
          hint={baseline === null ? undefined : `from ${n(baseline)} combined`}
        />
        {/* ⛔ The one that cannot honestly be called "people". */}
        <Tile label="Reach yesterday" value={n(reach)} hint="⚠️ summed, not distinct people" />
        <Tile label="Engagement measured" value={n(totalEngagement)} hint="reactions, comments, shares, saves" />
      </div>

      <p className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-200">
        ⚠️ Reach is added across channels, so somebody who follows two of them is counted twice —
        this is not a count of distinct people. ⛔ And engagement sums different things per channel:
        Facebook cannot report a save, Instagram does not report a share here.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-white/8 bg-black/20 p-4">
          <h3 className="text-xs font-semibold text-zinc-400">Where the audience is</h3>
          {audience.length > 0 ? (
            <Donut slices={audience} centreLabel="followers" centreValue={n(followers)} />
          ) : (
            <p className="text-sm text-zinc-500">— (not measured)</p>
          )}
        </div>

        <div className="space-y-4 rounded-lg border border-white/8 bg-black/20 p-4">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-zinc-400">Reach yesterday, by channel</h3>
            <Bars
              unit="distinct people on that channel"
              rows={rows.map((r) => ({ label: r.channel.display_name, value: r.reach }))}
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-zinc-400">Engagement, by channel</h3>
            <Bars
              unit="reactions + comments + shares + saves"
              rows={rows.map((r) => ({
                label: r.channel.display_name,
                value: r.engagement,
                note: `${r.posts} post(s)`,
              }))}
            />
          </div>
        </div>
      </div>

      {/* 🔑 ONE LINE PER CHANNEL, same colours as every other chart here.
          ⛔ Only drawn once some channel has more than one reading — a single
          point joined to nothing is a chart that invents a trend. */}
      {rows.some((r) => r.series.length > 1) && (
        <div className="space-y-2 rounded-lg border border-white/8 bg-black/20 p-4">
          <h3 className="text-xs font-semibold text-zinc-400">Followers over time</h3>
          <LineChart
            lines={rows
              .filter((r) => r.series.length > 1)
              .map((r) => ({
                label: r.channel.display_name,
                color: r.colour,
                points: r.series.map((d) => d.followers as number),
              }))}
            xFirst={rows.find((r) => r.series.length > 1)!.series[0].captured_on}
            xLast={
              rows.find((r) => r.series.length > 1)!.series.slice(-1)[0].captured_on
            }
          />
          <p className="text-[11px] text-zinc-500">
            ⚠️ The lines share an x-axis but not necessarily the same days — a channel connected
            later starts later, and its line is shorter rather than padded with zeros.
          </p>
        </div>
      )}
    </section>
  );
}
