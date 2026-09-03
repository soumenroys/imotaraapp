// src/app/api/admin/broadcast/identities/route.ts
// GET / PUT — the names and addresses broadcasts may be sent as.
//
// Owner role only.

import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { storedIdentities, availableIdentities, saveIdentities } from "@/lib/broadcast/identities";
import { sendingDomain } from "@/lib/broadcast/resendClient";
import type { Identity } from "@/lib/broadcast/resendClient";

export async function GET(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const supabase = getSupabaseAdmin();
  return NextResponse.json({
    // Both, because they answer different questions: `stored` is what the
    // owner configured and can edit, `available` is what a draft can actually
    // use — which also includes the signed-in admin's own address when it
    // happens to be on the domain, and that one is not editable here.
    stored: await storedIdentities(supabase),
    available: await availableIdentities(supabase, auth.admin.email, auth.admin.name),
    domain: sendingDomain(),
  }, { status: 200 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  let body: { identities?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  if (!Array.isArray(body.identities)) {
    return NextResponse.json({ error: "identities must be a list" }, { status: 400 });
  }
  if (body.identities.length > 20) {
    return NextResponse.json({ error: "That is more sending addresses than anyone needs" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const result = await saveIdentities(supabase, body.identities as Identity[]);

  if (!result.ok) {
    return NextResponse.json({ error: result.error, domain: sendingDomain() }, { status: 400 });
  }

  return NextResponse.json({ ok: true, stored: result.saved }, { status: 200 });
}
