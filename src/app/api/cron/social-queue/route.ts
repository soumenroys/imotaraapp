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
import {
  prepareGenerated,
  nextLanguage,
  standDownReasons,
  failureDetail,
  istDayWindow,
} from "@/lib/social/pipeline";
import { giveAPicture, stylesUsedOn } from "@/lib/social/giveAPicture";
import {
  activeSchedules,
  writtenSlotKeys,
  scheduleById,
  liveDeps,
  postCountFor,
  postingIsPaused,
  savePreparedPost,
  slotAttempts,
  recordSlotFailure,
  clearSlotFailure,
} from "@/lib/social/store";
import { missingSlots, slotKey, HORIZON_DAYS, MAX_PER_RUN } from "@/lib/social/horizon";
import { angleScores, angleReport } from "@/lib/social/learning";
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
   * 🔴 THE HORIZON, NOT A LEAD TIME ⇒ src/lib/social/horizon.ts.
   *
   * The question is no longer "is a schedule due this minute?" but "which of
   * the next ten days' slots do not have a post yet?". ⛔ That is the whole
   * difference: a gap from ANY cause — a missed minute, a deploy, a channel
   * time added after that day's trigger had passed — is just a missing slot,
   * and the next run fills it. The old shape could only ever write the one
   * slot whose minute was happening right now.
   *
   * ⚠️ Ten days because the owner reviews these by hand and asked for the
   * room to think, comment and correct. Two hours was a window that opened
   * while you were at lunch.
   */
  const schedules = await activeSchedules();
  const written = await writtenSlotKeys(schedules.map((s) => s.id), now);
  /**
   * ⛔ A SLOT THAT JUST FAILED IS SKIPPED, NOT RETRIED ⇒ horizon.ts.
   *
   * Earliest-first plus a per-run bound plus a slot that cannot be written is
   * head-of-line blocking: ten days of queue stay empty behind one bad day,
   * burning about 2,880 model calls a day on a post nobody ever sees.
   */
  const tried = await slotAttempts(schedules.map((s) => s.id), now);
  // ⚠️ Read ONCE and shared with the stand-down explanation below, so what the
  // run did and what it says about itself cannot disagree.
  const usage = await deps.poolUsage();
  const wanted = missingSlots(schedules, written, now, {
    horizonDays: HORIZON_DAYS,
    max: MAX_PER_RUN,
    attempts: tried,
  });

  if (wanted.length === 0) {
    return NextResponse.json({
      ran: true,
      horizonDays: HORIZON_DAYS,
      filled: 0,
      cards: upgrades,
      at: now.toISOString(),
    });
  }

  const outcomes: Outcome[] = [];

  for (const want of wanted) {
    const row = schedules.find((s) => s.id === want.scheduleId);
    if (!row) continue;
    const full = await scheduleById(want.scheduleId);
    if (!full) continue;
    const schedule = full;
    const platform = want.platform;
    const count = await postCountFor(schedule.id);

    const soFar = tried.get(slotKey(want))?.attempts ?? 0;
    const failed = async (reason: string) => {
      await recordSlotFailure(want, reason, soFar);
    };

    let language: string;
    try {
      language = nextLanguage(schedule.languages, count);
    } catch (e) {
      await failed((e as Error).message);
      outcomes.push({
        schedule: schedule.name,
        platform,
        result: "refused",
        detail: (e as Error).message,
      });
      continue;
    }

    try {
      const prepared = await prepareGenerated(deps, {
        schedule,
        platform,
        language,
        postsSoFar: count,
        // 🔑 WHICH DAY this post is for, so the angle can avoid what the other
        // channels already said that day ⇒ pipeline.poolsLeftForToday.
        scheduledFor: want.scheduledFor,
      });
      if (!prepared.ok) {
        /**
         * 🔴 THE OBJECTIONS, WRITTEN DOWN — added 20 Oct 2026.
         *
         * ⛔ The refusal says "the objections are recorded against each
         * attempt so the brief can be fixed". **They were not.**
         * `prepareGenerated` returns them on `rejected` and this branch threw
         * them away, storing only the summary — so the one sentence telling
         * an operator where to look pointed at nothing
         * ⇒ trap_a_sentence_that_states_the_world_goes_stale.
         *
         * 🔑 Found on four Instagram slots that failed 3 drafts out of 3 and
         * left no evidence of WHY. Two later recovered on retry, which makes
         * it intermittent — exactly the kind of failure that cannot be
         * diagnosed after the fact unless the reason was kept.
         *
         * ⚠️ The subject and body are deliberately NOT stored: the reason is
         * what is actionable, and copying rejected drafts into a failure row
         * would put ungated words somewhere nobody is expecting them.
         */
        const detail = failureDetail(prepared.reason, prepared.rejected);
        await failed(detail);
        outcomes.push({ schedule: schedule.name, platform, language, result: "refused", detail });
        continue;
      }
      const saved = await savePreparedPost(prepared.post, { scheduledFor: want.scheduledFor });
      if (!saved.ok) {
        await failed(saved.reason);
        outcomes.push({ schedule: schedule.name, platform, language, result: "skipped", detail: saved.reason });
        continue;
      }
      // ⚠️ The slot has a post now, so its failures are history.
      await clearSlotFailure(want);

      /**
       * 🔑 THE BACKGROUND PICTURE — AFTER THE POST IS SAFELY SAVED, on purpose.
       *
       * ⛔ A DRAWING MUST NEVER COST A SLOT. The post exists and will publish
       * with or without a picture; a post without one composes exactly the
       * card this product published all week. So a model outage, a storage
       * hiccup or a safety refusal is a note on the row, not a lost evening
       * ⇒ the four empty Instagram slots are what this ordering prevents.
       *
       * ⚠️ ONCE, HERE, rather than at render: drawing per render would spend
       * money on every approval, preview and retry — and would hand the
       * reviewer a different picture from the one that publishes, which is an
       * approval gate approving something nobody will see.
       */
      let pictureNote = "";
      try {
        const day = istDayWindow(want.scheduledFor);
        const gave = await giveAPicture({
          postId: saved.postId,
          postsSoFar: count,
          // 🔑 Across every channel, so three posts on one day get three
          // different styles ⇒ the lockstep bug found this morning.
          usedToday: await stylesUsedOn(day.from, day.to),
          angle: prepared.post.topicPool,
          // ⚠️ The subject as a FEELING to evoke, never as something to depict
          // — "illustrate someone awake at 3am" lands on exactly the imagery
          // the safety clause forbids.
          mood: prepared.post.subject,
        });
        pictureNote = gave.ok ? ` · picture: ${gave.illustration.style}` : ` · no picture (${gave.reason})`;
      } catch (e) {
        // ⛔ Caught, never thrown. The post is already saved.
        pictureNote = ` · no picture (${(e as Error).message})`;
      }

      outcomes.push({
        schedule: schedule.name,
        platform,
        language,
        result: prepared.post.status === "approved" ? "approved" : "queued",
        detail: `for ${want.scheduledFor} · ${prepared.post.notes.join(" ")}${pictureNote}`,
      });
    } catch (e) {
      // ⛔ One slot failing must not stop the others. A thrown model call on a
      // Tuesday should not mean no posts anywhere for ten days.
      await failed((e as Error).message);
      outcomes.push({
        schedule: schedule.name,
        platform,
        language,
        result: "refused",
        detail: (e as Error).message,
      });
    }
  }

  /**
   * 🔑 WHY AN ANGLE NEVER APPEARS, said out loud ⇒ standDownReasons.
   *
   * ⛔ An angle that quietly stops being offered looks exactly like one that
   * is simply unlucky in the rotation. `untranslatable` carried a careful
   * explanation from the day it was written and nothing ever read it — which
   * is how four posts about the same word reached one ten-day queue.
   */
  const standDown = schedules.flatMap((row) =>
    standDownReasons(row.topic_pool ?? [], usage).map((r) => ({ schedule: row.id, ...r })),
  );

  /**
   * 🔑 WHAT THE NUMBERS SAY, AND WHETHER THEY SAID ANYTHING ⇒ learning.ts.
   *
   * ⛔ A feedback loop quietly doing nothing because it has no data looks
   * exactly like one that is broken, and the difference is what decides
   * whether anybody trusts it. So it reports "not enough to rank" in as many
   * words rather than returning an empty list.
   */
  const scores = angleScores(await deps.measuredPosts());
  const learned = [...new Set(schedules.flatMap((r) => r.platforms ?? []))].map((p) =>
    angleReport(scores, p),
  );

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
    horizonDays: HORIZON_DAYS,
    // ⚠️ The slots this run TRIED to fill, named. A run that filled none
    // because the horizon is full and a run that filled none because every
    // generation refused must not look the same from outside.
    filled: wanted.map((w) => `${w.platform}@${w.scheduledFor}`),
    standDown,
    learned,
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
