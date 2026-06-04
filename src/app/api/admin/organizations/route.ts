// src/app/api/admin/organizations/route.ts
// GET  /api/admin/organizations?search=&status=&page=0  — list orgs
// POST /api/admin/organizations                          — create org
// Protected by ADMIN_SECRET Bearer token.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { adminAuthorized } from "@/app/api/admin/_auth";
import { adminSearchOrgs } from "@/lib/imotara/org";
import type { OrgStatus } from "@/lib/imotara/org";

// ── GET — list / search orgs ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!adminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const search = req.nextUrl.searchParams.get("search")?.trim()  || undefined;
  const status = req.nextUrl.searchParams.get("status")?.trim()  || undefined;
  const page   = Math.max(0, parseInt(req.nextUrl.searchParams.get("page")  ?? "0", 10));
  const limit  = Math.min(50, parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10));

  const result = await adminSearchOrgs(search, status as OrgStatus | undefined, page, limit);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ orgs: result.data }, { status: 200 });
}

// ── POST — create org (Imotara admin manually creates org for a client) ───────
export async function POST(req: NextRequest) {
  if (!adminAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    name:           string;
    slug:           string;
    billing_type:   string;
    tier:           string;
    status:         string;
    seats_purchased: number;
    expires_at?:    string | null;
    notes?:         string | null;
    owner_email?:   string | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.name?.trim() || !body.slug?.trim()) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // If owner_email provided, look up the user_id
  let ownerUserId: string | null = null;
  if (body.owner_email?.trim()) {
    const { data: users } = await admin.auth.admin.listUsers();
    const match = users?.users?.find((u) => u.email === body.owner_email!.trim());
    ownerUserId = match?.id ?? null;
  }

  const { data, error } = await admin
    .from("organizations")
    .insert({
      name:            body.name.trim(),
      slug:            body.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      billing_type:    body.billing_type  ?? "commercial",
      tier:            body.tier          ?? "enterprise",
      status:          body.status        ?? "pending",
      seats_purchased: body.seats_purchased ?? 0,
      expires_at:      body.expires_at    ?? null,
      notes:           body.notes         ?? null,
      owner_user_id:   ownerUserId,
    })
    .select("id, name, slug, status")
    .single();

  if (error) {
    console.error("[admin/organizations POST]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ org: data }, { status: 201 });
}
