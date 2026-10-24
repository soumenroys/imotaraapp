// GET /api/admin/outreach — the mailer's switches, its drafts, and every contact's email state.
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { readDirectory, sheetLink, sheetsConfigured, sheetId, tabGids } from "@/lib/voice/sheets";
import { getBudget } from "@/lib/broadcast/warmup";
import { isResendConfigured } from "@/lib/broadcast/resendClient";
import { isUnsubscribeConfigured } from "@/lib/broadcast/unsubscribe";
import { AUDIENCE_OF, dueStep, emailOf, mailCheck } from "@/lib/outreach/sequence";
import { readOutreach } from "@/lib/outreach/store";
import { senderIdentity, suppressedEmails } from "@/lib/outreach/send";
import { outreachAdmin, failed } from "./_shared";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const a = await outreachAdmin(req);
  if (!a.ok) return a.response;
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId()}`;
  if (!sheetsConfigured()) return NextResponse.json({ error: "The contact sheet is not connected.", sheetUrl }, { status: 409 });
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const [state, d, suppressed, budget, sender, gids] = await Promise.all([
      readOutreach(supabase), readDirectory(), suppressedEmails(supabase), getBudget(supabase, now), senderIdentity(supabase), tabGids().catch(() => null),
    ]);
    const today = new Date(now); today.setUTCHours(0, 0, 0, 0);
    const contacts = d.contacts
      .filter((c) => emailOf(c) || c.v.mail_status)
      .map((c) => ({
        tab: c.tab, row: c.row, sheetLink: sheetLink(gids, c.tab, c.row), audience: AUDIENCE_OF[c.tab], name: c.v.name, organisation: c.v.organisation,
        email: emailOf(c), mailStatus: c.v.mail_status, mailStep: Number(c.v.mail_step) || 0, lastSent: c.v.mail_last_sent,
        callStatus: c.v.status, check: mailCheck(c, suppressed, d.dnc), due: dueStep(c, suppressed, now, d.dnc),
      }));
    return NextResponse.json({
      settings: state.settings,
      drafts: state.drafts,
      contacts,
      sentToday: contacts.filter((c) => (Date.parse(c.lastSent) || 0) >= today.getTime()).length,
      domainBudget: { remaining: budget.remaining, cap: budget.cap, week: budget.week },
      sender,
      ready: { email: isResendConfigured(), unsubscribe: isUnsubscribeConfigured(), sender: Boolean(sender) },
      sheetUrl,
    });
  } catch (e) {
    return failed(e);
  }
}
