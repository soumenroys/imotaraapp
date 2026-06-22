export const preferredRegion = ["sin1"];

// POST /api/connect/sessions/[id]/review
// Auth required. User submits a rating (1–5) after a completed session.
// Body: { rating: number, review_text?: string }

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });

  const { rating, review_text } = body;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ ok: false, error: "rating must be integer 1–5" }, { status: 400 });
  }
  if (review_text !== undefined && review_text !== null) {
    if (typeof review_text !== "string") {
      return NextResponse.json({ ok: false, error: "review_text must be a string" }, { status: 400 });
    }
    if (review_text.length > 200) {
      return NextResponse.json({ ok: false, error: "review_text max 200 chars" }, { status: 400 });
    }
  }

  const supabase = getSupabaseAdmin();

  const { data: session } = await supabase
    .from("connect_sessions")
    .select("id, user_id, consultant_id, status, review_submitted_at")
    .eq("id", sessionId)
    .single();

  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
  }
  if (session.status !== "completed") {
    return NextResponse.json({ ok: false, error: "Can only review completed sessions" }, { status: 409 });
  }
  if (session.review_submitted_at) {
    return NextResponse.json({ ok: false, error: "Already reviewed" }, { status: 409 });
  }

  // Atomic update — the IS NULL filter prevents a second concurrent submission from overwriting
  const { data: updated } = await supabase
    .from("connect_sessions")
    .update({
      rating,
      review_text:         review_text?.trim() ?? null,
      review_submitted_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .is("review_submitted_at", null)
    .select("id");

  if (!updated || updated.length === 0) {
    return NextResponse.json({ ok: false, error: "Already reviewed" }, { status: 409 });
  }

  // Rating aggregate is handled atomically by the DB trigger trg_update_consultant_rating
  // (connect_v16_security_hardening.sql). The trigger fires AFTER UPDATE of the rating
  // column inside the same transaction, so no application-level aggregate is needed.
  // Keeping the aggregate here would overwrite the trigger's correct value with a
  // non-atomic read taken after the INSERT — dropping concurrent reviews from the average.

  return NextResponse.json({ ok: true });
}
