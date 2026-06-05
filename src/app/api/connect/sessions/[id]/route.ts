// PATCH /api/connect/sessions/[id]
// Auth required. Session participants update session status.
// Body: { action: "accept" | "decline" | "complete" | "cancel" }
// On "complete": credits consultant for minutes_used at 80% of rate.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

const VALID_ACTIONS = ["accept", "decline", "complete", "cancel"] as const;
type Action = typeof VALID_ACTIONS[number];

const TRANSITIONS: Record<Action, { from: string[]; to: string; consultantOnly?: boolean }> = {
  accept:   { from: ["pending"],  to: "active",    consultantOnly: true },
  decline:  { from: ["pending"],  to: "declined",  consultantOnly: true },
  complete: { from: ["active"],   to: "completed" },
  cancel:   { from: ["pending"], to: "cancelled" },
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const action: Action | undefined = body?.action;
  if (!action || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ ok: false, error: "action must be one of: " + VALID_ACTIONS.join(", ") }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: session } = await supabase
    .from("connect_sessions")
    .select("id, user_id, consultant_id, status, minutes_used")
    .eq("id", id)
    .single();

  if (!session) {
    return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
  }

  // Determine if caller is the consultant
  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("id, user_id, rate_per_min, sessions_completed")
    .eq("id", session.consultant_id)
    .single();

  const isConsultant = consultant?.user_id === user.id;
  const isUser       = session.user_id === user.id;

  if (!isConsultant && !isUser) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const transition = TRANSITIONS[action];
  if (!transition.from.includes(session.status)) {
    return NextResponse.json(
      { ok: false, error: `Cannot ${action} a session in status "${session.status}"` },
      { status: 409 }
    );
  }
  if (transition.consultantOnly && !isConsultant) {
    return NextResponse.json({ ok: false, error: "Only the consultant can perform this action" }, { status: 403 });
  }

  const updatePayload: Record<string, unknown> = { status: transition.to };
  if (action === "accept")   updatePayload.started_at = new Date().toISOString();
  if (action === "complete") updatePayload.ended_at   = new Date().toISOString();

  const { error } = await supabase
    .from("connect_sessions")
    .update(updatePayload)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Credit consultant earnings on manual completion (minutes_used > 0)
  if (action === "complete" && consultant && Number(session.minutes_used) > 0) {
    const sessionEarnings = Number(session.minutes_used) * Number(consultant.rate_per_min) * 0.80;

    await supabase
      .from("connect_wallet")
      .upsert({ user_id: consultant.user_id }, { onConflict: "user_id", ignoreDuplicates: true });

    const { data: wallet } = await supabase
      .from("connect_wallet")
      .select("earned_amount")
      .eq("user_id", consultant.user_id)
      .single();

    await supabase
      .from("connect_wallet")
      .update({
        earned_amount: (Number(wallet?.earned_amount ?? 0) + sessionEarnings),
        updated_at:    new Date().toISOString(),
      })
      .eq("user_id", consultant.user_id);

    await supabase
      .from("connect_consultants")
      .update({ sessions_completed: (consultant.sessions_completed ?? 0) + 1 })
      .eq("id", consultant.id);
  }

  return NextResponse.json({ ok: true, status: transition.to });
}
