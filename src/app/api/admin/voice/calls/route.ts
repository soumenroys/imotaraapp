// GET /api/admin/voice/calls?days=30 — the call log and its report, read from Bolna.
import { NextRequest, NextResponse } from "next/server";
import { listCalls, summarise, type CallRecord } from "@/lib/voice/calls";
import { voiceAdmin } from "../_shared";

export const runtime = "nodejs";
export const maxDuration = 120;

// 🔑 44 agents × 7-day windows ⇒ 10–30 s per load (measured 24 Oct: 30 days 9–14 s,
// 90 days 30 s). ⚠️ The key used to be the exact from/to instants, which the
// page recomputes on every click — so it never hit. Keyed by the number of days.
const cache = new Map<number, { at: number; calls: CallRecord[] }>();
const TTL_MS = 5 * 60_000;
const MAX_DAYS = 92;

export async function GET(req: NextRequest) {
  const a = await voiceAdmin(req);
  if (!a.ok) return a.response;
  const sp = req.nextUrl.searchParams;
  const days = Number(sp.get("days") ?? 30);
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    return NextResponse.json({ error: `Choose 1 to ${MAX_DAYS} days.` }, { status: 400 });
  }
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400_000);
  const hit = cache.get(days);
  try {
    const fresh = !hit || Date.now() - hit.at >= TTL_MS || sp.get("fresh") === "1";
    const calls = fresh ? await listCalls(from, to) : hit.calls;
    if (fresh) cache.set(days, { at: Date.now(), calls });
    const asOf = new Date(fresh ? Date.now() : hit!.at).toISOString();
    return NextResponse.json({ days, asOf, calls, report: summarise(calls) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
