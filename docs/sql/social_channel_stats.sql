-- docs/sql/social_channel_stats.sql
--
-- 🔑 THE OWNER'S ASK, 18 Oct: "whenever you connect any social media channel,
-- take the stock of that channel and store that. then after everyday's post
-- update the statistics ... so that we can do analytics to check how this
-- scheduler is performing."
--
-- 🔴 WHY A BASELINE MATTERS MORE THAN THE DAILY NUMBERS. Without the figure
-- from BEFORE the scheduler started, every later number is unreadable: 63
-- followers is a success or a disappointment depending entirely on what it was
-- the day before we began. A baseline cannot be taken retroactively, which is
-- why it is captured the moment a channel is connected rather than when
-- somebody first wants a chart.
--
-- ⚠️ AND THE HONEST LIMIT, recorded here so nobody reads these tables as more
-- than they are: the Page had ~50 followers on 18 Oct. ONE person is 2%. For a
-- long while these numbers will be directional at best, and anything that
-- looks like a trend over a few days is noise.
--
-- ⛔ RE-RUNNABLE. Every statement is IF NOT EXISTS or a named constraint.

-- ── 1. THE CHANNEL, DAY BY DAY ───────────────────────────────────────────────
create table if not exists social_channel_stats (
  id             uuid        primary key default gen_random_uuid(),
  account_id     uuid        not null references social_accounts(id) on delete cascade,
  platform       text        not null,

  -- ⚠️ A DATE, not a timestamp, and it is the key. Two captures on one day are
  -- the same day's figure, not two data points — the second simply corrects
  -- the first. A timestamp key would quietly turn a retry into a duplicate
  -- reading and make every average wrong.
  captured_on    date        not null default (now() at time zone 'utc')::date,

  -- 🔑 The first capture for a channel, ever. ⛔ Never overwritten by a later
  -- capture on the same day: the VALUES may be corrected, but the fact that
  -- this row is the starting line may not be erased.
  is_baseline    boolean     not null default false,

  followers      int,
  fans           int,
  -- How many of OUR posts were live when this was taken. ⚠️ Makes the follower
  -- line readable: a jump with no posts behind it came from somewhere else.
  posts_live     int,

  -- Everything the platform actually returned, unparsed. ⛔ Kept because the
  -- fields we think matter today are not the fields we will wish we had.
  raw            jsonb,
  note           text,
  created_at     timestamptz not null default now(),

  constraint social_channel_stats_one_per_day unique (account_id, captured_on)
);

create index if not exists social_channel_stats_account_idx
  on social_channel_stats (account_id, captured_on desc);

alter table social_channel_stats enable row level security;

-- ── 2. EACH POST, DAY BY DAY ─────────────────────────────────────────────────
--
-- 🔑 A post's numbers keep moving for days after it goes out, so this is a
-- SERIES per post, not one row. The shape of that curve is the only way to
-- tell a post that landed from a post that was merely seen early.
create table if not exists social_post_stats (
  id             uuid        primary key default gen_random_uuid(),
  post_id        uuid        not null references social_posts(id) on delete cascade,
  captured_on    date        not null default (now() at time zone 'utc')::date,

  reactions      int,
  comments       int,
  shares         int,
  -- ⛔ NULL until the token carries `read_insights`. Stored as NULL rather
  -- than 0, because "we could not ask" and "nobody saw it" are different
  -- facts and a zero here would be a lie that averages into every chart.
  impressions    int,

  raw            jsonb,
  created_at     timestamptz not null default now(),

  constraint social_post_stats_one_per_day unique (post_id, captured_on)
);

create index if not exists social_post_stats_post_idx
  on social_post_stats (post_id, captured_on desc);

alter table social_post_stats enable row level security;

-- ── 3. NO PUBLIC READ ────────────────────────────────────────────────────────
--
-- ⛔ Both tables are reached only by the service role, exactly like
-- social_accounts. There is no policy granting anon or authenticated anything,
-- and RLS being ON with no policy means no row is readable
-- ⇒ security_review_findings_2026_10_16, where a table with RLS on and a
-- permissive policy was mistaken for a protected one.
