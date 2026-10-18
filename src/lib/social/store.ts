// src/lib/social/store.ts
// Everything that touches the database, in one place.
//
// 🔑 WHY IT IS SEPARATE FROM THE PIPELINE. The pipeline decides what a post
// says and whether it may go out; this fetches rows. Keeping them apart is what
// lets the decisions be tested — all 156 of those tests run with no database —
// and it keeps the queries in one file where the RLS assumption is visible.
//
// ⛔ EVERY TABLE HERE HAS RLS ON AND NO POLICIES, so only the service-role
// client can read them. That is deliberate: `social_accounts` holds platform
// access tokens. If something here ever appears not to work from a browser,
// that is the lockdown doing its job — add an API route, never a policy.

import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { RECENT_WINDOW } from "@/lib/social/visualRecipe";
import { wantsPicture } from "@/lib/social/pipeline";
import type { ContentType } from "@/lib/social/contentTypes";
import type { GateOverlay } from "@/lib/social/voiceGate";
import type { PipelineDeps, PreparedPost, ScheduleShape } from "@/lib/social/pipeline";
import { writeWithModel } from "@/lib/social/writer";

/** How many past subjects the overlap check sees. ⚠️ Exact repeats at ANY
 *  distance are caught by the unique index regardless of this number. */
const SUBJECT_HISTORY = 400;

export type ScheduleRow = {
  id: string;
  name: string;
  brief: string;
  platforms: string[];
  content_type: ScheduleShape["contentType"];
  topic_pool: string[];
  tone: string;
  length_hint: string;
  languages: string[];
  wordmark_follows_language: boolean;
  post_at: string;
  timezone: string;
  days: number[];
  active: boolean;
  auto_publish: boolean;
  created_at: string;
  updated_at: string;
};

export function toScheduleShape(row: ScheduleRow): ScheduleShape {
  return {
    id: row.id,
    name: row.name,
    brief: row.brief,
    platforms: row.platforms,
    contentType: row.content_type,
    topicPool: row.topic_pool ?? [],
    tone: row.tone,
    lengthHint: row.length_hint,
    languages: row.languages,
    autoPublish: row.auto_publish,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The overlay: what a speaker has contributed since the code was written
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⛔ FAILS CLOSED. If either query errors, the overlay comes back empty — which
 * means fewer languages qualify for unattended posting, not more. A database
 * hiccup must never be able to widen what may be published.
 */
export type AbuseTermRow = { language: string; term: string };
export type TierRow = { code: string; reviewed: boolean; abuse_list_ready: boolean };

/**
 * The decision, as a pure function.
 *
 * 🔴 EXTRACTED BECAUSE IT WAS UNTESTABLE AND THEREFORE UNTESTED. A mutation run
 * showed that turning the `&&` below into `||` broke nothing — and that single
 * character is the difference between "a language nobody here reads may not
 * post unattended" and "six contributed words unlock it".
 *
 * ⛔ BOTH conditions, never either. They are separate facts:
 *   • `reviewed`         — somebody here can read a draft in it.
 *   • `abuse_list_ready` — there is a vocabulary to check abuse against.
 * Bengali passes the first and fails the second today, which is exactly the
 * case that makes the distinction worth keeping
 * ⇒ trap_a_guard_satisfied_by_a_neighbouring_value.
 */
export function overlayFromRows(terms: AbuseTermRow[], tiers: TierRow[]): GateOverlay {
  const abuse: Record<string, string[]> = {};
  for (const row of terms) {
    (abuse[row.language] ??= []).push(row.term);
  }
  const reviewed = tiers.filter((t) => t.reviewed && t.abuse_list_ready).map((t) => t.code);
  return { abuse, reviewed };
}

export async function loadOverlay(): Promise<GateOverlay> {
  const db = getSupabaseAdmin();
  const [terms, tiers] = await Promise.all([
    db.from("social_abuse_terms").select("language, term"),
    db.from("social_language_tiers").select("code, reviewed, abuse_list_ready"),
  ]);
  // ⛔ FAILS CLOSED: an errored query yields no rows, so FEWER languages
  // qualify, never more. A database hiccup must not be able to widen what may
  // be published.
  return overlayFromRows((terms.data ?? []) as AbuseTermRow[], (tiers.data ?? []) as TierRow[]);
}

// ─────────────────────────────────────────────────────────────────────────────
// The registers
// ─────────────────────────────────────────────────────────────────────────────

export async function recentSubjects(limit = SUBJECT_HISTORY): Promise<string[]> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("social_topics_used")
    .select("subject")
    .order("used_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => r.subject as string);
}

/**
 * Every recipe hash ever used.
 *
 * ⚠️ Fetched whole rather than queried per candidate. There are 1,152 recipes
 * per language, so the register cannot outgrow a single page in any realistic
 * future, and one round trip beats a thousand.
 */
export async function usedRecipeHashes(): Promise<Set<string>> {
  const db = getSupabaseAdmin();
  const { data } = await db.from("social_visuals_used").select("recipe_hash").limit(50_000);
  return new Set((data ?? []).map((r) => r.recipe_hash as string));
}

export async function recentVisuals(): Promise<{ palettes: string[]; layouts: string[] }> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("social_visuals_used")
    .select("palette, layout")
    .order("used_at", { ascending: false })
    .limit(RECENT_WINDOW);
  const rows = data ?? [];
  return {
    palettes: rows.map((r) => r.palette as string),
    layouts: rows.map((r) => r.layout as string),
  };
}

/** The deps the pipeline needs, wired to the real database and the real model. */
export async function liveDeps(): Promise<PipelineDeps> {
  const recent = await recentVisuals();
  return {
    recentSubjects: () => recentSubjects(),
    usedRecipeHashes: () => usedRecipeHashes(),
    recentPalettes: async () => recent.palettes,
    recentLayouts: async () => recent.layouts,
    overlay: () => loadOverlay(),
    write: writeWithModel,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Saving a prepared post
// ─────────────────────────────────────────────────────────────────────────────

export type SaveResult =
  | { ok: true; postId: string }
  | { ok: false; reason: string };

/**
 * Write a prepared post, and claim its subject and its picture recipe.
 *
 * 🔑 THE REGISTERS ARE CLAIMED IN THE SAME CALL, and a unique-violation on
 * either is treated as SUCCESS-FOR-SOMEBODY-ELSE rather than as an error: it
 * means a concurrent run took that subject or that recipe first. The post is
 * then discarded, because the alternative is publishing the duplicate the whole
 * register exists to prevent.
 *
 * ⚠️ This is the one place the uniqueness guarantee actually lands. The checks
 * in the pipeline reduce how often we get here with a clash; the unique index
 * is what makes it impossible.
 */
export async function savePreparedPost(
  post: PreparedPost,
  opts: { scheduledFor: string | null; mediaPath?: string | null },
): Promise<SaveResult> {
  const db = getSupabaseAdmin();

  const { data: inserted, error } = await db
    .from("social_posts")
    .insert({
      origin: post.origin,
      schedule_id: post.scheduleId,
      author_id: post.authorId,
      platform: post.platform,
      language: post.language,
      scheduled_for: opts.scheduledFor,
      status: post.status,
      subject: post.subject,
      body: post.body,
      media_kind: post.mediaKind,
      // ⚠️ NULL for a hand-written post, which has no angle — and that is the
      // truth rather than a default pool.
      topic_pool: post.topicPool ?? null,
      media_path: opts.mediaPath ?? null,
      visual_recipe: post.recipe ? { ...post.recipe, notes: post.notes } : null,
      gate_result: {
        listsRun: post.gate.listsRun,
        listsUnavailable: post.gate.listsUnavailable,
        findings: post.gate.findings,
        houseStyle: post.houseStyle.problems,
        notes: post.notes,
        rejectedDrafts: post.rejected,
      },
      generated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { ok: false, reason: error?.message ?? "the post could not be saved" };
  }
  const postId = inserted.id as string;

  const topic = await db.from("social_topics_used").insert({
    subject_hash: post.subjectHash,
    subject: post.subject,
    language: post.language,
    schedule_id: post.scheduleId,
    post_id: postId,
  });

  if (topic.error) {
    // 23505 is a unique violation. Anything else is a real failure.
    const duplicate = topic.error.code === "23505" || /duplicate key/i.test(topic.error.message);
    await db.from("social_posts").delete().eq("id", postId);
    return {
      ok: false,
      reason: duplicate
        ? `Another run claimed the subject “${post.subject}” first. The draft was discarded rather than duplicated.`
        : `The subject register refused the entry: ${topic.error.message}`,
    };
  }

  if (post.recipe) {
    const visual = await db.from("social_visuals_used").insert({
      recipe_hash: post.recipe.hash,
      layout: post.recipe.layout,
      palette: post.recipe.palette,
      type_treatment: post.recipe.typeTreatment,
      motif: post.recipe.motif,
      script: post.recipe.script,
      schedule_id: post.scheduleId,
      post_id: postId,
    });
    if (visual.error) {
      const duplicate = visual.error.code === "23505" || /duplicate key/i.test(visual.error.message);
      await db.from("social_topics_used").delete().eq("post_id", postId);
      await db.from("social_posts").delete().eq("id", postId);
      return {
        ok: false,
        reason: duplicate
          ? "Another run claimed that picture recipe first. The draft was discarded rather than repeated."
          : `The picture register refused the entry: ${visual.error.message}`,
      };
    }
  }

  return { ok: true, postId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Due schedules
// ─────────────────────────────────────────────────────────────────────────────

/** How far ahead of its slot a post is written, so a draft is waiting with
 *  time to spare rather than appearing at the hour. */
export const LEAD_MINUTES = 120;

/**
 * Is this schedule due to be written now?
 *
 * ⚠️ PURE, AND SEPARATE FROM THE QUERY, so the timezone arithmetic can be
 * tested at a fixed instant. "Due at 09:30 Asia/Kolkata on weekdays" read off a
 * UTC clock is exactly the kind of thing that works for eleven months and then
 * posts at the wrong hour when a date boundary falls between the two.
 */
export function isDue(
  schedule: { post_at: string; timezone: string; days: number[]; active: boolean },
  now: Date,
  leadMinutes = LEAD_MINUTES,
): boolean {
  if (!schedule.active) return false;

  const target = new Date(now.getTime() + leadMinutes * 60_000);

  // The wall clock in the schedule's own zone at the moment we are aiming at.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: schedule.timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(target);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = get("weekday");
  const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  if (dayIndex < 0 || !schedule.days.includes(dayIndex)) return false;

  const [h, m] = schedule.post_at.split(":").map(Number);
  return Number(get("hour")) === h && Number(get("minute")) === m;
}

export async function dueSchedules(now: Date): Promise<ScheduleRow[]> {
  const db = getSupabaseAdmin();
  const { data } = await db.from("social_schedules").select("*").eq("active", true);
  return ((data ?? []) as ScheduleRow[]).filter((s) => isDue(s, now));
}

export async function postingIsPaused(): Promise<{ paused: boolean; note?: string }> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("social_settings")
    .select("posting_paused, note")
    .eq("id", 1)
    .single();
  // ⛔ Fails CLOSED: a settings row we cannot read is treated as paused. The
  // cost of a missed post is a missed post; the cost of posting while somebody
  // believes everything is held is the whole reason that switch exists.
  if (error || !data) {
    return { paused: true, note: "The posting settings could not be read, so everything is held." };
  }
  return { paused: Boolean(data.posting_paused), note: (data.note as string) ?? undefined };
}

/** How many posts a schedule has produced, for the language rotation. */
export async function postCountFor(scheduleId: string): Promise<number> {
  const db = getSupabaseAdmin();
  const { count } = await db
    .from("social_posts")
    .select("id", { count: "exact", head: true })
    .eq("schedule_id", scheduleId);
  return count ?? 0;
}

/** Has this schedule already produced a post for this slot? */
export async function alreadyWrittenFor(
  scheduleId: string,
  platform: string,
  scheduledFor: string,
): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("social_posts")
    .select("id")
    .eq("schedule_id", scheduleId)
    .eq("platform", platform)
    .eq("scheduled_for", scheduledFor)
    .limit(1);
  return (data ?? []).length > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Giving a queued post the card it can now have
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 `media_kind` IS FROZEN AT WRITE TIME, AND THE CARD RULES CHANGE.
 *
 * On 18 Oct the headline started coming from the subject rather than the
 * body's opening sentence ⇒ src/lib/social/visualRecipe.ts. Every post already
 * in the queue had been composed under the old rule, had failed to produce a
 * headline, and carried `media_kind: "none"` — so fixing the renderer changed
 * nothing for them, and the first post to publish went out as plain text into
 * a feed of bold graphics.
 *
 * ⚠️ I patched four of them with a one-off script. That worked and left the
 * owner unable to do the same thing — the same "dependency, not a feature"
 * problem as the missing reschedule control.
 *
 * ⛔ AND IT DOES NOT BELONG IN THE PUBLISHER. Composing a card claims a recipe
 * against a unique index, which can fail; the publish path is the one place in
 * this feature that cannot be undone, and it does not need another way to go
 * wrong a second before it posts. The queue cron already holds the recipe
 * register, so it does this.
 */
export type CardUpgrade = { id: string; subject: string; result: "given" | "still-no-headline" | "refused"; detail?: string };

/** Posts that are queued, have no card, and belong to a schedule that wanted one. */
export async function postsWantingACard(): Promise<
  { id: string; subject: string; body: string; language: string; schedule_id: string | null }[]
> {
  const db = getSupabaseAdmin();
  const { data: posts } = await db
    .from("social_posts")
    .select("id, subject, body, language, schedule_id, media_kind, visual_recipe, status")
    .in("status", ["needs_review", "approved"])
    .eq("media_kind", "none")
    .is("visual_recipe", null)
    .limit(50);

  const rows = (posts ?? []) as { id: string; subject: string; body: string; language: string; schedule_id: string | null }[];
  if (rows.length === 0) return [];

  // ⚠️ The post row does not carry the content type — the SCHEDULE does. A
  // post from a text-only schedule must not sprout a card it was never meant
  // to have.
  const ids = [...new Set(rows.map((r) => r.schedule_id).filter(Boolean))] as string[];
  if (ids.length === 0) return [];
  const { data: schedules } = await db
    .from("social_schedules")
    .select("id, content_type")
    .in("id", ids);

  const wants = new Map((schedules ?? []).map((s) => [s.id as string, s.content_type as string]));
  return rows.filter((r) => r.schedule_id && wantsPicture(wants.get(r.schedule_id) as ContentType));
}

/**
 * Claim a recipe and attach it to a post.
 *
 * ⛔ The claim goes through the SAME unique index the pipeline uses, so a
 * recipe still cannot come round twice — and a post is only updated once its
 * recipe is safely claimed, never the other way round.
 */
export async function attachCard(
  post: { id: string; schedule_id: string | null },
  recipe: { hash: string; layout: string; palette: string; typeTreatment: string; motif: string; script: string },
): Promise<{ ok: boolean; reason?: string }> {
  const db = getSupabaseAdmin();
  const claim = await db.from("social_visuals_used").insert({
    recipe_hash: recipe.hash,
    layout: recipe.layout,
    palette: recipe.palette,
    type_treatment: recipe.typeTreatment,
    motif: recipe.motif,
    script: recipe.script,
    schedule_id: post.schedule_id,
    post_id: post.id,
  });
  if (claim.error) {
    const duplicate = claim.error.code === "23505" || /duplicate key/i.test(claim.error.message);
    return {
      ok: false,
      reason: duplicate
        ? "Another run claimed that picture recipe first."
        : `The picture register refused the entry: ${claim.error.message}`,
    };
  }

  const { error } = await db
    .from("social_posts")
    .update({ media_kind: "graphic", visual_recipe: recipe, updated_at: new Date().toISOString() })
    .eq("id", post.id)
    // ⛔ Only while it is still cardless. A concurrent run must not overwrite
    // a recipe that was just attached.
    .eq("media_kind", "none");
  return error ? { ok: false, reason: error.message } : { ok: true };
}
