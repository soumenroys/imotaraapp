// src/app/api/org/dashboard/cohorts/route.ts
// GET    — list cohorts for org (with member counts)
// POST   — create a cohort
// PATCH  — update cohort (name, description, tone_policy)
// DELETE ?cohortId= — delete a cohort

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

// ── GET — list cohorts ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();

  const { data: cohorts, error } = await admin
    .from("cohorts")
    .select("id, name, description, tone_policy, seat_limit, created_at")
    .eq("org_id", auth.orgId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get member counts per cohort
  const { data: memberCounts } = await admin
    .from("cohort_members")
    .select("cohort_id")
    .in("cohort_id", (cohorts ?? []).map((c) => c.id));

  const countMap: Record<string, number> = {};
  (memberCounts ?? []).forEach(({ cohort_id }) => {
    countMap[cohort_id] = (countMap[cohort_id] ?? 0) + 1;
  });

  return NextResponse.json({
    cohorts: (cohorts ?? []).map((c) => ({ ...c, memberCount: countMap[c.id] ?? 0 })),
  });
}

// ── POST — create cohort ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { name: string; description?: string; tone_policy?: string; seat_limit?: number };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const VALID_TONES = ["close_friend", "calm_companion", "coach", "mentor"];
  const tone = VALID_TONES.includes(body.tone_policy ?? "") ? body.tone_policy : "close_friend";

  const { data, error } = await getSupabaseAdmin()
    .from("cohorts")
    .insert({
      org_id:      auth.orgId,
      name:        body.name.trim(),
      description: body.description?.trim() ?? null,
      tone_policy: tone,
      seat_limit:  body.seat_limit ?? null,
      created_by:  auth.userId,
    })
    .select("id, name, description, tone_policy, seat_limit, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cohort: { ...data, memberCount: 0 } }, { status: 201 });
}

// ── PATCH — update cohort ─────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { cohortId: string; name?: string; description?: string; tone_policy?: string; seat_limit?: number | null };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  if (!body.cohortId) return NextResponse.json({ error: "cohortId required" }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name        !== undefined) update.name        = body.name?.trim();
  if (body.description !== undefined) update.description = body.description?.trim() ?? null;
  if (body.tone_policy !== undefined) update.tone_policy = body.tone_policy;
  if (body.seat_limit  !== undefined) update.seat_limit  = body.seat_limit;

  const { error } = await getSupabaseAdmin()
    .from("cohorts")
    .update(update)
    .eq("id", body.cohortId)
    .eq("org_id", auth.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── DELETE — delete cohort ────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const cohortId = req.nextUrl.searchParams.get("cohortId");
  if (!cohortId) return NextResponse.json({ error: "cohortId required" }, { status: 400 });

  const { error } = await getSupabaseAdmin()
    .from("cohorts")
    .delete()
    .eq("id", cohortId)
    .eq("org_id", auth.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
