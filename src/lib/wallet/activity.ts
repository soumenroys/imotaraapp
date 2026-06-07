// Shared helper — updates last_activity_at on the unified Imotara wallet.
// The DB trigger automatically recalculates expires_at = last_activity_at + 2 years.
// Call this on every topup AND every session deduction.

import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function updateWalletActivity(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("imotara_wallets")
    .upsert(
      { user_id: userId, last_activity_at: new Date().toISOString(), status: "active" },
      { onConflict: "user_id" }
    );
}
