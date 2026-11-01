// src/lib/meetings/run.ts
// Every 10 minutes (with the outreach mailer): agreed meetings from the Call
// Directory sheet ⇒ the Imotara calendar ⇒ "Meeting in calendar" on the row.
//
// ⚠️ Until the calendar is connected this does nothing and says so — the sheet
// is not touched, so a row waits rather than showing a false ⛔.

import type { SupabaseClient } from "@supabase/supabase-js";
import { readDirectory, writeMany } from "@/lib/voice/sheets";
import { meetingWork } from "@/lib/meetings/plan";
import { calendarAccessToken, calendarOAuthConfig, putEvent } from "@/lib/meetings/calendar";

export type MeetingRun = { skipped?: string; booked: number; updated: number; problems: number; failed: string[] };

export async function bookMeetings(db: SupabaseClient, now = new Date()): Promise<MeetingRun> {
  const out: MeetingRun = { booked: 0, updated: 0, problems: 0, failed: [] };
  const work = meetingWork((await readDirectory()).contacts, now);
  if (work.length === 0) return out;

  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.imotara.com").trim();
  const config = calendarOAuthConfig(process.env, origin);
  if (!config.ok) return { ...out, skipped: config.message };
  const access = await calendarAccessToken(db, config.config);
  if (!access) return { ...out, skipped: "the Imotara calendar is not connected yet" };

  const writes: Parameters<typeof writeMany>[0] = [];
  for (const w of work) {
    if (w.kind === "problem") {
      out.problems++;
      writes.push({ c: w.c, cells: { meeting_booked: w.mark } });
      continue;
    }
    try {
      await putEvent(access, w.event, w.kind === "update");
      if (w.kind === "book") out.booked++;
      else out.updated++;
      writes.push({ c: w.c, cells: { meeting_booked: w.mark } });
    } catch (e) {
      // ⚠️ The row is left as it was, so the next run tries again; the reason goes to the log, not the sheet.
      out.failed.push(`${w.c.tab} row ${w.c.row}: ${(e as Error).message}`);
    }
  }
  if (writes.length) await writeMany(writes);
  return out;
}
