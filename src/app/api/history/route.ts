// src/app/api/history/route.ts
import { NextResponse } from "next/server";
import type { EmotionRecord } from "@/types/history";

/**
 * In-memory store for dev. Resets on server restart/hot reload.
 * Swap this Map out for a DB (e.g., Postgres/Supabase/Mongo) later.
 */
const store: Map<string, EmotionRecord> = new Map();

/* ----------------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------------*/

/** Coerce a loose object into a strict EmotionRecord or return null if invalid. */
function normalizeIncoming(input: any): EmotionRecord | null {
  if (!input || typeof input !== "object") return null;

  const id = typeof input.id === "string" && input.id.length > 0 ? input.id : null;
  if (!id) return null;

  const now = Date.now();

  const message = typeof input.message === "string" ? input.message : "";
  const emotion = typeof input.emotion === "string" ? input.emotion : "neutral";
  const intensity = typeof input.intensity === "number" ? input.intensity : 0;

  const createdAt =
    typeof input.createdAt === "number" && Number.isFinite(input.createdAt)
      ? input.createdAt
      : now;

  const updatedAt =
    typeof input.updatedAt === "number" && Number.isFinite(input.updatedAt)
      ? input.updatedAt
      : now;

  const rec: EmotionRecord = {
    id,
    message,
    emotion,
    intensity,
    createdAt,
    updatedAt,
    // Keep optional flags if present
    ...(input.source ? { source: input.source } : {}),
    ...(input.deleted === true ? { deleted: true } : {}),
  };

  return rec;
}

/** Last-Write-Wins by updatedAt. If equal, prefer incoming (server convergence). */
function upsertLWW(incoming: EmotionRecord) {
  const existing = store.get(incoming.id);
  if (!existing) {
    store.set(incoming.id, incoming);
    return true;
  }
  const lt = existing.updatedAt ?? 0;
  const rt = incoming.updatedAt ?? 0;
  if (rt > lt) {
    store.set(incoming.id, incoming);
    return true;
  }
  if (rt === lt) {
    // Prefer incoming on ties to converge clients with server
    store.set(incoming.id, incoming);
    return true;
  }
  // incoming older than existing -> ignore
  return false;
}

/* ----------------------------------------------------------------------------
 * GET /api/history?since=<ms>&syncToken=<opaque>
 * Returns an envelope: { records, syncToken?, serverTs }
 * For MVP we ignore syncToken and optionally filter by `since`.
 * --------------------------------------------------------------------------*/
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sinceParam = searchParams.get("since");
  const since = sinceParam ? Number(sinceParam) : undefined;

  let records = Array.from(store.values());

  if (typeof since === "number" && Number.isFinite(since)) {
    records = records.filter((r) => (r.updatedAt ?? 0) >= since);
  }

  const envelope = {
    records,
    syncToken: undefined as string | undefined, // plug real tokens when you add a DB
    serverTs: Date.now(),
  };

  return NextResponse.json(envelope, { status: 200 });
}

/* ----------------------------------------------------------------------------
 * POST /api/history
 * Body (back-compat):
 *   - NEW preferred: { records: EmotionRecord[] }
 *   - OLD (compat):  EmotionRecord[]
 * Upserts with LWW; returns { attempted, acceptedIds, rejected?, serverTs }
 * --------------------------------------------------------------------------*/
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Accept both {records:[...]} and raw array for backward compatibility
    const list: any[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.records)
      ? body.records
      : [];

    const attempted = list.length;
    const acceptedIds: string[] = [];
    const rejected: { id?: string; reason: string }[] = [];

    for (const raw of list) {
      const rec = normalizeIncoming(raw);
      if (!rec) {
        rejected.push({ reason: "invalid-record" });
        continue;
      }
      const ok = upsertLWW(rec);
      if (ok) acceptedIds.push(rec.id);
      else rejected.push({ id: rec.id, reason: "older-than-existing" });
    }

    return NextResponse.json(
      {
        attempted,
        acceptedIds,
        rejected: rejected.length ? rejected : undefined,
        serverTs: Date.now(),
      },
      { status: 200 }
    );
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("POST /api/history error:", err);
    return NextResponse.json(
      { error: String(err?.message ?? err) },
      { status: 400 }
    );
  }
}

/* ----------------------------------------------------------------------------
 * DELETE /api/history
 * Body: { ids: string[], updatedAt?: number }
 * Applies tombstone (deleted:true) per id with LWW.
 * --------------------------------------------------------------------------*/
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
    const ts =
      typeof body?.updatedAt === "number" && Number.isFinite(body.updatedAt)
        ? body.updatedAt
        : Date.now();

    const deletedIds: string[] = [];

    for (const id of ids) {
      const existing = store.get(id);
      const tombstone: EmotionRecord = existing
        ? { ...existing, deleted: true, updatedAt: Math.max(existing.updatedAt ?? 0, ts) }
        : {
            id,
            message: "",
            emotion: "neutral",
            intensity: 0,
            createdAt: ts,
            updatedAt: ts,
            deleted: true,
          };

      const ok = upsertLWW(tombstone);
      if (ok) deletedIds.push(id);
    }

    return NextResponse.json({ deletedIds }, { status: 200 });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("DELETE /api/history error:", err);
    return NextResponse.json(
      { error: String(err?.message ?? err) },
      { status: 400 }
    );
  }
}
