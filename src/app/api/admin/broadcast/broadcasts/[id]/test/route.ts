// src/app/api/admin/broadcast/broadcasts/[id]/test/route.ts
// POST — send this draft to one address, right now (G2).
//
// Without it, the only way to see a real message was to build a list holding
// your own address and send to it — so the first time anyone saw the true
// rendering was when the recipients did. A preview iframe is close, but no
// preview reproduces what Gmail does to a message.
//
// It bypasses the queue on purpose: a test that waits for the next cron tick
// is a test nobody runs twice.
//
// Owner role only.

import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getClientIp, checkPersistentIpRateLimit } from "@/lib/imotara/ipRateLimit";
import { sendBatch, isResendConfigured } from "@/lib/broadcast/resendClient";
import { emailDocument, footerHtml, footerText } from "@/lib/broadcast/markup";
import { EMAIL_RE } from "@/lib/broadcast/parseRecipients";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  if (!isResendConfigured()) {
    return NextResponse.json({ error: "Sending is not configured" }, { status: 400 });
  }

  const { id } = await params;

  let body: { email?: unknown };
  try { body = await req.json(); }
  catch { body = {}; }

  // Defaults to the admin's own address: the common case is "show me what this
  // looks like", and making them retype their own address every time is how a
  // test send becomes a step people skip.
  const to = (typeof body.email === "string" && body.email.trim()
    ? body.email.trim()
    : auth.admin.email
  ).toLowerCase();

  if (!EMAIL_RE.test(to)) {
    return NextResponse.json({ error: "That is not a valid address" }, { status: 400 });
  }

  // Tests do not pass through broadcast_sends, so they are invisible to the
  // warm-up ceiling. This is the cap that stops that being a hole.
  const ok = await checkPersistentIpRateLimit("broadcast-test", getClientIp(req), 30, 24 * 3600);
  if (!ok) {
    return NextResponse.json(
      { error: "That is a lot of test sends for one day. Try again tomorrow." }, { status: 429 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: b } = await supabase
    .from("broadcasts")
    .select("id, subject, body_html, body_text, message_type, from_email, from_name, reply_to")
    .eq("id", id)
    .maybeSingle();

  if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!b.subject?.trim()) return NextResponse.json({ error: "Add a subject first" }, { status: 400 });
  if (!b.body_html?.trim()) return NextResponse.json({ error: "Write the message first" }, { status: 400 });

  // A dead unsubscribe link, because there is no recipient row to unsubscribe.
  // The footer is still shown so the test reflects the real message's height
  // and layout rather than a slightly shorter one.
  const footer = b.message_type === "broadcast" ? footerHtml("#") : "";
  const footerT = b.message_type === "broadcast" ? footerText("(not active in a test)") : "";

  const name = b.from_name?.trim().replace(/["\\]/g, "");
  const [outcome] = await sendBatch([{
    from: name ? `"${name}" <${b.from_email}>` : (b.from_email as string),
    to,
    // Marked in the subject so a test can never be mistaken for the real
    // thing, by the sender or by anyone the sender forwards it to.
    subject: `[TEST] ${b.subject}`,
    html: emailDocument(b.body_html as string, footer),
    text: `${b.body_text ?? ""}${footerT}`,
    replyTo: (b.reply_to ?? b.from_email) as string,
  }]);

  if (!outcome?.ok) {
    return NextResponse.json(
      { error: outcome ? `${outcome.code}: ${outcome.message}` : "The send failed" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, to, id: outcome.id }, { status: 200 });
}
