// POST /api/admin/broadcast/auto/sample — write next month's newsletter as a
// sample and return it. Saves nothing, sends nothing.
import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { monthKey, readAuto, sendAtFor, themeFor, writeNewsletter } from "@/lib/broadcast/autoBroadcast";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;
  const s = await readAuto(getSupabaseAdmin());
  const now = new Date();
  let month = monthKey(now);
  if (sendAtFor(month, s.settings).getTime() < now.getTime()) {
    const [y, m] = month.split("-").map(Number);
    month = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  try {
    const theme = themeFor(month);
    return NextResponse.json({ month, theme: theme.brief, ...(await writeNewsletter(theme)) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
