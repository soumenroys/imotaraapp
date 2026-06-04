// src/app/api/admin/auth/logout/route.ts
// DELETE /api/admin/auth/logout — revoke session + clear cookie

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { hashSessionToken, SESSION_COOKIE } from "@/lib/imotara/adminCrypto";

export async function DELETE(_req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    const tokenHash = hashSessionToken(token);
    await getSupabaseAdmin().from("admin_sessions").delete().eq("token_hash", tokenHash);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
