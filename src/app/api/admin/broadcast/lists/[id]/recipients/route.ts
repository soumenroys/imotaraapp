// src/app/api/admin/broadcast/lists/[id]/recipients/route.ts
// GET    — recipients on a list (paged)
// POST   — bulk add from pasted text; returns the five validation buckets
// DELETE — remove one address from the list
//
// Owner role only (BC-12).

import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { classify } from "@/lib/broadcast/parseRecipients";

type Params = { params: Promise<{ id: string }> };

const PAGE = 1000;
const MAX_PASTE = 200_000;   // ~10k addresses; guards against a pasted file

// The eight allowed provenance values. Kept in sync with the CHECK constraint
// in docs/sql/broadcast_v1.sql — every one names something the PERSON did.
// There is deliberately no 'found_online': a vague source becomes a laundering
// route for addresses that were never offered, so the enum is the control.
const SOURCES = [
  "event", "meeting", "email", "whatsapp",
  "social", "website_form", "phone", "app_signup",
] as const;
type Source = (typeof SOURCES)[number];

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const page = Math.max(0, parseInt(req.nextUrl.searchParams.get("page") ?? "0", 10));
  const supabase = getSupabaseAdmin();

  const { data, error, count } = await supabase
    .from("broadcast_recipients")
    .select("id, email, name, source, source_detail, collected_at, created_at", { count: "exact" })
    .eq("list_id", id)
    .order("email", { ascending: true })
    .range(page * PAGE, page * PAGE + PAGE - 1);

  if (error) {
    console.error("[broadcast/recipients] GET:", error.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ recipients: data ?? [], total: count ?? 0, page }, { status: 200 });
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const { id: listId } = await params;

  let body: {
    raw?: unknown; source?: unknown; source_detail?: unknown;
    collected_at?: unknown; dryRun?: unknown;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const raw = typeof body.raw === "string" ? body.raw : "";
  if (!raw.trim()) {
    return NextResponse.json({ error: "Paste at least one address" }, { status: 400 });
  }
  if (raw.length > MAX_PASTE) {
    return NextResponse.json({ error: "That paste is too large — split it up" }, { status: 413 });
  }

  // ── Provenance is mandatory ────────────────────────────────────────────────
  // Rejected here, not merely encouraged in the UI. GDPR requires the
  // controller to DEMONSTRATE consent, and an address whose origin nobody
  // recorded cannot be defended later. A dry run is exempt: previewing what a
  // paste contains is not storing anything.
  const dryRun = body.dryRun === true;
  const source = String(body.source ?? "") as Source;
  const sourceDetail = typeof body.source_detail === "string" ? body.source_detail.trim() : "";
  const collectedAt = typeof body.collected_at === "string" ? body.collected_at.trim() : "";

  if (!dryRun) {
    if (!SOURCES.includes(source)) {
      return NextResponse.json(
        { error: "A consent source is required", allowed: SOURCES }, { status: 400 },
      );
    }
    if (!sourceDetail) {
      return NextResponse.json(
        { error: "Describe where these addresses came from" }, { status: 400 },
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(collectedAt)) {
      return NextResponse.json(
        { error: "A collection date is required (YYYY-MM-DD)" }, { status: 400 },
      );
    }
    if (collectedAt > new Date().toISOString().slice(0, 10)) {
      return NextResponse.json(
        { error: "The collection date cannot be in the future" }, { status: 400 },
      );
    }
  }

  const supabase = getSupabaseAdmin();

  const { data: list } = await supabase
    .from("broadcast_lists").select("id").eq("id", listId).maybeSingle();
  if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });

  // ── Load what we compare against ───────────────────────────────────────────
  const existing = new Map<string, string | null>();
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("broadcast_recipients")
      .select("email, created_at")
      .eq("list_id", listId)
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const r of data) existing.set(r.email as string, (r.created_at as string) ?? null);
    if (data.length < PAGE) break;
  }

  const { data: sup } = await supabase
    .from("broadcast_suppressions").select("email, reason");
  const suppressed = new Map<string, string>(
    (sup ?? []).map((s) => [s.email as string, s.reason as string]),
  );

  const buckets = classify(raw, existing, suppressed);

  if (dryRun) {
    return NextResponse.json({ dryRun: true, buckets, wouldAdd: buckets.toAdd.length });
  }

  // ── Write ──────────────────────────────────────────────────────────────────
  let added = 0;
  if (buckets.toAdd.length > 0) {
    const rows = buckets.toAdd.map((a) => ({
      list_id: listId,
      email: a.email,
      source,
      source_detail: sourceDetail,
      collected_at: collectedAt,
      added_by: auth.admin.id,
    }));

    // ignoreDuplicates guards the race where the same paste is submitted twice
    // — the unique index on (list_id, email) would otherwise 23505 the whole
    // batch and lose every good address alongside the duplicate.
    const { error, count } = await supabase
      .from("broadcast_recipients")
      .upsert(rows, { onConflict: "list_id,email", ignoreDuplicates: true, count: "exact" });

    if (error) {
      console.error("[broadcast/recipients] POST:", error.message);
      return NextResponse.json({ error: "Could not save the addresses" }, { status: 500 });
    }
    added = count ?? rows.length;
  }

  return NextResponse.json({ added, buckets }, { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const { id: listId } = await params;
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("broadcast_recipients")
    .delete()
    .eq("list_id", listId)
    .eq("email", email);

  if (error) {
    console.error("[broadcast/recipients] DELETE:", error.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  // Removing someone from a list is NOT an unsubscribe — it does not touch
  // broadcast_suppressions. Suppression is the recipient's decision; list
  // membership is the admin's. Conflating them would let a tidy-up silently
  // resubscribe someone who had opted out.
  return NextResponse.json({ ok: true }, { status: 200 });
}
