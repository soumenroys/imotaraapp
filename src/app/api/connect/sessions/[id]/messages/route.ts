// POST /api/connect/sessions/[id]/messages
// Server-side message insertion with session-state validation and rate limiting.
// Auth required. Caller must be a session participant.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

const MAX_LEN = 2000;

// In-memory per-user rate limiter: 60 messages per 60 seconds.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 60) return false;
  entry.count++;
  return true;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ ok: false, error: "Too many messages. Please slow down." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const content: string | undefined = body?.content;

  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ ok: false, error: "content is required" }, { status: 400 });
  }
  if (content.length > MAX_LEN) {
    return NextResponse.json({ ok: false, error: `Message too long (max ${MAX_LEN} chars)` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Verify session is active and caller is a participant
  const { data: session } = await supabase
    .from("connect_sessions")
    .select("id, user_id, consultant_id, status")
    .eq("id", id)
    .single();

  if (!session) {
    return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
  }

  if (session.status !== "active") {
    return NextResponse.json({ ok: false, error: "Session is not active" }, { status: 409 });
  }

  // Verify caller is a session participant
  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("user_id")
    .eq("id", session.consultant_id)
    .single();

  const isConsultant = consultant?.user_id === user.id;
  const isUser       = session.user_id === user.id;
  if (!isConsultant && !isUser) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { data: message, error } = await supabase
    .from("connect_messages")
    .insert({
      session_id: id,
      sender_id:  user.id,
      content:    content.trim(),
    })
    .select("id, session_id, sender_id, content, created_at")
    .single();

  if (error || !message) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message }, { status: 201 });
}
