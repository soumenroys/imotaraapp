// src/lib/imotara/seedLicense.ts
// LIC-4: Seed a free-tier license row for a user on first sign-in.
// Uses INSERT ... ON CONFLICT DO NOTHING so repeated calls are safe no-ops.

import type { SupabaseClient } from "@supabase/supabase-js";

export async function seedLicenseIfAbsent(
  userId: string,
  admin: SupabaseClient
): Promise<void> {
  const graceDays =
    parseInt(process.env.NEXT_PUBLIC_IMOTARA_FREE_DAYS ?? "90", 10) || 90;
  const expires_at = new Date(
    Date.now() + graceDays * 24 * 60 * 60 * 1000
  ).toISOString();

  await admin.from("licenses").upsert(
    {
      user_id: userId,
      tier: "free",
      status: "trial",
      expires_at,
      source: "internal",
      notes: "launch-offer",
    },
    { onConflict: "user_id", ignoreDuplicates: true }
  );
}
