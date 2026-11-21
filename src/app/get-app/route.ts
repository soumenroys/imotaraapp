// GET /get-app?from=facebook — one link that opens the right store. ⇒ lib/analytics/getAppLink.ts
//
// 🔑 #162 (owner 21 Nov 2026): the Facebook Page action button points here, so an
// iPhone user never lands in Google Play (about a third of our users are on iPhone).
// Counted anonymously in the funnel (get_app_android / _ios / _web), like the web → app handoff.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { refuseAsRobot } from "@/lib/analytics/automatedVisitor";
import { getAppTarget } from "@/lib/analytics/getAppLink";
import { FUNNEL_STEPS } from "@/lib/analytics/visitTally";

export const runtime = "nodejs";

const STEP = { android: FUNNEL_STEPS.get_app_android, ios: FUNNEL_STEPS.get_app_ios, other: FUNNEL_STEPS.get_app_web } as const;

export async function GET(req: NextRequest) {
  const ua = req.headers.get("user-agent");
  const { device, url } = getAppTarget(ua, req.nextUrl.searchParams.get("from"));

  // ⛔ Link-preview robots (Facebook's own crawler fetches every button link) are not people.
  if (!refuseAsRobot("web", ua)) {
    try {
      await getSupabaseAdmin().rpc("imotara_record_visit_tally", {
        p_platform: "web",
        p_kind: "funnel",
        p_bucket: STEP[device],
        p_delta: 1,
      });
    } catch {
      // ⛔ A lost count must never cost the redirect.
    }
  }

  const res = NextResponse.redirect(url, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
