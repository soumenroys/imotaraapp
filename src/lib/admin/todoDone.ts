// src/lib/admin/todoDone.ts
// "Mark done" for to-do items that nothing in the system can see finished —
// a person called back, details sent by hand, a meeting held.
//
// 🔑 Most to-do items clear THEMSELVES: approve a draft and it is no longer
// waiting. Only these need a person to say so. Each record names who and when,
// so the page can show "Done by … at …" rather than an item silently vanishing.
//
// ⚠️ app_settings, not a new table (no migration to run by hand). The newest
// KEEP records are kept so the row never grows without bound. ⛔ NOT pruned by
// age: an item still derived from the sheet after 30 days came BACK as undone
// once its record was pruned (review, 24 Oct).

import type { SupabaseClient } from "@supabase/supabase-js";

const KEY = "admin_todo_done";
const KEEP = 2000;

export type DoneRecord = { by: string; at: string; title: string };

export async function readDone(supabase: SupabaseClient): Promise<Record<string, DoneRecord>> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", KEY).maybeSingle();
  const v = (data?.value ?? {}) as { done?: Record<string, DoneRecord> };
  return v.done && typeof v.done === "object" ? v.done : {};
}

export async function markDone(supabase: SupabaseClient, id: string, by: string, title: string, now = new Date()): Promise<void> {
  const done = await readDone(supabase);
  done[id] = { by, at: now.toISOString(), title: title.slice(0, 200) };
  const oldest = Object.entries(done).sort((a, b) => Date.parse(b[1].at) - Date.parse(a[1].at)).slice(KEEP);
  for (const [k] of oldest) delete done[k];
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
