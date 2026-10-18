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
import { checkFacebookPage } from "@/lib/social/adapters/facebook";

export const maxDuration = 60;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;

  const db = getSupabaseAdmin();
  const cred = await loadChannelCredential(db, id);
  if (!cred.ok) return NextResponse.json({ error: cred.reason }, { status: 400 });

  /**
   * ⚠️ Facebook is the only channel with an adapter today, and this says so
   * rather than returning a cheerful nothing. ⇒ src/lib/social/platforms.ts
   */
  if (cred.platform !== "facebook") {
    return NextResponse.json(
      {
        error:
          `There is no way to check a ${cred.platform} token yet — nothing has been built that ` +
          `can talk to it. ⚠️ Its status stays "Not checked yet", which is the truth.`,
      },
      { status: 400 },
    );
  }

  const result = await checkFacebookPage({ token: cred.token, pageId: cred.externalId });
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

  const status = result.ok ? "ok" : result.kind === "rate" ? "pending" : "dead";

  const { error } = await db
    .from("social_accounts")
    .update({
      status,
      last_error: result.ok ? null : result.message,
      last_verified_at: now,
    })
    .eq("id", cred.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    status,
    ok: result.ok,
    note: result.ok ? result.note : result.message,
    // ⚠️ Carried separately because a reachable Page that cannot be posted to
    // is the one failure that otherwise reads as success.
    canPost: result.ok ? result.canPost : false,
    checkedAt: now,
  });
}
