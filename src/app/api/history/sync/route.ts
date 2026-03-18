// src/app/api/history/sync/route.ts
import { NextResponse } from "next/server";
import type { SyncEnvelope, SyncResponse } from "@/types/history";
import { getRecordsSince, upsertRecords } from "../store";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseUserServer } from "@/lib/supabase/userServer";

function sanitizeScope(raw: string | null): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  return s.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

async function getScopeFromRequest(req: Request): Promise<string> {
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (bearerToken) {
    const { data } = await supabaseServer.auth.getUser(bearerToken);
    if (data?.user?.id) return sanitizeScope(data.user.id);
  }

  try {
    const supabase = await supabaseUserServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return sanitizeScope(user.id);
  } catch {
    // no cookie session
  }

  return sanitizeScope(req.headers.get("x-imotara-user"));
}

/**
 * Sync endpoint used by the web EmotionHistory sync engine.
 * Production-safe: backed by Supabase via ../store.
 */
export async function POST(request: Request) {
  try {
    const scope = await getScopeFromRequest(request);

    // 🔒 safety: never allow unscoped sync (prevents cross-user data pollution)
    if (!scope) {
      return NextResponse.json({ serverChanges: [] } satisfies SyncResponse, { status: 401 });
    }

    const body = (await request.json()) as SyncEnvelope;

    const clientSince = Number(body?.clientSince ?? 0);
    const clientChanges = Array.isArray(body?.clientChanges) ? body.clientChanges : [];

    // 1) Apply client changes — scope all incoming IDs to this user
    if (clientChanges.length > 0) {
      const scoped = clientChanges.map((rec: any) => ({
        ...rec,
        id: rec?.id ? `${scope}:${String(rec.id).replace(/^[^:]+:/, "")}` : rec?.id,
      }));
      await upsertRecords(scoped);
    }

    // 2) Return server changes since clientSince — filtered to this user's scope only
    const allSince = await getRecordsSince(clientSince);
    const prefix = `${scope}:`;
    const serverChanges = allSince
      .filter((r: any) => typeof r.id === "string" && r.id.startsWith(prefix))
      .map((r: any) => ({ ...r, id: r.id.slice(prefix.length) }));

    const payload: SyncResponse = { serverChanges };
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    const PROD = process.env.NODE_ENV === "production";
    if (!PROD && process.env.NODE_ENV !== "test") {
      console.error("POST /api/history/sync error:", err);
    }
    return NextResponse.json({ serverChanges: [] } satisfies SyncResponse, { status: 400 });
  }
}
