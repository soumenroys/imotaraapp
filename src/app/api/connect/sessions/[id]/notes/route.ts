export const preferredRegion = ["sin1"];

// GET  /api/connect/sessions/[id]/notes — consultant reads own session note
// POST /api/connect/sessions/[id]/notes — consultant upserts session note { content }
// Auth required. Consultant-only.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const user = await getConnectUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  // Verify this user is the consultant on this session
  const { data: session } = await supabase
    .from("connect_sessions")
    .select("id, consultant_id")
    .eq("id", sessionId)
    .single();
  if (!session) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });

  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("id")
    .eq("id", session.consultant_id)
    .eq("user_id", user.id)
    .single();
  if (!consultant) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { data: note } = await supabase
    .from("connect_session_notes")
    .select("content, updated_at")
    .eq("session_id", sessionId)
    .eq("consultant_user_id", user.id)
    .single();

  return NextResponse.json({ ok: true, content: note?.content ?? "", updated_at: note?.updated_at ?? null });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const user = await getConnectUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { content } = body ?? {};
  if (typeof content !== "string") return NextResponse.json({ ok: false, error: "content (string) required" }, { status: 400 });
  if (content.length > 2000) return NextResponse.json({ ok: false, error: "content max 2000 chars" }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { data: session } = await supabase
    .from("connect_sessions")
    .select("id, consultant_id")
    .eq("id", sessionId)
    .single();
  if (!session) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });

  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("id")
    .eq("id", session.consultant_id)
    .eq("user_id", user.id)
    .single();
  if (!consultant) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("connect_session_notes")
    .upsert(
      { session_id: sessionId, consultant_user_id: user.id, content, updated_at: now },
      { onConflict: "session_id,consultant_user_id" }
    );

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
