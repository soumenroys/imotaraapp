// GET /api/admin/voice/preview — the sheet as the dispatcher sees it, and who
// would be called right now. Reads only; places nothing.

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/api/admin/_auth";
import { readDirectory, sheetsConfigured, sheetId } from "@/lib/voice/sheets";
import { bolnaConfigured } from "@/lib/voice/bolna";
import { checkContact, phoneOf, selectDue } from "@/lib/voice/rules";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;
  if (auth.admin.role === "connect_reviewer") return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const setup = { sheets: sheetsConfigured(), bolna: bolnaConfigured(), webhookToken: Boolean(process.env.VOICE_WEBHOOK_TOKEN?.trim()) };
  if (!setup.sheets) return NextResponse.json({ setup, sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId()}` });

  try {
    const d = await readDirectory();
    const now = new Date();
    const manual = selectDue(d, now, { auto: false });
    const auto = selectDue(d, now, { auto: true });
    return NextResponse.json({
      setup,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId()}`,
      settings: d.settings,
      contacts: d.contacts.map((c) => ({
        tab: c.tab, row: c.row, name: c.v.name, organisation: c.v.organisation, phone: phoneOf(c),
        language: c.v.language, status: c.v.status || "Pending", attempts: c.v.call_attempts,
        lastCall: c.v.last_call_date, outcome: c.v.outcome, summary: c.v.call_summary, check: checkContact(c, d),
      })),
      wouldCallNow: (d.settings.autoDispatch ? auto : manual).toCall.map((c) => ({ tab: c.tab, row: c.row, name: c.v.name })),
      dueIfAutomatic: auto.toCall.length + auto.skipped.filter((s) => s.reason === "Waiting for a free line").length,
      activeCalls: auto.activeCalls,
    });
  } catch (e) {
    return NextResponse.json({ setup, error: (e as Error).message }, { status: 502 });
  }
}
