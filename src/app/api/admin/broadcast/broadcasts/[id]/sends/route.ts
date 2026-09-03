// src/app/api/admin/broadcast/broadcasts/[id]/sends/route.ts
// GET — the recipient-level record for one broadcast, on screen.
//
// The CSV export already held this, but a file you have to download, open in a
// spreadsheet and read with a BOM is not where anyone looks when they want to
// know why four addresses bounced. This is the same data, filtered and paged,
// for the question actually being asked: what happened to whom.
//
// Owner role only.

import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

type Params = { params: Promise<{ id: string }> };

const PAGE = 50;

const STATUSES = new Set([
  "queued", "sent", "delivered", "bounced", "complained", "skipped", "failed",
]);

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const page = Math.max(0, parseInt(sp.get("page") ?? "0", 10));
  const status = sp.get("status") ?? "";
  const q = (sp.get("q") ?? "").trim().toLowerCase();

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("broadcast_sends")
    .select("id, email, status, skip_reason, error, resend_id, created_at, sent_at, delivered_at", { count: "exact" })
    .eq("broadcast_id", id);

  if (STATUSES.has(status)) query = query.eq("status", status);

  // A substring match rather than a prefix one: an operator hunting a problem
  // usually remembers the domain, not the first letters of the address.
  if (q) query = query.ilike("email", `%${q}%`);

  const { data, error, count } = await query
    // Anything that went wrong sorts first — the rows worth reading are the
    // ones that did not simply work.
    .order("status", { ascending: true })
    .order("email", { ascending: true })
    .range(page * PAGE, page * PAGE + PAGE - 1);

  if (error) {
    console.error("[broadcast/sends] GET:", error.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({
    sends: data ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE,
    pages: Math.ceil((count ?? 0) / PAGE),
  }, { status: 200 });
}
