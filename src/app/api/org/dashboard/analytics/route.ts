// src/app/api/org/dashboard/analytics/route.ts
// GET /api/org/dashboard/analytics?days=30
// EDU/NGO billing_type only — aggregate anonymized usage stats

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getOrgUsageStats } from "@/lib/imotara/org";
import {
  normaliseAnalyticsEmotion,
  EMOTION_POLARITY,
  averagePolarity,
} from "@/lib/emotion/analyticsEmotion";

export async function GET(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  // Verify org has analytics access (EDU or NGO billing_type)
  const admin = getSupabaseAdmin();
  const { data: org } = await admin
    .from("organizations")
    .select("billing_type, name")
    .eq("id", auth.orgId)
    .single();

  const analyticsAllowed = ["edu", "ngo"].includes(org?.billing_type ?? "");
  if (!analyticsAllowed) {
    return NextResponse.json({ error: "Analytics available for EDU and NGO accounts only" }, { status: 403 });
  }

  const days = Math.min(180, parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10));

  const result = await getOrgUsageStats(auth.orgId, days);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  // Compute summary stats
  const stats = result.data;
  const totalEvents  = stats.reduce((s, r) => s + r.totalEvents, 0);
  const uniqueDays   = stats.filter((r) => r.activeUsers > 0).length;
  const avgWAU       = stats.length > 0
    ? Math.round(stats.reduce((s, r) => s + r.activeUsers, 0) / stats.length)
    : 0;
  const avgSession   = stats.length > 0
    ? Math.round(stats.reduce((s, r) => s + r.avgSessionMins, 0) / stats.length * 10) / 10
    : 0;

  // Emotion trend breakdown — aggregate count per emotion label across the period
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  // Hoisted: the member list is needed twice — once for the labels, once for
  // the chat_reply denominator below.
  const memberIds =
    (await admin.from("org_members").select("user_id").eq("org_id", auth.orgId).eq("status", "active"))
      .data?.map((m) => m.user_id) ?? [];

  // 🔑 The denominator is chat replies, NOT all usage events. Dividing by every
  // event (tts, voice_transcribe, settings_search all write usage_events and
  // carry no emotion) would understate coverage and make a healthy sample look
  // thin — the mirror of the 6.4% distortion this work exists to fix.
  const { count: chatReplyCount } = await admin
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "chat_reply")
    .gte("created_at", cutoff)
    .in("user_id", memberIds);

  const { data: emotionRows } = await admin
    .from("usage_events")
    .select("emotion, created_at")
    // ⚠️ NOT a null filter alone: rows written before 2026-10-05 stored the
    // EMPTY STRING when the client sent no hint (`?.` and `??` both pass ""
    // through), and "" passes `is not null`. normaliseAnalyticsEmotion treats
    // "" as absent, so the discarding happens below rather than in SQL.
    .not("emotion", "is", null)
    .gte("created_at", cutoff)
    .in("user_id", memberIds);

  // Every label is folded onto the canonical vocabulary first. Without this the
  // chart shows two bars for one feeling — historical rows say "sad" while
  // analyzeLocal's palette says "sadness", and clients have sent both.
  const emotionCounts: Record<string, number> = {};
  const canonical: string[] = [];
  (emotionRows ?? []).forEach(({ emotion }) => {
    const label = normaliseAnalyticsEmotion(emotion);
    if (!label) return;                       // "" / unknown → not charted
    canonical.push(label);
    emotionCounts[label] = (emotionCounts[label] ?? 0) + 1;
  });
  const emotionTrends = Object.entries(emotionCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([emotion, count]) => ({
      emotion,
      count,
      // Lets the dashboard colour and order the bars without duplicating the
      // sign of each feeling in the UI.
      polarity: EMOTION_POLARITY[emotion as keyof typeof EMOTION_POLARITY] ?? 0,
    }));

  // ── The actual "mindset trend" ────────────────────────────────────────────
  //
  // Category counts cannot answer the only question an NGO really has: are our
  // people doing better than they were? Averaging polarity (-1..+1) over the
  // period gives one comparable number, and bucketing it by day gives the line.
  const byDay = new Map<string, string[]>();
  (emotionRows ?? []).forEach(({ emotion, created_at }) => {
    const label = normaliseAnalyticsEmotion(emotion);
    if (!label || !created_at) return;
    const day = String(created_at).slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(label);
  });
  const moodTrend = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, labels]) => ({
      date,
      polarity: averagePolarity(labels),
      samples:  labels.length,
    }));

  const overallPolarity = averagePolarity(canonical);
  // Labelled share is reported openly: a trend drawn from a small fraction of
  // conversations is not a trend, and the reader should be able to see that.
  const labelledShare = (chatReplyCount ?? 0) > 0
    ? Number((canonical.length / (chatReplyCount ?? 1)).toFixed(3))
    : null;

  return NextResponse.json({
    orgName:    org?.name,
    days,
    summary: {
      totalEvents, uniqueDays, avgWAU, avgSessionMins: avgSession,
      // -1..+1, or null when nothing in the period carried a label.
      overallPolarity,
      labelledShare,
      chatReplies: chatReplyCount ?? 0,
    },
    daily:   stats,
    emotionTrends,
    moodTrend,
  });
}
