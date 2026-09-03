// src/app/api/admin/broadcast/lists/route.ts
// GET  /api/admin/broadcast/lists  — every list with its recipient count
// POST /api/admin/broadcast/lists  — create a list
//
// Owner role only (BC-11). See requireOwner in _auth.ts for why the legacy
// ADMIN_SECRET bearer path is not accepted here.

import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const MAX_NAME = 120;

// Postgres unique-violation. The schema has a unique index on lower(name), so
// "Staff" and "staff" collide — surface that as a clear 409 rather than a 500.
const UNIQUE_VIOLATION = "23505";

export async function GET(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const supabase = getSupabaseAdmin();

  // The embedded count avoids N+1: one round trip returns every list with how
  // many recipients it holds, rather than a query per list.
  const { data, error } = await supabase
    .from("broadcast_lists")
    .select("id, name, created_at, updated_at, broadcast_recipients(count)")
    .order("name", { ascending: true });

  if (error) {
    console.error("[broadcast/lists] GET:", error.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  // PostgREST returns the aggregate as [{ count: n }].
  //
  // recipientCount is deliberately `number | null`, not defaulted to 0. If the
  // embedded aggregate ever comes back in a shape this does not recognise,
  // reporting 0 would tell the admin a populated list is empty — and the
  // review screen's whole job is making the recipient arithmetic trustworthy.
  // null lets the UI show "—" instead, which is honest: unknown is not zero.
  const lists = (data ?? []).map((l) => {
    const rel = (l as { broadcast_recipients?: unknown }).broadcast_recipients;
    let recipientCount: number | null = null;
    if (Array.isArray(rel)) {
      const c = (rel[0] as { count?: unknown } | undefined)?.count;
      // An empty list legitimately returns [] or [{count: 0}] — both are 0.
      recipientCount = rel.length === 0 ? 0 : (typeof c === "number" ? c : null);
    }
    return {
      id: l.id,
      name: l.name,
      created_at: l.created_at,
      updated_at: l.updated_at,
      recipientCount,
    };
  });

  return NextResponse.json({ lists }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

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
    .insert({ name, created_by: auth.admin.id })
    .select("id, name, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return NextResponse.json(
        { error: `A list called "${name}" already exists` },
        { status: 409 },
      );
    }
    console.error("[broadcast/lists] POST:", error.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ list: { ...data, recipientCount: 0 } }, { status: 201 });
}
