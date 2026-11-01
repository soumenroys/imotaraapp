// GET /api/admin/social/comments — comments under our posts and what was done  🔐 social admin
//
// Drafts waiting for approval first, then the last 100 handled ⇒ lib/social/comments/run.ts.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialAdmin } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;
  const db = getSupabaseAdmin();
  const cols = "id, platform, post_snippet, author, text, commented_at, kind, status, draft, language, note, decided_by, created_at, updated_at";
  const [waiting, handled] = await Promise.all([
    db.from("social_comments").select(cols).eq("status", "draft").order("created_at", { ascending: true }),
    db.from("social_comments").select(cols).neq("status", "draft").order("updated_at", { ascending: false }).limit(100),
  ]);
  const error = waiting.error ?? handled.error;
  if (error) return NextResponse.json({ error: `Could not read the comments (${error.message}).` }, { status: 500 });
  return NextResponse.json({ waiting: waiting.data, handled: handled.data, actorRole: guard.actor.role });
}
