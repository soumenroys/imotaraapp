// GET  /api/admin/todo — everything waiting for this admin, most urgent first.
// POST /api/admin/todo {id, title, done} — mark a manual item done (or undo it).
//
// 🔑 Owner, 24 Oct 2026: one page that shows an admin's immediate action points;
// an item is marked done once the action is taken ⇒ lib/admin/todo.ts.
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { requireSuperAdmin } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { collect } from "@/lib/admin/todo";
import { markDone, readDone, undoDone } from "@/lib/admin/todoDone";
import {
  broadcastSource, commentsSource, connectMoneySource, connectSource, cronSource, organisationsSource,
  outreachSource, requestsSource, setupBroadcastSource, setupSource, socialSource, voiceSource,
} from "@/lib/admin/todoSources";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;
  const supabase = getSupabaseAdmin();
  let declared: { path: string; schedule: string }[] = [];
  try {
    declared = (JSON.parse(await readFile(join(process.cwd(), "vercel.json"), "utf8")).crons ?? []) as typeof declared;
  } catch { /* the System source then reports nothing late rather than everything */ }
  const done = await readDone(supabase);
  const result = await collect(
    [
      voiceSource(), outreachSource(supabase), broadcastSource(supabase), requestsSource(supabase), commentsSource(supabase),
      connectSource(supabase), connectMoneySource(supabase), organisationsSource(supabase), socialSource(supabase),
      cronSource(supabase, declared),
      setupSource(supabase), setupBroadcastSource(supabase),
    ],
    auth.admin.role,
    done,
  );
  // Done in the last 24 hours, newest first — so "it vanished" always has a who and a when.
  const recent = Object.entries(done)
    .filter(([, r]) => Date.now() - Date.parse(r.at) < 86_400_000)
    .sort((a, b) => b[1].at.localeCompare(a[1].at))
    .map(([id, r]) => ({ id, ...r }));
  return NextResponse.json({ ...result, recentlyDone: recent, role: auth.admin.role, asOf: new Date().toISOString() });
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;
  // ⛔ Only items a reviewer cannot see are manual, so a reviewer has nothing to mark —
  // and must not be able to hide one (e.g. a safety callback) by guessing its id (review, 24 Oct).
  if (auth.admin.role === "connect_reviewer") return NextResponse.json({ error: "Not available for your role." }, { status: 403 });
  const b = (await req.json().catch(() => null)) as { id?: string; title?: string; done?: boolean } | null;
  if (!b?.id || typeof b.id !== "string" || b.id.length > 500) return NextResponse.json({ error: "Which item?" }, { status: 400 });
  try {
    const supabase = getSupabaseAdmin();
    if (b.done === false) await undoDone(supabase, b.id);
    else await markDone(supabase, b.id, auth.admin.email, String(b.title ?? ""));
    console.log("[admin/todo]", { by: auth.admin.email, id: b.id, done: b.done !== false });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
