// GET /api/geo/country — the country the edge placed this request in, for the
// crisis card's helpline numbers.
//
// 🔑 The web chat guessed the country from the browser's locale and timezone, which
// are preferences, not a location: a Bengali-locale laptop in London was shown
// Indian numbers that do not dial from there. This is the same edge header
// /api/respond and /api/chat-reply already read. Nothing is stored or logged; no
// IP or coordinate leaves the edge. An explicit Settings choice still wins.
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET(req: NextRequest) {
  const c = req.headers.get("x-vercel-ip-country")?.trim().toUpperCase() ?? "";
  return NextResponse.json(
    { country: /^[A-Z]{2}$/.test(c) ? c : null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
