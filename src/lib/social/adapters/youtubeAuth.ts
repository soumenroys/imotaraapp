// src/lib/social/adapters/youtubeAuth.ts
// Getting — and keeping — permission to put a Short on the Imotara channel.
//
// 🔴 WHY THIS FILE EXISTS AT ALL, WHEN NO OTHER CHANNEL NEEDS ONE.
//
// Facebook, Instagram and LinkedIn each hand over ONE LONG-LIVED TOKEN that we
// paste in once and store. Google does not: its access tokens last about an
// hour. So YouTube is the first channel where the thing we store is not the
// thing we send — we keep a REFRESH token and mint an access token per publish.
//
// ⛔ THE STORED SECRET IS A REFRESH TOKEN AND IS NEVER SENT TO YOUTUBE. Sending
// it where an access token belongs fails with a 401 that reads exactly like an
// expired credential, which is a bad hour to spend ⇒ the two are separate types
// below rather than both being `string`.
//
// ⚠️ EVERY ENDPOINT HERE WAS READ OFF THE CREDENTIALS FILE Google itself issued
// for this client (`auth_uri` / `token_uri`), not recalled
// ⇒ trap_a_model_invents_specifics_it_cannot_have.

import { YOUTUBE_UPLOAD_SCOPE } from "@/lib/social/adapters/youtube";

/** From the client JSON's `auth_uri`. */
const AUTH_URL = "https://accounts.google.com/o/oauth2/auth";
/** From the client JSON's `token_uri`. */
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * 🔑 The refresh token, as stored. A distinct type so it cannot be passed to
 * `publishShortToYouTube`, which wants the short-lived one.
 */
export type YouTubeRefreshToken = string & { readonly __youtubeRefresh?: unique symbol };

export type YouTubeAuthFailure = "config" | "denied" | "expired" | "transient";

export type YouTubeAccessResult =
  | { ok: true; accessToken: string; expiresInSeconds: number }
  | { ok: false; kind: YouTubeAuthFailure; message: string };

export type YouTubeExchangeResult =
  | { ok: true; refreshToken: YouTubeRefreshToken; accessToken: string }
  | { ok: false; kind: YouTubeAuthFailure; message: string };

export type YouTubeOAuthConfig = { clientId: string; clientSecret: string; redirectUri: string };

/**
 * ⚠️ Reads the environment and says plainly what is missing. ⛔ Returns the
 * NAMES, never the values — a config error that prints a client secret turns a
 * misconfiguration into a credential leak.
 */
export function youtubeOAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
  origin?: string,
): { ok: true; config: YouTubeOAuthConfig } | { ok: false; message: string } {
  const clientId = env.YOUTUBE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.YOUTUBE_OAUTH_CLIENT_SECRET?.trim();

  const missing: string[] = [];
  if (!clientId) missing.push("YOUTUBE_OAUTH_CLIENT_ID");
  if (!clientSecret) missing.push("YOUTUBE_OAUTH_CLIENT_SECRET");
  if (missing.length > 0) {
    return {
      ok: false,
      message:
        `YouTube publishing is not configured: ${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} ` +
        `not set. 🔑 Both come from the Google Cloud project imotara-publishing ⇒ the OAuth client ` +
        `"Imotara YouTube uploader".`,
    };
  }

  const base = (origin ?? env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (!base) {
    return {
      ok: false,
      message:
        "YouTube publishing needs to know its own origin to build the redirect URI, and neither an " +
        "origin nor NEXT_PUBLIC_SITE_URL was given.",
    };
  }

  return {
    ok: true,
    config: { clientId: clientId!, clientSecret: clientSecret!, redirectUri: redirectUriFor(base) },
  };
}

/**
 * 🔴 ONE PLACE BUILDS THIS STRING. Google matches the redirect URI it receives
 * against the registered list CHARACTER FOR CHARACTER, so a second copy of this
 * path that drifts by a slash produces `redirect_uri_mismatch` — an error that
 * names neither copy. The three registered values differ only in their origin.
 */
export function redirectUriFor(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/api/admin/social/youtube/callback`;
}

/**
 * The URL that asks the channel's owner for permission.
 *
 * 🔴 `access_type=offline` AND `prompt=consent` TOGETHER, and neither is
 * optional here:
 *   • without `offline`, Google returns an access token and NO refresh token,
 *     so publishing would work for one hour and then stop;
 *   • without `prompt=consent`, Google omits the refresh token on every
 *     authorisation AFTER the first, because it assumes we kept the first one.
 *     ⚠️ That makes re-connecting a channel silently useless — the flow
 *     completes, reports success, and leaves nothing to refresh with.
 */
export function youtubeConsentUrl(config: YouTubeOAuthConfig, state: string): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", YOUTUBE_UPLOAD_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "false");
  url.searchParams.set("state", state);
  return url.toString();
}

function classify(status: number, body: string): { kind: YouTubeAuthFailure; message: string } {
  const error = /"error"\s*:\s*"([^"]+)"/.exec(body)?.[1] ?? "";
  const described = /"error_description"\s*:\s*"([^"]+)"/.exec(body)?.[1] ?? body.slice(0, 300);

  /**
   * 🔴 `invalid_grant` IS THE ONE THAT MATTERS and it does not mean "wrong
   * password". It means the refresh token is dead: revoked in the Google
   * account, or — the trap this whole setup was arranged to avoid — the OAuth
   * app slipped back to "Testing", where refresh tokens expire after 7 days.
   * ⇒ The remedy is to re-consent, and the message says so rather than leaving
   * somebody to guess at the client secret.
   */
  if (error === "invalid_grant") {
    return {
      kind: "expired",
      message:
        `Google will not accept the stored YouTube refresh token any more (invalid_grant: ${described}). ` +
        `⚠️ This is not a wrong secret — the token was revoked, or the OAuth app is back in "Testing" ` +
        `publishing status, where refresh tokens die after 7 days. ▶️ Re-connect the channel, and check ` +
        `that imotara-publishing still reads "In production".`,
    };
  }
  if (error === "invalid_client") {
    return {
      kind: "config",
      message:
        `Google rejected the client itself (invalid_client: ${described}). ⚠️ YOUTUBE_OAUTH_CLIENT_ID and ` +
        `YOUTUBE_OAUTH_CLIENT_SECRET must both come from the SAME OAuth client.`,
    };
  }
  if (error === "redirect_uri_mismatch") {
    return {
      kind: "config",
      message:
        `The redirect URI did not match one Google has registered (${described}). ⚠️ It is compared ` +
        `character for character, including the scheme and any trailing slash.`,
    };
  }
  if (status >= 500) return { kind: "transient", message: `Google's end (${status}): ${described}` };
  return { kind: "denied", message: `Google refused (${status}, ${error || "no code"}): ${described}` };
}

async function postToken(
  config: YouTubeOAuthConfig,
  form: Record<string, string>,
  doFetch: typeof fetch,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; kind: YouTubeAuthFailure; message: string }> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    ...form,
  });

  let res: Response;
  try {
    res = await doFetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (e) {
    // ⚠️ A thrown fetch is the network, not a refused grant. Calling it
    // "denied" would send somebody to re-consent for a blip.
    return { ok: false, kind: "transient", message: `Could not reach Google: ${(e as Error).message}` };
  }

  const text = await res.text();
  if (!res.ok) return { ok: false, ...classify(res.status, text) };

  try {
    return { ok: true, body: JSON.parse(text) as Record<string, unknown> };
  } catch {
    return { ok: false, kind: "transient", message: "Google returned something that was not JSON." };
  }
}

/**
 * One-time: turn the `code` Google put on the callback into a refresh token.
 *
 * ⛔ FAILS LOUDLY IF NO REFRESH TOKEN COMES BACK, rather than storing the
 * access token and calling it connected. That combination — a successful
 * exchange with no refresh token — is exactly what a missing `prompt=consent`
 * produces, and it would look like a working channel until an hour later.
 */
export async function exchangeYouTubeCode(args: {
  config: YouTubeOAuthConfig;
  code: string;
  fetchImpl?: typeof fetch;
}): Promise<YouTubeExchangeResult> {
  const result = await postToken(
    args.config,
    { code: args.code, grant_type: "authorization_code", redirect_uri: args.config.redirectUri },
    args.fetchImpl ?? fetch,
  );
  if (!result.ok) return result;

  const refreshToken = typeof result.body.refresh_token === "string" ? result.body.refresh_token : "";
  const accessToken = typeof result.body.access_token === "string" ? result.body.access_token : "";

  if (!refreshToken) {
    return {
      ok: false,
      kind: "denied",
      message:
        "Google completed the exchange but returned no refresh token, so nothing durable could be stored. " +
        "⚠️ That happens when the consent was not asked with access_type=offline and prompt=consent, or " +
        "when this Google account has already authorised the app and was not asked again. " +
        "▶️ Remove Imotara from the account's third-party access and connect once more.",
    };
  }
  if (!accessToken) {
    return { ok: false, kind: "denied", message: "Google returned a refresh token but no access token." };
  }

  return { ok: true, refreshToken: refreshToken as YouTubeRefreshToken, accessToken };
}

/**
 * Per publish: a fresh access token, good for about an hour.
 *
 * ⛔ NOT CACHED HERE. A module-level cache would be per-instance and would
 * outlive a revocation, and the saving is one HTTP call against an upload that
 * sends megabytes.
 */
export async function refreshYouTubeAccessToken(args: {
  config: YouTubeOAuthConfig;
  refreshToken: YouTubeRefreshToken;
  fetchImpl?: typeof fetch;
}): Promise<YouTubeAccessResult> {
  if (!String(args.refreshToken).trim()) {
    return { ok: false, kind: "config", message: "There is no stored YouTube refresh token to use." };
  }

  const result = await postToken(
    args.config,
    { refresh_token: String(args.refreshToken), grant_type: "refresh_token" },
    args.fetchImpl ?? fetch,
  );
  if (!result.ok) return result;

  const accessToken = typeof result.body.access_token === "string" ? result.body.access_token : "";
  if (!accessToken) {
    return { ok: false, kind: "transient", message: "Google's refresh response carried no access token." };
  }

  /**
   * ⚠️ `expires_in` is reported, not trusted. Nothing here schedules against
   * it — the token is minted immediately before use, so a wrong number cannot
   * strand a publish.
   */
  const expiresInSeconds =
    typeof result.body.expires_in === "number" ? result.body.expires_in : 0;

  return { ok: true, accessToken, expiresInSeconds };
}
