// POST   /api/admin/users/[userId]/ban   — ban a user
// DELETE /api/admin/users/[userId]/ban   — unban a user
// GET    /api/admin/users/[userId]/ban   — ban status
// Body (POST): { reason: string }
// Auth: admin or owner. connect_reviewer excluded on ALL THREE handlers —
// DELETE/GET previously only had requireSuperAdmin with no role check,
// letting a connect_reviewer (meant to be Connect-routes-only) unban any
// user and read any ban record. Consequential as of the fix below: DELETE
// used to only toggle an inert audit row, now it calls a real Supabase ban.
//
// user_bans is an audit table only (who banned whom, when, why) — it was
// never actually checked anywhere else in the app (confirmed via a
// repo-wide grep: this file was the only reference to it). Banning a user
// via this route previously did nothing except set that row; the confirm
// dialog's "They will lose access immediately" was false. Real enforcement
// now comes from Supabase's own ban mechanism (auth.admin.updateUserById
// ban_duration), the same one used for org-member suspension — blocks
// sign-in and token refresh at the Auth layer itself, not something this
// app has to separately remember to check.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { requireSuperAdmin } from "@/app/api/admin/_auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const result = await requireSuperAdmin(req);
  if (!result.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (result.admin.role === "connect_reviewer") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const reason: string = body?.reason?.trim() ?? "";
  if (!reason) return NextResponse.json({ ok: false, error: "reason is required" }, { status: 400 });

  const supabase = getSupabaseAdmin();

  // Real enforcement first — don't record an audit row claiming "banned" if
  // the actual block failed to apply.
  const { error: banError } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: "876000h", // ~100 years — effectively indefinite, matches the org-member suspend convention
  });
  if (banError) return NextResponse.json({ ok: false, error: banError.message }, { status: 500 });

  const { error } = await supabase
    .from("user_bans")
    .upsert({
      user_id:     userId,
      banned_by:   result.admin.email,
      reason,
      banned_at:   new Date().toISOString(),
      unbanned_at: null,
    }, { onConflict: "user_id" });

  // The real ban already succeeded — an audit-log write failure shouldn't
  // report the whole action as failed, just get logged for follow-up.
  if (error) console.error("[users/ban] user_bans audit write failed after real ban succeeded:", error.message);

  return NextResponse.json({ ok: true, message: "User banned" });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const result = await requireSuperAdmin(req);
  if (!result.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (result.admin.role === "connect_reviewer") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  const { error: unbanError } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });
  if (unbanError) return NextResponse.json({ ok: false, error: unbanError.message }, { status: 500 });

  const { error } = await supabase
    .from("user_bans")
    .update({ unbanned_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("unbanned_at", null);

  if (error) console.error("[users/ban] user_bans audit write failed after real unban succeeded:", error.message);

  return NextResponse.json({ ok: true, message: "User unbanned" });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const result = await requireSuperAdmin(req);
  if (!result.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (result.admin.role === "connect_reviewer") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  // Authoritative: Supabase's own banned_until, not the user_bans audit
  // table — a ban applied any way other than this route's POST (direct in
  // Supabase, a future admin tool) would leave no audit row, and the audit
  // table alone could drift from what's actually enforced at the Auth layer.
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError) return NextResponse.json({ ok: false, error: userError.message }, { status: 500 });

  const bannedUntil = userData.user?.banned_until;
  const banned = !!bannedUntil && new Date(bannedUntil) > new Date();

  // Audit metadata (who/why/when) is still useful context when available,
  // but no longer what decides the banned boolean itself.
  const { data } = await supabase
    .from("user_bans")
    .select("user_id, banned_by, reason, banned_at, unbanned_at")
    .eq("user_id", userId)
    .is("unbanned_at", null)
    .maybeSingle();

  return NextResponse.json({ ok: true, banned, bannedUntil: bannedUntil ?? null, ban: data ?? null });
}
