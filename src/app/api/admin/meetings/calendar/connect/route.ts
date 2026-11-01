// GET /api/admin/meetings/calendar/connect — the one consent the calendar needs  🔐 owner
//
// Sends the owner to Google to let Imotara put agreed meetings in the
// imotara.imotara@gmail.com calendar ⇒ lib/meetings/calendar.ts.
// ⛔ Stores nothing. Everything durable happens in ../callback.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireSocialOwner } from "@/app/api/admin/social/_guard";
import { encryptToken, tokenStorageReady } from "@/lib/social/tokenCrypto";
import { calendarConsentUrl, calendarOAuthConfig } from "@/lib/meetings/calendar";

/** ⚠️ Its own binding, so a YouTube state string cannot finish a calendar consent, or the reverse. */
export const CALENDAR_STATE_AAD = "imotara:calendar:oauth-state";
export const CALENDAR_STATE_MAX_AGE_MS = 10 * 60 * 1000;

export async function GET(req: NextRequest) {
  const guard = await requireSocialOwner(req, "connect the Imotara calendar");
  if (!guard.ok) return guard.response;

  // ⛔ Refused before Google: a granted consent with nowhere to store it is a wasted grant.
  const storage = tokenStorageReady();
  if (!storage.ok) return NextResponse.json({ error: `The token key is not usable (${storage.reason}). Fix SOCIAL_TOKEN_KEY first.` }, { status: 500 });

  const config = calendarOAuthConfig(process.env, new URL(req.url).origin);
  if (!config.ok) return NextResponse.json({ error: config.message }, { status: 500 });

  const state = encryptToken(JSON.stringify({ t: Date.now(), n: randomUUID() }), CALENDAR_STATE_AAD);
  return NextResponse.redirect(calendarConsentUrl(config.config, state), { status: 307, headers: { "cache-control": "no-store" } });
}
