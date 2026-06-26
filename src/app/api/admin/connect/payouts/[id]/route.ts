// PATCH /api/admin/connect/payouts/[id]
// Update payout status: pending → processing → completed | failed
// Body: { status: "processing"|"completed"|"failed"; admin_note?: string }
// Auth: admin or owner.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { requireSuperAdmin } from "@/app/api/admin/_auth";

const VALID_STATUSES = ["processing", "completed", "failed"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireSuperAdmin(req);
  if (!authResult.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (authResult.admin.role === "connect_reviewer") {
    return NextResponse.json({ ok: false, error: "Insufficient privileges to approve payouts" }, { status: 403 });
  }

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

  if (Number(payout.amount) <= 0) {
    return NextResponse.json({ ok: false, error: "Payout amount must be positive" }, { status: 422 });
  }

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

  // Atomically decrement pending_payout on both completed AND failed transitions.
  // Without decrementing on "failed", the consultant's pending_payout remains inflated
  // permanently, making available = earned - pending_payout = 0 for future requests.
  if (status === "completed" || status === "failed") {
    const { error: decrementErr } = await supabase
      .rpc("decrement_pending_payout", {
        p_user_id: payout.consultant_user_id,
        p_amount:  Number(payout.amount),
      });
    if (decrementErr) {
      const errorContext = status === "completed"
        ? "Payout marked complete but wallet decrement failed — contact engineering before retrying"
        : "Payout marked failed but pending_payout decrement failed — consultant may be permanently unable to request payout";
      console.error("[admin/connect/payouts PATCH] CRITICAL: decrement_pending_payout failed:", decrementErr.message, "payout:", id);
      return NextResponse.json({ ok: false, error: errorContext }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
