// src/app/api/v1/org/members/route.ts
// GET /api/v1/org/members?page=0&limit=50
// List org members accessible via API key (scope: read:members)
// Enterprise tier only.

import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey, checkApiKeyRateLimit } from "@/lib/imotara/apiKeyAuth";
import { getOrgMembers } from "@/lib/imotara/org";

export async function GET(req: NextRequest) {
  const ctx = await verifyApiKey(req);
  if (!ctx) return NextResponse.json({ error: "invalid or missing API key" }, { status: 401 });
  if (!(await checkApiKeyRateLimit(ctx))) {
    return NextResponse.json({ error: "rate limit exceeded" }, { status: 429 });
  }
  if (!ctx.scopes.includes("read:members")) {
    return NextResponse.json({ error: "API key missing read:members scope" }, { status: 403 });
  }
  if (ctx.orgTier !== "enterprise") {
    return NextResponse.json({ error: "REST API access requires Enterprise plan" }, { status: 403 });
  }

  const page  = parseInt(req.nextUrl.searchParams.get("page")  ?? "0",  10);
  const limit = Math.min(100, parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10));

  const result = await getOrgMembers(ctx.orgId, page, limit);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({
    org:     { id: ctx.orgId, name: ctx.orgName },
    page, limit,
    members: result.data,
  });
}
