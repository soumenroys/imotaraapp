-- docs/sql/social_reaction_sign.sql
-- The SIGN of a reaction, not just its size.
--
-- 🔴 WHY THIS MATTERS MORE HERE THAN ALMOST ANYWHERE.
--
-- `social_post_stats.reactions` holds a total. Forty reactions reads as a
-- post that did well — and forty ANGRY and SAD reactions on a mental-health
-- post means something has gone wrong. Until now those were the same number.
--
-- ⛔ A FEEDBACK LOOP THAT REWARDS ENGAGEMENT WITHOUT READING ITS SIGN would
-- treat a post people are upset by as a success and ask for more like it.
-- That is not a hypothetical failure mode of recommender systems; it is the
-- best-documented one. ⇒ src/lib/social/learning.ts now subtracts.
--
-- ⚠️ NULLABLE, AND NULL IS NOT ZERO. Every row captured before today has no
-- breakdown, and an older post or a permission change can fail to return one.
-- A null must read as "not measured", never as "nobody was angry" — which is
-- the reassuring answer and the wrong one.
--
-- ⛔ Instagram has no equivalent: its API reports likes, not types. These stay
-- null for Instagram posts, and the code must not infer calm from that.

alter table social_post_stats add column if not exists angry int;
alter table social_post_stats add column if not exists sad   int;
alter table social_post_stats add column if not exists love  int;

comment on column social_post_stats.angry is
  'Facebook ANGRY reactions. NULL = not measured (older row, or the edge did not answer), never "none".';
comment on column social_post_stats.sad is
  'Facebook SAD reactions. NULL = not measured. ⚠️ Sad is not automatically bad on this brand — read it with the others.';
comment on column social_post_stats.love is
  'Facebook LOVE reactions. The positive counterweight, so a ratio can be taken rather than a bare count.';
