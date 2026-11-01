// GET /api/admin/meetings/calendar/callback — where Google comes back  🔐 owner
//
// 🔴 The only place the calendar's refresh token exists in plaintext, for the
// lines between the exchange and the encrypt. Never logged, never returned.
// ⛔ A consent from any account but imotara.imotara@gmail.com is refused.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialOwner } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { decryptToken } from "@/lib/social/tokenCrypto";
import { calendarOAuthConfig, exchangeCalendarCode, saveCalendarGrant } from "@/lib/meetings/calendar";
import { CALENDAR_STATE_AAD, CALENDAR_STATE_MAX_AGE_MS } from "@/app/api/admin/meetings/calendar/connect/route";

/** ⚠️ The channels screen shows ?connected= / ?error= as a banner — the same place the YouTube result lands. */
function back(origin: string, note: string, ok: boolean) {
  const url = new URL("/admin/social/channels", origin);
  url.searchParams.set(ok ? "connected" : "error", note);
  return NextResponse.redirect(url, { status: 307, headers: { "cache-control": "no-store" } });
}

export async function GET(req: NextRequest) {
  const guard = await requireSocialOwner(req, "finish connecting the Imotara calendar");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const origin = url.origin;
  const denied = url.searchParams.get("error");
  if (denied) return back(origin, `Google did not grant calendar access (${denied}). Nothing was changed.`, false);

  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!state || !code) return back(origin, "That callback was missing its code or state.", false);

  // 🔑 State before the code is spent.
  let issuedAt = 0;
  try {
    issuedAt = (JSON.parse(decryptToken(state, CALENDAR_STATE_AAD)) as { t?: number }).t ?? 0;
  } catch {
    return back(origin, "That callback's state did not come from here. Nothing was changed.", false);
  }
  if (!issuedAt || Date.now() - issuedAt > CALENDAR_STATE_MAX_AGE_MS) return back(origin, "That consent link had gone stale. Connect the calendar again.", false);

  const config = calendarOAuthConfig(process.env, origin);
  if (!config.ok) return back(origin, config.message, false);

  try {
    const grant = await exchangeCalendarCode(config.config, code);
    await saveCalendarGrant(getSupabaseAdmin(), grant);
  } catch (e) {
    return back(origin, (e as Error).message, false);
  }
  return back(origin, "The Imotara calendar is connected. Agreed meetings from the sheet are booked within 10 minutes.", true);
}
