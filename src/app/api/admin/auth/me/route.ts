// src/app/api/admin/auth/me/route.ts
// GET /api/admin/auth/me — return current session admin user

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/api/admin/_auth";

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ admin: auth.admin });
}
