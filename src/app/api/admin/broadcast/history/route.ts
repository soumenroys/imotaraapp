// src/app/api/admin/broadcast/history/route.ts
// GET — every broadcast ever sent, with per-send tallies and a summary strip.
//
// Owner role only (BC-15). This is the audit trail: sent broadcasts are
// immutable, so this is the permanent account of what was sent, by whom, to
// how many, and what happened to each message.

import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

type Tally = {
  broadcast_id: string;
  queued: number; sent: number; delivered: number; bounced: number;
  complained: number; skipped: number; failed: number; attempted: number;
};

const ZERO = {
  queued: 0, sent: 0, delivered: 0, bounced: 0,
  complained: 0, skipped: 0, failed: 0, attempted: 0,
};

export async function GET(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const supabase = getSupabaseAdmin();
  const limit = Math.min(200, parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10));

  const { data: broadcasts, error } = await supabase
    .from("broadcasts")
    .select("id, subject, message_type, status, from_email, from_name, created_at, started_at, finished_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[broadcast/history] GET:", error.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  // One round trip for every tally, rather than a count query per broadcast
  // per status.
  const { data: tallies, error: tErr } = await supabase.rpc("broadcast_history_summary");
  if (tErr) {
    console.error("[broadcast/history] rpc:", tErr.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const byId = new Map<string, Tally>(
    ((tallies ?? []) as Tally[]).map((t) => [t.broadcast_id, t]),
  );

  const rows = (broadcasts ?? []).map((b) => {
    const t = byId.get(b.id);
    return {
      id: b.id,
      subject: b.subject,
      messageType: b.message_type,
      status: b.status,
      from: b.from_name ? `${b.from_name} <${b.from_email}>` : b.from_email,
      fromEmail: b.from_email,
      createdAt: b.created_at,
      startedAt: b.started_at,
      finishedAt: b.finished_at,
      tallies: t ? { ...ZERO, ...t } : { ...ZERO },
    };
  });

  // Totals across the whole table, not just the page — a summary that only
  // covered the most recent 50 would quietly change meaning as the list grew.
  const all = (tallies ?? []) as Tally[];
  const sum = (k: keyof Tally) => all.reduce((n, t) => n + Number(t[k] ?? 0), 0);

  const attempted = sum("attempted");
  const delivered = sum("delivered");

  return NextResponse.json({
    summary: {
      broadcasts: all.length,
      attempted,
      delivered,
      bounced: sum("bounced"),
      complained: sum("complained"),
      failed: sum("failed"),
      skipped: sum("skipped"),
      // null rather than 0 when nothing has been attempted: a delivery rate of
      // "0%" would read as total failure rather than "nothing sent yet".
      deliveredPct: attempted > 0 ? Math.round((delivered / attempted) * 1000) / 10 : null,
    },
    broadcasts: rows,
  }, { status: 200 });
}
