-- docs/sql/social_post_angle.sql
--
-- 🔴 THE ANGLE WAS CHOSEN AND THROWN AWAY.
--
-- `nextPool()` picks one topic pool per post, hands it to the writer, and
-- nothing records which one it was. So "do the untranslatable-word posts
-- outperform the privacy posts?" — the question the whole angle-rotation work
-- of 18 Oct was in service of — is unanswerable for every post written before
-- this column exists.
--
-- ⛔ AND IT CANNOT BE BACKFILLED. The rotation is `pools[postCount % n]`, and
-- postCount has moved since; the pool list on the schedule has also changed.
-- Reconstructing it would be a guess wearing a fact's clothes.
--
-- ⚠️ Nullable on purpose: posts already published have no angle and must not
-- be given one. A NULL here means "written before we recorded this", which is
-- the truth, and the dashboard says so rather than filing them under a pool.
alter table social_posts
  add column if not exists topic_pool text;

comment on column social_posts.topic_pool is
  'Which angle this post was written from. NULL = written before 18 Oct 2026, when the angle was not recorded. ⛔ Never backfilled — the rotation cannot be reconstructed.';

create index if not exists social_posts_topic_pool_idx
  on social_posts (topic_pool, published_at desc);
