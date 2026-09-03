// src/app/api/admin/broadcast/broadcasts/route.ts
// GET  — every broadcast, newest first, with its send tallies
// POST — create a draft
//
// Owner role only (BC-13).

import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const MAX_SUBJECT = 200;

export async function GET(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("broadcasts")
    .select("id, subject, message_type, status, from_email, from_name, list_id, created_at, started_at, finished_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[broadcast/broadcasts] GET:", error.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ broadcasts: data ?? [] }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  let body: {
    subject?: unknown; body_html?: unknown; body_text?: unknown;
    message_type?: unknown; list_id?: unknown;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  if (!subject) return NextResponse.json({ error: "A subject is required" }, { status: 400 });
  if (subject.length > MAX_SUBJECT) {
    return NextResponse.json(
      { error: `Subject must be ${MAX_SUBJECT} characters or fewer` }, { status: 400 },
    );
  }

  const messageType = body.message_type === "operational" ? "operational" : "broadcast";

  // from_email and from_name are SNAPSHOTTED from the signed-in owner, never
  // supplied by the client. Letting a request choose its own From would make
  // "who sent this" a claim rather than a fact, and the history report exists
  // precisely to answer that question.
  const { data, error } = await getSupabaseAdmin()
    .from("broadcasts")
    .insert({
      subject,
      body_html: typeof body.body_html === "string" ? body.body_html : "",
      body_text: typeof body.body_text === "string" ? body.body_text : "",
      message_type: messageType,
      list_id: typeof body.list_id === "string" ? body.list_id : null,
      from_email: auth.admin.email.toLowerCase(),
      from_name: auth.admin.name,
      created_by: auth.admin.id,
      status: "draft",
    })
    .select("id, subject, message_type, status, from_email, from_name, list_id, created_at")
    .single();

  if (error) {
    console.error("[broadcast/broadcasts] POST:", error.message);
    return NextResponse.json({ error: "Could not create the draft" }, { status: 500 });
  }

  return NextResponse.json({ broadcast: data }, { status: 201 });
}
