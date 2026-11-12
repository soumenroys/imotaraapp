// src/lib/history/claimGuestHistory.ts — #135 (owner chose A, 12 Nov 2026): when someone signs in,
// the chats they typed as a guest IN THIS BROWSER join their account, so they follow them to any device.
//
// 🔑 WHY: a guest's history is saved on our server under the browser's own random id
// (lib/imotara/userScope.ts). Signing in — Google or email, same path — started a separate history
// under the account and nothing joined the two; "Back up now" even said "up to date". Found in the
// #134 live test (12 Nov): the guest message sat under "2ibehxfyli5-…", the account had 0 rows.
//
// ⛔ Only the id this browser itself holds is ever moved — the signed-in person sends it, and could
//    already read it with that id. Never a Link Key (shared between devices), never an account id.
// Moves: imotara_history (id = "<scope>:<record>", record.id the same) and imotara_chat_messages
// (user_scope). Idempotent — a second run finds nothing left to move.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A browser's own guest id may be moved; an account id (uuid) or anything odd may not. Pure — tested. */
export function isClaimableScope(scope: unknown): scope is string {
  if (typeof scope !== "string") return false;
  const s = scope.trim();
  if (s.length < 8 || s.length > 80) return false;
  if (!/^[a-zA-Z0-9._-]+$/.test(s)) return false; // exactly what the history routes store
  if (UUID.test(s)) return false;                   // an account's own scope — never claimable
  return true;
}

/** "<from>:<rest>" ⇒ "<to>:<rest>", or null when the id is not under <from>. Pure — tested. */
export function rekeyId(id: string, from: string, to: string): string | null {
  const p = `${from}:`;
  return id.startsWith(p) ? `${to}:${id.slice(p.length)}` : null;
}

function likePrefix(scope: string): string {
  return scope.replace(/[\\%_]/g, (m) => `\\${m}`) + ":%"; // "_" is a LIKE wildcard
}

type HistRow = { id: string; created_at_ms: number; updated_at_ms: number; deleted: boolean; record: Record<string, unknown> | null };

export async function claimGuestHistory(admin: SupabaseClient, deviceScope: string, userId: string): Promise<{ history: number; messages: number }> {
  let history = 0;
  for (let round = 0; round < 50; round++) {
    const { data, error } = await admin
      .from("imotara_history")
      .select("id, created_at_ms, updated_at_ms, deleted, record")
      .like("id", likePrefix(deviceScope))
      .limit(500);
    if (error) throw new Error(`history read: ${error.message}`);
    const rows = ((data ?? []) as HistRow[]).filter((r) => r.id.startsWith(`${deviceScope}:`));
    if (rows.length === 0) break;

    const moved = rows.map((r) => {
      const id = rekeyId(r.id, deviceScope, userId)!;
      return { ...r, id, record: r.record && typeof r.record === "object" ? { ...r.record, id } : r.record };
    });
    // Never overwrite something the account already has under the same record id.
    const { data: existing } = await admin.from("imotara_history").select("id").in("id", moved.map((m) => m.id));
    const taken = new Set(((existing ?? []) as { id: string }[]).map((e) => e.id));
    const fresh = moved.filter((m) => !taken.has(m.id));
    if (fresh.length) {
      const { error: insErr } = await admin.from("imotara_history").upsert(fresh, { onConflict: "id" });
      if (insErr) throw new Error(`history write: ${insErr.message}`);
    }
    const { error: delErr } = await admin.from("imotara_history").delete().in("id", rows.map((r) => r.id));
    if (delErr) throw new Error(`history tidy: ${delErr.message}`);
    history += fresh.length;
    if (rows.length < 500) break;
  }

  const { data: msgs, error: mErr } = await admin
    .from("imotara_chat_messages")
    .update({ user_scope: userId })
    .eq("user_scope", deviceScope)
    .select("id");
  if (mErr) throw new Error(`messages: ${mErr.message}`);

  return { history, messages: (msgs ?? []).length };
}
