import "server-only";
// #80 (15 Nov 2026) — keep the Apple certificate-chain verdict where it waits for us.
//
// 🔴 The plan was "watch the logs for '[apple-jws] chain check passed', then
// switch APPLE_JWS_CHAIN_MODE to enforce". It cannot work: runtime logs are
// kept for ONE day on this plan, and iPhone purchases are rare — the evidence
// expires before anybody looks. ⇒ the latest pass and the latest failure are
// written to app_settings, where an admin (or Claude) can read them any time.
// ⛔ Best effort only: a failed write must never fail a purchase.

import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const PASS_KEY = "apple_jws_chain_last_pass";
export const FAIL_KEY = "apple_jws_chain_last_fail";

export function chainEvidenceRow(
  verdict: { ok: boolean; reason?: string },
  mode: "report" | "enforce",
  now: Date,
): { key: string; value: { at: string; reason: string | null; mode: string }; updated_at: string } {
  return {
    key: verdict.ok ? PASS_KEY : FAIL_KEY,
    value: { at: now.toISOString(), reason: verdict.ok ? null : verdict.reason ?? "unknown", mode },
    updated_at: now.toISOString(),
  };
}

export async function recordAppleChainVerdict(
  verdict: { ok: boolean; reason?: string },
  mode: "report" | "enforce",
): Promise<void> {
  try {
    await getSupabaseAdmin()
      .from("app_settings")
      .upsert(chainEvidenceRow(verdict, mode, new Date()), { onConflict: "key" });
  } catch {
    // ⛔ never let the evidence block or fail a purchase
  }
}
