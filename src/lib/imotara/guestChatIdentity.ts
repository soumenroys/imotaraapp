// src/lib/imotara/guestChatIdentity.ts
// A signed-out web visitor's identity — for CHAT REQUESTS ONLY.
//
// 🔑 Owner, 25 Oct 2026 (option A): a web guest's cloud replies must be recorded
// and counted like the phone's — 20 a day — so guest retention can be measured
// and guest cost is capped. Web guests had no identity at all.
//
// ⛔ DELIBERATELY NOT THE SITE'S SIGN-IN. This is a separate Supabase client with
// its OWN storage key, so the cookie session every page reads never sees it: no
// page can mistake a guest for a signed-in person, and nothing that runs "when
// signed in" (history sync, plan, Connect) runs for them. It is sent in its own
// header (x-imotara-guest-token), never Authorization, and the server accepts it
// only when nobody is signed in and only when it really is anonymous. This is
// the phone's anonymousAccessToken, on the web.
//
// It is created on the guest's FIRST message — never on a page view, so a
// crawler that only reads pages creates nothing.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const STORAGE_KEY = "imotara.guest-chat.auth.v1";
/** The reply never waits longer than this for an identity; without one it goes out uncounted, as before. */
const WAIT_MS = 3000;

let client: SupabaseClient | null = null;
let inFlight: Promise<string | null> | null = null;

function guestClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key, {
    auth: { storageKey: STORAGE_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}

/** Is someone signed in on this site? The sign-in cookie is readable by design ⇒ supabase/cookieOptions.ts. */
export function signedInCookiePresent(cookie: string): boolean {
  return /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(cookie);
}

async function obtain(): Promise<string | null> {
  const c = guestClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  const s = data.session;
  if (s?.access_token && s.user?.is_anonymous && (s.expires_at ?? 0) * 1000 > Date.now() + 60_000) return s.access_token;
  if (s?.refresh_token && s.user?.is_anonymous) {
    const r = await c.auth.refreshSession();
    if (r.data.session?.access_token) return r.data.session.access_token;
  }
  const r = await c.auth.signInAnonymously();
  return r.data.session?.access_token ?? null;
}

/**
 * The guest's chat token, or null when someone is signed in (their cookie already
 * identifies them) or when none can be had quickly. ⛔ Never throws, never delays
 * a reply by more than WAIT_MS.
 */
export async function guestChatToken(): Promise<string | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  if (signedInCookiePresent(document.cookie)) return null;
  inFlight ??= obtain().catch(() => null).finally(() => { inFlight = null; });
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), WAIT_MS));
  return Promise.race([inFlight, timeout]);
}
