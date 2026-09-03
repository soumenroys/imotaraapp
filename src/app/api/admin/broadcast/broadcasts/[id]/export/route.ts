// src/app/api/admin/broadcast/broadcasts/[id]/export/route.ts
// GET — recipient-level CSV for one broadcast. One row per address.
//
// This is the audit artefact: what was sent, to whom, what happened, and —
// where it can still be resolved — where that address came from in the first
// place. Owner role only (BC-15).

import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { cell, row, UTF8_BOM } from "@/lib/broadcast/csv";

type Params = { params: Promise<{ id: string }> };

const PAGE = 1000;

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: b } = await supabase
    .from("broadcasts")
    .select("id, subject, from_email, from_name, list_id, started_at, finished_at, message_type")
    .eq("id", id)
    .maybeSingle();

  if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Provenance lives on broadcast_recipients, keyed by (list_id, email).
  // A send row deliberately has no FK to it — the send record has to outlive
  // the recipient being removed from the list — so this is a best-effort
  // lookup and the CSV says so per row rather than leaving a silent blank.
  const provenance = new Map<string, { source: string; detail: string; collected: string }>();
  if (b.list_id) {
    for (let from = 0; ; from += PAGE) {
      const { data } = await supabase
        .from("broadcast_recipients")
        .select("email, source, source_detail, collected_at")
        .eq("list_id", b.list_id)
        .range(from, from + PAGE - 1);
      if (!data || data.length === 0) break;
      for (const r of data) {
        provenance.set(r.email as string, {
          source: r.source as string,
          detail: r.source_detail as string,
          collected: r.collected_at as string,
        });
      }
      if (data.length < PAGE) break;
    }
  }

  const lines: string[] = [
    row([
      "email", "status", "skip_reason", "queued_at", "sent_at", "delivered_at",
      "error", "consent_source", "consent_detail", "collected_at",
    ]),
  ];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("broadcast_sends")
      .select("email, status, skip_reason, queued_at, sent_at, delivered_at, error")
      .eq("broadcast_id", id)
      .order("email", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) {
      console.error("[broadcast/export]:", error.message);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
    if (!data || data.length === 0) break;

    for (const r of data) {
      const p = provenance.get(r.email as string);
      lines.push(row([
        r.email, r.status, r.skip_reason,
        r.queued_at, r.sent_at, r.delivered_at, r.error,
        p?.source ?? "(no longer on the list)",
        p?.detail ?? "",
        p?.collected ?? "",
      ]));
    }

    if (data.length < PAGE) break;
  }

  const slug = (b.subject ?? "broadcast")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const date = (b.started_at ?? b.finished_at ?? new Date().toISOString()).slice(0, 10);

  // The BOM is prepended to the BODY — a charset in the header alone does not
  // make Excel read UTF-8.
  return new NextResponse(UTF8_BOM + lines.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="imotara-${slug}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
