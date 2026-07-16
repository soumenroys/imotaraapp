// src/app/api/org/join-by-domain/route.ts
// GET  ?slug=<org-slug>  — public org preview for a domain-auto-join landing page
// POST { orgSlug }       — authenticated user joins if their email domain matches
//
// Unlike org/invite/[token], this isn't tied to any single-use token — any
// number of eligible users can call this repeatedly. That's the actual fix
// for "auto-join by domain": previously it only worked by piggybacking on
// one admin-sent invite link, which got consumed by whoever used it first
// (and could even lock out the invite's real, intended recipient).

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getSupabaseUserServerClient } from "@/lib/supabaseServer";
import { assignOrgLicense, releasePriorOrgMembership } from "@/lib/imotara/org";

function emailDomainMatches(email: string, allowedDomains: string[]): boolean {
  const domain = email.toLowerCase().split("@")[1] ?? "";
  return allowedDomains.some((d) => domain === d || domain.endsWith("." + d));
}

// ── GET — public preview for the join landing page ────────────────────────────
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: org } = await admin
    .from("organizations")
    .select("name, billing_type, tier, status, org_settings")
    .eq("slug", slug)
    .single();

  if (!org) return NextResponse.json({ error: "organisation not found" }, { status: 404 });

  const settings = (org.org_settings ?? {}) as Record<string, unknown>;
  const autoJoinEnabled = !!settings.auto_join_by_domain;
  const allowedDomains  = (settings.allowed_email_domains as string[] | null) ?? [];

  if (!autoJoinEnabled || allowedDomains.length === 0) {
    return NextResponse.json({ error: "domain auto-join is not enabled for this organisation" }, { status: 404 });
  }
  if (org.status !== "active") {
    return NextResponse.json({ error: "this organisation is not yet active" }, { status: 409 });
  }

  return NextResponse.json({
    org: { name: org.name, billingType: org.billing_type, tier: org.tier },
    allowedDomains, // shown so a user can confirm their email qualifies before signing in
  });
}

// ── POST — join if the authenticated user's email domain matches ─────────────
export async function POST(req: NextRequest) {
  let body: { orgSlug?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const slug = body.orgSlug?.trim();
  if (!slug) return NextResponse.json({ error: "orgSlug required" }, { status: 400 });

  const admin = getSupabaseAdmin();

  // Resolve authenticated user (Bearer first, cookie fallback — same pattern as org/invite/[token])
  let userId: string | null = null;
  let userEmail: string | null = null;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (bearer) {
    const { data } = await admin.auth.getUser(bearer);
    userId    = data?.user?.id    ?? null;
    userEmail = data?.user?.email ?? null;
  }
  if (!userId) {
    const supabase = await getSupabaseUserServerClient();
    const { data } = await supabase.auth.getUser();
    userId    = data?.user?.id    ?? null;
    userEmail = data?.user?.email ?? null;
  }
  if (!userId || !userEmail) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: org } = await admin
    .from("organizations")
    .select("id, status, org_settings")
    .eq("slug", slug)
    .single();

  if (!org) return NextResponse.json({ error: "organisation not found" }, { status: 404 });
  if (org.status !== "active") return NextResponse.json({ error: "this organisation is not yet active" }, { status: 409 });

  const settings = (org.org_settings ?? {}) as Record<string, unknown>;
  const autoJoinEnabled = !!settings.auto_join_by_domain;
  const allowedDomains  = (settings.allowed_email_domains as string[] | null) ?? [];

  if (!autoJoinEnabled || !emailDomainMatches(userEmail, allowedDomains)) {
    return NextResponse.json({ error: "your email domain doesn't qualify for auto-join at this organisation" }, { status: 403 });
  }

  const { data: existing } = await admin
    .from("org_members")
    .select("id, status")
    .eq("org_id", org.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.status === "active") {
    return NextResponse.json({ error: "You are already a member of this organisation" }, { status: 409 });
  }

  // Release any different active org membership first — a user can only
  // occupy one paid org seat at a time (see releasePriorOrgMembership).
  await releasePriorOrgMembership(userId, org.id);

  await admin.from("org_members").upsert({
    org_id:     org.id,
    user_id:    userId,
    role:       "member",
    status:     "active",
    invited_by: null,
    joined_at:  new Date().toISOString(),
  }, { onConflict: "org_id,user_id" });

  const licResult = await assignOrgLicense(userId, org.id, undefined, "domain_auto_join");
  if (!licResult.ok) {
    await admin.from("org_members").delete().eq("org_id", org.id).eq("user_id", userId);
    return NextResponse.json({ error: licResult.error }, { status: 409 });
  }

  return NextResponse.json({ ok: true, orgId: org.id, role: "member" });
}
