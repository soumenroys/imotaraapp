// POST /api/history/claim — #135: move this browser's guest history into the signed-in account.
// ⇒ lib/history/claimGuestHistory.ts. Body: { deviceScope } — the browser's own guest id.
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseUserServer } from "@/lib/supabase/userServer";
import { checkPersistentIpRateLimit } from "@/lib/imotara/ipRateLimit";
import { claimGuestHistory, isClaimableScope } from "@/lib/history/claimGuestHistory";

export const runtime = "nodejs";

async function signedInUser(req: NextRequest): Promise<{ id: string; anonymous: boolean } | null> {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (bearer) {
    const { data } = await supabaseServer.auth.getUser(bearer);
    if (data?.user) return { id: data.user.id, anonymous: !!data.user.is_anonymous };
  }
  try {
    const sb = await supabaseUserServer();
    const { data } = await sb.auth.getUser();
    if (data?.user) return { id: data.user.id, anonymous: !!data.user.is_anonymous };
  } catch { /* no cookie session */ }
  return null;
}

export async function POST(req: NextRequest) {
  const user = await signedInUser(req);
  // ⛔ A real account only — a guest has nothing to move into.
  if (!user || user.anonymous) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });

  let body: { deviceScope?: unknown; anonymousToken?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  // Two kinds of guest id:
  //  · the WEB browser's own random id — claimable as itself (isClaimableScope);
  //  · the APP's guest, which is a real ANONYMOUS account (uuid). A uuid is never claimable on its
  //    own word — the phone must PROVE it held that guest account by sending its token, which only
  //    that phone had until the moment it signed in. (#135, app — 12 Nov 2026)
  let scope: string;
  if (typeof body.anonymousToken === "string" && body.anonymousToken.length > 20) {
    const { data, error } = await supabaseServer.auth.getUser(body.anonymousToken);
    const anon = data?.user;
    if (error || !anon || !anon.is_anonymous || anon.id === user.id) {
      return NextResponse.json({ error: "not_claimable" }, { status: 400 });
    }
    scope = anon.id;
  } else {
    if (!isClaimableScope(body.deviceScope) || body.deviceScope === user.id) {
      return NextResponse.json({ error: "not_claimable" }, { status: 400 });
    }
    scope = body.deviceScope.trim();
  }

  if (!(await checkPersistentIpRateLimit("history-claim", `u:${user.id}`, 30, 3600))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const moved = await claimGuestHistory(supabaseServer, scope, user.id);
    return NextResponse.json({ ok: true, ...moved });
  } catch (e) {
    console.error("[history/claim]", (e as Error).message);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
