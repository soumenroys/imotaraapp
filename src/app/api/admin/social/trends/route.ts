// GET    /api/admin/social/trends — this week's moments, and what was refused and why.
// POST   /api/admin/social/trends — refresh now.
// DELETE /api/admin/social/trends {id} — never use this one.
import { NextRequest, NextResponse } from "next/server";
import { requireSocialAdmin } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { readTrends, refreshTrends, removeTrend } from "@/lib/social/trends";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return auth.response;
  return NextResponse.json(await readTrends(getSupabaseAdmin()));
}

export async function POST(req: NextRequest) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json(await refreshTrends(getSupabaseAdmin()));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return auth.response;
  const b = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!b?.id) return NextResponse.json({ error: "Which one?" }, { status: 400 });
  await removeTrend(getSupabaseAdmin(), b.id);
  return NextResponse.json({ ok: true });
}
