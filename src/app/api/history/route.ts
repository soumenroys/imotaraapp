// src/app/api/history/route.ts
import { NextResponse } from "next/server";

let remoteHistory: any[] = []; // Temporary in-memory store (resets on restart)

export async function GET() {
  return NextResponse.json(remoteHistory);
}

export async function POST(req: Request) {
  const newRecords = await req.json();
  remoteHistory.push(...newRecords);
  return NextResponse.json({ status: "ok" });
}
