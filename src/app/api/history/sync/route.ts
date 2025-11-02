// src/app/api/history/sync/route.ts
import { NextResponse } from "next/server";
import type { EmotionRecord, SyncEnvelope, SyncResponse } from "@/types/history";

// Simulated server store (in-memory). Replace with DB later.
let SERVER_STORE: EmotionRecord[] = [];

function upsertServer(records: EmotionRecord[]) {
  const idx = new Map(SERVER_STORE.map((r) => [r.id, r]));
  for (const rec of records) {
    const prev = idx.get(rec.id);
    if (!prev || (rec.updatedAt ?? 0) >= (prev.updatedAt ?? 0)) {
      idx.set(rec.id, { ...rec });
    }
  }
  SERVER_STORE = Array.from(idx.values()).sort(
    (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SyncEnvelope;

    // 1) Apply client changes
    if (Array.isArray(body.clientChanges) && body.clientChanges.length) {
      upsertServer(body.clientChanges);
    }

    // 2) Compute server changes since clientSince
    const since = body.clientSince ?? 0;
    const serverChanges = SERVER_STORE.filter((r) => (r.updatedAt ?? 0) > since);

    const payload: SyncResponse = { serverChanges };
    return NextResponse.json(payload, { status: 200 });
  } catch {
    return NextResponse.json({ serverChanges: [] } satisfies SyncResponse, { status: 400 });
  }
}
