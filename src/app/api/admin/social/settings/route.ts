// PATCH /api/admin/social/settings — the master switch  🔐 owner
//
// One place to hold everything at once, for the week the estate is under
// scrutiny or any other reason to stop quickly.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialOwner } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

type Body = { postingPaused?: boolean; note?: string };

export async function PATCH(req: NextRequest) {
  // 🔐 Pausing is safe; UNPAUSING lets unattended posting resume, which is the
  // same power as switching auto-publish on. Both sides are owner-only so the
  // pair cannot be used to route around that.
  const guard = await requireSocialOwner(req, "Changing the posting switch");
  if (!guard.ok) return guard.response;

  let input: Body;
  try {
    input = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "the request body was not JSON" }, { status: 400 });
  }
  if (typeof input.postingPaused !== "boolean") {
    return NextResponse.json({ error: "postingPaused must be true or false" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("social_settings")
    .update({
      posting_paused: input.postingPaused,
      paused_by: input.postingPaused ? guard.actor.id : null,
      paused_at: input.postingPaused ? now : null,
      note: input.note?.trim() || null,
      updated_at: now,
    })
    .eq("id", 1)
    .select("posting_paused, paused_at, note")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({
    settings: data,
    note: input.postingPaused
      ? "Everything is held. Posts are still written and queued; nothing publishes."
      : "Posting resumed.",
  });
}
