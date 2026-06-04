// src/app/api/org/certificate/impact-report/route.ts
// GET /api/org/certificate/impact-report?months=3
// Generates a grant-ready HTML impact report for NGO/EDU orgs.

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getOrgUsageStats } from "@/lib/imotara/org";

export async function GET(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();
  const { data: org } = await admin.from("organizations").select("name, billing_type, seats_used, created_at").eq("id", auth.orgId).single();

  if (!["ngo","edu"].includes(org?.billing_type ?? "")) {
    return NextResponse.json({ error: "Impact reports are available for NGO and EDU organisations only." }, { status: 403 });
  }

  const months   = Math.min(12, parseInt(req.nextUrl.searchParams.get("months") ?? "3", 10));
  const days     = months * 30;
  const statsRes = await getOrgUsageStats(auth.orgId, days);
  const stats    = statsRes.ok ? statsRes.data : [];

  const totalSessions   = stats.reduce((s, r) => s + r.totalEvents, 0);
  const activeDays      = stats.filter((r) => r.activeUsers > 0).length;
  const avgWAU          = stats.length ? Math.round(stats.reduce((s, r) => s + r.activeUsers, 0) / stats.length) : 0;
  const maxDailyUsers   = stats.length ? Math.max(...stats.map((r) => r.activeUsers)) : 0;

  const from = new Date(Date.now() - days * 86_400_000).toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" });
  const to   = new Date().toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" });
  const generated = new Date().toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Impact Report — ${org?.name}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111827;background:#fff;padding:32px}
  .page{max-width:700px;margin:auto}
  .header{border-bottom:3px solid #4f46e5;padding-bottom:24px;margin-bottom:32px}
  .org{font-size:24px;font-weight:700;color:#1e1b4b}
  .sub{font-size:13px;color:#6b7280;margin-top:4px}
  h2{font-size:16px;font-weight:600;color:#374151;margin:24px 0 12px}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:16px 0}
  .stat{background:#f5f3ff;border-radius:10px;padding:16px;text-align:center}
  .stat-val{font-size:28px;font-weight:700;color:#4f46e5}
  .stat-label{font-size:12px;color:#6b7280;margin-top:4px}
  .chart{height:80px;display:flex;align-items:flex-end;gap:3px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin:12px 0}
  .bar{background:#c7d2fe;border-radius:3px 3px 0 0;flex:1;min-height:2px}
  .note{font-size:11px;color:#9ca3af;margin-top:8px}
  .section{margin-top:32px}
  .footer{border-top:1px solid #e5e7eb;padding-top:16px;margin-top:32px;font-size:11px;color:#9ca3af}
  @media print{body{padding:16px}}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div class="org">${org?.name ?? "Organisation"}</div>
        <div class="sub">Emotional Wellness Impact Report · ${from} – ${to}</div>
      </div>
      <div style="font-size:22px;font-weight:700;color:#4f46e5">imotara.</div>
    </div>
  </div>

  <h2>Executive Summary</h2>
  <p style="font-size:13px;color:#374151;line-height:1.6">
    This report summarises the emotional wellness engagement of <strong>${org?.name}</strong>'s members
    on the Imotara platform over the past ${months} month${months !== 1 ? "s" : ""}. All data is
    aggregate and fully anonymised — no individual user data is shown.
  </p>

  <div class="stats">
    <div class="stat"><div class="stat-val">${org?.seats_used ?? 0}</div><div class="stat-label">Active members</div></div>
    <div class="stat"><div class="stat-val">${totalSessions.toLocaleString()}</div><div class="stat-label">Total sessions</div></div>
    <div class="stat"><div class="stat-val">${avgWAU}</div><div class="stat-label">Avg weekly active</div></div>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-val">${activeDays}</div><div class="stat-label">Days with activity</div></div>
    <div class="stat"><div class="stat-val">${maxDailyUsers}</div><div class="stat-label">Peak daily users</div></div>
    <div class="stat"><div class="stat-val">${months}mo</div><div class="stat-label">Report period</div></div>
  </div>

  <div class="section">
    <h2>Daily Activity Trend</h2>
    <div class="chart">
      ${(() => {
        if (stats.length === 0) return '<div style="font-size:12px;color:#9ca3af;padding:20px">No activity data in this period.</div>';
        const max = Math.max(...stats.map((s) => s.totalEvents), 1);
        return stats.slice().reverse().map((s) => {
          const h = Math.max(4, Math.round((s.totalEvents / max) * 72));
          return `<div class="bar" style="height:${h}px" title="${s.statDate}: ${s.totalEvents} sessions"></div>`;
        }).join("");
      })()}
    </div>
    <div class="note">Each bar represents one day of activity. Data is anonymised aggregate counts.</div>
  </div>

  <div class="section">
    <h2>Programme Impact Statement</h2>
    <p style="font-size:13px;color:#374151;line-height:1.7">
      Through the Imotara Emotional Wellness Programme, <strong>${org?.name}</strong> has provided
      a private, judgment-free space for ${org?.seats_used ?? 0} individuals to reflect on their
      emotional wellbeing. Over ${months} month${months !== 1 ? "s" : ""}, members engaged in
      ${totalSessions.toLocaleString()} wellness sessions, with an average of ${avgWAU} users
      engaging each week.
    </p>
    <p style="font-size:13px;color:#374151;line-height:1.7;margin-top:12px">
      Imotara is a private, AI-powered emotional companion that helps individuals process emotions,
      build resilience, and develop self-awareness — with no ads, no social feed, and full privacy.
      All conversations remain confidential and are never shared with the organisation.
    </p>
  </div>

  <div class="footer">
    Generated: ${generated} · Imotara · info@imotara.com · imotara.com<br/>
    This report contains aggregated, anonymised data only. Individual user data is never disclosed.
  </div>
</div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="imotara-impact-report-${org?.name?.toLowerCase().replace(/\s+/g,"-") ?? "org"}-${months}mo.html"`,
    },
  });
}
