// src/app/api/org/dashboard/member-trends/route.ts
// GET /api/org/dashboard/member-trends?days=30
// EDU/NGO only — PER-MEMBER wellbeing trends, for members who consented.
//
// ─────────────────────────────────────────────────────────────────────────────
// 🔑 THIS IS A SEPARATE ENDPOINT FROM /analytics ON PURPOSE.
//
// The owner's consent spec (2026-10-05) is that switching consent OFF removes
// someone from IDENTIFICATION, never from the AGGREGATE:
//
//   "user may decline to accept, or set off the consent option from the
//    setting and in those cases organisational admin will not be able to get
//    that user specific information but will get his/her report in the
//    aggreegated format"
//
// ⛔ SO THIS MUST NEVER BECOME A FILTER SHARED WITH /analytics. If one query
// served both with a consent filter applied, every opt-out would silently
// shrink the organisation's totals — under-reporting the org, and making the
// opt-out visible by arithmetic to anyone who watched the numbers move. Two
// endpoints, two queries: this one excludes non-consenters, /analytics counts
// everybody.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/app/api/org/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import {
  normaliseAnalyticsEmotion,
  EMOTION_POLARITY,
  averagePolarity,
} from "@/lib/emotion/analyticsEmotion";

/**
 * Owner decision 2026-10-06. Mirrors org_individual_reporting_min_members()
 * in docs/sql/org_member_report_consent.sql — if you change one, change both.
 */
const MIN_MEMBERS_FOR_INDIVIDUAL = 10;

export async function GET(req: NextRequest) {
  const auth = await requireOrgAdmin(req);
  if (!auth.ok) return auth.response;

  const admin = getSupabaseAdmin();

  // Same EDU/NGO gate as the aggregate endpoint.
  const { data: org } = await admin
    .from("organizations")
    .select("billing_type, name")
    .eq("id", auth.orgId)
    .single();

  if (!["edu", "ngo"].includes(org?.billing_type ?? "")) {
    return NextResponse.json(
      { error: "Analytics available for EDU and NGO accounts only" },
      { status: 403 },
    );
  }

  const days = Math.min(180, parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10));
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // ── The small-N gate ───────────────────────────────────────────────────────
  //
  // Counts ACTIVE members, NOT consenting ones. If the threshold moved with the
  // number of consenters, each person switching consent off could flip the
  // breakdown on or off — which leaks precisely what the threshold hides.
  const { data: activeMembers } = await admin
    .from("org_members")
    .select("user_id, report_consent")
    .eq("org_id", auth.orgId)
    .eq("status", "active");

  const activeCount = activeMembers?.length ?? 0;

  if (activeCount < MIN_MEMBERS_FOR_INDIVIDUAL) {
    // Not an error — a deliberate, explained refusal the dashboard can render.
    return NextResponse.json({
      orgName: org?.name,
      days,
      available: false,
      reason: "below_threshold",
      minMembers: MIN_MEMBERS_FOR_INDIVIDUAL,
      activeMembers: activeCount,
      members: [],
      message:
        `Individual trends appear once this organisation has ${MIN_MEMBERS_FOR_INDIVIDUAL} or more active members. ` +
        `With fewer, a per-person breakdown would identify people who asked not to be identified.`,
    });
  }

  const consenting = (activeMembers ?? []).filter((m) => m.report_consent);
  const consentingIds = consenting.map((m) => m.user_id);

  // Everyone opted out — a real, reportable state, not an empty chart.
  if (consentingIds.length === 0) {
    return NextResponse.json({
      orgName: org?.name, days,
      available: true, reason: "no_consent",
      minMembers: MIN_MEMBERS_FOR_INDIVIDUAL,
      activeMembers: activeCount, consentingMembers: 0,
      members: [],
      message: "No member of this organisation has consented to individual reporting.",
    });
  }

  const { data: rows } = await admin
    .from("usage_events")
    .select("user_id, emotion, created_at")
    .eq("event_type", "chat_reply")
    .gte("created_at", cutoff)
    .in("user_id", consentingIds);

  // Emails only for members who consented — never resolve the others.
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById: Record<string, string> = {};
  authUsers?.users
    ?.filter((u) => consentingIds.includes(u.id))
    .forEach((u) => { emailById[u.id] = u.email ?? "—"; });

  const byUser = new Map<string, string[]>();
  (rows ?? []).forEach(({ user_id, emotion }) => {
    const label = normaliseAnalyticsEmotion(emotion);
    if (!label) return;
    if (!byUser.has(user_id)) byUser.set(user_id, []);
    byUser.get(user_id)!.push(label);
  });

  const members = consentingIds.map((id) => {
    const labels = byUser.get(id) ?? [];
    const counts: Record<string, number> = {};
    labels.forEach((l) => { counts[l] = (counts[l] ?? 0) + 1; });
    return {
      userId: id,
      email: emailById[id] ?? "—",
      conversations: labels.length,
      polarity: averagePolarity(labels),
      topEmotions: Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([emotion, count]) => ({
          emotion,
          count,
          polarity: EMOTION_POLARITY[emotion as keyof typeof EMOTION_POLARITY] ?? 0,
        })),
    };
  });

  return NextResponse.json({
    orgName: org?.name,
    days,
    available: true,
    minMembers: MIN_MEMBERS_FOR_INDIVIDUAL,
    activeMembers: activeCount,
    consentingMembers: consentingIds.length,
    // Stated plainly so the dashboard can say "12 of 20 members consented"
    // rather than implying this is everyone.
    optedOut: activeCount - consentingIds.length,
    members: members.sort((a, b) => b.conversations - a.conversations),
  });
}
