// src/lib/meetings/calendar.ts
// Permission to write the Imotara calendar, and the two calls that use it.
//
// 🔴 WHY NOT THE SERVICE ACCOUNT THE SHEET USES. Google refuses to let a
// service account invite attendees on a normal Gmail calendar — that needs a
// Workspace domain and domain-wide delegation, which imotara.imotara@gmail.com
// does not have. So the server acts as the brand account itself, with a refresh
// token from ONE consent, given in the imotara-publishing project — the same
// OAuth client that publishes to YouTube for the same account.
// ⛔ Never the `imotara` project: it holds the app's live Google Sign-In.
//
// ⚠️ The endpoints are the ones youtubeAuth.ts read off the client's own JSON;
// the Calendar paths are from Google's Calendar API v3 reference.

import { decryptToken, encryptToken } from "@/lib/social/tokenCrypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MEETING_CALENDAR_ACCOUNT, type CalendarEvent } from "@/lib/meetings/plan";

const AUTH_URL = "https://accounts.google.com/o/oauth2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/**
 * 🔑 `calendar.events` writes events and nothing else; `openid email` only
 * tells us WHICH account consented — so a consent given with the wrong Google
 * account is refused instead of quietly booking into somebody's own calendar.
 */
export const CALENDAR_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events"] as const;

/** The row in google_grants. ⛔ Stable: it is half the encryption binding. */
const PURPOSE = "calendar";
export const grantAad = (account: string) => `google:${PURPOSE}:${account.toLowerCase()}`;

export type CalendarOAuthConfig = { clientId: string; clientSecret: string; redirectUri: string };

/** ⛔ Names what is missing, never a value. */
export function calendarOAuthConfig(env: NodeJS.ProcessEnv, origin: string): { ok: true; config: CalendarOAuthConfig } | { ok: false; message: string } {
  // 🔑 The same OAuth client as YouTube (project imotara-publishing): one client, one consent screen, one 100-user allowance.
  const clientId = env.YOUTUBE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.YOUTUBE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return { ok: false, message: "The calendar uses the imotara-publishing OAuth client, and YOUTUBE_OAUTH_CLIENT_ID / YOUTUBE_OAUTH_CLIENT_SECRET are not set." };
  }
  return { ok: true, config: { clientId, clientSecret, redirectUri: calendarRedirectUri(origin) } };
}

/** 🔴 One place builds it: Google compares it character for character with the registered list. */
export function calendarRedirectUri(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/api/admin/meetings/calendar/callback`;
}

/**
 * The consent link. `offline` + `consent` together, or no refresh token comes
 * back (see youtubeAuth.ts for the long version). `login_hint` pre-selects the
 * brand account; the callback still checks it.
 */
export function calendarConsentUrl(config: CalendarOAuthConfig, state: string): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", CALENDAR_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "false");
  url.searchParams.set("login_hint", MEETING_CALENDAR_ACCOUNT);
  url.searchParams.set("state", state);
  return url.toString();
}

async function token(config: CalendarOAuthConfig, form: Record<string, string>, doFetch: typeof fetch): Promise<Record<string, unknown>> {
  const res = await doFetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...form }).toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    const error = /"error"\s*:\s*"([^"]+)"/.exec(text)?.[1] ?? String(res.status);
    // 🔴 invalid_grant = the stored permission is dead (revoked, or the app went back to "Testing") ⇒ connect again.
    throw new Error(error === "invalid_grant"
      ? "Google no longer accepts the calendar permission (invalid_grant) — connect the calendar again, and check imotara-publishing still reads 'In production'."
      : `Google refused the calendar sign-in (${error}).`);
  }
  return JSON.parse(text) as Record<string, unknown>;
}

/**
 * The account an id_token names. ⚠️ Not signature-checked: it came straight
 * from Google's token endpoint over TLS, in answer to our own client secret —
 * the same trust the refresh token itself rests on.
 */
export function idTokenEmail(idToken: unknown): string {
  const payload = typeof idToken === "string" ? idToken.split(".")[1] : "";
  if (!payload) return "";
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: string; email_verified?: boolean };
    return p.email && p.email_verified !== false ? p.email.toLowerCase() : "";
  } catch {
    return "";
  }
}

/**
 * One time, on the callback: the code ⇒ a refresh token for the BRAND account.
 * ⛔ Refuses another account, and refuses an exchange with no refresh token.
 */
export async function exchangeCalendarCode(config: CalendarOAuthConfig, code: string, doFetch: typeof fetch = fetch): Promise<{ account: string; refreshToken: string; scopes: string[] }> {
  const body = await token(config, { code, grant_type: "authorization_code", redirect_uri: config.redirectUri }, doFetch);
  const account = idTokenEmail(body.id_token);
  if (account !== MEETING_CALENDAR_ACCOUNT) {
    throw new Error(`That consent was given by ${account || "an unknown account"}, not ${MEETING_CALENDAR_ACCOUNT}. Nothing was stored — connect again and choose ${MEETING_CALENDAR_ACCOUNT}.`);
  }
  const scopes = String(body.scope ?? "").split(/\s+/).filter(Boolean);
  if (!scopes.includes(CALENDAR_SCOPES[2])) {
    throw new Error("Google signed in but did not grant calendar access — the box for 'see, edit … events' was left unticked. Nothing was stored; connect again and tick it.");
  }
  const refreshToken = typeof body.refresh_token === "string" ? body.refresh_token : "";
  if (!refreshToken) throw new Error("Google returned no refresh token, so nothing durable could be stored. Remove Imotara Publishing from the account's third-party access and connect again.");
  return { account, refreshToken, scopes };
}

/** Stores the grant, encrypted. */
export async function saveCalendarGrant(db: SupabaseClient, g: { account: string; refreshToken: string; scopes: string[] }): Promise<void> {
  const { error } = await db.from("google_grants").upsert(
    { purpose: PURPOSE, account_email: g.account, refresh_token: encryptToken(g.refreshToken, grantAad(g.account)), scopes: g.scopes, updated_at: new Date().toISOString() },
    { onConflict: "purpose" },
  );
  if (error) throw new Error(`Google granted access but it could not be stored (${error.message}). That grant is spent — connect again.`);
}

/** A fresh access token, or null when the calendar was never connected. */
export async function calendarAccessToken(db: SupabaseClient, config: CalendarOAuthConfig, doFetch: typeof fetch = fetch): Promise<string | null> {
  const { data, error } = await db.from("google_grants").select("account_email, refresh_token").eq("purpose", PURPOSE).maybeSingle();
  if (error) throw new Error(`Could not read the calendar permission (${error.message}).`);
  if (!data) return null;
  const refresh = decryptToken(String(data.refresh_token), grantAad(String(data.account_email)));
  const body = await token(config, { refresh_token: refresh, grant_type: "refresh_token" }, doFetch);
  const access = typeof body.access_token === "string" ? body.access_token : "";
  if (!access) throw new Error("Google's refresh answer carried no access token.");
  return access;
}

/**
 * Puts the event in the calendar, or brings the existing one up to date.
 * 🔑 `sendUpdates=all`: the guests get the invitation — and a changed time —
 * by email from Google itself.
 * ⚠️ A 409 on insert means the id exists: an earlier run booked it and lost the
 * sheet write. That is not an error — the event is updated instead.
 */
export async function putEvent(accessToken: string, event: CalendarEvent, exists: boolean, doFetch: typeof fetch = fetch): Promise<void> {
  const headers = { authorization: `Bearer ${accessToken}`, "content-type": "application/json" };
  const send = (url: string, method: string, body: unknown) => doFetch(url, { method, headers, body: JSON.stringify(body) });
  const { id, ...fields } = event;
  // status "confirmed" also revives an event someone deleted by hand in the calendar.
  const patch = () => send(`${EVENTS_URL}/${id}?sendUpdates=all`, "PATCH", { ...fields, status: "confirmed" });

  const insert = () => send(`${EVENTS_URL}?sendUpdates=all`, "POST", event);
  let res = exists ? await patch() : await insert();
  if (!exists && res.status === 409) res = await patch();
  // The sheet said booked but the calendar has no such event (it never landed) ⇒ book it now.
  if (exists && res.status === 404) res = await insert();
  if (!res.ok) {
    const text = await res.text();
    const reason = /"message"\s*:\s*"([^"]+)"/.exec(text)?.[1] ?? String(res.status);
    throw new Error(`The calendar refused the meeting (${res.status}: ${reason}).`);
  }
}
