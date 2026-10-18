// GET /api/admin/cron-health — is every scheduled job still running?
//
// 🔴 THE BLIND SPOT THIS CLOSES. Vercel's runtime logs returned nothing for a
// 45-minute window, including for two crons that fire every minute and
// demonstrably work — so the logs are a retention setting, not a monitor. And
// this repo has already shipped two crons that answered 405 for MONTHS,
// because a dead cron produces exactly as much output as a healthy one with
// nothing to do: none.
//
// ⚠️ THE LIST COMES FROM vercel.json, not from the heartbeat rows. A job that
// has never once fired has no row — and that is the single most important case
// to show, so it must not be the case that quietly disappears.

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { requireSuperAdmin } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { judgeJobs } from "@/lib/cron/heartbeat";

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;

  let declared: { path: string; schedule: string }[] = [];
  try {
    const raw = await readFile(join(process.cwd(), "vercel.json"), "utf8");
    declared = (JSON.parse(raw).crons ?? []) as { path: string; schedule: string }[];
  } catch {
    // ⛔ An empty list would render a reassuring green panel that proves
    // nothing. Say that the question could not be answered instead.
    return NextResponse.json(
      { error: "Could not read vercel.json, so the list of scheduled jobs is unknown." },
      { status: 500 },
    );
  }

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("cron_heartbeats")
    .select("job, last_fired_at, fire_count, last_note");

  if (error) {
    // ⚠️ Most likely the migration has not been run. Say which one.
    return NextResponse.json(
      {
        error:
          `Could not read cron_heartbeats (${error.message}). ` +
          `If this table does not exist yet, run docs/sql/cron_heartbeats.sql.`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ jobs: judgeJobs(declared, data ?? []) });
}
