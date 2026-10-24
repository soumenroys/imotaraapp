// src/lib/outreach/syncSheet.ts
// Writes each row's plain-language status (call_progress, mail_progress,
// what_to_do) into the sheet — only the cells that changed, in one request.
//
// 🔑 Runs from the 10-minute outreach job whether or not email is switched on,
// so the sheet stays current for calls too ⇒ /api/cron/outreach-mail.

import type { SupabaseClient } from "@supabase/supabase-js";
import { readDirectory, writeMany } from "@/lib/voice/sheets";
import { SYSTEM_STATE, type Column, type Contact } from "@/lib/voice/rules";
import { progressFor } from "@/lib/outreach/progress";
import { readOutreach } from "@/lib/outreach/store";
import { suppressedEmails } from "@/lib/outreach/send";

export async function syncProgress(supabase: SupabaseClient, now = new Date()): Promise<{ rows: number; cells: number }> {
  const [d, state, suppressed] = await Promise.all([readDirectory(), readOutreach(supabase), suppressedEmails(supabase)]);
  const updates: { c: Pick<Contact, "tab" | "row">; cells: Partial<Record<Column, string>> }[] = d.contacts
    .map((c) => {
      const want = progressFor(c, d, suppressed, state, now);
      const changed = Object.fromEntries(Object.entries(want).filter(([k, v]) => c.v[k as keyof typeof want] !== v));
      return { c, cells: changed };
    })
    .filter((u) => Object.keys(u.cells).length > 0);
  // Rows emptied of a person but still showing a status are blanked.
  for (const r of d.staleStatus ?? []) updates.push({ c: r, cells: Object.fromEntries(SYSTEM_STATE.map((k) => [k, ""])) });
  const cells = updates.length ? await writeMany(updates) : 0;
  return { rows: updates.length, cells };
}
