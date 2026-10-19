// GET /api/cron/social-health — does every connected channel still work?
//
// 🔑 THE OWNER'S ASK, 18 Oct: "if anytime i change the social media
// credentials, it will alert me to re-validate". ⇒ This is the alert. It runs
// whether or not anything is due to post, so a broken connection is found on a
// quiet Sunday rather than on the morning of a launch.
//
// 🔴 THE FAILURE THIS EXISTS TO PREVENT is not a token expiring. It is a token
// expiring and NOBODY FINDING OUT — the queue fills, every screen looks
// healthy, and the first symptom is somebody asking why nothing has been
// posted for three weeks ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
//
// ⚠️ GET with a Bearer, like every other cron here. A route expecting POST
// 405s forever and nothing tells you.

import { NextRequest, NextResponse } from "next/server";
import { cronAuthorised } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { tokenStorageReady } from "@/lib/social/tokenCrypto";
import { sendChannelAlert, sendMissedSlotAlert } from "@/lib/social/alert";
import { missedSlots, missedSummary, type QueueRow } from "@/lib/social/queueHealth";
import { markCronFired } from "@/lib/cron/heartbeat";
import { loadCredentialFor } from "@/lib/social/channelCredentials";
import { checkChannel, channelCanBeChecked } from "@/lib/social/channelCheck";

export const maxDuration = 120;

/** How long before a token dies we start saying so. ⚠️ LinkedIn's live 60
 *  days, so ten days is more than one working week of warning — enough that
 *  the fix is never done in a hurry. */
const WARN_DAYS = 10;

export async function GET(req: NextRequest) {
  const auth = cronAuthorised(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });
  // 🔵 It fired. Recorded before the work, so a job that crashes
  // half-way still proves Vercel invoked it — which is the thing a dead
  // cron cannot do. Never throws; see markCronFired.
  void markCronFired("/api/cron/social-health");

  const db = getSupabaseAdmin();
  const now = new Date();

  const { data: accounts, error } = await db
    .from("social_accounts")
    .select("id, platform, display_name, external_id, token_expires_at, status, token_tail, last_verified_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const storage = tokenStorageReady();
  const checked: { platform: string; was: string; now: string; why?: string }[] = [];
  const newlyBroken: { platform: string; displayName: string; why: string }[] = [];

  for (const a of accounts ?? []) {
    const was = a.status as string;
    let next = was;
    let why: string | undefined;
    /**
     * ⚠️ FALSE UNTIL A PLATFORM ANSWERS. A run that could not reach Facebook
     * must not stamp `last_verified_at` — "checked an hour ago" would then be
     * a lie told by the one field somebody consults to decide whether to
     * trust the rest of this page.
     */
    let verified = true;

    if (!storage.ok) {
      // ⛔ Without the key nothing can be verified AND nothing can be posted.
      // Saying "ok" here would be the most expensive lie this route could tell.
      next = "dead";
      why = storage.reason;
    } else if (channelCanBeChecked(a.platform as string)) {
      /**
       * 🔑 THE REAL CALL. Everything below this branch is inference from a
       * date; this is the platform itself answering. A token revoked at the
       * other end, an app removed from the portfolio or a Page un-assigned all
       * surface here and nowhere else.
       *
       * ⚠️ Which platforms that covers is decided in ONE place
       * ⇒ channelCheck.ts, so this cron and the button somebody presses can
       * never again disagree about the same channel.
       */
      const cred = await loadCredentialFor(db, a.id as string, a.platform as string);
      if (!cred.ok) {
        next = "dead";
        why = cred.reason;
      } else {
        const result = await checkChannel(cred);
        if (result.ok) {
          // ⛔ `canPost` false is NOT healthy. A Page we can read and cannot
          // post to is the failure that otherwise reads as success.
          next = result.canPost ? "ok" : "dead";
          why = result.canPost ? undefined : result.note;
        } else if (result.kind === "network") {
          // ⚠️ Our connectivity failing is not the platform saying no.
          verified = false;
          why = result.message;
        } else if (result.kind === "rate") {
          verified = false;
          why = result.message;
        } else {
          next = "dead";
          why = result.message;
        }
      }
    } else if (a.token_expires_at) {
      const days = (new Date(a.token_expires_at as string).getTime() - now.getTime()) / 86_400_000;
      if (days <= 0) {
        next = "dead";
        why = `The token expired on ${new Date(a.token_expires_at as string).toLocaleDateString()}.`;
      } else if (days <= WARN_DAYS) {
        next = "expiring";
        why = `The token expires in ${Math.ceil(days)} day(s).`;
      } else {
        next = was === "dead" || was === "expiring" ? "pending" : was;
      }
    }

    /**
     * ⚠️ WHAT THIS DOES AND DOES NOT DO, PER CHANNEL, said plainly rather than
     * implied. Facebook is asked directly — `ok` there means Facebook answered
     * and returned the Page. Every other channel has no adapter, so all that
     * is knowable from here is the key and the expiry the platform gave at
     * connect time; a token revoked at the other end still reads 'pending'.
     *
     * ⛔ That is why `pending` is a status at all, and why `ok` is only ever
     * set by a real call that succeeded.
     */
    const patch: Record<string, unknown> = verified ? { last_verified_at: now.toISOString() } : {};

    if (next !== was) {
      await db
        .from("social_accounts")
        .update({ ...patch, status: next, last_error: why ?? null })
        .eq("id", a.id);

      if ((next === "dead" || next === "expiring") && was !== next) {
        newlyBroken.push({
          platform: a.platform as string,
          displayName: a.display_name as string,
          why: why ?? "It stopped working.",
        });
      }
    } else if (verified) {
      await db.from("social_accounts").update(patch).eq("id", a.id);
    }

    checked.push({ platform: a.platform as string, was, now: next, why });
  }

  // 🔑 Only on a CHANGE. A daily email saying the same thing is an email
  // nobody opens, and then the one that matters is not opened either.
  let alerted = false;
  if (newlyBroken.length > 0) {
    alerted = await sendChannelAlert(newlyBroken);
  }

  /**
   * 🔴 THE SECOND ROAD TO THE SILENCE THIS CRON EXISTS TO PREVENT.
   *
   * The header above says it plainly: the failure is "the queue fills, every
   * screen looks healthy, and nobody has posted for three weeks". ⛔ Until 19
   * Oct this file only ever read `social_accounts`, so it could see a broken
   * token and could NOT see a healthy channel with a finished post nobody
   * approved — which produces the identical symptom.
   *
   * ⚠️ It happened the day this was added: Instagram's 11:30Z slot passed with
   * a post sitting in `needs_review` and nothing said a word
   * ⇒ src/lib/social/queueHealth.ts.
   */
  const { data: queue } = await db
    .from("social_posts")
    .select("id, platform, subject, status, scheduled_for, attempts, last_error")
    .in("status", ["needs_review", "approved"])
    // ⚠️ Bounded. A post whose slot passed a month ago is a fact about history,
    // not something to be told about this morning.
    .gte("scheduled_for", new Date(now.getTime() - 7 * 86_400_000).toISOString())
    .order("scheduled_for");

  const missed = missedSlots((queue ?? []) as QueueRow[], now);
  const missedAlerted = missed.length > 0 ? await sendMissedSlotAlert(missed, missedSummary(missed)) : false;

  return NextResponse.json({
    ran: true,
    at: now.toISOString(),
    checked,
    alerted,
    missed: missed.map((m) => ({ platform: m.platform, kind: m.kind, lateMinutes: m.lateMinutes, subject: m.subject })),
    missedAlerted,
    note:
      "✅ Facebook is asked directly: 'ok' there means Facebook answered and returned the Page. " +
      "⚠️ Every other channel has no adapter yet, so all that is checked is the encryption key and " +
      "the expiry the platform gave at connect time — a token revoked at the other end still " +
      "reads 'pending' on those.",
  });
}
