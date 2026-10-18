// GET /api/cron/social-queue — write what is due, two hours ahead of its slot
//
// ⚠️ GET, AND BEARER-AUTHENTICATED. Vercel Cron sends a GET with
// `Authorization: Bearer $CRON_SECRET`. A route expecting POST 405s forever and
// nothing tells you ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
//
// ⛔ PHASE 1 DOES NOT PUBLISH. It writes, gates, composes and queues. There is
// no adapter yet, and a drain that silently did nothing would be worse than one
// that is openly absent — so the response says plainly how many posts are
// waiting on a channel that does not exist.

import { NextRequest, NextResponse } from "next/server";
import { cronAuthorised } from "@/app/api/admin/social/_guard";
import { prepareGenerated, nextLanguage } from "@/lib/social/pipeline";
import {
  duePlatforms,
  liveDeps,
  postCountFor,
  postingIsPaused,
  savePreparedPost,
  toScheduleShape,
  alreadyWrittenFor,
  LEAD_MINUTES,
} from "@/lib/social/store";
import { markCronFired } from "@/lib/cron/heartbeat";
import { sendQueueAlert } from "@/lib/social/alert";
import { pickRecipe, headlineFor } from "@/lib/social/visualRecipe";
import { postsWantingACard, attachCard, type CardUpgrade } from "@/lib/social/store";

/**
 * ⚠️ One pass, small and bounded. ⛔ It never touches a published post and
 * never changes a word — it only attaches a picture recipe to a post whose
 * schedule asked for one and which could not have had one when it was written.
 */
async function giveMissingCards(deps: Awaited<ReturnType<typeof liveDeps>>): Promise<CardUpgrade[]> {
  const out: CardUpgrade[] = [];
  const posts = await postsWantingACard();
  if (posts.length === 0) return out;

  const used = await deps.usedRecipeHashes();
  const palettes = await deps.recentPalettes();
  const layouts = await deps.recentLayouts();

  for (const p of posts) {
    // ⛔ Still derived from the post's own words, never invented.
    if (!headlineFor(p.subject ?? "", p.body)) {
      out.push({ id: p.id, subject: p.subject, result: "still-no-headline" });
      continue;
    }
    const picked = pickRecipe({
      language: p.language,
      usedHashes: used,
      recentPalettes: palettes,
      recentLayouts: layouts,
      rng: deps.rng,
    });
    if (!picked.ok) {
      out.push({ id: p.id, subject: p.subject, result: "refused", detail: picked.reason });
      continue;
    }
    const done = await attachCard(p, picked.recipe);
    if (!done.ok) {
      out.push({ id: p.id, subject: p.subject, result: "refused", detail: done.reason });
      continue;
    }
    // ⚠️ Kept in step within the run, so two posts in one pass cannot be
    // handed the same recipe before the register has caught up.
    used.add(picked.recipe.hash);
    palettes.unshift(picked.recipe.palette);
    layouts.unshift(picked.recipe.layout);
    out.push({ id: p.id, subject: p.subject, result: "given" });
  }
  return out;
}
import { publishingSentence } from "@/lib/social/platforms";

export const maxDuration = 300;

type Outcome = {
  schedule: string;
  platform: string;
  language?: string;
  result: "queued" | "approved" | "refused" | "skipped" | "already-written";
  detail?: string;
};

export async function GET(req: NextRequest) {
  const auth = cronAuthorised(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });
  // 🔵 It fired. Recorded before the work, so a job that crashes
  // half-way still proves Vercel invoked it — which is the thing a dead
  // cron cannot do. Never throws; see markCronFired.
  void markCronFired("/api/cron/social-queue");

  const now = new Date();
  const paused = await postingIsPaused();
  if (paused.paused) {
    // 🔑 Returns 200, not an error: the switch being on is a correct state, and
    // a failing cron would raise an alarm about something working as intended.
    return NextResponse.json({
      ran: false,
      reason: "Posting is paused.",
      note: paused.note ?? null,
      at: now.toISOString(),
    });
  }

  const deps = await liveDeps();

  /**
   * 🔴 GIVE QUEUED POSTS THE CARD THEY CAN NOW HAVE, before anything else.
   *
   * `media_kind` is frozen when a post is written, and the card rules change.
   * On 18 Oct the headline moved from the body's opening sentence to the
   * subject — and every post already queued stayed cardless, so the first one
   * to publish went out as plain text ⇒ src/lib/social/store.ts.
   *
   * ⛔ Deliberately HERE and not in the publisher. Claiming a recipe can fail
   * against a unique index, and the publish path is the one thing in this
   * feature that cannot be undone; it does not need another way to go wrong a
   * second before it posts.
   *
   * ⚠️ Runs even when no schedule is due — a quiet Sunday is exactly when the
   * backlog should be repaired.
   */
  const upgrades = await giveMissingCards(deps);

  /**
   * 🔑 PAIRS, NOT SCHEDULES. A schedule posting to Instagram at 17:00 and
   * Facebook at 17:30 is due for one and not the other, and writing both at
   * the earlier time is exactly the bug this replaces
   * ⇒ docs/sql/social_platform_times.sql.
   */
  const due = await duePlatforms(now);
  if (due.length === 0) {
    return NextResponse.json({ ran: true, due: 0, cards: upgrades, at: now.toISOString() });
  }

  const outcomes: Outcome[] = [];
  const slot = new Date(now.getTime() + LEAD_MINUTES * 60_000).toISOString();

  for (const { schedule: row, platforms } of due) {
    const schedule = toScheduleShape(row);
    const count = await postCountFor(schedule.id);

    // ⚠️ The platforms DUE NOW, not every platform on the schedule.
    for (const platform of platforms) {
      // ⚠️ The cron runs every minute and a slot lasts a minute, but a retry, a
      // clock skew or an overlapping invocation would otherwise write the same
      // post twice. Checked per platform, because the slot is per platform.
      if (await alreadyWrittenFor(schedule.id, platform, slot)) {
        outcomes.push({ schedule: schedule.name, platform, result: "already-written" });
        continue;
      }

      let language: string;
      try {
        language = nextLanguage(schedule.languages, count);
      } catch (e) {
        outcomes.push({
          schedule: schedule.name,
          platform,
          result: "refused",
          detail: (e as Error).message,
        });
        continue;
      }

      try {
        const prepared = await prepareGenerated(deps, { schedule, platform, language, postsSoFar: count });
        if (!prepared.ok) {
          outcomes.push({ schedule: schedule.name, platform, language, result: "refused", detail: prepared.reason });
          continue;
        }
        const saved = await savePreparedPost(prepared.post, { scheduledFor: slot });
        if (!saved.ok) {
          outcomes.push({ schedule: schedule.name, platform, language, result: "skipped", detail: saved.reason });
          continue;
        }
        outcomes.push({
          schedule: schedule.name,
          platform,
          language,
          result: prepared.post.status === "approved" ? "approved" : "queued",
          detail: prepared.post.notes.join(" "),
        });
      } catch (e) {
        // ⛔ One schedule failing must not stop the others. A thrown model call
        // on a Tuesday should not mean no posts anywhere for a week.
        outcomes.push({
          schedule: schedule.name,
          platform,
          language,
          result: "refused",
          detail: (e as Error).message,
        });
      }
    }
  }

  const approved = outcomes.filter((o) => o.result === "approved").length;

  /**
   * 🔴 A DUE SLOT THAT WROTE NOTHING IS TOLD TO SOMEBODY.
   *
   * ⛔ Until 19 Oct this reason only ever reached the HTTP response Vercel
   * Cron throws away. So generation could refuse every day — three drafts
   * rejected, no card possible on a channel that cannot post without one, a
   * model outage — and the only symptom would be an empty feed
   * ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
   *
   * ⚠️ ONLY `refused`. `already-written` is the idempotency guard doing its
   * job on a cron that runs every minute, and `skipped` means the post exists
   * but a duplicate subject was caught — neither is a slot that produced
   * nothing. Alerting on those would be a daily email that teaches somebody
   * to filter the one that matters.
   *
   * ⛔ Never fails the run. An alert that cannot send must not cost the posts
   * that DID get written.
   */
  const refused = outcomes.filter((o) => o.result === "refused");
  let alerted = false;
  if (refused.length > 0) {
    try {
      alerted = await sendQueueAlert(
        refused.map((o) => ({
          schedule: o.schedule,
          platform: o.platform,
          language: o.language,
          why: o.detail ?? "No reason was recorded.",
        })),
      );
    } catch (e) {
      console.error("[social-queue] the refusal alert threw:", (e as Error).message);
    }
  }

  return NextResponse.json({
    alerted,
    ran: true,
    at: now.toISOString(),
    slot,
    due: due.length,
    outcomes,
    // ⛔ Said out loud on every run, so nobody mistakes a full queue for a
    // feature that is working end to end.
    // ⚠️ Derived ⇒ publishingSentence. This said "Phase 1 does not publish"
    // for an hour after the publisher went live.
    cards: upgrades,
    publishing:
      approved > 0
        ? `${approved} post(s) are marked approved. ${publishingSentence()}`
        : publishingSentence(),
  });
}
