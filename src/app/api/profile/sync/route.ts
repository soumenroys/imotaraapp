// src/app/api/profile/sync/route.ts
//
// Cross-device profile sync for logged-in users.
// Persists toneContext (companion + user profile) to user_memory table.
//
// POST /api/profile/sync — upsert toneContext fields
// GET  /api/profile/sync — read back toneContext from stored rows

import { NextResponse } from "next/server";
import { getSupabaseAdmin, getSupabaseUserServerClient } from "@/lib/supabaseServer";

// ─── Auth helper: Bearer token (mobile) then cookie (web) ───────────────────
async function getAuthedUserId(req: Request): Promise<string | null> {
  const admin = getSupabaseAdmin();

  // 1) Bearer token — mobile sends Authorization: Bearer <jwt>
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (bearerToken) {
    const { data } = await admin.auth.getUser(bearerToken);
    if (data?.user?.id) return data.user.id;
  }

  // 2) Cookie session — web signed-in users
  try {
    const supabaseUser = await getSupabaseUserServerClient();
    const { data } = await supabaseUser.auth.getUser();
    if (data?.user?.id) return data.user.id;
  } catch { /* no cookie session */ }

  return null;
}

// ─── Field map: toneContext path → user_memory key ──────────────────────────
type ProfileRow = { key: string; value: string };

function toneContextToRows(tc: Record<string, any>): ProfileRow[] {
  const rows: ProfileRow[] = [];
  const push = (key: string, val: unknown) => {
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      rows.push({ key, value: String(val).trim() });
    }
  };
  push("preferred_name",          tc?.user?.name);
  push("preferred_lang",          tc?.user?.preferredLang);
  push("user_age_tone",           tc?.user?.ageTone);
  push("user_gender",             tc?.user?.gender);
  push("response_style",          tc?.user?.responseStyle);
  push("companion_enabled",       tc?.companion?.enabled !== undefined ? String(tc.companion.enabled) : undefined);
  push("companion_name",          tc?.companion?.name);
  push("companion_relationship",  tc?.companion?.relationship);
  push("companion_age_tone",      tc?.companion?.ageTone);
  push("companion_gender",        tc?.companion?.gender);
  return rows;
}

function rowsToToneContext(rows: ProfileRow[]): Record<string, any> {
  const get = (key: string) => rows.find((r) => r.key === key)?.value ?? "";
  return {
    user: {
      name:          get("preferred_name")  || undefined,
      preferredLang: get("preferred_lang")  || undefined,
      ageTone:       get("user_age_tone")   || undefined,
      gender:        get("user_gender")     || undefined,
      responseStyle: get("response_style")  || undefined,
    },
    companion: {
      enabled:      get("companion_enabled") === "true" ? true : get("companion_enabled") === "false" ? false : undefined,
      name:         get("companion_name")         || undefined,
      relationship: get("companion_relationship") || undefined,
      ageTone:      get("companion_age_tone")     || undefined,
      gender:       get("companion_gender")       || undefined,
    },
  };
}

// ─── POST — upsert profile fields ────────────────────────────────────────────
export async function POST(req: Request) {
  const userId = await getAuthedUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rows = toneContextToRows(body);
  if (rows.length === 0) return NextResponse.json({ ok: true, synced: [] });

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  const upsertRows = rows.map(({ key, value }) => ({
    user_id: userId,
    type: "identity" as const,
    key,
    value,
    confidence: 0.9,
    updated_at: now,
  }));

  const { error } = await admin
    .from("user_memory")
    .upsert(upsertRows, { onConflict: "user_id,type,key" });

  if (error) {
    console.error("[profile/sync] upsert error:", error.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, synced: rows.map((r) => r.key) });
}

// ─── GET — read profile back ──────────────────────────────────────────────────
export async function GET(req: Request) {
  const userId = await getAuthedUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const PROFILE_KEYS = [
    "preferred_name", "preferred_lang", "user_age_tone", "user_gender",
    "response_style", "companion_enabled", "companion_name",
    "companion_relationship", "companion_age_tone", "companion_gender",
  ];

  const { data, error } = await admin
    .from("user_memory")
    .select("key, value")
    .eq("user_id", userId)
    .eq("type", "identity")
    .in("key", PROFILE_KEYS);

  if (error) {
    console.error("[profile/sync] fetch error:", error.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const toneContext = rowsToToneContext((data ?? []) as ProfileRow[]);
  return NextResponse.json({ toneContext });
}
