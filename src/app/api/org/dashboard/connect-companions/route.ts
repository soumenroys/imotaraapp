// src/app/api/org/dashboard/connect-companions/route.ts
//
// GET    — the companions this organisation has made private to itself
// POST   — make one of our own members' companion profiles org-only
// DELETE — release it back to the public marketplace
//
// 🔴 THE RULE THAT MATTERS: an org admin may only privatise a companion whose
// user is an ACTIVE MEMBER OF THEIR OWN ORG. Without that, any org admin could
// point this at a popular public companion and pull them out of the marketplace
// — harming the companion's livelihood and every other user, from a dashboard
// that is supposed to govern only that org's own people.
//
// A companion already claimed by another org is likewise untouchable here.

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const SELECT = "id, display_name, status, org_id, visibility, role_category, user_id";

export async function GET(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const { data, error } = await getSupabaseAdmin()
    .from("connect_consultants")
    .select(SELECT)
    .eq("org_id", auth.orgId)
    .order("display_name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ companions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { consultantId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const consultantId = body.consultantId?.trim();
  if (!consultantId) {
    return NextResponse.json({ error: "consultantId is required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: consultant, error: readErr } = await admin
    .from("connect_consultants")
    .select("id, user_id, org_id, display_name")
    .eq("id", consultantId)
    .maybeSingle();

  // Fail closed: if we cannot read the row we do not know whose it is.
  if (readErr) return NextResponse.json({ error: "could not read companion" }, { status: 500 });
  if (!consultant) return NextResponse.json({ error: "companion not found" }, { status: 404 });

  // 🔴 Already belongs to another organisation — not ours to take.
  if (consultant.org_id && consultant.org_id !== auth.orgId) {
    return NextResponse.json(
      { error: "This companion already belongs to another organisation." },
      { status: 409 },
    );
  }

  // 🔴 Must be one of our own members. This is the check that stops an admin
  // privatising a stranger from the public marketplace.
  const { data: membership, error: memErr } = await admin
    .from("org_members")
    .select("user_id")
    .eq("org_id", auth.orgId)
    .eq("user_id", consultant.user_id)
    .eq("status", "active")
    .maybeSingle();

  if (memErr) return NextResponse.json({ error: "could not verify membership" }, { status: 500 });
  if (!membership) {
    return NextResponse.json(
      { error: "You can only make your own members' companion profiles private to your organisation." },
      { status: 403 },
    );
  }

  const { data, error } = await admin
    .from("connect_consultants")
    .update({ org_id: auth.orgId, visibility: "org_only", updated_at: new Date().toISOString() })
    .eq("id", consultantId)
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ companion: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { consultantId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const consultantId = body.consultantId?.trim();
  if (!consultantId) {
    return NextResponse.json({ error: "consultantId is required" }, { status: 400 });
  }

  // ⚠️ Scoped to .eq("org_id", auth.orgId): an admin can only release a
  // companion their OWN org holds. Releasing somebody else's would be the same
  // overreach as claiming one.
  const { data, error } = await getSupabaseAdmin()
    .from("connect_consultants")
    .update({ org_id: null, visibility: "public", updated_at: new Date().toISOString() })
    .eq("id", consultantId)
    .eq("org_id", auth.orgId)
    .select(SELECT)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "companion not found in your organisation" }, { status: 404 });

  return NextResponse.json({ companion: data });
}
