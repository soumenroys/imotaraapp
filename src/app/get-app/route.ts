// GET /get-app?from=facebook — one link that opens the right store. ⇒ lib/analytics/getAppLink.ts
//
// 🔑 #162 (owner 21 Nov 2026): the Facebook Page action button points here, so an
// iPhone user never lands in Google Play (about a third of our users are on iPhone).
// Counted anonymously in the funnel (get_app_android / _ios / _web), like the web → app handoff.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { refuseAsRobot } from "@/lib/analytics/automatedVisitor";
import { getAppTarget, sourceOf } from "@/lib/analytics/getAppLink";
import { FUNNEL_STEPS } from "@/lib/analytics/visitTally";

export const runtime = "nodejs";

const STEP = { android: FUNNEL_STEPS.get_app_android, ios: FUNNEL_STEPS.get_app_ios, other: FUNNEL_STEPS.get_app_web } as const;
// #162 (22 Nov 2026): which link it was. ⛔ The App Store keeps no source for an iPhone visitor, so this count is the only place it survives.
const SOURCE_STEP = {
  fb_button: FUNNEL_STEPS.get_app_from_fb_button,
  fb_pinned: FUNNEL_STEPS.get_app_from_fb_pinned,
  fb_story: FUNNEL_STEPS.get_app_from_fb_story,
  ig_story: FUNNEL_STEPS.get_app_from_ig_story,
  other: FUNNEL_STEPS.get_app_from_other,
} as const;

export async function GET(req: NextRequest) {
  const ua = req.headers.get("user-agent");
  const { device, url } = getAppTarget(ua, req.nextUrl.searchParams.get("from"));

  // ⛔ Link-preview robots (Facebook's own crawler fetches every button link) are not people.
  if (!refuseAsRobot("web", ua)) {
    try {
      const db = getSupabaseAdmin();
      const source = SOURCE_STEP[sourceOf(req.nextUrl.searchParams.get("from"))];
      await Promise.all([STEP[device], source].map((bucket) =>
        db.rpc("imotara_record_visit_tally", {
          p_platform: "web",
          p_kind: "funnel",
          p_bucket: bucket,
          p_delta: 1,
        }),
      ));
    } catch {
      // ⛔ A lost count must never cost the redirect.
    }
  }

  const res = NextResponse.redirect(url, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
