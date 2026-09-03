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
import { notifyOwner } from "@/lib/broadcast/notify";
import { confirmUrl, isUnsubscribeConfigured } from "@/lib/broadcast/unsubscribe";
import { sendBatch, isResendConfigured } from "@/lib/broadcast/resendClient";
import { availableIdentities } from "@/lib/broadcast/identities";

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

  // ── Confirm the address actually belongs to whoever typed it (G7) ────────
  // A form submission proves someone typed an address, not that they own it.
  // Until the link in this email is clicked the address is a claim, and the
  // admin panel says so. Nothing is ever mailed to an unconfirmed address
  // except this one message.
  //
  // The 24-hour guard is the abuse control: without it, submitting a stranger's
  // address repeatedly would turn this form into a way to mail them.
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: recentlyMailed } = await supabase
    .from("broadcast_interest_submissions")
    .select("id")
    .eq("email", email)
    .not("confirmation_sent_at", "is", null)
    .gte("confirmation_sent_at", dayAgo)
    .limit(1)
    .maybeSingle();

  if (!recentlyMailed && isResendConfigured() && isUnsubscribeConfigured()) {
    const identities = await availableIdentities(supabase);
    const identity = identities[0];
    if (identity) {
      const link = confirmUrl(email);
      const sender = identity.name ? `"${identity.name}" <${identity.email}>` : identity.email;
      await sendBatch([{
        from: sender,
        to: email,
        subject: "Please confirm your email address",
        // Operational by nature: it carries no marketing and cannot be
        // unsubscribed from, because it exists to establish consent.
        html:
          `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937">` +
          `<p>Someone — we hope you — asked to hear from Imotara at this address.</p>` +
          `<p>Confirm it and we will occasionally write about the app. ` +
          `Every email after this has a one-click unsubscribe link.</p>` +
          `<p><a href="${link}" style="display:inline-block;padding:11px 22px;background:#4f46e5;` +
          `color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Yes, confirm</a></p>` +
          `<p style="font-size:12px;color:#94a3b8">If this was not you, ignore this email — ` +
          `nothing happens unless the button is pressed, and we will not write again.</p></div>`,
        text:
          `Someone — we hope you — asked to hear from Imotara at this address.\n\n` +
          `Confirm: ${link}\n\n` +
          `If this was not you, ignore this email. Nothing happens unless you press the link.`,
        replyTo: identity.email,
      }]).catch(() => undefined);

      await supabase
        .from("broadcast_interest_submissions")
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq("email", email)
        .is("confirmed_at", null);
    }
  }

  // Told to a person, because a submission that nobody sees is consent
  // collected and wasted. Never allowed to fail the visitor's request.
  void notifyOwner("Someone asked to hear from Imotara", [
    `${name ?? "Someone"} <${email}> filled in the form at imotara.com/updates.`,
    message ? `\nThey wrote: ${message}` : "",
    `\nThey still have to confirm the address before it can be used.`,
    `Review it under Broadcast -> Requests.`,
  ]);

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
