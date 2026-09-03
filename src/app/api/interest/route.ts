// src/app/api/interest/route.ts
// POST — someone asks to hear from Imotara (BC-26).
//
// This is the strongest consent record the broadcast system has. A manually
// typed address is an admin's claim that someone gave it to them; a form
// submission is the person's own act, with their IP, their browser and the
// exact time attached. That is what "demonstrate consent" means in the GDPR
// sense, and it is why the form exists rather than more typing.
//
// Public and unauthenticated, so it is also the most attackable surface in the
// feature.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getClientIp, checkPersistentIpRateLimit } from "@/lib/imotara/ipRateLimit";
import { EMAIL_RE } from "@/lib/broadcast/parseRecipients";

export const runtime = "nodejs";

const RATE_LIMIT = 5;
const WINDOW_SECONDS = 60 * 60;
const MAX_MESSAGE = 2000;
const MAX_NAME = 120;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  // ── Honeypot ───────────────────────────────────────────────────────────────
  // A field no human sees and every naive bot fills. It answers 200 rather
  // than 400 on purpose: an error teaches the author of the bot what to change,
  // whereas a success teaches them nothing and they move on.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "That does not look like an email address" }, { status: 400 });
  }

  // ── Consent is the point ───────────────────────────────────────────────────
  // Checked server-side because a tick box that only the browser enforces
  // proves nothing later. Without it there is no lawful basis to mail this
  // person, so the submission is refused rather than stored and sorted out
  // afterwards.
  if (body.consent !== true) {
    return NextResponse.json(
      { error: "Please tick the box to say we may email you" }, { status: 400 },
    );
  }

  const ip = getClientIp(req);
  const allowed = await checkPersistentIpRateLimit("broadcast-interest", ip, RATE_LIMIT, WINDOW_SECONDS);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many submissions from this connection. Try again later." }, { status: 429 },
    );
  }

  const name = String(body.name ?? "").trim().slice(0, MAX_NAME) || null;
  const message = String(body.message ?? "").trim().slice(0, MAX_MESSAGE) || null;
  const supabase = getSupabaseAdmin();

  // A double submission — the same address within ten minutes — is almost
  // always an impatient second click. Answer as though it worked, because from
  // the person's point of view it did.
  const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: recent } = await supabase
    .from("broadcast_interest_submissions")
    .select("id")
    .eq("email", email)
    .gte("created_at", tenMinutesAgo)
    .limit(1)
    .maybeSingle();

  if (recent) return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });

  const { error } = await supabase.from("broadcast_interest_submissions").insert({
    email, name, message,
    ip,
    user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    status: "new",
  });

  if (error) {
    console.error("[interest] insert:", error.message);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  // Deliberately NOT clearing any suppression this address may carry.
  //
  // A form is not proof of who is sitting at the keyboard — anyone can type
  // anyone's address. Someone who previously unsubscribed, bounced or reported
  // us as spam stays suppressed, and an admin decides whether this submission
  // is a genuine change of mind. Auto-resurrecting an address would mean a
  // stranger could put a person back on our list against their expressed
  // wishes, which is the precise thing the suppression list exists to prevent.

  return NextResponse.json({ ok: true }, { status: 201 });
}
