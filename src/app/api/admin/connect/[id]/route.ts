// PATCH  /api/admin/connect/[id] — admin edits a consultant's profile fields
// DELETE /api/admin/connect/[id] — soft-delete (status → deleted); data kept for accounting.

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const EDITABLE_FIELDS = ["rate_per_min", "bio", "expertise_tags", "availability_note", "display_name"] as const;
type EditableField = typeof EDITABLE_FIELDS[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireSuperAdmin(req);
  if (!authResult.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (authResult.admin.role === "connect_reviewer") {
    return NextResponse.json({ ok: false, error: "Insufficient privileges to edit consultant profiles" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) update[field as EditableField] = body[field];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: `No editable fields provided. Allowed: ${EDITABLE_FIELDS.join(", ")}` }, { status: 400 });
  }

  // Validate rate_per_min if present
  if ("rate_per_min" in update) {
    const rate = Number(update.rate_per_min);
    if (isNaN(rate) || rate <= 0 || rate > 10000) {
      return NextResponse.json({ ok: false, error: "rate_per_min must be between 0 and 10000" }, { status: 400 });
    }
    update.rate_per_min = rate;
  }

  // Validate expertise_tags if present
  if ("expertise_tags" in update) {
    const tags = update.expertise_tags;
    if (!Array.isArray(tags) || tags.length > 20 || tags.some((t) => typeof t !== "string" || t.length > 50)) {
      return NextResponse.json({ ok: false, error: "expertise_tags: max 20 items, each max 50 characters" }, { status: 400 });
    }
  }
  if ("display_name" in update) {
    const dn = String(update.display_name ?? "").trim();
    if (!dn || dn.length > 100) {
      return NextResponse.json({ ok: false, error: "display_name must be 1–100 characters" }, { status: 400 });
    }
    update.display_name = dn;
  }
  if ("bio" in update) {
    const b = String(update.bio ?? "").trim();
    if (!b || b.length > 500) {
      return NextResponse.json({ ok: false, error: "bio must be 1–500 characters" }, { status: 400 });
    }
    update.bio = b;
  }
  if ("availability_note" in update) {
    const an = String(update.availability_note ?? "").trim();
    if (an.length > 500) {
      return NextResponse.json({ ok: false, error: "availability_note must be 500 characters or fewer" }, { status: 400 });
    }
    update.availability_note = an;
  }

  update.updated_at = new Date().toISOString();

  const supabase = getSupabaseAdmin();
  const { data: updatedRows, error } = await supabase
    .from("connect_consultants")
    .update(update)
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[admin/connect/[id] PATCH] DB update failed:", error.message, "consultant:", id);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json({ ok: false, error: "Consultant not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, updated: Object.keys(update).filter((k) => k !== "updated_at") });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireSuperAdmin(req);
  if (!authResult.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (authResult.admin.role === "connect_reviewer") {
    return NextResponse.json({ ok: false, error: "Insufficient privileges to delete consultants" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: consultant, error: fetchErr } = await supabase
    .from("connect_consultants")
    .select("id, user_id, display_name, verification_docs")
    .eq("id", id)
    .single();

  if (fetchErr || !consultant) {
    return NextResponse.json({ ok: false, error: "Consultant not found" }, { status: 404 });
  }

  // Block deletion if the consultant has an in-progress session — deleting mid-session
  // forces is_busy=false while billing is still running, allowing them to accept a second session.
  const { data: activeSessions } = await supabase
    .from("connect_sessions")
    .select("id")
    .eq("consultant_id", id)
    .in("status", ["pending", "active"])
    .limit(1);

  if (activeSessions && activeSessions.length > 0) {
    return NextResponse.json({
      ok: false,
      error: "Cannot delete a consultant with active or pending sessions. End the session first.",
    }, { status: 409 });
  }

  // Soft-delete: set status=deleted rather than hard-deleting — session and earnings history
  // must remain for accounting, dispute resolution, and regulatory compliance.
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("connect_consultants")
    .update({
      status:      "deleted",
      is_online:   false,
      is_busy:     false,
      updated_at:  now,
    })
    .eq("id", id);

  if (error) {
    console.error("[admin/connect/[id] DELETE] DB update failed:", error.message, "consultant:", id);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }

  // Archive the wallet — mark it so revenue reports exclude it from active payables.
  // Earnings rows are kept for accounting; pending_payout is cleared (admin should settle first).
  // connect_wallet.user_id stores the consultant's auth.users UUID (same as connect_consultants.user_id)
  await supabase
    .from("connect_wallet")
    .update({ updated_at: now })
    .eq("user_id", consultant.user_id);
  // Note: if real settled earnings remain, admin must process the payout before deleting.
  // We intentionally do not zero out earned_amount here.

  return NextResponse.json({ ok: true, soft_deleted: id, note: "Status set to deleted; data retained for accounting." });
}
