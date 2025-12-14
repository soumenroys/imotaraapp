// src/app/api/history/sync/route.ts
import { NextResponse } from "next/server";
import type { SyncEnvelope, SyncResponse } from "@/types/history";
import { getRecordsSince, upsertRecords } from "../store";

/**
 * Sync endpoint used by the web EmotionHistory sync engine.
 * Production-safe: backed by Supabase via ../store.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SyncEnvelope;

    const clientSince = Number(body?.clientSince ?? 0);
    const clientChanges = Array.isArray(body?.clientChanges) ? body.clientChanges : [];

    // 1) Apply client changes
    if (clientChanges.length > 0) {
      await upsertRecords(clientChanges);
    }

    // 2) Return server changes since clientSince
    const serverChanges = await getRecordsSince(clientSince);

    const payload: SyncResponse = { serverChanges };
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("POST /api/history/sync error:", err);
    return NextResponse.json({ serverChanges: [] } satisfies SyncResponse, { status: 400 });
  }
}
