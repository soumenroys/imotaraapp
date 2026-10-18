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
  dueSchedules,
  liveDeps,
  postCountFor,
  postingIsPaused,
  savePreparedPost,
  toScheduleShape,
  alreadyWrittenFor,
  LEAD_MINUTES,
  type ScheduleRow,
} from "@/lib/social/store";
import { markCronFired } from "@/lib/cron/heartbeat";

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

  const due = await dueSchedules(now);
  if (due.length === 0) {
    return NextResponse.json({ ran: true, due: 0, at: now.toISOString() });
  }

  const deps = await liveDeps();
  const outcomes: Outcome[] = [];
  const slot = new Date(now.getTime() + LEAD_MINUTES * 60_000).toISOString();

  for (const row of due as ScheduleRow[]) {
    const schedule = toScheduleShape(row);
    const count = await postCountFor(schedule.id);

    for (const platform of schedule.platforms) {
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
        const prepared = await prepareGenerated(deps, { schedule, platform, language });
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

  return NextResponse.json({
    ran: true,
    at: now.toISOString(),
    slot,
    due: due.length,
    outcomes,
    // ⛔ Said out loud on every run, so nobody mistakes a full queue for a
    // feature that is working end to end.
    publishing:
      approved > 0
        ? `${approved} post(s) are marked approved and will publish as soon as a channel adapter exists. ` +
          `Phase 1 does not publish — nothing has reached a timeline.`
        : "Phase 1 does not publish. Everything written is waiting to be read.",
  });
}
