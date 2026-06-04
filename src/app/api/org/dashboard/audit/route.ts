// src/app/api/org/dashboard/audit/route.ts
// GET /api/org/dashboard/audit?page=0&limit=50&export=csv
// Returns paginated org audit log. Admin only.

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const isExport = req.nextUrl.searchParams.get("export") === "csv";
  const page     = parseInt(req.nextUrl.searchParams.get("page")  ?? "0",  10);
  const limit    = isExport ? 1000 : Math.min(50, parseInt(req.nextUrl.searchParams.get("limit") ?? "25", 10));

  const admin = getSupabaseAdmin();

  const { data, count, error } = await admin
    .from("org_audit_log")
    .select("id, action, actor_email, actor_role, target_email, changes, notes, created_at", { count: "exact" })
    .eq("org_id", auth.orgId)
    .order("created_at", { ascending: false })
    .range(page * limit, page * limit + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // CSV export
  if (isExport) {
    const rows = data ?? [];
    const header = ["Date", "Action", "Actor", "Actor role", "Target", "Changes", "Notes"].join(",");
    const lines  = rows.map((r) => [
      new Date(r.created_at).toISOString(),
      r.action,
      r.actor_email ?? "",
      r.actor_role  ?? "",
      r.target_email ?? "",
      JSON.stringify(r.changes ?? {}),
      (r.notes ?? "").replace(/,/g, ";"),
    ].map((v) => `"${v}"`).join(","));

    const csv = [header, ...lines].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="org-audit-log-${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ entries: data ?? [], total: count ?? 0, page, limit });
}
