// GET  /api/connect/sessions — user's session list
// POST /api/connect/sessions — create a new session
// Auth required.

export const preferredRegion = ["sin1"];
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";
import { sendSessionRequestEmail } from "@/lib/connect/mailer";

export async function GET(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("connect_sessions")
    .select(
      "id, user_id, consultant_id, type, status, scheduled_note, scheduled_at, scheduled_duration_min, " +
      "started_at, ended_at, minutes_used, amount_charged, currency_code, rate_per_min, base_rate_per_min, " +
      "translation_enabled, user_lang, consultant_lang, " +
      "rating, review_text, review_submitted_at, created_at, " +
      "connect_consultants(display_name, photo_url, gender, rate_per_min, preferred_lang)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[sessions/GET] query error:", error.message);
    return NextResponse.json({ ok: false, error: "Could not load sessions. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sessions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  // Server-side age enforcement — rejects users who have explicitly confirmed they are under 18.
  if (user.user_metadata?.connect_age_restricted === true) {
    return NextResponse.json(
      { ok: false, error: "Age restricted: Imotara Connect is not available for users under 18." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });

  const { consultant_id, type, scheduled_note, scheduled_at, scheduled_duration_min } = body;

  if (!consultant_id) {
    return NextResponse.json({ ok: false, error: "Companion not found. Please try again." }, { status: 400 });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(consultant_id))) {
    return NextResponse.json({ ok: false, error: "Companion not found. Please try again." }, { status: 400 });
  }
  if (!["instant", "scheduled"].includes(type)) {
    return NextResponse.json({ ok: false, error: "Invalid session type. Please try again." }, { status: 400 });
  }
  if (type === "scheduled" && !scheduled_note?.trim()) {
    return NextResponse.json({ ok: false, error: "Please add a message describing what you would like to discuss." }, { status: 400 });
  }
  if (scheduled_note && scheduled_note.length > 800) {
    return NextResponse.json({ ok: false, error: "Message must be 800 characters or fewer." }, { status: 400 });
  }
  if (type === "scheduled") {
    if (!scheduled_at) {
      return NextResponse.json({ ok: false, error: "Please select a date and time for the session." }, { status: 400 });
    }
    const scheduledDate = new Date(scheduled_at);
    // Require at least 60 seconds in the future: the POST handler does ~5 sequential DB
    // round-trips before INSERT, so a timestamp only a second or two ahead could arrive
    // already-past and be treated as an immediately-stale session by the orphan cron.
    if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() < Date.now() + 60_000) {
      return NextResponse.json({ ok: false, error: "Please choose a valid future date and time." }, { status: 400 });
    }
    const maxDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    if (scheduledDate > maxDate) {
      return NextResponse.json({ ok: false, error: "Sessions can only be scheduled up to 90 days in advance." }, { status: 400 });
    }
  }

  const supabase = getSupabaseAdmin();

  // Rate limit: max 10 session creates per user per 10 minutes (blocks push-notification spam)
  const rateLimitWindow = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: recentCount, error: rlErr } = await supabase
    .from("connect_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", rateLimitWindow);
  if (rlErr) {
    console.error("[sessions] rate-limit count failed:", rlErr.message);
    return NextResponse.json({ ok: false, error: "Service temporarily unavailable. Please try again." }, { status: 503 });
  }
  if ((recentCount ?? 0) >= 10) {
    return NextResponse.json(
      { ok: false, error: "Too many session requests. Please wait a moment before trying again." },
      { status: 429 }
    );
  }

  // Prevent duplicate open sessions with the same consultant
  const { data: existing } = await supabase
    .from("connect_sessions")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("consultant_id", consultant_id)
    .in("status", ["pending", "active"])
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: false,
      error: "You already have an open session with this companion.",
      existing_session_id: existing.id,
      redirect: true,
    }, { status: 409 });
  }

  // Prevent concurrent sessions with any OTHER consultant (one active session at a time)
  const { data: anyOtherActive } = await supabase
    .from("connect_sessions")
    .select("id")
    .eq("user_id", user.id)
    .neq("consultant_id", consultant_id)
    .in("status", ["pending", "active"])
    .maybeSingle();

  if (anyOtherActive) {
    return NextResponse.json({
      ok: false,
      error: "You already have an active session with another companion. Please end it before starting a new one.",
      existing_session_id: anyOtherActive.id,
    }, { status: 409 });
  }

  // Verify consultant is approved
  const { data: consultant } = await supabase
    .from("connect_consultants")
    .select("id, status, is_busy, currency_code, preferred_lang, rate_per_min")
    .eq("id", consultant_id)
    .eq("status", "approved")
    .single();

  if (!consultant) {
    return NextResponse.json({ ok: false, error: "Consultant not found or not approved" }, { status: 404 });
  }

  if (consultant.is_busy) {
    return NextResponse.json(
      { ok: false, error: "This companion is currently in a session. Please try again shortly." },
      { status: 409 }
    );
  }

  // For scheduled sessions, prevent double-booking the same consultant at overlapping time slots.
  // is_busy only reflects live sessions — it doesn't guard future calendar conflicts.
  // The original 30-min window check was one-directional: it only caught new bookings within
  // 30 min of an existing start, missing the case where a new booking lands DURING a long
  // existing session (e.g. 4-hour session at 10:00 AM — a new booking at 11:30 AM passed).
  // Fix: fetch all existing scheduled sessions that start before the new booking ends (looking
  // back up to 8 hours to cover the maximum session length), then check true interval overlap
  // in JS: [newStart, newEnd) ∩ [existingStart, existingStart + existingDuration) ≠ ∅
  if (type === "scheduled" && scheduled_at) {
    const newStart   = new Date(scheduled_at);
    const newDurMin  = Number.isInteger(scheduled_duration_min) && scheduled_duration_min >= 5
                       ? scheduled_duration_min : 60;
    const newEnd     = new Date(newStart.getTime() + newDurMin * 60 * 1000);
    // Look back max 8 hours (maximum allowed session duration) so a long existing session
    // that started before newStart can still be detected as conflicting.
    const lookbackStart = new Date(newStart.getTime() - 8 * 60 * 60 * 1000);

    const { data: nearSessions } = await supabase
      .from("connect_sessions")
      .select("id, scheduled_at, scheduled_duration_min")
      .eq("consultant_id", consultant_id)
      .in("status", ["pending", "active"])
      .eq("type", "scheduled")
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", lookbackStart.toISOString())
      .lt("scheduled_at",  newEnd.toISOString());

    const hasConflict = (nearSessions ?? []).some((ex) => {
      const exStart  = new Date(ex.scheduled_at as string);
      const exDurMin = Number.isInteger(ex.scheduled_duration_min) && ex.scheduled_duration_min >= 5
                       ? ex.scheduled_duration_min : 60;
      const exEnd    = new Date(exStart.getTime() + exDurMin * 60 * 1000);
      return newStart < exEnd && newEnd > exStart;
    });
    if (hasConflict) {
      return NextResponse.json(
        { ok: false, error: "This companion already has a session booked at that time. Please choose a different slot." },
        { status: 409 }
      );
    }
  }

  // Check if this user is blocked by the consultant
  const { data: block, error: blockErr } = await supabase
    .from("connect_blocks")
    .select("id")
    .eq("consultant_id", consultant.id)
    .eq("blocked_user_id", user.id)
    .maybeSingle();

  if (blockErr) {
    console.error("[sessions] block check failed:", blockErr.message);
    return NextResponse.json({ ok: false, error: "Could not verify eligibility. Please try again." }, { status: 500 });
  }
  if (block) {
    return NextResponse.json({ ok: false, error: "Unable to request a session with this companion." }, { status: 403 });
  }

  // Bug #37 fix: prevent user from booking a session with their own consultant profile
  const { data: selfConsultant } = await supabase
    .from("connect_consultants")
    .select("id")
    .eq("id", consultant_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (selfConsultant) {
    return NextResponse.json({ ok: false, error: "You cannot book a session with your own companion profile." }, { status: 403 });
  }

  // Both instant and scheduled sessions require at least 1 minute of pre-paid balance.
  // Uses the atomic get_session_balance RPC (single SQL expression) to avoid the
  // two-query TOCTOU window where a concurrent recharge or session could land between reads.
  {
    const { data: balance, error: balErr } = await supabase
      .rpc("get_session_balance", { p_user_id: user.id, p_consultant_id: consultant_id });
    if (balErr) {
      console.error("[sessions/POST] get_session_balance failed:", balErr.message);
      return NextResponse.json({ ok: false, error: "Service temporarily unavailable. Please try again." }, { status: 503 });
    }
    if (Number(balance ?? 0) < 1) {
      return NextResponse.json(
        { ok: false, error: "Insufficient balance. Please recharge session minutes first.", needs_recharge: true },
        { status: 402 }
      );
    }
  }

  // Validate user_timezone against a safe character set (IANA timezone format) before storing
  const rawTz = typeof body.user_timezone === "string" ? body.user_timezone : "";
  const user_timezone = rawTz.length > 0 && rawTz.length <= 64 && /^[A-Za-z0-9/_+\-]{1,64}$/.test(rawTz)
    ? rawTz
    : "Asia/Kolkata";

  // Translation opt-in: +10% surcharge baked into rate_per_min when enabled.
  // rate_per_min is read from the same query that verified status='approved' (line 144) —
  // a separate re-fetch would not re-check status and could use a suspended consultant's rate.
  const SUPPORTED_LANGS = ["en","hi","bn","mr","ta","te","gu","pa","kn","ml","ur","ar","es","fr","de","pt"];
  const userLang       = typeof body.user_lang === "string" && SUPPORTED_LANGS.includes(body.user_lang) ? body.user_lang : "en";
  const consultantLang = typeof consultant.preferred_lang === "string" ? consultant.preferred_lang : "en";
  const translationEnabled = body.translation_requested === true && userLang !== consultantLang;
  const baseRate = Number(consultant.rate_per_min ?? 0);
  if (baseRate <= 0) {
    return NextResponse.json({ ok: false, error: "Consultant rate unavailable. Please try again." }, { status: 409 });
  }
  const effectiveRate  = translationEnabled ? +((baseRate * 1.10).toFixed(4)) : baseRate;

  const { data: session, error } = await supabase
    .from("connect_sessions")
    .insert({
      user_id:        user.id,
      consultant_id,
      type,
      status:         "pending",
      scheduled_note:         scheduled_note?.trim() ?? null,
      scheduled_at:           scheduled_at ?? null,
      scheduled_duration_min: type === "scheduled" && Number.isInteger(scheduled_duration_min)
        && scheduled_duration_min >= 5 && scheduled_duration_min <= 480 ? scheduled_duration_min : null,
      currency_code:  consultant.currency_code,
      rate_per_min:   effectiveRate,
      base_rate_per_min: translationEnabled ? baseRate : null,
      translation_enabled: translationEnabled,
      user_lang:       translationEnabled ? userLang : null,
      consultant_lang: translationEnabled ? consultantLang : null,
      user_timezone,
    })
    .select(
      "id, status, created_at, user_id, consultant_id, type, " +
      "rate_per_min, base_rate_per_min, translation_enabled, user_lang, consultant_lang, " +
      "minutes_used, amount_charged, currency_code, user_timezone, started_at"
    )
    .single();

  if (error) {
    // 23505: the partial unique index uq_connect_sessions_user_active fired — two concurrent
    // POSTs both passed the maybeSingle() check before either INSERT landed. Surface a 409
    // identical to the explicit duplicate check so the client can redirect to the existing session.
    if (error.code === "23505") {
      return NextResponse.json({
        ok: false,
        error: "You already have an open session. Please check your active sessions.",
        redirect: true,
      }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: "Session could not be created. Please try again." }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ ok: false, error: "Session could not be created. Please try again." }, { status: 500 });
  }

  // Supabase TypeScript inference produces GenericStringError on multi-field selects when
  // columns added in later migrations are not yet reflected in the generated types. We assert
  // the known shape here — the runtime value is always correct after the insert succeeds.
  const createdSession = session as unknown as { id: string; [key: string]: unknown };

  // Notify consultant via Expo push if they have a token registered (mobile only, non-blocking)
  const { data: consultantForPush } = await supabase
    .from("connect_consultants")
    .select("expo_push_token, display_name")
    .eq("id", consultant_id)
    .single();

  // Confirmation email to the requesting user (P2-24, non-blocking)
  if (user.email) {
    void sendSessionRequestEmail({
      userEmail:      user.email,
      consultantName: consultantForPush?.display_name ?? "your companion",
      sessionType:    type as "instant" | "scheduled",
      sessionId:      createdSession.id,
    }).catch((e) => console.error("[sessions] request email error:", e));
  }

  if (consultantForPush?.expo_push_token) {
    void fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        to:    consultantForPush.expo_push_token,
        sound: "default",
        title: "New Session Request",
        body:  `A client is requesting a ${type} session with you`,
        data:  { session_id: createdSession.id, type: "session_request" },
      }),
    }).catch((e) => console.error("[sessions] push notification error:", e));
  }

  return NextResponse.json({ ok: true, session: createdSession }, { status: 201 });
}
