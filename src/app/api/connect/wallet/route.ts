// GET /api/connect/wallet
// Auth required. Returns user's balance per consultant + consultant earnings if applicable.
// Query param: consultant_id — filter balance to a specific consultant

export const preferredRegion = ["sin1"];

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

export async function GET(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const consultantId = req.nextUrl.searchParams.get("consultant_id");
  const supabase = getSupabaseAdmin();

  // Compute balance: total credited - total used (per consultant if filtered)
  let rechargeQuery = supabase
    .from("connect_recharges")
    .select("consultant_id, minutes_credited, currency_code")
    .eq("user_id", user.id)
    .eq("status", "completed");

  let sessionQuery = supabase
    .from("connect_sessions")
    .select("consultant_id, minutes_used")
    .eq("user_id", user.id)
    .in("status", ["completed", "active"]);

  if (consultantId) {
    rechargeQuery = rechargeQuery.eq("consultant_id", consultantId);
    sessionQuery  = sessionQuery.eq("consultant_id", consultantId);
  }

  const [
    { data: recharges },
    { data: sessions },
    { data: wallet },
    { data: imotaraWallet },
  ] = await Promise.all([
    rechargeQuery,
    sessionQuery,
    supabase
      .from("connect_wallet")
      .select("earned_amount, earned_currency, pending_payout")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("imotara_wallets")
      .select("balance, currency_code, expires_at, status, last_activity_at")
      .eq("user_id", user.id)
      .single(),
  ]);

  // Group by consultant
  const balanceByConsultant: Record<string, { minutes: number; currency: string }> = {};

  for (const r of recharges ?? []) {
    const cid = r.consultant_id;
    if (!balanceByConsultant[cid]) {
      balanceByConsultant[cid] = { minutes: 0, currency: r.currency_code };
    }
    balanceByConsultant[cid].minutes += Number(r.minutes_credited);
  }
  for (const s of sessions ?? []) {
    const cid = s.consultant_id;
    if (balanceByConsultant[cid]) {
      balanceByConsultant[cid].minutes -= Number(s.minutes_used);
    }
  }

  // Enrich balances with consultant names/photos (for display)
  const consultantIds = Object.keys(balanceByConsultant);
  const nameMap: Record<string, { display_name: string; photo_url: string | null; gender: string | null }> = {};
  if (consultantIds.length > 0) {
    const { data: cRows } = await supabase
      .from("connect_consultants")
      .select("id, display_name, photo_url, gender")
      .in("id", consultantIds);
    for (const c of (cRows ?? [])) {
      nameMap[c.id] = { display_name: c.display_name, photo_url: c.photo_url, gender: c.gender };
    }
  }

  // Flat wallets array (convenience for mobile + web UI)
  const wallets = Object.entries(balanceByConsultant)
    .filter(([, v]) => v.minutes > 0)
    .map(([id, v]) => ({
      consultant_id:  id,
      display_name:   nameMap[id]?.display_name ?? "Companion",
      photo_url:      nameMap[id]?.photo_url    ?? null,
      gender:         nameMap[id]?.gender       ?? null,
      balance_minutes: Math.max(0, Math.floor(v.minutes)),
      currency_code:  v.currency,
    }));

  // wallet and imotaraWallet are fetched in the parallel Promise.all above

  const expiresAt    = imotaraWallet?.expires_at ?? null;
  const daysUntilExpiry = expiresAt
    ? Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
    : null;

  return NextResponse.json({
    ok: true,
    balances: balanceByConsultant,
    wallets,
    earned_amount:      wallet?.earned_amount   ?? 0,
    earned_currency:    wallet?.earned_currency ?? "INR",
    pending_payout:     wallet?.pending_payout  ?? 0,
    wallet_balance:     Number(imotaraWallet?.balance     ?? 0),
    wallet_currency:    imotaraWallet?.currency_code ?? "INR",
    wallet_status:      imotaraWallet?.status         ?? "active",
    expires_at:         expiresAt,
    days_until_expiry:  daysUntilExpiry,
  });
}
