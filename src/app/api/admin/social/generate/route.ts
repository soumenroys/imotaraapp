// POST /api/admin/social/generate — write one now, for a schedule
//
// The same code path the cron uses, triggered by hand. ⛔ Deliberately the SAME
// path: a "test" button that ran different code would prove nothing about what
// happens at 09:30.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialAdmin } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { activeTrends } from "@/lib/social/trends";
import { prepareGenerated, nextLanguage, type ScheduleShape, type ContentType } from "@/lib/social/pipeline";
import { liveDeps, savePreparedPost, toScheduleShape, postCountFor, type ScheduleRow } from "@/lib/social/store";

export const maxDuration = 120;

type Body = {
  scheduleId?: string;
  platform?: string;
  language?: string;
  dryRun?: boolean;
  /**
   * 🔑 A schedule that does not exist yet.
   *
   * The owner's mental model, 18 Oct: "i thought that i can schedule the social
   * media name, time, language and preview the content and schedule". Preview
   * came BEFORE saving, and it could not — you had to create the schedule, then
   * generate, then look. ⇒ This previews from the form's own values.
   *
   * ⛔ Always a dry run: nothing is saved, and the subject and picture recipe
   * are NOT claimed, so previewing twice does not burn two subjects.
   */
  preview?: {
    brief?: string;
    platforms?: string[];
    contentType?: ContentType;
    topicPool?: string[];
    tone?: string;
    lengthHint?: string;
    languages?: string[];
  };
};

export async function POST(req: NextRequest) {
  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;

  let input: Body;
  try {
    input = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "the request body was not JSON" }, { status: 400 });
  }
  // ── Previewing an unsaved schedule ────────────────────────────────────────
  if (input.preview && !input.scheduleId) {
    const pv = input.preview;
    const platform = pv.platforms?.[0];
    const language = pv.languages?.[0];
    if (!platform || !language) {
      return NextResponse.json(
        { error: "Choose at least one channel and one language before previewing." },
        { status: 400 },
      );
    }
    if (!pv.brief || pv.brief.trim().length < 20) {
      return NextResponse.json({ error: "Write the brief first — it is what the post is written from." }, { status: 400 });
    }

    const shape: ScheduleShape = {
      id: "preview",
      name: "preview",
      brief: pv.brief.trim(),
      platforms: [platform],
      contentType: pv.contentType ?? "text_graphic",
      topicPool: pv.topicPool ?? [],
      tone: pv.tone ?? "gentle_plain",
      lengthHint: pv.lengthHint ?? "medium",
      languages: [language],
      autoPublish: false,
    };

    const deps = await liveDeps();
    /**
     * ⚠️ A PREVIEW HAS NO HISTORY, so there is no count to rotate on. Pressing
     * "See what it would write" repeatedly would otherwise show the same angle
     * every time and look like the rotation is broken — so a preview walks the
     * pools instead, which is also the fastest way to see what each one does.
     */
    const result = await prepareGenerated(deps, {
      schedule: shape,
      platform,
      language,
      postsSoFar: Math.floor(Math.random() * Math.max(1, shape.topicPool.length)),
      trends: await activeTrends(getSupabaseAdmin()).catch(() => []),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.reason, rejected: result.rejected }, { status: 422 });
    }
    return NextResponse.json({
      preview: true,
      subject: result.post.subject,
      body: result.post.body,
      support: result.post.support ?? null,
      language: result.post.language,
      platform,
      characters: [...result.post.body].length,
      houseStyle: result.post.houseStyle.problems,
      listsRun: result.post.gate.listsRun,
      listsUnavailable: result.post.gate.listsUnavailable,
      notes: result.post.notes,
      // ⛔ Said plainly: nothing was kept, so this subject can still come up.
      note: "Nothing was saved. This is what the schedule would write.",
    });
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

  /**
   * ⚠️ ONE count, used for BOTH the language and the angle ⇒ nextPool. Calling
   * postCountFor twice would be two different numbers if a post landed in
   * between, and the two rotations would then drift apart for no reason
   * anybody could see.
   */
  const postsSoFar = await postCountFor(schedule.id);
  const language = input.language ?? nextLanguage(schedule.languages, postsSoFar);
  if (!schedule.languages.includes(language)) {
    return NextResponse.json(
      { error: `This schedule does not write in ${language}. It writes in ${schedule.languages.join(", ")}.` },
      { status: 400 },
    );
  }

  const deps = await liveDeps();
  const result = await prepareGenerated(deps, { schedule, platform, language, postsSoFar, trends: await activeTrends(db).catch(() => []) });

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
