// src/app/api/admin/broadcast/interest/route.ts
// GET   — people who asked to hear from us through the public form
// PATCH — act on one: add them to a list, or set it aside
//
// Without this the form is a black hole: consent collected and never used.
// Owner role only (BC-26).

import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const status = req.nextUrl.searchParams.get("status") ?? "new";
  const supabase = getSupabaseAdmin();

  const q = supabase
    .from("broadcast_interest_submissions")
    .select("id, email, name, message, ip, status, created_at, confirmed_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const { data, error } = status === "all" ? await q : await q.eq("status", status);

  if (error) {
    console.error("[broadcast/interest] GET:", error.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  // Anyone already suppressed is flagged rather than hidden. A person who
  // unsubscribed and then filled the form in again is a real decision for a
  // human to make — and one that must never be made silently, in either
  // direction.
  const emails = (data ?? []).map((r) => r.email as string);
  const suppressed = new Set<string>();
  if (emails.length > 0) {
    const { data: sup } = await supabase
      .from("broadcast_suppressions").select("email").in("email", emails);
    for (const s of sup ?? []) suppressed.add(s.email as string);
  }

  return NextResponse.json({
    submissions: (data ?? []).map((r) => ({ ...r, suppressed: suppressed.has(r.email as string) })),
  }, { status: 200 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  let body: { id?: unknown; action?: unknown; listId?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: sub } = await supabase
    .from("broadcast_interest_submissions")
    .select("id, email, created_at, ip, status, confirmed_at")
    .eq("id", id)
    .maybeSingle();

  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.action === "ignore") {
    await supabase.from("broadcast_interest_submissions").update({ status: "ignored" }).eq("id", id);
    return NextResponse.json({ ok: true, status: "ignored" }, { status: 200 });
  }

  // An unconfirmed address is a claim that someone typed it, not evidence that
  // they own it. Adding it to a list would put the whole list's provenance in
  // doubt, so it is refused rather than warned about.
  if (body.action === "add" && !sub.confirmed_at) {
    return NextResponse.json({
      error: "They have not confirmed this address yet",
      hint: "A confirmation email was sent when they submitted the form. Until they press the link, we only know somebody typed the address.",
    }, { status: 409 });
  }

  if (body.action !== "add") {
    return NextResponse.json({ error: "action must be 'add' or 'ignore'" }, { status: 400 });
  }

  const listId = typeof body.listId === "string" ? body.listId : "";
  if (!listId) return NextResponse.json({ error: "listId is required" }, { status: 400 });

  const { data: list } = await supabase
    .from("broadcast_lists").select("id").eq("id", listId).maybeSingle();
  if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });

  // Provenance is copied from the submission, not typed by the admin. That is
  // the whole advantage of the form: the source is 'website_form', the date is
  // when they actually submitted it, and the detail carries the IP the consent
  // came from. Nobody transcribes anything, so nobody can transcribe it wrong.
  const submittedOn = String(sub.created_at).slice(0, 10);
  const { error } = await supabase.from("broadcast_recipients").upsert({
    list_id: listId,
    email: sub.email,
    source: "website_form",
    source_detail: `Submitted the form on imotara.com${sub.ip ? ` from ${sub.ip}` : ""}`,
    collected_at: submittedOn,
    added_by: auth.admin.id,
  }, { onConflict: "list_id,email", ignoreDuplicates: true });

  if (error) {
    console.error("[broadcast/interest] add:", error.message);
    return NextResponse.json({ error: "Could not add them to that list" }, { status: 500 });
  }

  await supabase
    .from("broadcast_interest_submissions")
    .update({ status: "added_to_list" })
    .eq("id", id);

  return NextResponse.json({ ok: true, status: "added_to_list" }, { status: 200 });
}
