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
import { decryptToken, tokenAad, tokenStorageReady } from "@/lib/social/tokenCrypto";

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
