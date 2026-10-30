// GET /api/cron/indexnow — once per production deployment, tell IndexNow
// (Bing, and through it ChatGPT search, Copilot, DuckDuckGo) every public page.
// ⇒ lib/seo/indexNow for why per deployment and not on a timer.

import { NextRequest, NextResponse } from "next/server";
import { cronAuthorised } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { markCronFired } from "@/lib/cron/heartbeat";
import sitemap from "@/app/sitemap";
import { buildPayload, shouldSubmit, submit } from "@/lib/seo/indexNow";

export const runtime = "nodejs";
export const maxDuration = 60;

const KEY = "indexnow_last_deployment";

export async function GET(req: NextRequest) {
  const auth = cronAuthorised(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });
  void markCronFired("/api/cron/indexnow");

  // ⚠️ Production only: a preview deployment must never announce its URLs as the site's.
  if (process.env.VERCEL_ENV !== "production") return NextResponse.json({ ok: true, skipped: "not production" });
  const deployment = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA;

  const db = getSupabaseAdmin();
  const { data } = await db.from("app_settings").select("value").eq("key", KEY).maybeSingle();
  const last = (data?.value as { deployment?: string } | null)?.deployment;
  if (!shouldSubmit(last, deployment)) return NextResponse.json({ ok: true, skipped: "already reported this deployment" });

  const payload = buildPayload(sitemap().map((e) => e.url));
  if (!payload) return NextResponse.json({ ok: false, error: "no https URLs in the sitemap" }, { status: 500 });

  const r = await submit(payload);
  if (!r.ok) {
    // Not remembered ⇒ the next hourly run tries again.
    console.warn("[indexnow] refused", r.status, r.body);
    return NextResponse.json({ ok: false, status: r.status, body: r.body }, { status: 502 });
  }
  await db.from("app_settings").upsert(
    { key: KEY, value: { deployment, at: new Date().toISOString(), urls: payload.urlList.length }, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  console.log("[indexnow] submitted", payload.urlList.length, "URLs for", deployment);
  return NextResponse.json({ ok: true, submitted: payload.urlList.length, host: payload.host });
}
