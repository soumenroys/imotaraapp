// POST /api/admin/broadcast/auto/sample — write next month's newsletter as a
// sample and return it. Saves nothing, sends nothing.
import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { nextMonth, readAuto, themeFor, writeNewsletter } from "@/lib/broadcast/autoBroadcast";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;
  const s = await readAuto(getSupabaseAdmin());
  const now = new Date();
  // 🔑 One rule, shared with the sample: once this month's send time has passed, the next one is next month.
  const month = nextMonth(now, s);
  try {
    const theme = themeFor(month);
    return NextResponse.json({ month, theme: theme.brief, ...(await writeNewsletter(theme)) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
