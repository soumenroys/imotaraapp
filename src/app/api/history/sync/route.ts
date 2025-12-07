// src/app/api/history/sync/route.ts
import { NextResponse } from "next/server";
import type { EmotionRecord, SyncEnvelope, SyncResponse } from "@/types/history";
import {
  getRecordsSince,
  upsertRecords,
} from "../store";

/**
 * Sync endpoint used by the web EmotionHistory sync engine.
 * Now uses the shared in-memory store so that:
 *   - /api/history
 *   - /api/history?mode=array
 *   - /api/history/sync
 * all operate on the SAME backend state.
 */

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SyncEnvelope;

    // 1) Apply client changes (Last-Write-Wins handled by upsertRecords)
    if (Array.isArray(body.clientChanges) && body.clientChanges.length) {
      // We assume clientChanges are already well-formed EmotionRecord objects.
      // upsertRecords will:
      //   - validate ids
      //   - compare updatedAt/createdAt
      //   - keep the newest version per id
      upsertRecords(body.clientChanges as EmotionRecord[]);
    }

    // 2) Compute server changes since clientSince
    const since = body.clientSince ?? 0;
    const serverChanges = getRecordsSince(since);

    const payload: SyncResponse = { serverChanges };
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    // In case of malformed body or any other error, keep contract:
    // return { serverChanges: [] } with 400.
    // eslint-disable-next-line no-console
    console.error("POST /api/history/sync error:", err);
    return NextResponse.json(
      { serverChanges: [] } satisfies SyncResponse,
      { status: 400 }
    );
  }
}
