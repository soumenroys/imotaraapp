// src/app/api/admin/broadcast/broadcasts/[id]/stop/route.ts
// POST — stop a run that is already going out (G1).
//
// Until this existed the only thing that could halt a send was a fatal error.
// An operator who noticed a typo, the wrong list or a dead link thirty seconds
// after pressing send could do nothing but watch it drain — which made "there
// is no undo" more absolute than it needed to be. The messages already handed
// to Resend are genuinely gone; everything still queued is not, and this is
// the difference between a mistake and an unrecoverable one.
//
// Owner role only.

import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: { discardQueued?: unknown };
  try { body = await req.json(); }
  catch { body = {}; }

  const supabase = getSupabaseAdmin();
  const { data: b } = await supabase
    .from("broadcasts").select("id, status").eq("id", id).maybeSingle();

  if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (b.status !== "sending" && b.status !== "scheduled") {
    return NextResponse.json(
      { error: `This broadcast is ${b.status}, so there is nothing to stop`, status: b.status },
      { status: 409 },
    );
  }

  // Pause first, and check the status in the WHERE clause: the cron runs every
  // minute and may be mid-batch. Stopping the tap before touching the queue
  // means the worst case is one batch already in flight, not a race where the
  // cron re-queues what this just cleared.
  const { data: paused } = await supabase
    .from("broadcasts")
    .update({ status: "paused" })
    .eq("id", id)
    .in("status", ["sending", "scheduled"])
    .select("id")
    .maybeSingle();

  if (!paused) {
    return NextResponse.json({ error: "It finished before it could be stopped" }, { status: 409 });
  }

  let discarded = 0;
  if (body.discardQueued === true) {
    // Marked skipped rather than deleted. The record has to keep saying that
    // these people were meant to receive it and did not — deleting the rows
    // would make the broadcast look like it only ever had the recipients it
    // managed to reach.
    const { count } = await supabase
      .from("broadcast_sends")
      .update({ status: "skipped", skip_reason: "cancelled" }, { count: "exact" })
      .eq("broadcast_id", id)
      .eq("status", "queued");
    discarded = count ?? 0;

    await supabase
      .from("broadcasts")
      .update({ finished_at: new Date().toISOString() })
      .eq("id", id);
  }

  return NextResponse.json({
    ok: true,
    stopped: true,
    discarded,
    resumable: body.discardQueued !== true,
  }, { status: 200 });
}
