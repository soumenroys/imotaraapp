-- connect_v22_grant_rpc_functions.sql
-- Fixes identified in Round-60 schema audit.
-- Run in Supabase SQL editor after connect_v21_grant_increment_sessions_completed.sql.
--
-- Summary of changes:
-- Four SECURITY DEFINER functions were defined without GRANT EXECUTE TO service_role.
-- Without these grants, service-role .rpc() calls return "permission denied",
-- causing the following silent failures in production:
--
--   get_session_balance         → tick route returns 503 on every tick;
--                                 session runs at zero cost to the user
--   decrement_pending_payout    → payout approval never decrements pending_payout;
--                                 consultant balance stays inflated
--   decrement_wallet_balance    → refund approval never deducts from wallet;
--                                 user keeps money that was refunded
--   increment_wallet_earnings   → consultant never receives earnings credit;
--                                 earned_amount stays at 0 forever
--
-- (increment_sessions_completed was fixed in v21.)

GRANT EXECUTE ON FUNCTION get_session_balance(UUID, UUID)          TO service_role;
GRANT EXECUTE ON FUNCTION decrement_pending_payout(UUID, NUMERIC)  TO service_role;
GRANT EXECUTE ON FUNCTION decrement_wallet_balance(UUID, NUMERIC)  TO service_role;
GRANT EXECUTE ON FUNCTION increment_wallet_earnings(UUID, NUMERIC)  TO service_role;

-- Verify:
-- SELECT has_function_privilege('service_role', 'get_session_balance(uuid,uuid)',         'EXECUTE');
-- SELECT has_function_privilege('service_role', 'decrement_pending_payout(uuid,numeric)', 'EXECUTE');
-- SELECT has_function_privilege('service_role', 'decrement_wallet_balance(uuid,numeric)', 'EXECUTE');
-- SELECT has_function_privilege('service_role', 'increment_wallet_earnings(uuid,numeric)','EXECUTE');
-- Expected: all return 't'
