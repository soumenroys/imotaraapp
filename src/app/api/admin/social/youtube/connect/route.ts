// GET /api/admin/social/youtube/connect — start the one consent YouTube needs  🔐 owner
//
// 🔑 WHY YOUTUBE GETS A FLOW WHEN NO OTHER CHANNEL DOES. Every other channel is
// connected by pasting a long-lived token into the admin. Google does not issue
// one: the durable thing is a REFRESH token, and a refresh token can only come
// out of a consent screen. So this is the one channel where the credential is
// fetched rather than pasted — which is strictly better, because the secret
// never passes through a person, a clipboard or a chat window.
//
// ⛔ THIS ROUTE STORES NOTHING. It only redirects. Everything durable happens in
// ../callback, after Google has agreed.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialOwner } from "@/app/api/admin/social/_guard";
import { youtubeOAuthConfig, youtubeConsentUrl } from "@/lib/social/adapters/youtubeAuth";
import { encryptToken, tokenStorageReady } from "@/lib/social/tokenCrypto";
import { randomUUID } from "crypto";

/**
 * 🔑 The `state` is the CSRF defence, and it is SIGNED RATHER THAN STORED.
 * Keeping it in a table would need a row per attempt and a sweep for the ones
 * nobody finished; encrypting a timestamp with the key we already trust gives
 * the same guarantee with nothing to clean up.
 *
 * ⚠️ The aad is a constant and NOT tokenAad(), on purpose: this is not a
 * channel credential, and borrowing the channel binding would mean a state
 * string could be swapped for a token payload.
 */
export const STATE_AAD = "imotara:youtube:oauth-state";

/** ⚠️ Deliberately short. A consent screen is answered in seconds, not hours. */
export const STATE_MAX_AGE_MS = 10 * 60 * 1000;

export async function GET(req: NextRequest) {
  const guard = await requireSocialOwner(req, "connect the YouTube channel");
  if (!guard.ok) return guard.response;

  const storage = tokenStorageReady();
  if (!storage.ok) {
    // ⛔ Refused BEFORE sending anybody to Google. Discovering on the callback
    // that the key is unusable means a granted consent with nowhere to put it,
    // and the refresh token Google issued is then burnt.
    return NextResponse.json(
      {
        error:
          `The token key is not usable, so a YouTube credential could not be stored even if you granted it ` +
          `(${storage.reason}). ⛔ Fix SOCIAL_TOKEN_KEY first — consenting now would waste the grant.`,
      },
      { status: 500 },
    );
  }

  const origin = new URL(req.url).origin;
  const config = youtubeOAuthConfig(process.env, origin);
  if (!config.ok) return NextResponse.json({ error: config.message }, { status: 500 });

  const state = encryptToken(JSON.stringify({ t: Date.now(), n: randomUUID() }), STATE_AAD);

  /**
   * ⚠️ 307, not 302. The method is preserved, and more importantly the browser
   * is told not to cache this: the URL carries a one-shot state.
   */
  return NextResponse.redirect(youtubeConsentUrl(config.config, state), {
    status: 307,
    headers: { "cache-control": "no-store" },
  });
}
