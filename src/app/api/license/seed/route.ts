// src/app/api/license/seed/route.ts
// LIC-4: Called by the mobile app after sign-in to seed a free license row.
// Uses Bearer token auth. Always returns 200 so the mobile fire-and-forget call
// never surfaces an error to the user.
//
// POST /api/license/seed  { Authorization: Bearer <jwt> }
// → { ok: true }

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { seedLicenseIfAbsent } from "@/lib/imotara/seedLicense";

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdmin();

    const authHeader = req.headers.get("authorization") ?? "";
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (!bearerToken) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data } = await admin.auth.getUser(bearerToken);
    const userId = data?.user?.id ?? null;

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    await seedLicenseIfAbsent(userId, admin);
    return NextResponse.json({ ok: true });
  } catch {
    // Non-fatal — mobile call is fire-and-forget, always respond 200
    return NextResponse.json({ ok: true });
  }
}
