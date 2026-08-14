-- connect_v42_grant_license_atomic.sql
-- P1-7 (code_review_audit_2026_08_14, finding A8): grantLicense() (src/lib/imotara/grantLicense.ts)
-- did a JS-level read-modify-write on licenses.token_balance and licenses.expires_at —
-- read current value, compute new value in JS, write it back in a separate UPDATE.
-- Two concurrent webhook deliveries for the same user (Razorpay does retry
-- payment.captured/order.paid; the existing payment_licenses dedup check only
-- protects against the SAME paymentId being processed twice, not two DIFFERENT
-- in-flight requests racing before either commits) could both read the same
-- starting value and either double-credit or lose an update, depending on
-- interleaving. Same non-atomic pattern existed on the subscription-stacking
-- path (expires_at), not just token_balance.
--
-- Fix: do the entire read+compute+write as a single atomic
-- INSERT ... ON CONFLICT (user_id) DO UPDATE statement, where the SET
-- expressions reference the table's own (old) committed column values
-- (`licenses.token_balance`, `licenses.expires_at`, `licenses.tier`) directly —
-- Postgres guarantees this is evaluated atomically per-row at conflict-resolution
-- time, so two concurrent calls can never observe or clobber each other's update.
-- No explicit locking needed; this is the standard safe idiom for read-combine-write.

CREATE OR REPLACE FUNCTION public.grant_license_atomic(
  p_user_id         uuid,
  p_is_subscription boolean,
  p_tier            text,     -- target tier for subscription grants; ignored for token packs
  p_days            integer,  -- days to extend for subscription grants; ignored for token packs
  p_tokens          integer,  -- tokens to add for token-pack grants; ignored for subscription grants
  p_source          text
)
RETURNS TABLE(out_tier text, out_token_balance integer, out_expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_is_subscription THEN
    INSERT INTO licenses (user_id, tier, status, expires_at, token_balance, source, updated_at)
    VALUES (p_user_id, p_tier, 'valid', now() + make_interval(days => p_days), 0, p_source, now())
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
      -- Stack renewals on top of the existing expiry when still active, otherwise from now.
      expires_at = GREATEST(COALESCE(licenses.expires_at, now()), now()) + make_interval(days => p_days),
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

GRANT EXECUTE ON FUNCTION public.grant_license_atomic(uuid, boolean, text, integer, integer, text) TO service_role;
