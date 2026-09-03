// src/app/api/interest/confirm/route.ts
// GET — the link in the confirmation email (G7).
//
// A GET that changes state, which is normally the wrong thing. It is right
// here for one reason: the alternative is a page with a button, and a person
// who has already pressed "confirm" in their mail client and been asked to
// press it again mostly does not. Confirming an address is also not a
// destructive act — the worst a scanner following the link can do is confirm
// an address its owner just asked us to confirm.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { verifyConfirmToken } from "@/lib/broadcast/unsubscribe";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const email = verifyConfirmToken(token);

  const to = (state: string) =>
    NextResponse.redirect(new URL(`/updates/confirm?s=${state}`, req.url), 302);

  if (!email) return to("bad");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("broadcast_interest_submissions")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("email", email)
    .is("confirmed_at", null)
    .select("id");

  if (error) {
    console.error("[interest/confirm]:", error.message);
    return to("error");
  }

  // Nothing updated means it was already confirmed — which is a success from
  // the person's point of view, and telling them otherwise would be a lie.
  return to((data?.length ?? 0) > 0 ? "ok" : "already");
}
