// GET  /api/admin/social/schedules — every schedule
// POST /api/admin/social/schedules — create one

import { NextRequest, NextResponse } from "next/server";
import { requireSocialAdmin, requireSocialOwner } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { PLATFORM_IDS } from "@/lib/social/platforms";
import { isSupportedLanguage } from "@/lib/social/languages";
import { TOPIC_POOL_IDS } from "@/lib/social/subjects";

const CONTENT_TYPES = ["text", "graphic", "text_graphic", "short_video"];
// ⚠️ From the shared list. Three hand-kept copies is how one of them ends
// up missing a channel ⇒ the ConsultantCard LANGUAGE_MAP that held 16 of 22.
const PLATFORMS: string[] = PLATFORM_IDS;

export async function GET(req: NextRequest) {
  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("social_schedules")
    .select("*")
    .order("post_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schedules: data ?? [], actorRole: guard.actor.role });
}

type Body = {
  name?: string;
  brief?: string;
  platforms?: string[];
  contentType?: string;
  topicPool?: string[];
  tone?: string;
  lengthHint?: string;
  languages?: string[];
  postAt?: string;
  timezone?: string;
  days?: number[];
  autoPublish?: boolean;
};

/**
 * ⚠️ VALIDATED HERE AND CONSTRAINED IN THE DATABASE, both. The schema rejects
 * an empty language list and refuses auto-publish in an unqualified language
 * via a trigger; this says the same things in a sentence a person can act on.
 * Neither is redundant — the trigger holds for writers that do not exist yet,
 * and the message holds for the person in front of the form.
 */
export async function POST(req: NextRequest) {
  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "the request body was not JSON" }, { status: 400 });
  }

  const problems: string[] = [];
  const name = body.name?.trim() ?? "";
  const brief = body.brief?.trim() ?? "";
  if (name.length < 3) problems.push("Give the schedule a name — it is for you, not for the post.");
  if (brief.length < 20) problems.push("The brief needs to say something: it stands behind every post on this schedule.");

  const platforms = (body.platforms ?? []).filter((p) => PLATFORMS.includes(p));
  if (platforms.length === 0) problems.push("Choose at least one channel.");

  const contentType = body.contentType ?? "";
  if (!CONTENT_TYPES.includes(contentType)) problems.push(`Content type must be one of ${CONTENT_TYPES.join(", ")}.`);
  if (contentType === "short_video") problems.push("Short video is not built yet — it is the last phase.");

  const languages = (body.languages ?? []).filter((l) => typeof l === "string");
  const unknown = languages.filter((l) => !isSupportedLanguage(l));
  if (languages.length === 0) {
    // ⛔ Not defaulted to English. A schedule that quietly fell back would post
    // in the wrong language for months and look healthy doing it.
    problems.push("Choose at least one language. There is no default, deliberately.");
  }
  if (unknown.length > 0) problems.push(`Not languages this product speaks: ${unknown.join(", ")}.`);

  const days = (body.days ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (days.length === 0) problems.push("Choose at least one day.");

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.postAt ?? "")) problems.push("The time must look like 09:30.");

  const topicPool = (body.topicPool ?? []).filter((t) => TOPIC_POOL_IDS.includes(t));

  if (problems.length > 0) return NextResponse.json({ error: problems.join(" "), problems }, { status: 400 });

  // 🔐 Creating a schedule is an admin action; turning auto-publish ON is not.
  if (body.autoPublish) {
    const owner = await requireSocialOwner(req, "Switching auto-publish on");
    if (!owner.ok) return owner.response;
  }

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("social_schedules")
    .insert({
      name,
      brief,
      platforms,
      content_type: contentType,
      topic_pool: topicPool,
      tone: body.tone?.trim() || "gentle_plain",
      // ⚠️ medium, not short. "short" produced two sentences every time.
      length_hint: body.lengthHint?.trim() || "medium",
      languages,
      post_at: body.postAt,
      timezone: body.timezone?.trim() || "Asia/Kolkata",
      days,
      auto_publish: Boolean(body.autoPublish),
      auto_publish_enabled_by: body.autoPublish ? guard.actor.id : null,
      auto_publish_enabled_at: body.autoPublish ? new Date().toISOString() : null,
      created_by: guard.actor.id,
    })
    .select("*")
    .single();

  if (error) {
    // 🔑 The database's own refusal is the most useful message available here:
    // the language trigger explains exactly which language is unqualified and
    // what to do about it. ⛔ Do not replace it with "could not save".
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ schedule: data }, { status: 201 });
}
