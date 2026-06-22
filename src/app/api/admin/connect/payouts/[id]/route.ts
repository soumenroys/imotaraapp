// PATCH /api/admin/connect/payouts/[id]
// Update payout status: pending → processing → completed | failed
// Body: { status: "processing"|"completed"|"failed"; admin_note?: string }
// Auth: admin or owner.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { connectAdminAuthorized } from "@/app/api/admin/_auth";

const VALID_STATUSES = ["processing", "completed", "failed"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = await connectAdminAuthorized(req);
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const status = body?.status;
  const admin_note: string | undefined = body?.admin_note;

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ ok: false, error: "status must be processing, completed, or failed" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: payout } = await supabase
    .from("connect_payouts")
    .select("id, status, consultant_user_id, amount")
    .eq("id", id)
    .single();

  if (!payout) return NextResponse.json({ ok: false, error: "Payout not found" }, { status: 404 });

  if (payout.status === "completed") {
    return NextResponse.json({ ok: false, error: "Payout already completed" }, { status: 409 });
  }

  const update: Record<string, unknown> = { status };
  if (admin_note) update.admin_note = admin_note;
  if (status === "completed") update.processed_at = new Date().toISOString();

  // Optimistic lock: only update if not already completed, preventing a concurrent
  // double-complete race from decrementing pending_payout twice.
  const { data: wonRows, error } = await supabase
    .from("connect_payouts")
    .update(update)
    .eq("id", id)
    .neq("status", "completed")
    .select("id");

  if (error) {
    console.error("[admin/connect/payouts PATCH] DB update failed:", error.message, "payout:", id);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
  if (!wonRows || wonRows.length === 0) {
    return NextResponse.json({ ok: false, error: "Payout already completed" }, { status: 409 });
  }

  // If completed, decrement pending_payout by the exact payout amount (not zero the whole field —
  // the consultant may have multiple concurrent pending payout requests).
  if (status === "completed") {
    const { data: wallet } = await supabase
      .from("connect_wallet")
      .select("pending_payout")
      .eq("user_id", payout.consultant_user_id)
      .single();

    const newPending = Math.max(0, Number(wallet?.pending_payout ?? 0) - Number(payout.amount));

    await supabase
      .from("connect_wallet")
      .update({ pending_payout: newPending, updated_at: new Date().toISOString() })
      .eq("user_id", payout.consultant_user_id);
  }

  return NextResponse.json({ ok: true });
}
