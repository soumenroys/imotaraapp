// src/lib/social/adapters/xAuth.ts
// Connecting @ImotaraOfficial to X once, and minting a short-lived token per post.
//
// 🔑 SAME SHAPE AS YOUTUBE ⇒ youtubeAuth.ts: store a refresh token, mint an
// access token at use. X's user tokens last ~2 hours without `offline.access`,
// and the schedule is WEEKLY — a pasted token would "work" and then be dead on
// every run that matters ⇒ the 20 Oct finding on the board.
//
// 🔴 ONE DIFFERENCE THAT DECIDES WHETHER THIS KEEPS WORKING: X ROTATES THE
// REFRESH TOKEN. Every refresh returns a NEW refresh token and the old one stops
// working. Google never does this. So the caller MUST store the token this file
// returns from `refreshXAccessToken` before doing anything else ⇒
// channelCredentials.loadCredentialFor. Forget it once and the next run is dead.
//
// 🔑 PKCE: X's OAuth 2.0 requires a code_challenge. The verifier has to survive
// the round trip to X and back; it travels INSIDE the encrypted `state`, so it
// is never readable in the URL and nothing needs a table.
//
// ⛔ Nothing here logs a token, a code or the client secret.

import { createHash, randomBytes } from "crypto";

const AUTH_URL = "https://x.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const ME_URL = "https://api.x.com/2/users/me";

/**
 * tweet.write to post, media.write for the card upload, users.read to learn
 * which account consented, offline.access for the refresh token.
 */
export const X_SCOPES = ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"] as const;

export type XAuthFailure = "config" | "denied" | "expired" | "transient";
export type XOAuthConfig = { clientId: string; clientSecret: string; redirectUri: string };

export function xRedirectUriFor(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/api/admin/social/x/callback`;
}

/** ⛔ Names what is missing, never the values. */
export function xOAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
  origin?: string,
): { ok: true; config: XOAuthConfig } | { ok: false; message: string } {
  const clientId = env.X_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.X_OAUTH_CLIENT_SECRET?.trim();
  const missing = [!clientId && "X_OAUTH_CLIENT_ID", !clientSecret && "X_OAUTH_CLIENT_SECRET"].filter(Boolean);
  if (missing.length) {
    return {
      ok: false,
      message:
        `X publishing is not configured: ${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} not set. ` +
        `🔑 Both come from the X Developer Console ⇒ the app's "Keys and tokens" → OAuth 2.0 Client ID and Secret.`,
    };
  }
  const base = (origin ?? env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (!base) return { ok: false, message: "X publishing needs its own origin to build the redirect URI." };
  return { ok: true, config: { clientId: clientId!, clientSecret: clientSecret!, redirectUri: xRedirectUriFor(base) } };
}

/** A fresh PKCE verifier (43–128 chars) and its S256 challenge. */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  return { verifier, challenge: pkceChallenge(verifier) };
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function xConsentUrl(config: XOAuthConfig, state: string, challenge: string): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", X_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

function classify(status: number, body: string): { kind: XAuthFailure; message: string } {
  const error = /"error"\s*:\s*"([^"]+)"/.exec(body)?.[1] ?? "";
  const described = /"error_description"\s*:\s*"([^"]+)"/.exec(body)?.[1] ?? body.slice(0, 300);
  if (error === "invalid_request" && /refresh/i.test(described)) {
    return {
      kind: "expired",
      message:
        `X will not accept the stored refresh token any more (${described}). ⚠️ X ROTATES refresh tokens — ` +
        `if a new one was ever not saved, the stored one is dead. ▶️ Re-connect X on the Channels page.`,
    };
  }
  if (error === "unauthorized_client" || error === "invalid_client" || status === 401) {
    return {
      kind: "config",
      message:
        `X rejected the app itself (${error || status}: ${described}). ⚠️ X_OAUTH_CLIENT_ID and ` +
        `X_OAUTH_CLIENT_SECRET must be the OAuth 2.0 pair of the SAME app, and OAuth 2.0 must be on in its settings.`,
    };
  }
  if (status >= 500) return { kind: "transient", message: `X's end (${status}): ${described}` };
  return { kind: "denied", message: `X refused (${status}, ${error || "no code"}): ${described}` };
}

async function postToken(
  config: XOAuthConfig,
  form: Record<string, string>,
  doFetch: typeof fetch,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; kind: XAuthFailure; message: string }> {
  let res: Response;
  try {
    res = await doFetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        // A confidential client authenticates with Basic, not by sending the secret in the body.
        authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({ client_id: config.clientId, ...form }).toString(),
    });
  } catch (e) {
    return { ok: false, kind: "transient", message: `Could not reach X: ${(e as Error).message}` };
  }
  const text = await res.text();
  if (!res.ok) return { ok: false, ...classify(res.status, text) };
  try {
    return { ok: true, body: JSON.parse(text) as Record<string, unknown> };
  } catch {
    return { ok: false, kind: "transient", message: "X returned something that was not JSON." };
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

export type XTokens =
  | { ok: true; accessToken: string; refreshToken: string; expiresInSeconds: number }
  | { ok: false; kind: XAuthFailure; message: string };

export async function exchangeXCode(args: {
  config: XOAuthConfig;
  code: string;
  verifier: string;
  fetchImpl?: typeof fetch;
}): Promise<XTokens> {
  const r = await postToken(
    args.config,
    { code: args.code, grant_type: "authorization_code", redirect_uri: args.config.redirectUri, code_verifier: args.verifier },
    args.fetchImpl ?? fetch,
  );
  if (!r.ok) return r;
  const accessToken = str(r.body.access_token);
  const refreshToken = str(r.body.refresh_token);
  if (!refreshToken) {
    return {
      ok: false,
      kind: "denied",
      message: "X completed the exchange but returned no refresh token — offline.access was not granted. Nothing was stored.",
    };
  }
  if (!accessToken) return { ok: false, kind: "denied", message: "X returned a refresh token but no access token." };
  return { ok: true, accessToken, refreshToken, expiresInSeconds: Number(r.body.expires_in) || 0 };
}

/**
 * 🔴 Returns the NEW refresh token — store it before using the access token.
 * If X ever answers without one, the old token is returned so the caller keeps
 * what it had rather than blanking the row.
 */
export async function refreshXAccessToken(args: {
  config: XOAuthConfig;
  refreshToken: string;
  fetchImpl?: typeof fetch;
}): Promise<XTokens> {
  if (!args.refreshToken.trim()) return { ok: false, kind: "config", message: "There is no stored X refresh token to use." };
  const r = await postToken(args.config, { refresh_token: args.refreshToken, grant_type: "refresh_token" }, args.fetchImpl ?? fetch);
  if (!r.ok) return r;
  const accessToken = str(r.body.access_token);
  if (!accessToken) return { ok: false, kind: "transient", message: "X's refresh response carried no access token." };
  return {
    ok: true,
    accessToken,
    refreshToken: str(r.body.refresh_token) || args.refreshToken,
    expiresInSeconds: Number(r.body.expires_in) || 0,
  };
}

/** Who consented — so the row is bound to @ImotaraOfficial and nobody else. */
export async function xWhoAmI(accessToken: string, doFetch: typeof fetch = fetch): Promise<{ ok: true; id: string; username: string } | { ok: false; message: string }> {
  try {
    const res = await doFetch(ME_URL, { headers: { authorization: `Bearer ${accessToken}` } });
    const body = (await res.json().catch(() => ({}))) as { data?: { id?: string; username?: string } };
    if (!res.ok || !body.data?.id) return { ok: false, message: `X did not say which account this is (${res.status}).` };
    return { ok: true, id: body.data.id, username: body.data.username ?? "" };
  } catch (e) {
    return { ok: false, message: `Could not reach X: ${(e as Error).message}` };
  }
}
