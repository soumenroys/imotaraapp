// GET /api/admin/connect/[id]/docs
// Admin only. Returns signed URLs (1-hour TTL) for all verification documents
// of the consultant with the given id.

import { NextRequest, NextResponse } from "next/server";
import { connectAdminAuthorized } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const BUCKET = "connect-docs";
const SIGNED_URL_TTL = 3600; // 1 hour

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await connectAdminAuthorized(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: consultant, error } = await supabase
    .from("connect_consultants")
    .select("id, display_name, verification_docs, docs_verified, docs_notes")
    .eq("id", id)
    .single();

  if (error || !consultant) {
    return NextResponse.json({ ok: false, error: "Consultant not found" }, { status: 404 });
  }

  const docs = consultant.verification_docs as Record<string, { path: string; name: string }> | null;
  if (!docs || Object.keys(docs).length === 0) {
    return NextResponse.json({ ok: true, docs: {}, docs_verified: consultant.docs_verified });
  }

  // Generate signed URLs for each document
  const signed: Record<string, { url: string; name: string } | null> = {};
  for (const [docType, docInfo] of Object.entries(docs)) {
    if (!docInfo) { signed[docType] = null; continue; }
    // same_as_profile: return the public URL directly
    if ((docInfo as Record<string, unknown>).same_as_profile) {
      const publicUrl = (docInfo as Record<string, unknown>).public_url as string | undefined;
      signed[docType] = publicUrl ? { url: publicUrl, name: docInfo.name } : null;
      continue;
    }
    if (!docInfo.path) { signed[docType] = null; continue; }
    const { data, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(docInfo.path, SIGNED_URL_TTL);
    signed[docType] = signErr ? null : { url: data?.signedUrl ?? "", name: docInfo.name };
  }

  return NextResponse.json({
    ok: true,
    consultant_name: consultant.display_name,
    docs: signed,
    docs_verified: consultant.docs_verified,
    docs_notes: consultant.docs_notes,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await connectAdminAuthorized(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const updates: Record<string, unknown> = {};
  if (typeof body.docs_verified === "boolean") updates.docs_verified = body.docs_verified;
  if (typeof body.docs_notes === "string") updates.docs_notes = body.docs_notes.slice(0, 500);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("connect_consultants")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("[admin/connect/docs] DB update failed:", error.message, "consultant:", id);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
