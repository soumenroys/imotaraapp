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

  const message = typeof input.message === "string" ? input.message : "";
  const emotion = typeof input.emotion === "string" ? input.emotion : "neutral";
  const intensity = typeof input.intensity === "number" ? input.intensity : 0;

  // 🔹 IMPORTANT:
  // Trust client timestamps instead of replacing with Date.now().
  // If they are missing/invalid, we fall back to 0 so LWW still works,
  // but we don't generate fresh "now" timestamps that confuse sync.
  const createdAt =
    typeof input.createdAt === "number" && Number.isFinite(input.createdAt)
      ? input.createdAt
      : 0;

  const updatedAt =
    typeof input.updatedAt === "number" && Number.isFinite(input.updatedAt)
      ? input.updatedAt
      : createdAt;

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

/** Return records with optional filtering and shape. */
function listRecords(opts: { since?: number; includeDeleted?: boolean }) {
  const { since, includeDeleted } = opts;
  let records = Array.from(store.values());

  if (typeof since === "number" && Number.isFinite(since)) {
    records = records.filter((r) => (r.updatedAt ?? 0) >= since);
  }

  if (!includeDeleted) {
    records = records.filter((r) => r.deleted !== true);
  }

  // Sort newest-first for consistency
  records.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return records;
}

/** Dev-only: "touch" recent items to simulate server-newer conflicts. */
function touchRecent(n: number) {
  if (n <= 0) return [];
  const now = Date.now();
  const all = Array.from(store.values()).sort(
    (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
  );
  const picked = all.slice(0, n);
  for (const rec of picked) {
    const bumped = { ...rec, updatedAt: now };
    store.set(bumped.id, bumped);
  }
  return picked.map((r) => r.id);
}

/* ----------------------------------------------------------------------------
 * GET /api/history
 *
 * Query params:
 *   since=<ms>            -> only records with updatedAt >= since
 *   includeDeleted=1      -> include tombstoned records as well
 *   mode=array            -> return raw array (back-compat / easier debugging)
 *   dev_touchN=<int>      -> DEV ONLY: bump updatedAt on top-N records to simulate
 *                            "server newer" conflicts (use after client has local copies)
 *   dev_wipe=1            -> DEV ONLY: clear the in-memory store
 *
 * Default response (envelope):
 *   { records, syncToken?: string, serverTs: number, serverCount?: number }
 * --------------------------------------------------------------------------*/
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Dev toggles
  const devWipe = searchParams.get("dev_wipe") === "1";
  if (devWipe) {
    store.clear();
    return NextResponse.json(
      { ok: true, wiped: true, serverTs: Date.now() },
      { status: 200 }
    );
  }

  const touchN = Number(searchParams.get("dev_touchN") ?? "0");
  if (Number.isFinite(touchN) && touchN > 0) {
    const ids = touchRecent(touchN);
    // fall through to normal GET so you can see the updated records immediately
  }

  // Normal filters
  const sinceParam = searchParams.get("since");
  const since = sinceParam ? Number(sinceParam) : undefined;
  const includeDeleted = searchParams.get("includeDeleted") === "1";
  const mode = searchParams.get("mode"); // "array" | undefined

  const records = listRecords({ since, includeDeleted });

  // Total *non-deleted* records on server for debug/UI.
  const serverCount = Array.from(store.values()).filter(
    (r) => r.deleted !== true
  ).length;

  // Back-compat / simple inspection
  if (mode === "array") {
    return NextResponse.json(records, { status: 200 });
  }

  const serverTs = Date.now();

  const envelope = {
    records,
    // 🔹 Simple incremental strategy:
    // client sends `since=<previous syncToken>`, we filter by updatedAt >= since,
    // and we return a fresh syncToken based on the current server timestamp.
    syncToken: String(serverTs),
    serverTs,
    serverCount,
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
 *
 * Two modes (both LWW-safe and backwards compatible):
 *
 * 1) Targeted delete (existing behavior):
 *    Body: { ids: string[], updatedAt?: number }
 *    -> Applies tombstone (deleted:true) per id with LWW.
 *
 * 2) Global delete (new, for privacy / remote wipe):
 *    Body: {} or no body at all (e.g., plain DELETE with no payload)
 *    -> Applies tombstone to ALL known records in the store.
 *       This is used by /api/delete-remote as a best-effort "clear everything".
 * --------------------------------------------------------------------------*/
export async function DELETE(request: Request) {
  try {
    let body: any = {};
    try {
      // If there is no body, this will throw; we then treat as {}.
      body = await request.json();
    } catch {
      body = {};
    }

    const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
    const now = Date.now();
    const ts =
      typeof body?.updatedAt === "number" && Number.isFinite(body.updatedAt)
        ? body.updatedAt
        : now;

    const deletedIds: string[] = [];

    // 🔹 Mode 2: Global delete when no ids are provided.
    if (ids.length === 0) {
      // Apply tombstone to all known records so that sync clients
      // can still converge using LWW semantics.
      const all = Array.from(store.values());
      for (const rec of all) {
        const tombstone: EmotionRecord = {
          ...rec,
          deleted: true,
          updatedAt: Math.max(rec.updatedAt ?? 0, ts),
        };
        const ok = upsertLWW(tombstone);
        if (ok) deletedIds.push(rec.id);
      }

      // If there were no records yet, deletedIds will simply be [].
      return NextResponse.json(
        {
          mode: "all",
          deletedIds,
          serverTs: Date.now(),
        },
        { status: 200 }
      );
    }

    // 🔹 Mode 1: Targeted delete (previous behavior, unchanged).
    for (const id of ids) {
      const existing = store.get(id);
      const tombstone: EmotionRecord = existing
        ? {
          ...existing,
          deleted: true,
          updatedAt: Math.max(existing.updatedAt ?? 0, ts),
        }
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

    return NextResponse.json(
      { mode: "byIds", deletedIds, serverTs: Date.now() },
      { status: 200 }
    );
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("DELETE /api/history error:", err);
    return NextResponse.json(
      { error: String(err?.message ?? err) },
      { status: 400 }
    );
  }
}
