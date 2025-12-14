// src/app/api/history/route.ts
import { isAdminRequest, isProd } from "@/lib/prodGuard";
import { NextResponse } from "next/server";
import type { EmotionRecord } from "@/types/history";
import {
  getAllRecords,
  getRecordsSince,
  upsertRecords,
  clearAllRecords,
} from "./store";

/* ----------------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------------*/

/**
 * Coerce a loose object into a strict EmotionRecord or return null if invalid.
 * Keeps /api/history tolerant to older/mobile payload shapes.
 */
function coerceEmotionRecord(input: any): EmotionRecord | null {
  if (!input || typeof input !== "object") return null;

  const id = typeof input.id === "string" ? input.id.trim() : "";
  if (!id) return null;

  // Web sends: { message }
  // Mobile sends: { text }
  const message =
    typeof input.message === "string"
      ? input.message
      : typeof input.text === "string"
        ? input.text
        : "";

  if (!message) return null;

  const emotion =
    typeof input.emotion === "string" && input.emotion.trim()
      ? (input.emotion as any)
      : "neutral";

  const intensity =
    typeof input.intensity === "number" && Number.isFinite(input.intensity)
      ? input.intensity
      : undefined;

  const createdAtCandidate =
    typeof input.createdAt === "number" && Number.isFinite(input.createdAt)
      ? input.createdAt
      : typeof input.timestamp === "number" && Number.isFinite(input.timestamp)
        ? input.timestamp
        : Date.now();

  const updatedAtCandidate =
    typeof input.updatedAt === "number" && Number.isFinite(input.updatedAt)
      ? input.updatedAt
      : createdAtCandidate;

  const rec: EmotionRecord = {
    id,
    message,
    emotion,
    intensity,
    createdAt: createdAtCandidate,
    updatedAt: updatedAtCandidate,
  };

  // Optional: source (web) / from (mobile)
  if (input.source || input.from) {
    (rec as any).source = (input.source ?? input.from) as any;
  }

  // Optional: deleted
  if (input.deleted === true) {
    rec.deleted = true;
  }

  // Optional pass-through fields (safe)
  if (typeof input.sessionId === "string") rec.sessionId = input.sessionId;
  if (typeof input.messageId === "string") rec.messageId = input.messageId;
  if (typeof input.chatMessageId === "string") rec.chatMessageId = input.chatMessageId;
  if (Array.isArray(input.tags)) (rec as any).tags = input.tags;

  return rec;
}

function coerceRecordsFromBody(body: any): EmotionRecord[] {
  // New preferred: { records: EmotionRecord[] }
  if (body && typeof body === "object" && Array.isArray(body.records)) {
    return body.records.map(coerceEmotionRecord).filter(Boolean) as EmotionRecord[];
  }

  // Old compat: EmotionRecord[]
  if (Array.isArray(body)) {
    return body.map(coerceEmotionRecord).filter(Boolean) as EmotionRecord[];
  }

  // Mobile compat: single record-ish object
  const single = coerceEmotionRecord(body);
  return single ? [single] : [];
}

/**
 * Last-write-wins upsert for a single record.
 * Behavior preserved from the previous in-memory approach:
 * newer updatedAt (or createdAt) wins.
 */
async function upsertLWW(incoming: EmotionRecord): Promise<void> {
  const all = await getAllRecords();
  const existing = all.find((r) => r.id === incoming.id);

  if (!existing) {
    await upsertRecords([incoming]);
    return;
  }

  const existingTime = (existing.updatedAt ?? existing.createdAt ?? 0) as number;
  const incomingTime = (incoming.updatedAt ?? incoming.createdAt ?? 0) as number;

  if (incomingTime >= existingTime) {
    await upsertRecords([incoming]);
  }
}

/**
 * DEV ONLY helper:
 * bump updatedAt for the most-recent N records to simulate server-newer conflicts.
 * Preserves your existing dev_touchN behavior.
 */
async function touchRecent(n: number): Promise<string[]> {
  if (!Number.isFinite(n) || n <= 0) return [];

  const now = Date.now();
  const all = await getAllRecords();

  const sorted = all.sort(
    (a: EmotionRecord, b: EmotionRecord) =>
      ((b.updatedAt ?? 0) as number) - ((a.updatedAt ?? 0) as number)
  );

  const picked = sorted.slice(0, n);

  const bumped = picked.map<EmotionRecord>((rec: EmotionRecord) => ({
    ...rec,
    updatedAt: now,
  }));

  await upsertRecords(bumped);

  return picked.map((r: EmotionRecord) => r.id);
}

/* ----------------------------------------------------------------------------
 * GET /api/history
 * Query:
 *   mode=array            -> return raw array (back-compat / easier debugging)
 *   since=<ms>            -> return records updated after ms (array mode only)
 *   dev_touchN=<int>      -> DEV ONLY: bump updatedAt on top-N records
 *   dev_wipe=1            -> DEV ONLY: clear the store
 *
 * Default response (envelope):
 *   { records, syncToken?: string, serverTs: number, serverCount?: number }
 * --------------------------------------------------------------------------*/
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // DEV: wipe all records
  // DEV toggles (blocked in production unless admin header is present)
  const admin = isAdminRequest(request);

  const devWipe = searchParams.get("dev_wipe") === "1";
  if (devWipe) {
    if (isProd() && !admin) {
      return new NextResponse("Not Found", { status: 404 });
    }
    await clearAllRecords();
    return NextResponse.json(
      { ok: true, wiped: true, serverTs: Date.now() },
      { status: 200 }
    );
  }

  const touchN = Number(searchParams.get("dev_touchN") ?? "0");
  if (Number.isFinite(touchN) && touchN > 0) {
    if (isProd() && !admin) {
      return new NextResponse("Not Found", { status: 404 });
    }
    const ids = await touchRecent(touchN);
    return NextResponse.json(
      { ok: true, touched: ids, serverTs: Date.now() },
      { status: 200 }
    );
  }

  const mode = searchParams.get("mode") ?? "envelope";
  const since = Number(searchParams.get("since") ?? "0");

  // Array mode (back-compat)
  if (mode === "array") {
    if (Number.isFinite(since) && since > 0) {
      const rows = await getRecordsSince(since);
      return NextResponse.json(rows, { status: 200 });
    }
    const rows = await getAllRecords();
    return NextResponse.json(rows, { status: 200 });
  }

  // Default envelope mode
  const records = await getAllRecords();
  const serverTs = Date.now();

  // Preserve prior semantics: count excludes deleted
  const serverCount = records.filter((r: EmotionRecord) => r.deleted !== true).length;

  const envelope = {
    records,
    // serverTs acts as a simple syncToken for this server
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
 *   - Mobile:        { id, text, from, timestamp, emotion, intensity }
 *
 * Response:
 *   { ok: true, acceptedIds: string[], serverTs: number, serverCount?: number }
 * --------------------------------------------------------------------------*/
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const records = coerceRecordsFromBody(body);

    // Preserve LWW semantics record-by-record (safer than blind batch overwrite)
    for (const rec of records) {
      await upsertLWW(rec);
    }

    const serverTs = Date.now();

    // Preserve prior semantics: count excludes deleted
    const all = await getAllRecords();
    const serverCount = all.filter((r: EmotionRecord) => r.deleted !== true).length;

    return NextResponse.json(
      {
        ok: true,
        acceptedIds: records.map((r) => r.id),
        serverTs,
        serverCount,
      },
      { status: 200 }
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("POST /api/history error:", err);
    return NextResponse.json(
      { ok: false, acceptedIds: [], serverTs: Date.now() },
      { status: 400 }
    );
  }
}
