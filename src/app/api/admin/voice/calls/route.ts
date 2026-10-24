// GET /api/admin/voice/calls?from=ISO&to=ISO — the call log and its report, read from Bolna.
import { NextRequest, NextResponse } from "next/server";
import { listCalls, summarise, type CallRecord } from "@/lib/voice/calls";
import { voiceAdmin } from "../_shared";

export const runtime = "nodejs";
export const maxDuration = 120;

// 44 agents per load ⇒ a short cache so switching tabs does not refetch everything.
const cache = new Map<string, { at: number; calls: CallRecord[] }>();
const TTL_MS = 60_000;
const MAX_RANGE_DAYS = 92;

export async function GET(req: NextRequest) {
  const a = await voiceAdmin(req);
  if (!a.ok) return a.response;
  const sp = req.nextUrl.searchParams;
  const to = sp.get("to") ? new Date(sp.get("to")!) : new Date();
  const from = sp.get("from") ? new Date(sp.get("from")!) : new Date(to.getTime() - 30 * 86400_000);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) {
    return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86400_000) {
    return NextResponse.json({ error: `Choose at most ${MAX_RANGE_DAYS} days.` }, { status: 400 });
  }
  const key = `${from.toISOString()}|${to.toISOString()}`;
  const hit = cache.get(key);
  try {
    const calls = hit && Date.now() - hit.at < TTL_MS && sp.get("fresh") !== "1" ? hit.calls : await listCalls(from, to);
    cache.set(key, { at: Date.now(), calls });
    return NextResponse.json({ from: from.toISOString(), to: to.toISOString(), calls, report: summarise(calls) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
