// src/app/api/org/dashboard/apikeys/route.ts
// GET    — list active API keys for org
// POST   — generate new API key (returns plaintext once)
// DELETE ?keyId= — revoke a key

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { generateApiKey } from "@/lib/imotara/apiKeyAuth";

export async function GET(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const { data, error } = await getSupabaseAdmin()
    .from("api_keys")
    .select("id, name, key_prefix, scopes, rate_limit, last_used_at, created_at")
    .eq("org_id", auth.orgId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { name: string; scopes?: string[] };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  if (!body.name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  // UI hides key generation for non-Enterprise orgs, but nothing stopped a
  // direct API call from minting a permanently-useless key (the two
  // consuming endpoints, /api/v1/org/members and /stats, already require
  // Enterprise). Enforcing it here too for defense-in-depth.
  const { data: org } = await getSupabaseAdmin().from("organizations").select("tier").eq("id", auth.orgId).single();
  if (org?.tier !== "enterprise") {
    return NextResponse.json({ error: "API access requires the Enterprise plan" }, { status: 403 });
  }

  const VALID_SCOPES = ["read:stats", "read:members"];
  const scopes = (body.scopes ?? ["read:stats", "read:members"])
    .filter((s) => VALID_SCOPES.includes(s));

  const { key, prefix, hash } = generateApiKey();

  const { data, error } = await getSupabaseAdmin()
    .from("api_keys")
    .insert({
      org_id:     auth.orgId,
      name:       body.name.trim(),
      key_prefix: prefix,
      key_hash:   hash,
      scopes,
      rate_limit: 100,
      created_by: auth.userId,
    })
    .select("id, name, key_prefix, scopes, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return the plaintext key ONCE — never stored
  return NextResponse.json({ key: { ...data, plaintext: key } }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const keyId = req.nextUrl.searchParams.get("keyId");
  if (!keyId) return NextResponse.json({ error: "keyId required" }, { status: 400 });

  const { error } = await getSupabaseAdmin()
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("org_id", auth.orgId); // ensure org can only revoke its own keys

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
