// src/lib/admin/todoDone.ts
// "Mark done" for to-do items that nothing in the system can see finished —
// a person called back, details sent by hand, a meeting held.
//
// 🔑 Most to-do items clear THEMSELVES: approve a draft and it is no longer
// waiting. Only these need a person to say so. Each record names who and when,
// so the page can show "Done by … at …" rather than an item silently vanishing.
//
// ⚠️ app_settings, not a new table (no migration to run by hand). Old records
// are pruned after 30 days so the row never grows without bound.

import type { SupabaseClient } from "@supabase/supabase-js";

const KEY = "admin_todo_done";
const KEEP_DAYS = 30;

export type DoneRecord = { by: string; at: string; title: string };

export async function readDone(supabase: SupabaseClient): Promise<Record<string, DoneRecord>> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", KEY).maybeSingle();
  const v = (data?.value ?? {}) as { done?: Record<string, DoneRecord> };
  return v.done && typeof v.done === "object" ? v.done : {};
}

export async function markDone(supabase: SupabaseClient, id: string, by: string, title: string, now = new Date()): Promise<void> {
  const done = await readDone(supabase);
  const cutoff = now.getTime() - KEEP_DAYS * 86_400_000;
  for (const [k, r] of Object.entries(done)) if (Date.parse(r.at) < cutoff) delete done[k];
  done[id] = { by, at: now.toISOString(), title: title.slice(0, 200) };
  const { error } = await supabase.from("app_settings").upsert({ key: KEY, value: { done }, updated_at: now.toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`Could not record that: ${error.message}`);
}

export async function undoDone(supabase: SupabaseClient, id: string): Promise<void> {
  const done = await readDone(supabase);
  if (!done[id]) return;
  delete done[id];
  const { error } = await supabase.from("app_settings").upsert({ key: KEY, value: { done }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`Could not undo that: ${error.message}`);
}
