// GET  /api/admin/connect/refunds — list wallet refund requests
// PATCH /api/admin/connect/refunds — update a refund request status
// Admin only.

import { NextRequest, NextResponse } from "next/server";
import { connectAdminAuthorized, requireSuperAdmin } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const VALID_STATUSES = ["processing", "completed", "rejected"] as const;

export async function GET(req: NextRequest) {
  if (!(await connectAdminAuthorized(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("imotara_wallet_refund_requests")
    .select(
      "id, user_id, reference_number, amount, currency_code, " +
      "bank_name, account_number, ifsc_code, account_holder, upi_id, " +
      "reason, status, requested_at, processed_at"
    )
    .order("requested_at", { ascending: false })
    .limit(100);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[admin/connect/refunds GET] query failed:", error.message);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }

  type RefundRow = {
    id: string; user_id: string; reference_number: string; amount: number;
    currency_code: string; bank_name: string | null; account_number: string | null;
    ifsc_code: string | null; account_holder: string | null; upi_id: string | null;
    reason: string | null; status: string; requested_at: string | null; processed_at: string | null;
  };

  // Batch-fetch user emails
  const rows = (data ?? []) as unknown as RefundRow[];
  const emailMap: Record<string, string> = {};
  await Promise.all(
    rows.map(async (row) => {
      try {
        const { data: u } = await supabase.auth.admin.getUserById(row.user_id);
        if (u?.user?.email) emailMap[row.user_id] = u.user.email;
      } catch { /* non-critical */ }
    })
  );

  const refunds = rows.map((r) => ({
    ...r,
    user_email:     emailMap[r.user_id] ?? null,
    // Mask sensitive banking details for display — show only last 4 digits
    account_number: r.account_number
      ? `${"*".repeat(Math.max(0, r.account_number.length - 4))}${r.account_number.slice(-4)}`
      : null,
    ifsc_code: r.ifsc_code ? `${"*".repeat(Math.max(0, r.ifsc_code.length - 4))}${r.ifsc_code.slice(-4)}` : null,
    upi_id:    r.upi_id ? `${"*".repeat(Math.max(0, r.upi_id.length - 4))}${r.upi_id.slice(-4)}` : null,
  }));

  return NextResponse.json({ ok: true, refunds });
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireSuperAdmin(req);
  if (!authResult.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (authResult.admin.role === "connect_reviewer") {
    return NextResponse.json({ ok: false, error: "Insufficient privileges to approve refunds" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.id || !body?.status) {
    return NextResponse.json({ ok: false, error: "id and status required" }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { ok: false, error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const now      = new Date().toISOString();

  // Pre-fetch user_id and amount before the UPDATE so the wallet adjustment does not
  // depend on a second SELECT in the window between UPDATE and wallet write.
  let refundUserId: string | null = null;
  let refundAmount  = 0;
  if (body.status === "completed") {
    const { data: preFetch } = await supabase
      .from("imotara_wallet_refund_requests")
      .select("user_id, amount")
      .eq("id", body.id)
      .eq("status", "pending")  // only pre-fetch if still actionable
      .single();
    refundUserId = preFetch?.user_id ?? null;
    refundAmount = Number(preFetch?.amount ?? 0);
  }

  const update: Record<string, unknown> = { status: body.status };
  if (body.status === "completed" || body.status === "rejected") {
    update.processed_at = now;
  }
  if (body.admin_note) update.admin_note = body.admin_note;

  // Optimistic lock: prevent double-completion if two admins approve the same refund
  // concurrently — only the first UPDATE wins; the second sees 0 rows.
  const { data: updatedRows, error } = await supabase
    .from("imotara_wallet_refund_requests")
    .update(update)
    .eq("id", body.id)
    .neq("status", "completed")
    .select("id");

  if (error) {
    console.error("[admin/refunds PATCH] update failed:", error.message, "refund:", body.id);
    return NextResponse.json({ ok: false, error: "Failed to update refund. Please try again." }, { status: 500 });
  }
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json({ ok: false, error: "Refund already completed or not found" }, { status: 409 });
  }

  // If completed, zero out the wallet balance (refund has been issued)
  if (body.status === "completed") {
    if (refundUserId) {
      // Subtract only the refunded amount — do not zero the entire wallet; the user
      // may have topped up again between the refund request and its approval.
      const { data: walletRow } = await supabase
        .from("imotara_wallets")
        .select("balance")
        .eq("user_id", refundUserId)
        .single();
      const newBalance = Math.max(0, Number(walletRow?.balance ?? 0) - refundAmount);
      const { error: walletErr } = await supabase
        .from("imotara_wallets")
        .update({ balance: newBalance, status: "active" })
        .eq("user_id", refundUserId);
      if (walletErr) {
        console.error("[admin/refunds PATCH] CRITICAL: wallet adjustment failed for user:", refundUserId, "refund:", body.id, walletErr.message);
      }
    } else {
      console.error("[admin/refunds PATCH] refund row not found before update — wallet NOT zeroed. refund_id:", body.id);
    }
  }

  return NextResponse.json({ ok: true });
}
