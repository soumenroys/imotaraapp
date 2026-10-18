// PATCH  /api/admin/social/schedules/[id] — change one
// DELETE /api/admin/social/schedules/[id] — remove one

import { NextRequest, NextResponse } from "next/server";
import { requireSocialAdmin, requireSocialOwner } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { cleanPlatformTimes } from "@/lib/social/platformTimes";
import { isSupportedLanguage } from "@/lib/social/languages";

type Body = {
  name?: string;
  brief?: string;
  platforms?: string[];
  topicPool?: string[];
  tone?: string;
  lengthHint?: string;
  languages?: string[];
  postAt?: string;
  platformTimes?: unknown;
  timezone?: string;
  days?: number[];
  active?: boolean;
  autoPublish?: boolean;
  wordmarkFollowsLanguage?: boolean;
};

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "the request body was not JSON" }, { status: 400 });
  }

  // 🔐 Turning auto-publish ON is owner-only. Turning it OFF is not — the safe
  // direction must never be the harder one, or in a hurry somebody skips it.
  if (body.autoPublish === true) {
    const owner = await requireSocialOwner(req, "Switching auto-publish on");
    if (!owner.ok) return owner.response;
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.name !== undefined) {
    if (body.name.trim().length < 3) return NextResponse.json({ error: "The name is too short." }, { status: 400 });
    patch.name = body.name.trim();
  }
  if (body.brief !== undefined) {
    if (body.brief.trim().length < 20) {
      return NextResponse.json({ error: "The brief needs to say something." }, { status: 400 });
    }
    patch.brief = body.brief.trim();
  }
  if (body.platforms !== undefined) {
    if (body.platforms.length === 0) return NextResponse.json({ error: "Choose at least one channel." }, { status: 400 });
    patch.platforms = body.platforms;
  }
  if (body.languages !== undefined) {
    const unknown = body.languages.filter((l) => !isSupportedLanguage(l));
    if (body.languages.length === 0) {
      return NextResponse.json({ error: "A schedule cannot have no language. There is no default." }, { status: 400 });
    }
    if (unknown.length > 0) {
      return NextResponse.json({ error: `Not languages this product speaks: ${unknown.join(", ")}.` }, { status: 400 });
    }
    patch.languages = body.languages;
  }
  if (body.days !== undefined) {
    const days = body.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (days.length === 0) return NextResponse.json({ error: "Choose at least one day." }, { status: 400 });
    patch.days = days;
  }
  if (body.postAt !== undefined) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.postAt)) {
      return NextResponse.json({ error: "The time must look like 09:30." }, { status: 400 });
    }
    patch.post_at = body.postAt;
  }
  /**
   * 🔑 PER-CHANNEL TIMES. An override of post_at/days for one platform
   * ⇒ docs/sql/social_platform_times.sql. ⛔ Refused rather than silently
   * dropped: "it saved" and a channel that never posts is the exact failure
   * this feature exists to prevent.
   */
  if (body.platformTimes !== undefined) {
    const times = cleanPlatformTimes(body.platformTimes);
    if (!times.ok) return NextResponse.json({ error: times.error }, { status: 400 });
    patch.platform_times = times.value;
  }
  if (body.topicPool !== undefined) patch.topic_pool = body.topicPool;
  if (body.tone !== undefined) patch.tone = body.tone;
  if (body.lengthHint !== undefined) patch.length_hint = body.lengthHint;
  if (body.timezone !== undefined) patch.timezone = body.timezone;
  if (body.active !== undefined) patch.active = Boolean(body.active);
  if (body.wordmarkFollowsLanguage !== undefined) {
    patch.wordmark_follows_language = Boolean(body.wordmarkFollowsLanguage);
  }
  if (body.autoPublish !== undefined) {
    patch.auto_publish = Boolean(body.autoPublish);
    patch.auto_publish_enabled_by = body.autoPublish ? guard.actor.id : null;
    patch.auto_publish_enabled_at = body.autoPublish ? new Date().toISOString() : null;
  }

  const db = getSupabaseAdmin();
  const { data, error } = await db.from("social_schedules").update(patch).eq("id", id).select("*").single();

  // ⚠️ The trigger's message is better than anything this route could write:
  // it names the unqualified language and says how to qualify it.
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "no such schedule" }, { status: 404 });
  return NextResponse.json({ schedule: data });
}

/**
 * ⚠️ Deleting a schedule leaves its POSTS in place, with `schedule_id` set to
 * null by the foreign key. That is deliberate: the published ones are a record
 * of what went out in the company's name, and deleting the schedule must not
 * quietly erase it.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;

  const db = getSupabaseAdmin();
  const { error } = await db.from("social_schedules").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, note: "The posts it already produced are kept." });
}
