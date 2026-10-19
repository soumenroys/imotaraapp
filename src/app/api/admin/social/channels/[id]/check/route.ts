// POST /api/admin/social/channels/[id]/check — ask the platform, now
//
// 🔑 WHY A BUTTON AND NOT ONLY A CRON. The daily check is what catches a token
// that dies quietly. This is what answers "did the thing I just did work?" —
// and the moment a token is pasted is the only moment somebody is standing
// there able to fix it. Waiting until tomorrow to find out turns a thirty-
// second correction into a day of nothing being posted.
//
// ⛔ THE TOKEN DOES NOT LEAVE THIS ROUTE in either direction: it is decrypted
// here, sent to Facebook, and the reply is reduced to a status and a sentence.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialAdmin } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { loadChannelCredential } from "@/lib/social/channelCredentials";
import { checkChannel, channelCanBeChecked } from "@/lib/social/channelCheck";
import { captureChannelStats, capturePostStats } from "@/lib/social/stats";
import { describeToken } from "@/lib/social/adapters/facebook";

export const maxDuration = 60;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;

  const db = getSupabaseAdmin();
  const cred = await loadChannelCredential(db, id);
  if (!cred.ok) return NextResponse.json({ error: cred.reason }, { status: 400 });

  /**
   * ⚠️ Asked of the dispatcher rather than tested against a string here. This
   * read `cred.platform !== "facebook"`, which meant adding Instagram needed
   * an edit in a file nobody would think to open ⇒ channelCheck.ts.
   */
  if (!channelCanBeChecked(cred.platform)) {
    return NextResponse.json(
      {
        error:
          `There is no way to check a ${cred.platform} token yet — nothing has been built that ` +
          `can talk to it. ⚠️ Its status stays "Not checked yet", which is the truth.`,
      },
      { status: 400 },
    );
  }

  const result = await checkChannel(cred);
  const now = new Date().toISOString();

  /**
   * 🔑 A NETWORK FAILURE DOES NOT CHANGE THE STATUS. Our own connectivity
   * saying nothing is not the platform saying no, and marking a working
   * channel "Needs you" because a DNS lookup flapped would send somebody to
   * revoke and regenerate a perfectly good token.
   */
  if (!result.ok && result.kind === "network") {
    return NextResponse.json({ status: "unchanged", ok: false, note: result.message });
  }

  /**
   * ⛔ THE SAME RULE AS THE CRON, including `canPost`. The first version of
   * this route said `result.ok ? "ok" : …`, so a Page we could read and not
   * post to read **Working** here and **Needs you** an hour later when the
   * daily check ran. Two paths, one state, two verdicts — and the one the
   * owner would have trusted is the one they pressed themselves.
   * ⇒ src/app/api/cron/social-health/route.ts
   */
  const status = result.ok
    ? result.canPost
      ? "ok"
      : "dead"
    : result.kind === "rate"
      ? "pending"
      : "dead";

  const { error } = await db
    .from("social_accounts")
    .update({
      status,
      last_error: result.ok ? null : result.message,
      last_verified_at: now,
    })
    .eq("id", cred.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  /**
   * 🔑 A CHECK IS ALSO A CHANCE TO TAKE STOCK, and it is the only way to get a
   * baseline for a channel that was connected before any of this existed —
   * Facebook was connected hours earlier the same day.
   *
   * ⛔ Never fails the check. The verdict above is the answer somebody pressed
   * the button for; figures are a bonus.
   */
  let figures = "";
  if (result.ok) {
    try {
      const taken = await captureChannelStats(db, cred.id, { note: "taken at check" });
      if (taken.ok) figures = ` ${taken.note}`;
    } catch {
      // ⚠️ Silent on purpose — see above. The daily run will try again.
    }

    /**
     * 🔑 AND THE POSTS, NOT ONLY THE CHANNEL.
     *
     * ⛔ Until now the ONLY caller of capturePostStats was the 19:30 cron, so
     * the first time a new channel's per-post reader ever ran was unattended,
     * at night, with nobody to read the error. That is precisely the shape of
     * failure this feature exists to prevent — and on Instagram the figure it
     * fetches is SAVES, which is the number the whole voice was written for.
     *
     * ⚠️ Cheap here: it reads only posts published in the last fortnight,
     * and a channel that has just been connected has none.
     */
    try {
      const posts = await capturePostStats(db, cred.id);
      if (posts.captured > 0) {
        figures += ` ${posts.captured} post(s) measured.`;
      }
      if (posts.problems.length > 0) {
        // ⛔ Said, not swallowed. A reader that cannot read is the thing
        // somebody standing here can still fix.
        figures += ` ⚠️ Post figures: ${posts.problems.join("; ")}`;
      }
    } catch (e) {
      figures += ` ⚠️ Post figures could not be taken (${(e as Error).message}).`;
    }

    /**
     * 🔑 AND WHAT THE TOKEN ACTUALLY CARRIES ⇒ describeToken.
     *
     * 🔴 ADDED 19 Oct after an evening of inferring it. Facebook refused every
     * post's figures for want of `pages_read_engagement`; the permission was
     * ticked when the token was generated, the app holds it, and the token's
     * last four characters did not change when a new one was pasted. Three
     * pieces of indirect evidence, no answer. ⇒ Ask.
     *
     * ⛔ SCOPES ONLY, NEVER THE TOKEN. This line is rendered on a screen.
     */
    try {
      const facts = await describeToken({ token: cred.token });
      if (facts.ok) {
        figures +=
          ` 🔑 The token carries: ${facts.scopes.length ? facts.scopes.join(", ") : "NO scopes at all"}.` +
          ` Valid: ${facts.valid ? "yes" : "NO"}.` +
          ` Expires: ${facts.expiresAt ?? "never"}.`;
      } else {
        figures += ` ⚠️ The token could not be described (${facts.message}).`;
      }
    } catch (e) {
      figures += ` ⚠️ The token could not be described (${(e as Error).message}).`;
    }
  }

  return NextResponse.json({
    status,
    ok: result.ok,
    // ⚠️ `ok` from Facebook is not `ok` as a channel. The note carries which.
    note: (result.ok ? result.note : result.message) + figures,
    // ⚠️ Carried separately because a reachable Page that cannot be posted to
    // is the one failure that otherwise reads as success.
    canPost: result.ok ? result.canPost : false,
    checkedAt: now,
  });
}
