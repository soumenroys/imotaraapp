-- docs/sql/social_split_schedule_per_channel.sql
-- One schedule per channel, from the one shared schedule that exists today.
--
-- The owner, 19 Oct: "Ensure Scheduler is working for every social media
-- separately, not as one schedule for all social medias."
--
-- 🔑 WHY IT MATTERS, beyond tidiness. A shared schedule shares its BRIEF, its
-- content type, its angles and its languages — only the clock could differ,
-- through `platform_times`. So "a carousel on Instagram, written from an angle
-- shaped for a list" was unaskable: choosing it would have changed Facebook
-- too. After this, the two channels can differ in WHAT THEY SAY, not only in
-- when they say it.
--
-- 🔴 THE TRAP THIS SCRIPT EXISTS TO AVOID — DUPLICATE PUBLIC POSTS.
--
-- The queue decides what to write by asking which (schedule, platform, time)
-- slots have no post ⇒ src/lib/social/horizon.ts. The schedule id is PART OF
-- THAT KEY. So simply creating a new Instagram schedule would make every
-- Instagram post already queued under the old id look MISSING, and the cron
-- would cheerfully write a second post for the same minute. Two posts, same
-- time, same channel, on a public timeline — and nothing would look wrong
-- until they both went out.
--
-- ⇒ Which is why step 3 is not optional and not cosmetic.
--
-- ⚠️ SAFE TO RUN TWICE. The guard at the top stops after the first run.
-- ⛔ Nothing here deletes a post or changes a word anybody wrote.

do $$
declare
  shared_id uuid;
  ig_id     uuid;
begin
  -- The shared schedule: two or more channels on one row.
  select id into shared_id
    from social_schedules
   where array_length(platforms, 1) > 1
     and 'instagram' = any(platforms)
   limit 1;

  if shared_id is null then
    raise notice 'Nothing to split — no schedule drives more than one channel. (Already run?)';
    return;
  end if;

  -- ── 1. Instagram gets its own schedule, copied from the shared one ────────
  -- ⚠️ A COPY, not a blank. Everything it says today keeps saying, and the
  -- owner changes the brief, the pools or the shape afterwards IF they want
  -- to — a split that also changed the content would make it impossible to
  -- tell which change caused what.
  --
  -- 🔑 17:00 is Instagram's own time, lifted out of `platform_times` where it
  -- was an override on somebody else's schedule.
  insert into social_schedules (
    name, brief, platforms, content_type, topic_pool, tone, length_hint,
    languages, wordmark_follows_language, post_at, timezone, days,
    active, auto_publish, created_by
  )
  select
    name || ' — Instagram',
    brief,
    array['instagram'],
    content_type,
    topic_pool,
    tone,
    length_hint,
    languages,
    wordmark_follows_language,
    coalesce((platform_times -> 'instagram' ->> 'post_at')::time, post_at),
    timezone,
    days,
    active,
    -- ⛔ Carried over as-is. This script must not switch auto-publishing ON
    -- for a channel; that is a decision a person makes, once, deliberately.
    auto_publish,
    created_by
  from social_schedules
  where id = shared_id
  returning id into ig_id;

  -- ── 2. The original becomes Facebook's alone ──────────────────────────────
  update social_schedules
     set platforms      = array['facebook'],
         -- ⚠️ The override is gone because there is nothing left to override.
         platform_times = null,
         name           = name || ' — Facebook',
         updated_at     = now()
   where id = shared_id;

  -- ── 3. REPOINT WHAT IS ALREADY QUEUED ─────────────────────────────────────
  -- 🔴 THE STEP THAT PREVENTS A DUPLICATE PUBLIC POST. Without it every
  -- Instagram post already written looks like an empty slot to the new
  -- schedule, and the cron writes a second one for the same minute.
  update social_posts
     set schedule_id = ig_id
   where platform = 'instagram'
     and schedule_id = shared_id;

  -- ⚠️ And the back-off bookkeeping, or a slot that has been failing starts
  -- again from zero and hammers the model ⇒ docs/sql/social_slot_attempts.sql.
  update social_slot_attempts
     set schedule_id = ig_id
   where platform = 'instagram'
     and schedule_id = shared_id;

  -- ⚠️ The subject register is keyed GLOBALLY on subject_hash, so repointing
  -- it changes no behaviour — but a row pointing at the wrong schedule is a
  -- lie that somebody will read one day.
  update social_topics_used t
     set schedule_id = ig_id
    from social_posts p
   where t.post_id = p.id
     and p.platform = 'instagram'
     and t.schedule_id = shared_id;

  raise notice 'Split done. Facebook keeps %, Instagram is now %.', shared_id, ig_id;
end $$;

-- What you should see: two rows, one channel each, Instagram at 17:00 and
-- Facebook at 17:30, and no post left pointing at the wrong one.
select s.name, s.platforms, s.post_at, s.active, s.auto_publish,
       count(p.id) filter (where p.scheduled_for >= now()) as queued_ahead
  from social_schedules s
  left join social_posts p on p.schedule_id = s.id
 group by s.id, s.name, s.platforms, s.post_at, s.active, s.auto_publish
 order by s.post_at;
