// GET /api/admin/voice/recording/:callId — stream one call's recording to the console.
//
// 🔑 The provider's recording link needs our API key, which the browser must
// never hold ⇒ the server fetches it. ⛔ Not an open proxy: it looks the call up
// by id and fetches ONLY the recording_url the provider gives for that call.
import { NextRequest, NextResponse } from "next/server";
import { getExecution } from "@/lib/voice/bolna";
import { voiceAdmin } from "../../_shared";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const a = await voiceAdmin(req);
  if (!a.ok) return a.response;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{20,64}$/i.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const exec = await getExecution(id);
  const tel = (exec?.telephony_data ?? {}) as Record<string, unknown>;
  const url = String(tel.recording_url ?? "");
  if (!/^https:\/\//.test(url)) return NextResponse.json({ error: "No recording for this call." }, { status: 404 });

  const range = req.headers.get("range");
  const upstream = await fetch(url, {
    headers: {
      authorization: `Bearer ${process.env.BOLNA_API_KEY?.trim() ?? ""}`,
      ...(range ? { range } : {}),
    },
    signal: AbortSignal.timeout(45_000),
  });
  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ error: `The recording could not be fetched (${upstream.status}).` }, { status: 502 });
  }
  const headers = new Headers({ "cache-control": "private, max-age=300" });
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("content-type")) headers.set("content-type", "audio/mpeg");
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
