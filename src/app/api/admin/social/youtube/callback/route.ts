// GET /api/admin/social/youtube/callback — where Google comes back  🔐 owner
//
// 🔴 THE ONLY PLACE A YOUTUBE REFRESH TOKEN EVER EXISTS IN PLAINTEXT, and it
// lives for the few lines between the exchange and the encrypt. It is never
// logged, never returned in the response, and never shown in the admin — the
// redirect carries a note, not a credential.
//
// ⚠️ Google appends `?code=…` to this URL IN THE PERSON'S BROWSER, so the
// authorization code lands in their history. That is why the code is useless on
// its own: redeeming it needs the client secret, which is server-side only, and
// it is single-use.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialOwner } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { youtubeOAuthConfig, exchangeYouTubeCode } from "@/lib/social/adapters/youtubeAuth";
import { encryptToken, decryptToken, tokenAad, tokenTail, tokenFingerprint } from "@/lib/social/tokenCrypto";
import { STATE_AAD, STATE_MAX_AGE_MS } from "@/app/api/admin/social/youtube/connect/route";
import { YOUTUBE_UPLOAD_SCOPE } from "@/lib/social/adapters/youtube";

/**
 * 🔑 THE CHANNEL THIS APP POSTS TO, verified 19 Oct 2026 against the public
 * channel page's own canonical link — not recalled
 * ⇒ trap_a_model_invents_specifics_it_cannot_have.
 *
 * 🔴 IT IS HALF THE ENCRYPTION KEY. `tokenAad(platform, external_id)` binds the
 * stored secret to this string, so editing it on a connected row does not
 * rename the channel — it makes the credential undecryptable
 * ⇒ trap_an_id_can_be_half_an_encryption_key.
 *
 * ⚠️ WHY IT IS A CONSTANT RATHER THAN READ BACK FROM GOOGLE. Asking which
 * channel a token owns means `channels.list?mine=true`, which `youtube.upload`
 * does not permit — it would cost a wider scope than publishing needs. ⛔ A
 * broader scope to populate a display field is a bad trade.
 */
export const IMOTARA_YOUTUBE_CHANNEL_ID = "UCJSh0QnG31SYa4vw5KE1Baw";

function back(origin: string, note: string, ok: boolean) {
  const url = new URL("/admin/social", origin);
  url.searchParams.set(ok ? "connected" : "error", note);
  return NextResponse.redirect(url, { status: 307, headers: { "cache-control": "no-store" } });
}

export async function GET(req: NextRequest) {
  const guard = await requireSocialOwner(req, "finish connecting the YouTube channel");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const origin = url.origin;

  /**
   * ⚠️ GOOGLE'S OWN REFUSAL COMES BACK HERE TOO, as `?error=access_denied`,
   * and it is not an exception. Reading `code` first would produce "no code was
   * returned", which hides a person having clicked Cancel.
   */
  const denied = url.searchParams.get("error");
  if (denied) {
    return back(origin, `Google did not grant access (${denied}). Nothing was changed.`, false);
  }

  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!state || !code) return back(origin, "That callback was missing its code or state.", false);

  // 🔑 State first, always. Validating it after spending the code would mean a
  // forged callback could still burn a real authorization.
  let issuedAt = 0;
  try {
    issuedAt = (JSON.parse(decryptToken(state, STATE_AAD)) as { t?: number }).t ?? 0;
  } catch {
    return back(origin, "That callback's state did not come from here. Nothing was changed.", false);
  }
  if (!issuedAt || Date.now() - issuedAt > STATE_MAX_AGE_MS) {
    return back(origin, "That consent link had gone stale. Start the connection again.", false);
  }

  const config = youtubeOAuthConfig(process.env, origin);
  if (!config.ok) return back(origin, config.message, false);

  const exchanged = await exchangeYouTubeCode({ config: config.config, code });
  if (!exchanged.ok) return back(origin, exchanged.message, false);

  const aad = tokenAad("youtube", IMOTARA_YOUTUBE_CHANNEL_ID);
  const db = getSupabaseAdmin();

  /**
   * ⛔ `access_token` IS LEFT NULL ON PURPOSE. Google's expires in an hour, so
   * storing it would be storing something already stale — and a column holding
   * a dead credential is an invitation to send it ⇒ social_accounts_refresh_token.sql.
   *
   * ⚠️ The tail and fingerprint describe the REFRESH token, which is what this
   * row actually holds, so the admin's "which credential is this" display is
   * about the thing that exists.
   */
  const { error } = await db
    .from("social_accounts")
    .upsert(
      {
        platform: "youtube",
        external_id: IMOTARA_YOUTUBE_CHANNEL_ID,
        display_name: "Imotara on YouTube",
        access_token: null,
        refresh_token: encryptToken(String(exchanged.refreshToken), aad),
        token_tail: tokenTail(String(exchanged.refreshToken)),
        token_fingerprint: tokenFingerprint(String(exchanged.refreshToken)),
        scopes: YOUTUBE_UPLOAD_SCOPE,
        status: "ok",
        last_verified_at: new Date().toISOString(),
        last_error: null,
        // 🔑 A Google refresh token has no expiry while the app stays "In
        // production", so there is no date to put here. ⚠️ NULL means "does not
        // expire", which is different from "we do not know" — and the health
        // cron reads this column.
        token_expires_at: null,
      },
      { onConflict: "platform,external_id" },
    );

  if (error) {
    /**
     * 🔴 THE GRANT IS ALREADY SPENT AT THIS POINT. Saying "try again" would be
     * wrong — the code is single-use and the refresh token is now unreferenced.
     * The honest instruction is to run the whole consent again.
     */
    return back(
      origin,
      `Google granted access but it could not be stored (${error.message}). ⚠️ That grant is spent — ` +
        `run Connect again rather than retrying this link.`,
      false,
    );
  }

  return back(origin, "YouTube is connected. The channel can now publish Shorts.", true);
}
