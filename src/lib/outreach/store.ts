// src/lib/outreach/store.ts
// The outreach mailer's switches and its approved drafts, kept in app_settings.
//
// 🔑 ONE ROW, NO NEW TABLE. Twenty drafts (5 audiences × 4 emails) and three
// switches are small and change rarely; app_settings already holds the
// broadcast sender identities the same way. A new table would need a migration
// run by hand on the live database first ⇒ trap_a_migration_file_is_not_the_database.
//
// ⛔ DEFAULTS ARE SAFE: mailing OFF, "send without asking" OFF. A missing or
// broken row means nothing is sent.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Audience, StepId } from "@/lib/outreach/sequence";

const KEY = "outreach_mail";

export type DraftStatus = "needs_review" | "approved";

export type Draft = {
  subject: string;
  /** Broadcast composer markup, with {{name|there}}, {{organisation}} and {{signature}}. */
  body: string;
  status: DraftStatus;
  writtenAt: string;
  writtenBy: string;
  approvedAt?: string;
  approvedBy?: string;
  /** What the word and house-style checks said when it was written or edited. */
  findings: string[];
  /** The broadcasts row recording THIS version — set when it is approved or first sent ⇒ outreach/record. */
  broadcastId?: string;
};

export type OutreachSettings = {
  /** ⛔ The master switch. Nothing is emailed while it is off. */
  enabled: boolean;
  /** Owner's choice 24 Oct: review first; this lets a newly written draft count as approved when it passes every check. */
  sendWithoutAsking: boolean;
  /** At most this many outreach emails a day, whatever the broadcast warm-up would allow. */
  dailyCap: number;
};

export const DEFAULT_SETTINGS: OutreachSettings = { enabled: false, sendWithoutAsking: false, dailyCap: 20 };

export type OutreachState = { settings: OutreachSettings; drafts: Record<string, Draft> };

export const draftKey = (a: Audience, s: StepId) => `${a}:${s}`;

export async function readOutreach(supabase: SupabaseClient): Promise<OutreachState> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", KEY).maybeSingle();
  const v = (data?.value ?? {}) as Partial<OutreachState>;
  const s = (v.settings ?? {}) as Partial<OutreachSettings>;
  return {
    settings: {
      enabled: s.enabled === true,
      sendWithoutAsking: s.sendWithoutAsking === true,
      dailyCap: Number.isInteger(s.dailyCap) && s.dailyCap! >= 1 && s.dailyCap! <= 500 ? s.dailyCap! : DEFAULT_SETTINGS.dailyCap,
    },
    drafts: v.drafts && typeof v.drafts === "object" ? (v.drafts as Record<string, Draft>) : {},
  };
}

export async function writeOutreach(supabase: SupabaseClient, state: OutreachState): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: KEY, value: state, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`Could not save the outreach settings: ${error.message}`);
}

/** Read, change, write — the one way anything here is changed. */
export async function updateOutreach(
  supabase: SupabaseClient,
  change: (s: OutreachState) => void,
): Promise<OutreachState> {
  const state = await readOutreach(supabase);
  change(state);
  await writeOutreach(supabase, state);
  return state;
}

/**
 * The text a step may be sent with, or null.
 * ⛔ An approved draft — or, only with "send without asking" on, a draft that
 * passed every check. A draft with findings is never sent by itself.
 */
export function sendableDraft(state: OutreachState, a: Audience, s: StepId): Draft | null {
  const d = state.drafts[draftKey(a, s)];
  if (!d) return null;
  if (d.status === "approved") return d;
  return state.settings.sendWithoutAsking && d.findings.length === 0 ? d : null;
}
