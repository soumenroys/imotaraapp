// src/app/api/org/certificate/route.ts
// GET /api/org/certificate — generate NGO Emotional Wellness Champion certificate
// Returns HTML certificate for the org if eligibility milestone is met.
// Eligibility: org is NGO/EDU billing_type, active, has ≥10 active members,
//              org has been active for ≥30 days.

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const auth = await requireOrgMember(req);
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();

  const { data: org } = await admin
    .from("organizations")
    .select("name, billing_type, status, seats_used, created_at")
    .eq("id", auth.orgId)
    .single();

  if (!org) return NextResponse.json({ error: "org not found" }, { status: 404 });

  // Eligibility check
  const daysSinceCreation = (Date.now() - new Date(org.created_at).getTime()) / (1000 * 60 * 60 * 24);
  const isEligible =
    ["ngo", "edu"].includes(org.billing_type) &&
    org.status === "active" &&
    org.seats_used >= 10 &&
    daysSinceCreation >= 30;

  if (!isEligible) {
    return NextResponse.json({
      eligible: false,
      reason: org.status !== "active"  ? "Organisation is not yet active"
             : org.seats_used < 10     ? `Need at least 10 active members (currently ${org.seats_used})`
             : daysSinceCreation < 30  ? `Organisation needs to be active for at least 30 days`
             : "Not eligible for this certificate",
    }, { status: 200 });
  }

  const issuedDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Imotara Emotional Wellness Champion — ${org.name}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#f5f0ff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:32px;font-family:'Inter',sans-serif}
  .cert{background:#fff;border:3px solid #4f46e5;border-radius:16px;padding:56px 64px;max-width:720px;width:100%;text-align:center;position:relative;box-shadow:0 20px 60px rgba(79,70,229,0.15)}
  .cert::before{content:'';position:absolute;inset:8px;border:1px solid #c7d2fe;border-radius:10px;pointer-events:none}
  .logo{font-size:28px;font-weight:700;color:#4f46e5;letter-spacing:-0.5px;margin-bottom:4px}
  .logo span{color:#10b981}
  .tagline{font-size:12px;color:#6b7280;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:40px}
  .badge{display:inline-block;background:linear-gradient(135deg,#4f46e5,#10b981);color:#fff;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;padding:6px 16px;border-radius:999px;margin-bottom:32px}
  h1{font-family:'Playfair Display',serif;font-size:36px;color:#1e1b4b;margin-bottom:16px;line-height:1.2}
  .presented{font-size:13px;color:#6b7280;margin-bottom:12px;letter-spacing:0.05em}
  .org-name{font-family:'Playfair Display',serif;font-size:28px;color:#4f46e5;font-weight:700;margin-bottom:24px}
  .body-text{font-size:14px;color:#374151;line-height:1.7;max-width:520px;margin:0 auto 40px}
  .stats{display:flex;justify-content:center;gap:48px;margin:32px 0 40px;padding:24px;background:#f5f3ff;border-radius:12px}
  .stat-label{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em}
  .stat-value{font-size:22px;font-weight:700;color:#4f46e5;margin-top:2px}
  .footer{border-top:1px solid #e5e7eb;padding-top:24px;margin-top:8px;display:flex;justify-content:space-between;align-items:center}
  .issued{font-size:12px;color:#9ca3af}
  .seal{font-size:32px}
  @media print{body{background:#fff;padding:0}.cert{border:3px solid #4f46e5;box-shadow:none}}
</style>
</head>
<body>
<div class="cert">
  <div class="logo">imotara<span>.</span></div>
  <div class="tagline">Your Private Emotional Companion</div>
  <div class="badge">🏆 Emotional Wellness Champion</div>
  <h1>Certificate of Recognition</h1>
  <p class="presented">This certificate is proudly presented to</p>
  <div class="org-name">${org.name}</div>
  <p class="body-text">
    In recognition of outstanding commitment to emotional wellbeing and community care.
    This organisation has demonstrated leadership in making emotional support accessible
    to those who need it most — helping build emotionally resilient communities in the age of AI.
  </p>
  <div class="stats">
    <div>
      <div class="stat-label">Active Members</div>
      <div class="stat-value">${org.seats_used}+</div>
    </div>
    <div>
      <div class="stat-label">Programme Type</div>
      <div class="stat-value">${org.billing_type === "ngo" ? "NGO" : "EDU"}</div>
    </div>
    <div>
      <div class="stat-label">Days Active</div>
      <div class="stat-value">${Math.floor(daysSinceCreation)}+</div>
    </div>
  </div>
  <p class="body-text" style="font-style:italic;color:#6b7280;font-size:13px">
    "Because every mind deserves to be heard."
  </p>
  <div class="footer">
    <div class="issued">Issued: ${issuedDate}</div>
    <div class="seal">🌟</div>
    <div class="issued">imotara.com</div>
  </div>
</div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="imotara-certificate-${org.name.toLowerCase().replace(/\s+/g, "-")}.html"`,
    },
  });
}
