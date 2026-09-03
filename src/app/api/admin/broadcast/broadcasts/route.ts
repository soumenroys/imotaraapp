// src/app/api/admin/broadcast/broadcasts/route.ts
// GET  — every broadcast, newest first, with its send tallies
// POST — create a draft
//
// Owner role only (BC-13).

import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { renderHtml, renderText } from "@/lib/broadcast/markup";

const MAX_SUBJECT = 200;
const MAX_SOURCE = 100_000;   // ~30 printed pages; a paste bigger than this is a mistake

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
    subject?: unknown; body_source?: unknown;
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

  // The client sends SOURCE only. body_html and body_text are rendered here,
  // from a whitelist, and are never accepted from a request — otherwise the
  // composer's escaping would be a suggestion rather than a rule, and anyone
  // able to reach this route could put arbitrary HTML into mail signed by our
  // domain.
  const source = typeof body.body_source === "string" ? body.body_source : "";
  if (source.length > MAX_SOURCE) {
    return NextResponse.json({ error: "That message is too long" }, { status: 413 });
  }

  // from_email and from_name are SNAPSHOTTED from the signed-in owner, never
  // supplied by the client. Letting a request choose its own From would make
  // "who sent this" a claim rather than a fact, and the history report exists
  // precisely to answer that question.
  const { data, error } = await getSupabaseAdmin()
    .from("broadcasts")
    .insert({
      subject,
      body_source: source,
      body_html: renderHtml(source),
      body_text: renderText(source),
      message_type: messageType,
      list_id: typeof body.list_id === "string" ? body.list_id : null,
      from_email: auth.admin.email.toLowerCase(),
      from_name: auth.admin.name,
      created_by: auth.admin.id,
      status: "draft",
    })
    .select("id, subject, body_source, message_type, status, from_email, from_name, list_id, created_at")
    .single();

  if (error) {
    console.error("[broadcast/broadcasts] POST:", error.message);
    return NextResponse.json({ error: "Could not create the draft" }, { status: 500 });
  }

  return NextResponse.json({ broadcast: data }, { status: 201 });
}
