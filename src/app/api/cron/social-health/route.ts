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
import { sendChannelAlert } from "@/lib/social/alert";

export const maxDuration = 120;

/** How long before a token dies we start saying so. ⚠️ LinkedIn's live 60
 *  days, so ten days is more than one working week of warning — enough that
 *  the fix is never done in a hurry. */
const WARN_DAYS = 10;

export async function GET(req: NextRequest) {
  const auth = cronAuthorised(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });

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

    if (!storage.ok) {
      // ⛔ Without the key nothing can be verified AND nothing can be posted.
      // Saying "ok" here would be the most expensive lie this route could tell.
      next = "dead";
      why = storage.reason;
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
     * ⚠️ WHAT THIS DOES NOT DO YET, said plainly rather than implied: it does
     * not call the platform. There is no adapter, so there is nothing to call
     * with. It checks what is knowable from here — the key, and the expiry the
     * platform told us at connect time.
     *
     * ⛔ So a token revoked at the other end still reads 'pending' until an
     * adapter exists. That is why `pending` is a status and `ok` is only ever
     * set by a real call that succeeded.
     */
    if (next !== was) {
      await db
        .from("social_accounts")
        .update({ status: next, last_error: why ?? null, last_verified_at: now.toISOString() })
        .eq("id", a.id);

      if ((next === "dead" || next === "expiring") && was !== next) {
        newlyBroken.push({
          platform: a.platform as string,
          displayName: a.display_name as string,
          why: why ?? "It stopped working.",
        });
      }
    } else {
      await db.from("social_accounts").update({ last_verified_at: now.toISOString() }).eq("id", a.id);
    }

    checked.push({ platform: a.platform as string, was, now: next, why });
  }

  // 🔑 Only on a CHANGE. A daily email saying the same thing is an email
  // nobody opens, and then the one that matters is not opened either.
  let alerted = false;
  if (newlyBroken.length > 0) {
    alerted = await sendChannelAlert(newlyBroken);
  }

  return NextResponse.json({
    ran: true,
    at: now.toISOString(),
    checked,
    alerted,
    note:
      "⚠️ This verifies what is knowable from here: the encryption key and the expiry the platform " +
      "gave at connect time. It cannot yet ask the platform whether a token still works, because " +
      "there is no adapter to ask with — so a token revoked at the other end still reads 'pending'.",
  });
}
