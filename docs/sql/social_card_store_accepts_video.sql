-- docs/sql/social_card_store_accepts_video.sql
-- Tell the bucket what the code has been sending it since the video work landed.
--
-- 🔴 THE DEFECT, live and blocking on 19 Oct. Approving a short_video failed
-- with:
--
--     The video could not be stored: mime type video/mp4 is not supported
--
-- ⚠️ AFTER FFMPEG HAD DONE ALL ITS WORK. The encode succeeded; the bytes were
-- refused at the door. Three rounds of debugging went into the encoder because
-- the error that mattered was the LAST step, not the slow one.
--
-- ⛔ THE CAUSE IS A CONSTRAINT NOBODY TOLD THE NEW FEATURE. `social-cards` was
-- created in social_card_store.sql with `allowed_mime_types = ['image/jpeg']`,
-- which was exactly right while the only thing in it was a JPEG card for a
-- script Satori cannot shape. Video storage was added to the SAME bucket later
-- and the bucket was never updated ⇒ trap_a_constraint_nobody_told_the_writer.
--
-- 🔑 And it was WRITTEN DOWN, in cardStore.ts, three functions above the code
-- that broke it: "`.jpg` because the bucket only accepts image/jpeg". A limit
-- that lives in a comment cannot be consulted by the code that must satisfy
-- it. ⇒ It is now `STORED_MIME_TYPES`, and a test holds this file against it.

update storage.buckets
set
  -- ⚠️ MUST MATCH `STORED_MIME_TYPES` in src/lib/social/cardStore.ts, which a
  -- test asserts by parsing this file. Adding a type in one place fails until
  -- it is added in the other.
  --
  -- 🔑 image/gif is here although nothing publishes a GIF today: a GIF only
  -- animates on X, and X does not publish yet. ⛔ It is allowed now because
  -- the admin preview can already ask for one, and because the alternative is
  -- discovering this same refusal a second time on the day X comes online.
  allowed_mime_types = array['image/gif', 'image/jpeg', 'video/mp4'],

  -- 🔑 50 MB, from a measurement rather than a round number. The queued
  -- Facebook post — four sentences, seven frames, 18.9s at 1200×630 — encodes
  -- to 106 KB silent, 150 KB at X's 1600×900. Narration re-times the scenes
  -- longer and adds AAC at 128 kbps, so even a three-minute narrated video is
  -- a few MB. ⛔ The ceiling stops a BUG filling the bucket; it is not a
  -- statement about how large a card should be.
  file_size_limit = 52428800
where id = 'social-cards';

-- ⛔ VERIFY, rather than trusting that the update matched a row. `update … where`
-- affecting nothing is silent, and this file is most likely to be run against a
-- project where the bucket is named differently or does not exist yet.
do $$
declare
  got text[];
  bytes bigint;
begin
  select allowed_mime_types, file_size_limit into got, bytes
  from storage.buckets where id = 'social-cards';

  if got is null then
    raise exception 'The social-cards bucket does not exist. ▶️ Run docs/sql/social_card_store.sql first.';
  end if;
  if not ('video/mp4' = any(got)) then
    raise exception 'social-cards still refuses video/mp4 — the update matched no row.';
  end if;
  raise notice 'social-cards accepts % at up to % bytes.', got, bytes;
end $$;
