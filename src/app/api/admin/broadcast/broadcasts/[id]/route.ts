// src/app/api/admin/broadcast/broadcasts/[id]/route.ts
// GET    — one broadcast with its send tallies
// PATCH  — edit, DRAFT ONLY
// DELETE — remove, DRAFT ONLY
//
// Owner role only (BC-13).
//
// Immutability once a broadcast leaves 'draft' is the point of this file. Mail
// that has gone out cannot be unsent, so the stored record must keep saying
// what was actually sent — otherwise the history report becomes a description
// of the current draft rather than an account of what people received. Use
// duplicate() to revise.

import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { renderHtml, renderText } from "@/lib/broadcast/markup";

type Params = { params: Promise<{ id: string }> };

const MAX_SUBJECT = 200;
const MAX_SOURCE = 100_000;

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: broadcast, error } = await supabase
    .from("broadcasts")
    .select("id, subject, body_source, body_html, body_text, message_type, status, from_email, from_name, list_id, created_at, started_at, finished_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[broadcast/broadcasts/:id] GET:", error.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if (!broadcast) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Per-status tallies for the results screen. head+count avoids pulling
  // thousands of rows just to count them.
  const statuses = ["queued", "sent", "delivered", "bounced", "complained", "skipped", "failed"] as const;
  const tallies: Record<string, number> = {};
  for (const s of statuses) {
    const { count } = await supabase
      .from("broadcast_sends")
      .select("id", { count: "exact", head: true })
      .eq("broadcast_id", id)
      .eq("status", s);
    tallies[s] = count ?? 0;
  }

  return NextResponse.json({ broadcast, tallies }, { status: 200 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  let body: {
    subject?: unknown; body_source?: unknown;
    message_type?: unknown; list_id?: unknown;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const supabase = getSupabaseAdmin();

  const { data: current } = await supabase
    .from("broadcasts").select("id, status").eq("id", id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (current.status !== "draft") {
    return NextResponse.json(
      {
        error: `This broadcast is ${current.status} and can no longer be edited`,
        hint: "Duplicate it to make a revised version",
        status: current.status,
      },
      { status: 409 },
    );
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.subject === "string") {
    const subject = body.subject.trim();
    if (!subject) return NextResponse.json({ error: "A subject is required" }, { status: 400 });
    if (subject.length > MAX_SUBJECT) {
      return NextResponse.json(
        { error: `Subject must be ${MAX_SUBJECT} characters or fewer` }, { status: 400 },
      );
    }
    patch.subject = subject;
  }
  // Source in, rendered output derived here — see the note in POST. The three
  // columns are written together so body_html can never describe a version of
  // the message the admin did not write.
  if (typeof body.body_source === "string") {
    if (body.body_source.length > MAX_SOURCE) {
      return NextResponse.json({ error: "That message is too long" }, { status: 413 });
    }
    patch.body_source = body.body_source;
    patch.body_html = renderHtml(body.body_source);
    patch.body_text = renderText(body.body_source);
  }
  if (body.message_type === "broadcast" || body.message_type === "operational") {
    patch.message_type = body.message_type;
  }
  if (typeof body.list_id === "string" || body.list_id === null) patch.list_id = body.list_id;

  // from_email, from_name and created_by are absent by design — the sender is
  // whoever created the draft, and a later edit must not quietly reassign
  // authorship of a message.

  const { data, error } = await supabase
    .from("broadcasts")
    .update(patch)
    .eq("id", id)
    .eq("status", "draft")   // re-checked in the WHERE: the status could have
                             // changed between the read above and this write
    .select("id, subject, body_source, body_html, body_text, message_type, status, from_email, from_name, list_id, created_at")
    .maybeSingle();

  if (error) {
    console.error("[broadcast/broadcasts/:id] PATCH:", error.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "This broadcast started sending while you were editing" }, { status: 409 },
    );
  }

  return NextResponse.json({ broadcast: data }, { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: current } = await supabase
    .from("broadcasts").select("id, status").eq("id", id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (current.status !== "draft") {
    return NextResponse.json(
      {
        error: `This broadcast is ${current.status} and cannot be deleted`,
        hint: "Sent broadcasts are kept as a permanent record of what people received",
        status: current.status,
      },
      { status: 409 },
    );
  }

  const { error } = await supabase
    .from("broadcasts").delete().eq("id", id).eq("status", "draft");

  if (error) {
    console.error("[broadcast/broadcasts/:id] DELETE:", error.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
