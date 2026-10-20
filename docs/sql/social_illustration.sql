-- docs/sql/social_illustration.sql
--
-- 🔑 THE BACKGROUND PICTURE A POST WAS GIVEN.
--
-- The owner, 20 Oct 2026, looking at the live feed: "all posts still looks
-- very similar … we need to create more enriched content for Imotara not
-- similar kind of posts everyday." Every card until now is type on a flat
-- colour. This column records the picture behind the words.
--
-- ⛔ ONE JSONB COLUMN, NOT FIVE. The style, the measured ink, the veil and the
-- stored path are one decision taken at one moment, and they are only ever
-- read together. Splitting them invites a row where the ink was measured from
-- a picture the path no longer points at.
--
-- ⚠️ NULLABLE, AND NULL IS NORMAL. A post without a background composes
-- exactly the card this product published all week, so generation failing — a
-- model outage, a storage hiccup, a safety refusal — costs a nicer picture and
-- never a slot.
--
-- Shape:
--   {
--     "path":  "<post-id>/background.jpg",   -- in the social-cards bucket
--     "style": "night-window",               -- illustrationStyles.ts
--     "zone":  "top",                        -- where the words go
--     "ink":   "light",                      -- MEASURED, never guessed
--     "scrim": 0,                            -- veil over the zone only
--     "measured": { "mean": 12.7, "sd": 2.7 }
--   }

alter table social_posts
  add column if not exists illustration jsonb;

comment on column social_posts.illustration is
  'The background picture and how to write on it. Null means a plain card, which is normal. ink and scrim are measured from the stored image by backgroundPlan.planBackground — never guessed.';
