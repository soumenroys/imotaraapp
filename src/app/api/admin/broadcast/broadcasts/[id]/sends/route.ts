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

  // ── Timing, across the whole run rather than this page ───────────────────
  // "It said sent — when did it actually arrive?" is the question a report has
  // to answer, and the per-page rows cannot answer it. Capped at 5000 rows:
  // beyond that this becomes a job for a database aggregate, and saying so is
  // better than quietly reporting an average of the first 5000.
  const CAP = 5000;
  const { data: times } = await supabase
    .from("broadcast_sends")
    .select("created_at, sent_at, delivered_at")
    .eq("broadcast_id", id)
    .limit(CAP);

  const secs = (a: string | null, b: string | null) =>
    a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 1000 : null;

  const toSend: number[] = [];
  const toDeliver: number[] = [];
  let firstSent: number | null = null;
  let lastSent: number | null = null;

  for (const r of times ?? []) {
    const q = r.created_at as string | null;
    const s2 = r.sent_at as string | null;
    const d = r.delivered_at as string | null;

    const a = secs(q, s2); if (a !== null) toSend.push(a);
    const b2 = secs(s2, d); if (b2 !== null) toDeliver.push(b2);

    if (s2) {
      const t = new Date(s2).getTime();
      if (firstSent === null || t < firstSent) firstSent = t;
      if (lastSent === null || t > lastSent) lastSent = t;
    }
  }

  // Median, not mean. One message stuck behind a rate limit drags a mean far
  // from anything a person would recognise as typical.
  const median = (xs: number[]) => {
    if (xs.length === 0) return null;
    const s3 = [...xs].sort((x, y) => x - y);
    const m = Math.floor(s3.length / 2);
    return s3.length % 2 ? s3[m] : (s3[m - 1] + s3[m]) / 2;
  };

  return NextResponse.json({
    timing: {
      counted: times?.length ?? 0,
      capped: (times?.length ?? 0) >= CAP,
      firstSentAt: firstSent ? new Date(firstSent).toISOString() : null,
      lastSentAt: lastSent ? new Date(lastSent).toISOString() : null,
      sendWindowSeconds: firstSent && lastSent ? (lastSent - firstSent) / 1000 : null,
      medianSecondsToSend: median(toSend),
      medianSecondsToDeliver: median(toDeliver),
      slowestSecondsToDeliver: toDeliver.length ? Math.max(...toDeliver) : null,
      deliveryConfirmed: toDeliver.length,
    },
    sends: data ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE,
    pages: Math.ceil((count ?? 0) / PAGE),
  }, { status: 200 });
}
