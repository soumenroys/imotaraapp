// POST   /api/admin/broadcast/broadcasts/:id/approve — approve the content exactly as it stands.
// DELETE /api/admin/broadcast/broadcasts/:id/approve — withdraw the approval.
//
// 🔑 Owner, 24 Oct 2026: approval before anything is sent or scheduled, like the
// social scheduler ⇒ lib/broadcast/approval.ts. Owner role only, as broadcast is.
import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { approve, withdraw } from "@/lib/broadcast/approval";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data: b } = await supabase
    .from("broadcasts")
    .select("id, status, subject, body_html, body_text, header_text, list_id, from_email, message_type")
    .eq("id", id)
    .maybeSingle();
  if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (b.status !== "draft") return NextResponse.json({ error: `This broadcast is ${b.status}; only a draft is approved.` }, { status: 409 });
  if (!b.subject?.trim() || (!b.body_html?.trim() && !b.body_text?.trim())) {
    return NextResponse.json({ error: "There is nothing to approve yet — write the subject and the message first." }, { status: 400 });
  }
  try {
    const a = await approve(supabase, id, b, auth.admin.email);
    console.log("[broadcast/approve]", { id, by: auth.admin.email });
    return NextResponse.json({ ok: true, approval: a });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    await withdraw(getSupabaseAdmin(), id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
