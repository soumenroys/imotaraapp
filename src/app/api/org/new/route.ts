// src/app/api/org/new/route.ts
// POST /api/org/new — authenticated users submit an org creation request.
// Creates org with status=pending, sends alert email to Imotara admin.

import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getSupabaseAdmin, getSupabaseUserServerClient } from "@/lib/supabaseServer";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

export async function POST(req: NextRequest) {
  // 1. Resolve authenticated user (cookie or Bearer)
  let userId: string | null = null;
  let userEmail: string | null = null;

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (bearer) {
    const { data } = await getSupabaseAdmin().auth.getUser(bearer);
    userId    = data?.user?.id    ?? null;
    userEmail = data?.user?.email ?? null;
  }
  if (!userId) {
    const supabase = await getSupabaseUserServerClient();
    const { data } = await supabase.auth.getUser();
    userId    = data?.user?.id    ?? null;
    userEmail = data?.user?.email ?? null;
  }

  if (!userId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // 2. Parse + validate body
  let body: {
    name:         string;
    billing_type: string;
    contact_email?: string;
    description?:   string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const validTypes = ["commercial", "ngo", "edu", "govt"];
  if (!validTypes.includes(body.billing_type)) {
    return NextResponse.json({ error: "invalid billing_type" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // 3. Check user doesn't already own an org
  const { data: existing } = await admin
    .from("organizations")
    .select("id, status")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `You already have an org (status: ${existing.status}). Contact support to create another.` },
      { status: 409 },
    );
  }

  // 4. Generate a unique slug
  const baseSlug = slugify(body.name);
  let slug = baseSlug;
  let suffix = 0;
  while (true) {
    const { data: clash } = await admin.from("organizations").select("id").eq("slug", slug).maybeSingle();
    if (!clash) break;
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  // 5. Create org with status=pending
  const { data: org, error: insertErr } = await admin
    .from("organizations")
    .insert({
      name:          body.name.trim(),
      slug,
      billing_type:  body.billing_type,
      tier:          body.billing_type === "edu" ? "edu" : "enterprise",
      status:        "pending",
      seats_purchased: 0,
      owner_user_id: userId,
      notes:         [
        body.contact_email ? `Contact: ${body.contact_email}` : null,
        body.description   ? `Description: ${body.description}` : null,
      ].filter(Boolean).join("\n") || null,
    })
    .select("id, name, slug")
    .single();

  if (insertErr || !org) {
    console.error("[org/new POST]", insertErr?.message);
    return NextResponse.json({ error: insertErr?.message ?? "Failed to create org" }, { status: 500 });
  }

  // 6. Add owner as org_member with role=owner
  await admin.from("org_members").insert({
    org_id:  org.id,
    user_id: userId,
    role:    "owner",
    status:  "active",
  });

  // 6b. Create licenses row for owner so resolve_user_tier() can find their org context.
  // Uses 'free' tier until super-admin approves and activates the org — at which point
  // the super-admin should set org tier and seats to activate the license properly.
  await admin.from("licenses").upsert({
    user_id:    userId,
    tier:       "free",
    status:     "valid",
    org_id:     org.id,
    source:     "org",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  // 7. Send alert email to Imotara admin (non-blocking — don't fail request if email fails)
  void sendAdminAlert({
    orgName:      org.name,
    orgSlug:      org.slug,
    orgId:        org.id,
    billingType:  body.billing_type,
    ownerEmail:   userEmail ?? "unknown",
    contactEmail: body.contact_email ?? null,
    description:  body.description   ?? null,
  });

  return NextResponse.json({ ok: true, org: { id: org.id, name: org.name, slug: org.slug } }, { status: 201 });
}

async function sendAdminAlert(data: {
  orgName: string; orgSlug: string; orgId: string; billingType: string;
  ownerEmail: string; contactEmail: string | null; description: string | null;
}) {
  const user = process.env.ALERT_GMAIL_USER?.trim();
  const pass = process.env.ALERT_GMAIL_APP_PASSWORD?.trim();
  if (!user || !pass) return;

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.hostinger.com", port: 465, secure: true,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from:    `"Imotara Alerts" <${user}>`,
      to:      "publisher@imotara.com",
      subject: `[New Org Request] ${data.orgName} (${data.billingType})`,
      text: [
        `New organization request submitted and pending approval.`,
        ``,
        `Name:        ${data.orgName}`,
        `Slug:        ${data.orgSlug}`,
        `Type:        ${data.billingType}`,
        `Owner email: ${data.ownerEmail}`,
        data.contactEmail ? `Contact:     ${data.contactEmail}` : null,
        data.description  ? `Description: ${data.description}`  : null,
        ``,
        `Approve at: https://imotara.com/admin → Organizations tab → search "${data.orgSlug}"`,
      ].filter((l) => l !== null).join("\n"),
    });
  } catch (err) {
    console.error("[org/new] admin alert email failed:", err);
  }
}
