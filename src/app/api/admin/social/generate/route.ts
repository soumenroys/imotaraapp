// POST /api/admin/social/generate — write one now, for a schedule
//
// The same code path the cron uses, triggered by hand. ⛔ Deliberately the SAME
// path: a "test" button that ran different code would prove nothing about what
// happens at 09:30.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialAdmin } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { prepareGenerated, nextLanguage, type ScheduleShape } from "@/lib/social/pipeline";
import { liveDeps, savePreparedPost, toScheduleShape, postCountFor, type ScheduleRow } from "@/lib/social/store";

export const maxDuration = 120;

type Body = { scheduleId?: string; platform?: string; language?: string; dryRun?: boolean };

export async function POST(req: NextRequest) {
  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;

  let input: Body;
  try {
    input = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "the request body was not JSON" }, { status: 400 });
  }
  if (!input.scheduleId) return NextResponse.json({ error: "scheduleId is required" }, { status: 400 });

  const db = getSupabaseAdmin();
  const { data: row, error } = await db
    .from("social_schedules")
    .select("*")
    .eq("id", input.scheduleId)
    .single();

  if (error || !row) return NextResponse.json({ error: "no such schedule" }, { status: 404 });

  const schedule: ScheduleShape = toScheduleShape(row as ScheduleRow);
  const platform = input.platform ?? schedule.platforms[0];
  if (!schedule.platforms.includes(platform)) {
    return NextResponse.json(
      { error: `This schedule does not post to ${platform}. It posts to ${schedule.platforms.join(", ")}.` },
      { status: 400 },
    );
  }

  const language = input.language ?? nextLanguage(schedule.languages, await postCountFor(schedule.id));
  if (!schedule.languages.includes(language)) {
    return NextResponse.json(
      { error: `This schedule does not write in ${language}. It writes in ${schedule.languages.join(", ")}.` },
      { status: 400 },
    );
  }

  const deps = await liveDeps();
  const result = await prepareGenerated(deps, { schedule, platform, language });

  if (!result.ok) {
    // 🔑 The rejected drafts come back too. "Three drafts were written and all
    // three were refused" is a fact about the brief, and hiding the attempts
    // would leave nothing to act on.
    return NextResponse.json({ error: result.reason, rejected: result.rejected }, { status: 422 });
  }

  if (input.dryRun) {
    return NextResponse.json({
      dryRun: true,
      post: { ...result.post, picture: result.post.picture ? "composed" : null },
      note: "Nothing was saved. The subject and the picture recipe are NOT claimed on a dry run.",
    });
  }

  const saved = await savePreparedPost(result.post, { scheduledFor: null });
  if (!saved.ok) return NextResponse.json({ error: saved.reason }, { status: 409 });

  return NextResponse.json({
    postId: saved.postId,
    status: result.post.status,
    subject: result.post.subject,
    language: result.post.language,
    notes: result.post.notes,
    rejected: result.post.rejected,
  });
}
