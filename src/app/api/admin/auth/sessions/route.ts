// src/app/api/admin/auth/sessions/route.ts
// GET    — list active sessions for current admin (with IP + UA)
// DELETE ?sessionId= — revoke a specific session
// DELETE ?all=true   — revoke all OTHER sessions (keep current)

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSuperAdmin } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { hashSessionToken, SESSION_COOKIE } from "@/lib/imotara/adminCrypto";

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;

  const { data: sessions } = await getSupabaseAdmin()
    .from("admin_sessions")
    .select("id, ip_address, user_agent, created_at, expires_at, last_used_at")
    .eq("admin_id", auth.admin.id)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  // Mark which session is current
  const cookieStore  = await cookies();
  const currentToken = cookieStore.get(SESSION_COOKIE)?.value;
  const currentHash  = currentToken ? hashSessionToken(currentToken) : null;

  const { data: currentSession } = currentHash
    ? await getSupabaseAdmin().from("admin_sessions").select("id").eq("token_hash", currentHash).single()
    : { data: null };

  return NextResponse.json({
    sessions: (sessions ?? []).map((s) => ({
      ...s,
      isCurrent: s.id === currentSession?.id,
    })),
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;

  const admin      = getSupabaseAdmin();
  const sessionId  = req.nextUrl.searchParams.get("sessionId");
  const revokeAll  = req.nextUrl.searchParams.get("all") === "true";

  // Get current session ID to protect it when revokeAll=true
  const cookieStore  = await cookies();
  const currentToken = cookieStore.get(SESSION_COOKIE)?.value;
  const currentHash  = currentToken ? hashSessionToken(currentToken) : null;

  const { data: currentSession } = currentHash
    ? await admin.from("admin_sessions").select("id").eq("token_hash", currentHash).single()
    : { data: null };

  if (revokeAll) {
    // Revoke all sessions except the current one
    const query = admin
      .from("admin_sessions")
      .delete()
      .eq("admin_id", auth.admin.id);

    if (currentSession?.id) {
      await query.neq("id", currentSession.id);
    } else {
      await query;
    }
    return NextResponse.json({ ok: true, message: "All other sessions revoked." });
  }

  if (sessionId) {
    // Verify session belongs to current admin before deleting
    const { data: session } = await admin
      .from("admin_sessions")
      .select("admin_id")
      .eq("id", sessionId)
      .single();

    if (!session || session.admin_id !== auth.admin.id) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    await admin.from("admin_sessions").delete().eq("id", sessionId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "sessionId or all=true required." }, { status: 400 });
}
