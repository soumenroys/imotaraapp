// src/lib/broadcast/identities.ts
// Who a broadcast is sent as — name and address together, configurable.
//
// Stored in app_settings rather than only in the environment, so changing the
// sender is a thing an owner does in the panel and sees take effect, not a
// redeploy. The environment stays as the fallback for a fresh install, and the
// signed-in admin's own address is offered when it happens to be on the
// verified domain.

import type { SupabaseClient } from "@supabase/supabase-js";
import { type Identity, canSendFrom, envIdentities, parseIdentities } from "./resendClient";

const KEY = "broadcast_identities";

/** What is stored, as opposed to what is offered. */
export async function storedIdentities(
  supabase: SupabaseClient,
): Promise<Identity[]> {
  const { data } = await supabase
    .from("app_settings").select("value").eq("key", KEY).maybeSingle();

  const raw = (data?.value as { identities?: unknown })?.identities;
  if (!Array.isArray(raw)) return [];

  // Re-validated on the way out, not trusted because it was written once. The
  // verified domain can change, and a stored address that is no longer on it
  // must stop being offered rather than fail at send time.
  const out: Identity[] = [];
  for (const r of raw) {
    const email = String((r as Identity)?.email ?? "").trim().toLowerCase();
    const name = String((r as Identity)?.name ?? "").trim().replace(/["\\]/g, "");
    if (canSendFrom(email) && !out.some((i) => i.email === email)) out.push({ name, email });
  }
  return out;
}

/**
 * Everything this admin may send as, most preferred first.
 *
 * Order matters: the first entry is what a new draft uses, so whatever the
 * owner configured comes ahead of the accident of which account is signed in.
 */
export async function availableIdentities(
  supabase: SupabaseClient,
  adminEmail?: string | null,
  adminName?: string | null,
): Promise<Identity[]> {
  const out = await storedIdentities(supabase);
  if (out.length === 0) out.push(...envIdentities());

  const own = (adminEmail ?? "").trim().toLowerCase();
  if (own && canSendFrom(own) && !out.some((i) => i.email === own)) {
    out.push({ name: (adminName ?? "").trim(), email: own });
  }
  return out;
}

/** Replace the stored list. Anything off the verified domain is rejected. */
export async function saveIdentities(
  supabase: SupabaseClient,
  identities: Identity[],
): Promise<{ ok: true; saved: Identity[] } | { ok: false; error: string }> {
  const clean: Identity[] = [];
  for (const i of identities) {
    const email = String(i?.email ?? "").trim().toLowerCase();
    const name = String(i?.name ?? "").trim().replace(/["\\]/g, "").slice(0, 80);
    if (!email) continue;
    if (!canSendFrom(email)) {
      return { ok: false, error: `${email} is not on the verified sending domain` };
    }
    if (!clean.some((c) => c.email === email)) clean.push({ name, email });
  }

  if (clean.length === 0) {
    return { ok: false, error: "Keep at least one address, or nothing can be sent" };
  }

  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: KEY, value: { identities: clean }, updated_at: new Date().toISOString() },
            { onConflict: "key" });

  if (error) return { ok: false, error: error.message };
  return { ok: true, saved: clean };
}

/** The identity a given address corresponds to, for resolving a chosen From. */
export function findIdentity(list: Identity[], email: string): Identity | null {
  const e = email.trim().toLowerCase();
  return list.find((i) => i.email === e) ?? null;
}

export { parseIdentities };
