// src/lib/social/channelCredentials.ts
// Getting a stored token back out, for the two callers that legitimately need
// the plaintext: the health check and the publisher.
//
// 🔑 ONE DOOR, ON PURPOSE. Decryption needs the row's platform and external id
// as the aad — get either wrong and it throws rather than returning a token
// for the wrong channel. Spreading that across callers means each one gets a
// chance to pass the wrong binding, and the failure would be posting to one
// place with another place's credential.
//
// ⛔ NOTHING HERE LOGS THE TOKEN, and callers must not either. A token in a
// log is a token in a log aggregator, a screenshot and a support thread.

import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken, encryptToken, tokenAad, tokenStorageReady, tokenTail, tokenFingerprint } from "@/lib/social/tokenCrypto";
import { xOAuthConfig, refreshXAccessToken } from "@/lib/social/adapters/xAuth";
import {
  youtubeOAuthConfig,
  refreshYouTubeAccessToken,
  type YouTubeRefreshToken,
} from "@/lib/social/adapters/youtubeAuth";

export type ChannelCredential =
  | { ok: true; id: string; platform: string; externalId: string; displayName: string; token: string }
  | { ok: false; reason: string };

export type ChannelRefreshCredential =
  | { ok: true; id: string; platform: string; externalId: string; displayName: string; refreshToken: string }
  | { ok: false; reason: string };

/**
 * ⚠️ Takes the client rather than reaching for the admin client itself, so a
 * caller cannot accidentally run this with the anon key and get silence.
 */
export async function loadChannelCredential(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
  accountId: string,
): Promise<ChannelCredential> {
  const storage = tokenStorageReady();
  if (!storage.ok) return { ok: false, reason: storage.reason ?? "The token key is not usable." };

  const { data, error } = await db
    .from("social_accounts")
    .select("id, platform, external_id, display_name, access_token")
    .eq("id", accountId)
    .maybeSingle();

  if (error) return { ok: false, reason: error.message };
  if (!data) return { ok: false, reason: "There is no connected channel with that id." };
  if (!data.access_token) {
    return { ok: false, reason: "That channel has a row but no stored token." };
  }

  try {
    const token = decryptToken(
      data.access_token as string,
      tokenAad(data.platform as string, data.external_id as string),
    );
    return {
      ok: true,
      id: data.id as string,
      platform: data.platform as string,
      externalId: data.external_id as string,
      displayName: data.display_name as string,
      token,
    };
  } catch (e) {
    /**
     * ⛔ A FAILED DECRYPT IS NOT A DEAD TOKEN and must never be reported as
     * one. It means the key changed, the row was tampered with, or the
     * platform/external id was edited after the token was stored — and the
     * remedy for each is different from "paste a new token".
     */
    return {
      ok: false,
      reason:
        `The stored token could not be decrypted (${(e as Error).message}). ⚠️ This is a key or a ` +
        `row problem, not an expired token — check SOCIAL_TOKEN_KEY before pasting a new one.`,
    };
  }
}

/**
 * The same door, for the other kind of secret.
 *
 * 🔴 WHY THIS IS A SEPARATE FUNCTION AND NOT A FLAG ON THE ONE ABOVE.
 * `loadChannelCredential` refuses a row with no `access_token`, and every one
 * of its callers depends on that: they take `token` and send it to a platform.
 * Relaxing it so YouTube could share the path would mean the other four
 * channels could be handed an empty string and would post — or fail to — with
 * a credential that was never there.
 *
 * ⚠️ YouTube rows legitimately have `access_token = NULL`. What is stored is a
 * REFRESH token, which is never sent to YouTube; it is exchanged with Google
 * for an hour-long access token at publish time ⇒ youtubeAuth.ts.
 *
 * 🔑 SAME AAD as the access token — platform + external_id — so the binding
 * story stays one story ⇒ trap_an_id_can_be_half_an_encryption_key.
 */
export async function loadChannelRefreshToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
  accountId: string,
): Promise<ChannelRefreshCredential> {
  const storage = tokenStorageReady();
  if (!storage.ok) return { ok: false, reason: storage.reason ?? "The token key is not usable." };

  const { data, error } = await db
    .from("social_accounts")
    .select("id, platform, external_id, display_name, refresh_token")
    .eq("id", accountId)
    .maybeSingle();

  if (error) return { ok: false, reason: error.message };
  if (!data) return { ok: false, reason: "There is no connected channel with that id." };
  if (!data.refresh_token) {
    return {
      ok: false,
      reason:
        "That channel has a row but no stored refresh token. ▶️ Connect it once through " +
        "/api/admin/social/youtube/connect — a refresh token only arrives from a consent screen.",
    };
  }

  try {
    const refreshToken = decryptToken(
      data.refresh_token as string,
      tokenAad(data.platform as string, data.external_id as string),
    );
    return {
      ok: true,
      id: data.id as string,
      platform: data.platform as string,
      externalId: data.external_id as string,
      displayName: data.display_name as string,
      refreshToken,
    };
  } catch (e) {
    // ⛔ Same distinction as above: this is a KEY problem, not a dead token,
    // and sending somebody to re-consent would not fix it.
    return {
      ok: false,
      reason:
        `The stored refresh token could not be decrypted (${(e as Error).message}). ⚠️ This is a key or a ` +
        `row problem, not a revoked token — check SOCIAL_TOKEN_KEY, and whether external_id was edited.`,
    };
  }
}

/**
 * 🔑 ONE DOOR FOR THE PUBLISHER AND THE HEALTH CHECK ALIKE, whatever the
 * channel keeps.
 *
 * Four platforms store a long-lived access token; YouTube stores a refresh
 * token and mints an access token per use. Callers want the same thing from
 * all five — "a credential I can send" — and this is where that difference is
 * absorbed.
 *
 * ⛔ IT EXISTS BECAUSE I WROTE THE YOUTUBE BRANCH TWICE. The first copy lived
 * inside social-publish/route.ts, which meant the health check could not reach
 * it and reported YouTube as uncheckable — a channel connected and silently
 * unmonitored, which is the exact failure the production OAuth status was
 * chosen to avoid ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
 *
 * ⚠️ Minting is NOT cached. The token is wanted immediately before use, and a
 * cache would outlive a revocation.
 */
export async function loadCredentialFor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
  accountId: string,
  platform: string,
  origin?: string,
): Promise<ChannelCredential> {
  if (platform === "x") return loadXCredential(db, accountId, origin);
  if (platform !== "youtube") return loadChannelCredential(db, accountId);

  const stored = await loadChannelRefreshToken(db, accountId);
  if (!stored.ok) return stored;

  const config = youtubeOAuthConfig(process.env, origin);
  if (!config.ok) return { ok: false, reason: config.message };

  const minted = await refreshYouTubeAccessToken({
    config: config.config,
    refreshToken: stored.refreshToken as YouTubeRefreshToken,
  });
  /**
   * 🔑 AND THIS IS WHAT MAKES YOUTUBE CHECKABLE AT ALL. `youtube.upload` is
   * too narrow to read the channel back — `channels.list?mine=true` needs a
   * wider scope we deliberately did not ask for. But exchanging the refresh
   * token IS the meaningful question: it is exactly the thing that dies when a
   * grant is revoked or the OAuth app slips back to "Testing". ⇒ A successful
   * mint proves the credential is alive, without widening the scope.
   */
  if (!minted.ok) return { ok: false, reason: minted.message };

  return {
    ok: true,
    id: stored.id,
    platform: stored.platform,
    externalId: stored.externalId,
    displayName: stored.displayName,
    token: minted.accessToken,
  };
}

/**
 * 🔴 X ROTATES ITS REFRESH TOKEN ⇒ xAuth.ts. Every mint returns a new one and
 * the old one stops working, so the new one is stored HERE, before the access
 * token is handed to anyone. If storing fails, the post still goes out with the
 * token already minted, but the row is marked so the next run does not fail
 * silently on a dead token.
 */
async function loadXCredential(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
  accountId: string,
  origin?: string,
): Promise<ChannelCredential> {
  const stored = await loadChannelRefreshToken(db, accountId);
  if (!stored.ok) return stored;
  const config = xOAuthConfig(process.env, origin);
  if (!config.ok) return { ok: false, reason: config.message };

  const minted = await refreshXAccessToken({ config: config.config, refreshToken: stored.refreshToken });
  if (!minted.ok) return { ok: false, reason: minted.message };

  if (minted.refreshToken !== stored.refreshToken) {
    const aad = tokenAad(stored.platform, stored.externalId);
    const { error } = await db
      .from("social_accounts")
      .update({
        refresh_token: encryptToken(minted.refreshToken, aad),
        token_tail: tokenTail(minted.refreshToken),
        token_fingerprint: tokenFingerprint(minted.refreshToken),
        updated_at: new Date().toISOString(),
      })
      .eq("id", stored.id);
    if (error) {
      await db
        .from("social_accounts")
        .update({ status: "dead", last_error: `X issued a new refresh token that could not be saved (${error.message}). Re-connect X.` })
        .eq("id", stored.id);
    }
  }

  return {
    ok: true,
    id: stored.id,
    platform: stored.platform,
    externalId: stored.externalId,
    displayName: stored.displayName,
    token: minted.accessToken,
  };
}

