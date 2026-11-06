// GET /api/cron/indexnow — after a production deployment, tell IndexNow
// (Bing, and through it ChatGPT search, Copilot, DuckDuckGo) about NEW public
// pages at once, and the full list at most once a week.
// ⇒ lib/seo/indexNow (planSubmission) for why.

import { NextRequest, NextResponse } from "next/server";
import { cronAuthorised } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { markCronFired } from "@/lib/cron/heartbeat";
import sitemap from "@/app/sitemap";
import { buildPayload, planSubmission, shouldSubmit, submit, type IndexNowMemory } from "@/lib/seo/indexNow";

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
  const memory = (data?.value ?? null) as IndexNowMemory | null;
  if (!shouldSubmit(memory?.deployment, deployment)) return NextResponse.json({ ok: true, skipped: "already reported this deployment" });

  const all = buildPayload(sitemap().map((e) => e.url));
  if (!all) return NextResponse.json({ ok: false, error: "no https URLs in the sitemap" }, { status: 500 });

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const plan = planSubmission(memory, all.urlList, now);
  const remember = (fullAt: string | undefined) => db.from("app_settings").upsert(
    { key: KEY, value: { deployment, at: nowIso, fullAt, sent: all.urlList, lastKind: plan.kind, lastCount: plan.urls.length }, updated_at: nowIso },
    { onConflict: "key" },
  );

  if (plan.kind === "none") {
    await remember(memory?.fullAt ?? memory?.at);
    return NextResponse.json({ ok: true, skipped: "no new pages; full list was sent within the week" });
  }

  const payload = buildPayload(plan.urls)!;
  const r = await submit(payload);
  if (!r.ok) {
    // Not remembered ⇒ the next hourly run tries again.
    console.warn("[indexnow] refused", r.status, r.body);
    return NextResponse.json({ ok: false, status: r.status, body: r.body }, { status: 502 });
  }
  await remember(plan.kind === "full" ? nowIso : memory?.fullAt ?? memory?.at);
  console.log("[indexnow] submitted", plan.kind, payload.urlList.length, "URLs for", deployment);
  return NextResponse.json({ ok: true, kind: plan.kind, submitted: payload.urlList.length, host: payload.host });
}
