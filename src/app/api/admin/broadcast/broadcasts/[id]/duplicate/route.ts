// src/app/api/admin/broadcast/broadcasts/[id]/duplicate/route.ts
// POST — copy a broadcast into a fresh draft.
//
// This is what makes immutability tolerable. A sent broadcast cannot be edited
// because the record must keep saying what people actually received; without a
// one-click way to make a revised version, that rule would just be an
// obstacle. Owner role only (BC-13).

import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: src, error } = await supabase
    .from("broadcasts")
    .select("subject, body_html, body_text, message_type, list_id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[broadcast/duplicate] read:", error.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if (!src) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The COPY is sent by whoever duplicated it, not by the original author.
  // Inheriting the original sender would let one owner send mail under
  // another's name without ever being asked.
  const { data, error: iErr } = await supabase
    .from("broadcasts")
    .insert({
      subject: `${src.subject} (copy)`.slice(0, 200),
      body_html: src.body_html,
      body_text: src.body_text,
      message_type: src.message_type,
      list_id: src.list_id,
      from_email: auth.admin.email.toLowerCase(),
      from_name: auth.admin.name,
      created_by: auth.admin.id,
      status: "draft",
    })
    .select("id, subject, message_type, status, from_email, from_name, list_id, created_at")
    .single();

  if (iErr) {
    console.error("[broadcast/duplicate] insert:", iErr.message);
    return NextResponse.json({ error: "Could not duplicate" }, { status: 500 });
  }

  // Deliberately NOT copied: status, started_at, finished_at, and every
  // broadcast_sends row. The copy is a new message that has been sent to
  // nobody — carrying any of that across would make the history report claim
  // deliveries that never happened.
  return NextResponse.json({ broadcast: data }, { status: 201 });
}
