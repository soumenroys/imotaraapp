-- docs/sql/social_content_mix.sql
-- A schedule can rotate through SEVERAL shapes instead of always making one.
--
-- 🔑 THE OWNER, 19 Oct: "randomly mix text+graphics and videos in content."
--
-- ⛔ `content_type` is ONE value, so there was nothing to mix with: the whole
-- queue was `graphic`, 22 of 22. This adds the set.
--
-- ⚠️ ROTATION, NOT `random()`. The pick happens in CODE, by position in the
-- run, for the same reason the ANGLE does ⇒ trap_a_menu_handed_to_a_model_is_
-- not_a_rotation. True randomness over two values produces four videos in a
-- row often enough to notice, and "why is it all videos this week" is a
-- question with no answer when the cause is a coin flip. A rotation cannot do
-- that and needs no explaining.
--
-- 🔑 WEIGHTING IS BY REPETITION, which is why this is an array and not a
-- ratio column. Two parts graphic to one part video is written exactly as it
-- reads:
--
--     '{text_graphic,text_graphic,short_video}'
--
-- ⇒ The owner can change the balance by editing one row, with no deploy and
-- no new concept to learn.

alter table social_schedules
  add column if not exists content_mix text[];

comment on column social_schedules.content_mix is
  'Shapes this schedule rotates through, one per post, in order. NULL means '
  'use content_type for every post, which is the behaviour before 19 Oct. '
  'Repeat a value to weight it. Every entry must be publishable on every '
  'platform this schedule posts to ⇒ src/lib/social/mediaPlan.ts.';

/**
 * ⛔ THE SAME VOCABULARY AS `content_type`, enforced here too.
 *
 * 🔴 This list already had FIVE copies and the one that was missed made a
 * whole feature unreachable ⇒ the header of src/lib/social/contentTypes.ts.
 * ⚠️ A sixth copy is not ideal, and it is unavoidable: a CHECK constraint
 * cannot import TypeScript. ⇒ It is written out so that a typo in a row is
 * refused by the database rather than discovered when a post will not render.
 */
alter table social_schedules
  drop constraint if exists social_schedules_content_mix_known;
alter table social_schedules
  add constraint social_schedules_content_mix_known check (
    content_mix is null
    or (
      array_length(content_mix, 1) between 1 and 12
      and content_mix <@ array[
        'text', 'text_graphic', 'graphic', 'short_video', 'animated_gif', 'carousel'
      ]::text[]
    )
  );

-- ── What the owner asked for, on both live channels ─────────────────────────
--
-- ⚠️ ONE FOR ONE, alternating. "Mix" read plainly is an even mix; the balance
-- is a row edit away if a video every other day proves to be more than the
-- review queue wants.
--
-- ⛔ NOT carousel. It is built and unused, and on Instagram it is measured at
-- roughly 9× the saves — but it only works written from the `ways-of-saying`
-- pool, which neither schedule draws from and which needs its own brief
-- ⇒ social_platform_rules_reviewed_2026_10_19. Adding it here would produce
-- carousels written from angles that are not shaped for them.
update social_schedules
set content_mix = array['text_graphic', 'short_video']
where active and platforms && array['facebook', 'instagram'];

do $$
declare n int;
begin
  select count(*) into n from social_schedules where content_mix is not null;
  raise notice '% schedule(s) now rotate their shape.', n;
end $$;
