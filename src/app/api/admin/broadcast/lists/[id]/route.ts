// src/app/api/admin/broadcast/lists/[id]/route.ts
// PATCH  — rename a list
// DELETE — delete a list and its recipients
//
// Owner role only (BC-11).

import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

type Params = { params: Promise<{ id: string }> };

const MAX_NAME = 120;
const UNIQUE_VIOLATION = "23505";

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: { name?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "A list name is required" }, { status: 400 });
  }
  if (name.length > MAX_NAME) {
    return NextResponse.json(
      { error: `List name must be ${MAX_NAME} characters or fewer` },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("broadcast_lists")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, name, created_at, updated_at")
    .maybeSingle();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return NextResponse.json(
        { error: `A list called "${name}" already exists` },
        { status: 409 },
      );
    }
    console.error("[broadcast/lists/:id] PATCH:", error.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "List not found" }, { status: 404 });

  return NextResponse.json({ list: data }, { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  // Refuse while a broadcast is mid-flight against this list.
  //
  // The queue would technically survive — broadcast_sends rows reference
  // broadcast_id, not list_id — but the run's own review numbers would stop
  // reconciling and nobody could later explain who was on the list. Blocking
  // is cheap; an unexplainable audit trail is not.
  const { data: active } = await supabase
    .from("broadcasts")
    .select("id, subject")
    .eq("list_id", id)
    .in("status", ["sending", "paused"])
    .limit(1)
    .maybeSingle();

  if (active) {
    return NextResponse.json(
      {
        error: "This list is in use by a broadcast that has not finished",
        broadcastId: active.id,
        subject: active.subject,
      },
      { status: 409 },
    );
  }

  // Recipients cascade (FK on delete cascade). Broadcasts do NOT: their
  // list_id is on delete set null, so sent broadcasts keep their history and
  // simply lose the link to a list that no longer exists.
  const { error } = await supabase.from("broadcast_lists").delete().eq("id", id);

  if (error) {
    console.error("[broadcast/lists/:id] DELETE:", error.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
