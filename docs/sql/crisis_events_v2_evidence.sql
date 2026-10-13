-- docs/sql/crisis_events_v2_evidence.sql
--
-- Turns crisis_events from "a crisis was DETECTED" into "this is WHAT WE DID
-- ABOUT IT" — the difference between a dashboard metric and usable evidence.
--
-- THREE GAPS THIS CLOSES (all found 2026-10-13):
--
--  1. GUESTS WERE NEVER LOGGED AT ALL. logCrisisEvent() began with
--     `if (!userId) return;`, so an anonymous visitor in crisis left no record
--     whatsoever — and a signed-out first-time visitor is exactly the person a
--     claim is most likely to involve.
--
--  2. preferred_lang IS NOT THE CARD'S LANGUAGE. The card resolves its own
--     language client-side (chat/page.tsx `bannerLang`), deliberately ignoring
--     the stored setting — that was the a6f167f fix, because "auto" was
--     collapsing to English. The server was logging body.lang, a different
--     value, so the column could say "en" while the person saw Bengali.
--
--  3. NOTHING RECORDED WHETHER THE CARD WAS ACTUALLY SHOWN, which tier fired,
--     or which helplines were displayed. "We detected it" is not a defence.
--     "We showed this person these numbers, in their language, at this time" is.
--
-- WHAT DELIBERATELY DOES NOT CHANGE: no message text is stored. That was the
-- owner's decision on 2026-08-14 and it remains correct — retaining the words
-- someone used while suicidal would create a far larger liability than it
-- discharges. Evidence here is about OUR conduct, not their disclosure.

ALTER TABLE crisis_events
    -- Guests. Mirrors terms_acceptances.anon_id so the two can be joined.
    ADD COLUMN IF NOT EXISTS anon_id           text,
    -- Did the card actually render? NULL = not reported (older rows).
    ADD COLUMN IF NOT EXISTS card_shown        boolean,
    -- The language the CARD resolved to — not the stored preference.
    ADD COLUMN IF NOT EXISTS card_lang         text,
    -- 1 = gentle, 2 = urgent/explicit.
    ADD COLUMN IF NOT EXISTS tier              smallint,
    -- Which country's helpline set was used.
    ADD COLUMN IF NOT EXISTS resources_country text,
    -- Which specific helplines were on screen, e.g. {in-emergency-112,in-tele-manas-14416}.
    ADD COLUMN IF NOT EXISTS resource_ids      text[];

-- Older rows predate the columns and legitimately have neither identifier set,
-- so this is NOT VALID: it binds new writes without rewriting history.
ALTER TABLE crisis_events
    DROP CONSTRAINT IF EXISTS crisis_events_has_subject;
ALTER TABLE crisis_events
    ADD CONSTRAINT crisis_events_has_subject
    CHECK (user_id IS NOT NULL OR anon_id IS NOT NULL) NOT VALID;

ALTER TABLE crisis_events
    DROP CONSTRAINT IF EXISTS crisis_events_tier_check;
ALTER TABLE crisis_events
    ADD CONSTRAINT crisis_events_tier_check
    CHECK (tier IS NULL OR tier IN (1, 2)) NOT VALID;

-- Dedup for guests mirrors the per-user one already in v1.
CREATE INDEX IF NOT EXISTS idx_crisis_events_anon_recent
    ON crisis_events (anon_id, created_at DESC);

-- "Show me every case where we failed to display a card" — the query you would
-- most want to be able to answer, and most want to return nothing.
CREATE INDEX IF NOT EXISTS idx_crisis_events_card_shown
    ON crisis_events (card_shown, created_at DESC);

COMMENT ON COLUMN crisis_events.card_lang IS
    'The language the crisis card actually rendered in, as reported by the client that rendered it. NOT the user''s stored preference — the card resolves its own language (a6f167f). Logging the preference here would be misleading evidence.';
COMMENT ON COLUMN crisis_events.card_shown IS
    'True when the client confirmed the card was displayed. NULL means not reported (rows written before this column, or a client that never called back).';
COMMENT ON COLUMN crisis_events.resource_ids IS
    'Ids from src/lib/safety/crisisResources.ts that were on screen, so the exact numbers shown can be reconstructed later even if the helpline list changes.';
