// src/app/api/admin/organizations/route.ts
// GET  /api/admin/organizations?search=&status=&page=0  — list orgs
// POST /api/admin/organizations                          — create org
// Protected by ADMIN_SECRET Bearer token.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { adminAuthorized, requireSuperAdmin } from "@/app/api/admin/_auth";
import { adminSearchOrgs, provisionOrgMember } from "@/lib/imotara/org";
import type { OrgStatus } from "@/lib/imotara/org";
import { sendOrgWelcomeEmail } from "@/lib/connect/mailer";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://imotara.com").replace(/\/$/, "");
const ACCEPT_REDIRECT = `${SITE_URL}/auth/accept`;

// ── GET — list / search orgs ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!await adminAuthorized(req)) {
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
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;
  if (auth.admin.role === "connect_reviewer") return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
  }
  const rawSlug = body.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (!rawSlug) {
    return NextResponse.json({ error: "Slug is required (lowercase letters, numbers, and hyphens only)" }, { status: 400 });
  }

  // Bug #23: validate owner_email format before attempting any lookup
  const ownerEmail = body.owner_email?.trim() || null;
  if (ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    return NextResponse.json({ error: "owner_email is not a valid email address" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Bug #21: explicit slug uniqueness check — avoids leaking raw DB constraint errors
  const { data: existingSlug } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", rawSlug)
    .maybeSingle();
  if (existingSlug) {
    return NextResponse.json({ error: `Slug "${rawSlug}" is already in use. Choose a different slug.` }, { status: 409 });
  }

  // Resolve owner_email → auth user_id (single listUsers call, reused below)
  let ownerUserId: string | null = null;
  if (ownerEmail) {
    const { data: users } = await admin.auth.admin.listUsers();
    const match = users?.users?.find((u) => u.email === ownerEmail);
    ownerUserId = match?.id ?? null;

    // Bug #27 fix: reject if this user is already owner of another org
    if (ownerUserId) {
      const { data: existingOwnerOrg } = await admin
        .from("organizations")
        .select("id, name")
        .eq("owner_user_id", ownerUserId)
        .maybeSingle();
      if (existingOwnerOrg) {
        return NextResponse.json(
          { error: `This email is already the owner of "${existingOwnerOrg.name}". Each account can own only one organization.` },
          { status: 409 }
        );
      }
    }
  }

  const { data, error } = await admin
    .from("organizations")
    .insert({
      name:            body.name.trim(),
      slug:            rawSlug,
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
    // 23505: the partial unique index organizations_single_owner fired —
    // same race as org/new/route.ts, lower severity here since this path
    // is admin-gated, but the check-then-insert above has the same gap.
    if (error.code === "23505") {
      return NextResponse.json({ error: `This owner already owns another organization. Each account can own only one.` }, { status: 409 });
    }
    console.error("[admin/organizations POST]", error.message);
    // Bug #22: return a generic message — never expose raw DB error details
    return NextResponse.json({ error: "Failed to create organization. Please check your input and try again." }, { status: 500 });
  }

  // Bug #34 fix, then superseded: owner_email used to only set the decorative
  // owner_user_id column above and send a generic "your org is ready" email —
  // that never created an org_members row or a licenses.org_id for them, so
  // they had no seat, no license, and no way to actually reach their org
  // dashboard despite showing up as "owner" in the super-admin org list. Now
  // routed through the same provisionOrgMember() pipeline member-provisioning
  // uses, which actually creates the membership/seat and emails a working
  // set-password link. This can fail (e.g. the org was created as "pending"
  // with 0 seats) without the org creation itself failing — surfaced via
  // ownerProvisioned so the admin UI can tell the operator to finish this via
  // "Add member by email" once the org is activated.
  let ownerProvisioned: boolean | null = null;
  let ownerProvisionError: string | null = null;
  if (ownerEmail) {
    const provision = await provisionOrgMember(
      data.id, ownerEmail, "owner",
      { id: auth.admin.id, email: auth.admin.email },
      ACCEPT_REDIRECT,
    );
    ownerProvisioned = provision.ok;
    if (!provision.ok) {
      ownerProvisionError = provision.error;
      // Fall back to the old informational email so the intended owner at
      // least hears something, since the real invite couldn't go out.
      sendOrgWelcomeEmail({
        ownerEmail,
        orgName: data.name,
        orgSlug: data.slug,
      }).catch((err) => console.error("[admin/organizations] welcome email failed:", err));
    }
  }

  return NextResponse.json({ org: data, ownerProvisioned, ownerProvisionError }, { status: 201 });
}
