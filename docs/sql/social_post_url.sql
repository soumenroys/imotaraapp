-- docs/sql/social_post_url.sql
--
-- 🔴 THE LINK WAS CONSTRUCTED, AND ONLY FACEBOOK'S SHAPE WAS KNOWN.
--
-- The analytics screen built every post's "see it" link as
-- `facebook.com/<external_post_id>`. With one channel that was merely
-- fragile; the moment Instagram published, it pointed every Instagram post at
-- a Facebook URL that does not exist.
--
-- 🔑 AND INSTAGRAM'S CANNOT BE CONSTRUCTED AT ALL. A media id is 17-odd
-- digits; a permalink is `instagram.com/p/<shortcode>/`, and the shortcode is
-- not derivable from the id. The platform returns the permalink at publish
-- time and that is the only moment it is free to ask for.
--
-- ⚠️ NULLABLE, and null for every post published before this column existed.
-- ⛔ Not backfilled with a guess: a link that goes to the wrong place is worse
-- than no link, because somebody clicks it.
--
-- ⛔ RE-RUNNABLE.
alter table social_posts add column if not exists external_url text;

comment on column social_posts.external_url is
  'The permalink the platform returned when it published. ⛔ Never constructed from an id — '
  'Instagram''s shortcode is not derivable from its media id. NULL means it was not captured.';
