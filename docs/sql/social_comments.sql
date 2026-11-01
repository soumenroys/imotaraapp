-- docs/sql/social_comments.sql
-- Comments people leave under our Facebook and Instagram posts, and what was
-- done about each (#51, owner 31 Oct + 1 Nov 2026).
--
-- One row per comment, ever (unique platform + comment_id) — so a comment is
-- hidden, answered or drafted ONCE, however often the job runs.
--
-- kind:   team | spam | crisis | genuine   (lib/social/comments/classify.ts)
-- status: skipped | hidden | crisis_replied | draft | sent | rejected | failed
--
-- ⛔ Service role only. The text is public on the platform, but this table is
-- ours: no anon, no signed-in user.
--
-- Run once in the Supabase SQL editor. Safe to run again.

create table if not exists public.social_comments (
    id            uuid        primary key default gen_random_uuid(),
    platform      text        not null,
    comment_id    text        not null,
    post_id       text        not null,
    post_snippet  text,
    author        text,
    text          text        not null default '',
    commented_at  timestamptz,
    kind          text        not null,
    status        text        not null,
    draft         text,
    language      text,
    reply_id      text,
    note          text,
    decided_by    text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),

    constraint social_comments_once       unique (platform, comment_id),
    constraint social_comments_platform   check (platform in ('facebook', 'instagram')),
    constraint social_comments_kind       check (kind in ('team', 'spam', 'crisis', 'genuine')),
    constraint social_comments_status     check (status in ('skipped', 'hidden', 'crisis_replied', 'draft', 'sent', 'rejected', 'failed'))
);

comment on table public.social_comments is
    'Comments under our FB/IG posts and what was done about each. Service role only. See docs/sql/social_comments.sql.';

create index if not exists social_comments_status_idx on public.social_comments (status, created_at desc);

alter table public.social_comments enable row level security;

-- ⚠️ From 30 Oct 2026 a new table needs its grants spelled out, service_role too.
revoke all on public.social_comments from anon, authenticated;
grant select, insert, update, delete on public.social_comments to service_role;
