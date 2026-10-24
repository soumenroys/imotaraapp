// GET /api/admin/voice/preview — the sheet as the dispatcher sees it, and who
// would be called right now. Reads only; places nothing.

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/api/admin/_auth";
import { readDirectory, sheetLink, sheetsConfigured, sheetId, tabGids } from "@/lib/voice/sheets";
import { bolnaConfigured } from "@/lib/voice/bolna";
import { NEEDS_A_PERSON, checkContact, missedSchedule, phoneOf, selectDue } from "@/lib/voice/rules";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { readDone } from "@/lib/admin/todoDone";
import { MANUAL_KIND, voiceTodoId } from "@/lib/admin/todoSources";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;
  if (auth.admin.role === "connect_reviewer") return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const setup = { sheets: sheetsConfigured(), bolna: bolnaConfigured(), webhookToken: Boolean(process.env.VOICE_WEBHOOK_TOKEN?.trim()) };
  if (!setup.sheets) return NextResponse.json({ setup, sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId()}` });

  try {
    const [d, done, gids] = await Promise.all([readDirectory(), readDone(getSupabaseAdmin()).catch(() => ({} as Record<string, unknown>)), tabGids().catch(() => null)]);
    const now = new Date();
    const auto = selectDue(d, now, { auto: true });
    return NextResponse.json({
      setup,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId()}`,
      settings: d.settings,
      contacts: d.contacts.map((c) => ({
        tab: c.tab, row: c.row, sheetLink: sheetLink(gids, c.tab, c.row), name: c.v.name, organisation: c.v.organisation, phone: phoneOf(c),
        language: c.v.language, status: c.v.status || "Pending", attempts: c.v.call_attempts,
        lastCall: c.v.last_call_date, outcome: c.v.outcome, summary: c.v.call_summary, check: checkContact(c, d), missed: missedSchedule(c, now),
        needsPerson: NEEDS_A_PERSON.includes(c.v.status),
        // 🔑 Same record as To do's "Mark done" ⇒ admin/todoSources.voiceTodoId.
        todoId: MANUAL_KIND[c.v.status] ? voiceTodoId(c, MANUAL_KIND[c.v.status]) : null,
        handled: Boolean(MANUAL_KIND[c.v.status] && done[voiceTodoId(c, MANUAL_KIND[c.v.status])]),
        followUp: c.v.follow_up_datetime, nextAction: c.v.next_action, voice: c.v.voice_gender || "female",
        country: c.v.country, timeZone: c.v.time_zone, teamMember: c.v.team_member, type: c.v.organisation_type,
      })),
      activeCalls: auto.activeCalls,
    });
  } catch (e) {
    return NextResponse.json({ setup, error: (e as Error).message }, { status: 502 });
  }
}
