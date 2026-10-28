// GET /api/admin/daily?date=YYYY-MM-DD — the daily email and call lists ⇒ lib/outreach/daily.
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { readDirectory, sheetsConfigured } from "@/lib/voice/sheets";
import { readOutreach } from "@/lib/outreach/store";
import { suppressedEmails } from "@/lib/outreach/send";
import { adminToday, dailyList } from "@/lib/outreach/daily";
import { outreachAdmin, failed } from "../outreach/_shared";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const a = await outreachAdmin(req);
  if (!a.ok) return a.response;
  if (!sheetsConfigured()) return NextResponse.json({ error: "The contact sheet is not connected." }, { status: 409 });
  const now = new Date();
  const asked = req.nextUrl.searchParams.get("date") ?? "";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : adminToday(now);
  try {
    const supabase = getSupabaseAdmin();
    const [d, suppressed, state] = await Promise.all([readDirectory(), suppressedEmails(supabase), readOutreach(supabase)]);
    return NextResponse.json(dailyList(d, suppressed, state, day, now));
  } catch (e) {
    return failed(e);
  }
}
