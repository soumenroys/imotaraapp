-- docs/sql/social_card_store.sql
-- Somewhere to keep a card that cannot be drawn on demand.
--
-- 🔴 WHY THESE CARDS ARE STORED WHEN EVERY OTHER ONE IS DERIVED.
--
-- The Latin cards are rendered from the stored recipe each time they are
-- fetched, deliberately: a palette fix improves every past picture and nothing
-- has to be migrated. That is a good rule and it is NOT being abandoned here.
--
-- ⛔ It simply buys nothing for a Bengali card, because there is no Bengali
-- card. Satori does no complex-script shaping, so 21 of the 22 languages
-- cannot produce a picture at all — and Instagram has no text-only post, so
-- they cannot publish at all. A principle that improves pictures is worth
-- nothing to a language that has none.
--
-- ⚠️ THOSE CARDS NEED A BROWSER, and a browser must not be on the request
-- META MAKES. Instagram fetches the card URL itself; a Chromium cold start on
-- that request turns a design choice into a publish failure. ⇒ Rendered when
-- the post is APPROVED, which is a human action that can afford to take three
-- seconds, and the bytes kept here.
--
-- 🔑 PRIVATE, not public. The card is reached through /api/social/card/[id],
-- which checks an HMAC and the post's status before serving a byte. A public
-- bucket would be a second door onto the same pictures with no lock on it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social-cards',
  'social-cards',
  false,
  -- ⚠️ 8 MB. A 1080×1080 JPEG is ~100–300 KB; the limit is here to stop a bug
  -- filling the bucket, not because a card could legitimately be large.
  8388608,
  array['image/jpeg']
)
on conflict (id) do nothing;

-- 🔒 Service role only, like every other table in this feature. The app reads
-- these bytes and serves them through its own guarded route; nothing signed in
-- as a user ever touches the bucket directly.
drop policy if exists "social cards are service role only" on storage.objects;
create policy "social cards are service role only" on storage.objects
  for all
  using (bucket_id = 'social-cards' and auth.role() = 'service_role')
  with check (bucket_id = 'social-cards' and auth.role() = 'service_role');

-- `media_path` has existed since the first migration and has never been
-- written. This is what it was for.
comment on column social_posts.media_path is
  'Path in the social-cards bucket for a card that cannot be drawn on demand (a script Satori cannot shape). NULL means derive it from visual_recipe, which is the normal case.';
