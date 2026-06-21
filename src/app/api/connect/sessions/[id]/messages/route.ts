export const preferredRegion = ["sin1"];
export const maxDuration = 30;

// POST /api/connect/sessions/[id]/messages
// Server-side message insertion with session-state validation and rate limiting.
// When session.translation_enabled is true, translates content server-side before
// storing so both parties receive the translated text via Supabase Realtime.
// Auth required. Caller must be a session participant.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";
import { translateText } from "@/lib/connect/translate";

const MAX_LEN = 2000;
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

// In-process fast-path guard: catches obvious spam without a DB round-trip.
// NOTE: per-serverless-instance — does NOT enforce globally across concurrent
// cold-start instances. The DB-level COUNT below is the authoritative global guard.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkInProcessRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
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

  if (!checkInProcessRateLimit(user.id)) {
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

  // Global DB-level rate limit: count this user's messages in the last 60 s across all instances.
  // Requires idx_connect_messages_sender_created (connect_v16_security_hardening.sql).
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count: recentMsgCount } = await supabase
    .from("connect_messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", user.id)
    .gte("created_at", windowStart);
  if ((recentMsgCount ?? 0) >= RATE_LIMIT_MAX) {
    return NextResponse.json({ ok: false, error: "Too many messages. Please slow down." }, { status: 429 });
  }

  // Verify session is active and caller is a participant
  const { data: session } = await supabase
    .from("connect_sessions")
    .select("id, user_id, consultant_id, status, translation_enabled, user_lang, consultant_lang")
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

  // Server-side translation: translate message to the other party's language
  let translatedContent: string | null = null;
  if (session.translation_enabled) {
    const sourceLang = isConsultant
      ? (session.consultant_lang ?? "en")
      : (session.user_lang ?? "en");
    const targetLang = isConsultant
      ? (session.user_lang ?? "en")
      : (session.consultant_lang ?? "en");
    if (sourceLang !== targetLang) {
      // 4-second timeout prevents a slow/hung translation API from blocking message delivery.
      const timeoutPromise = new Promise<null>((res) => setTimeout(() => res(null), 4000));
      translatedContent = await Promise.race([
        translateText(content.trim(), targetLang, sourceLang),
        timeoutPromise,
      ]);
    }
  }

  const { data: message, error } = await supabase
    .from("connect_messages")
    .insert({
      session_id:         id,
      sender_id:          user.id,
      content:            content.trim(),
      translated_content: translatedContent,
    })
    .select("id, session_id, sender_id, content, translated_content, created_at")
    .single();

  if (error || !message) {
    console.error("[messages/POST] insert failed:", error?.message, "session:", id);
    return NextResponse.json({ ok: false, error: "Failed to send message. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message }, { status: 201 });
}
