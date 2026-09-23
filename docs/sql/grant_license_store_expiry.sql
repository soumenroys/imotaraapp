-- grant_license_store_expiry.sql
--
-- 🔴 THE BUG. grant_license_atomic extends a subscription by p_days — a number
-- taken from OUR catalog (31 or 366). For Apple and Google Play that is a guess
-- about what the store did, and introductory offers make the guess wrong:
-- a 7-day free trial would grant 31 DAYS of Plus. Cancel on day 2 and keep 29
-- free days, once per account, repeatably.
--
-- It has never cost anything, because every purchase so far paid full price for
-- the full period, so catalog days and store expiry agreed. Introductory offers
-- (approved 2026-09-24) are what make them disagree.
--
-- The store already tells us the truth and we were discarding it:
--   * Play  — verifySubscription() reads lineItems[0].expiryTime and RETURNS it;
--             the verify route dropped it on the floor.
--   * Apple — verifyAppleTransaction() parses the signed JWS, which carries
--             expiresDate, and returned only productId.
--
-- ── The change ──────────────────────────────────────────────────────────────
-- A new p_expires_at argument. When the caller knows the store's absolute
-- expiry it passes it, and that is used instead of counting days forward.
-- Razorpay and Stripe have no store expiry, pass NULL, and keep the exact
-- day-counting behaviour they have today.
--
-- 🔑 IT NEVER SHORTENS AN ENTITLEMENT. GREATEST() against the existing expiry
-- is deliberate: someone holding a Razorpay licence until 2027 who then starts
-- an Apple trial must not be cut back to the trial's end date. This mirrors the
-- "never downgrade" rule already applied to tier below.
--
-- ── Deploy order (there is no window where grants fail) ─────────────────────
--   1. Run THIS file. It adds a 7-argument overload; the live 6-argument
--      function is untouched and keeps serving the deployed code.
--   2. Deploy the application code, which calls the 7-argument form.
--   3. Once step 2 is live and healthy, run the DROP at the bottom.
--
-- ⚠️ The new argument has NO DEFAULT, on purpose. A default would make a
-- 6-argument call ambiguous between the two overloads and Postgres would
-- reject it — which is precisely the live traffic we are protecting in step 1.

CREATE OR REPLACE FUNCTION public.grant_license_atomic(
  p_user_id         uuid,
  p_is_subscription boolean,
  p_tier            text,        -- target tier for subscription grants; ignored for token packs
  p_days            integer,     -- days to extend when p_expires_at is NULL; ignored for token packs
  p_tokens          integer,     -- tokens to add for token-pack grants; ignored for subscription grants
  p_source          text,
  p_expires_at      timestamptz  -- the STORE's absolute expiry, or NULL to count p_days forward
)
RETURNS TABLE(out_tier text, out_token_balance integer, out_expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_is_subscription THEN
    INSERT INTO licenses (user_id, tier, status, expires_at, token_balance, source, updated_at)
    VALUES (
      p_user_id, p_tier, 'valid',
      COALESCE(p_expires_at, now() + make_interval(days => p_days)),
      0, p_source, now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      -- Never downgrade: keep the existing tier if it already outranks the new one.
      tier = CASE
        WHEN (CASE p_tier
                WHEN 'free' THEN 0 WHEN 'plus' THEN 1 WHEN 'pro' THEN 2
                WHEN 'family' THEN 3 WHEN 'edu' THEN 4 WHEN 'enterprise' THEN 5 ELSE 0 END)
             >=
             (CASE licenses.tier
                WHEN 'free' THEN 0 WHEN 'plus' THEN 1 WHEN 'pro' THEN 2
                WHEN 'family' THEN 3 WHEN 'edu' THEN 4 WHEN 'enterprise' THEN 5 ELSE 0 END)
        THEN p_tier
        ELSE licenses.tier
      END,
      status     = 'valid',
      expires_at = CASE
        -- The store is authoritative. Take its date, but never shorten an
        -- entitlement the user already holds from another rail.
        WHEN p_expires_at IS NOT NULL
          THEN GREATEST(COALESCE(licenses.expires_at, now()), p_expires_at)
        -- No store expiry (Razorpay, Stripe): stack renewals on top of the
        -- existing expiry when still active, otherwise from now. Unchanged.
        ELSE GREATEST(COALESCE(licenses.expires_at, now()), now()) + make_interval(days => p_days)
      END,
      source     = p_source,
      updated_at = now();
  ELSE
    INSERT INTO licenses (user_id, tier, status, token_balance, source)
    VALUES (p_user_id, 'free', 'valid', p_tokens, p_source)
    ON CONFLICT (user_id) DO UPDATE SET
      token_balance = licenses.token_balance + p_tokens,
      updated_at    = now();
  END IF;

  RETURN QUERY SELECT tier, token_balance, expires_at FROM licenses WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION
  public.grant_license_atomic(uuid, boolean, text, integer, integer, text, timestamptz)
  TO service_role;

-- ── STEP 3 — run only after the new code is live and healthy ────────────────
-- Removes the old 6-argument overload. Until this runs, both exist; that is
-- intentional and safe, since the argument lists are unambiguous.
--
--   DROP FUNCTION IF EXISTS
--     public.grant_license_atomic(uuid, boolean, text, integer, integer, text);
