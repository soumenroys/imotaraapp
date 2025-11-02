// src/app/api/history/route.ts
import { NextResponse } from "next/server";
import type { EmotionRecord } from "@/types/history";

/**
 * Temporary in-memory store for remote history.
 * This resets whenever the dev server restarts.
 */
const remoteHistory: EmotionRecord[] = [];

// GET /api/history
export async function GET() {
  return NextResponse.json(remoteHistory);
}

// POST /api/history
export async function POST(req: Request) {
  try {
    const newRecords = (await req.json()) as EmotionRecord[];
    if (Array.isArray(newRecords)) {
      remoteHistory.push(...newRecords);
    }
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("Invalid payload in /api/history:", err);
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }
}
