// GET  /api/admin/connect/refunds — list wallet refund requests
// PATCH /api/admin/connect/refunds — update a refund request status
// Admin only.

import { NextRequest, NextResponse } from "next/server";
import { connectAdminAuthorized } from "@/app/api/admin/_auth";
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
  if (!(await connectAdminAuthorized(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
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

  const update: Record<string, unknown> = { status: body.status };
  if (body.status === "completed" || body.status === "rejected") {
    update.processed_at = now;
  }
  if (body.admin_note) update.admin_note = body.admin_note;

  const { error } = await supabase
    .from("imotara_wallet_refund_requests")
    .update(update)
    .eq("id", body.id);

  if (error) {
    console.error("[admin/refunds PATCH] update failed:", error.message, "refund:", body.id);
    return NextResponse.json({ ok: false, error: "Failed to update refund. Please try again." }, { status: 500 });
  }

  // If completed, zero out the wallet balance (refund has been issued)
  if (body.status === "completed") {
    const { data: refund } = await supabase
      .from("imotara_wallet_refund_requests")
      .select("user_id")
      .eq("id", body.id)
      .single();
    if (refund?.user_id) {
      const { error: walletErr } = await supabase
        .from("imotara_wallets")
        .update({ balance: 0, status: "active" })
        .eq("user_id", refund.user_id);
      if (walletErr) {
        console.error("[admin/refunds PATCH] CRITICAL: wallet zero-out failed for user:", refund.user_id, "refund:", body.id, walletErr.message);
      }
    } else {
      console.error("[admin/refunds PATCH] refund row not found after update — wallet NOT zeroed. refund_id:", body.id);
    }
  }

  return NextResponse.json({ ok: true });
}
