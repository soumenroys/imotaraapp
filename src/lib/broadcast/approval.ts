// src/lib/broadcast/approval.ts
// A broadcast must be APPROVED before it can be sent or scheduled — and the
// approval belongs to the words, not the row.
//
// 🔑 OWNER, 24 Oct 2026: "add an admin approval just like social media
// scheduler before we broadcast the mail content and then push into
// scheduler". On social a draft waits for a person, and editing it puts it
// back in the queue. Same here: the approval stores a fingerprint of exactly
// what will be sent (subject, body, header, list, sender, type); change any of
// it and the approval no longer matches, so it must be approved again.
//
// ⚠️ KEPT IN app_settings, NOT A NEW COLUMN. A column would need a migration
// run by hand on the live database first ⇒ trap_a_migration_file_is_not_the_database.

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const KEY = "broadcast_approvals";

export type Approval = { approvedBy: string; approvedAt: string; hash: string };
export type ApprovalState = "approved" | "changed" | "none";

export type ApprovableContent = {
  subject: string | null; body_html: string | null; body_text: string | null;
  header_text?: string | null; list_id: string | null; from_email: string | null; message_type: string | null;
};

/** Everything that decides what a recipient receives, fingerprinted. */
export function contentHash(b: ApprovableContent): string {
  const parts = [b.subject, b.body_html, b.body_text, b.header_text ?? "", b.list_id, b.from_email, b.message_type].map((x) => x ?? "");
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

export async function readApprovals(supabase: SupabaseClient): Promise<Record<string, Approval>> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", KEY).maybeSingle();
  const v = (data?.value ?? {}) as { approvals?: Record<string, Approval> };
  return v.approvals && typeof v.approvals === "object" ? v.approvals : {};
}

async function writeApprovals(supabase: SupabaseClient, approvals: Record<string, Approval>): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: KEY, value: { approvals }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`Could not save the approval: ${error.message}`);
}

export function approvalState(approvals: Record<string, Approval>, id: string, b: ApprovableContent): ApprovalState {
  const a = approvals[id];
  if (!a) return "none";
  return a.hash === contentHash(b) ? "approved" : "changed";
}

export async function approve(supabase: SupabaseClient, id: string, b: ApprovableContent, by: string): Promise<Approval> {
  const approvals = await readApprovals(supabase);
  const a: Approval = { approvedBy: by, approvedAt: new Date().toISOString(), hash: contentHash(b) };
  approvals[id] = a;
  await writeApprovals(supabase, approvals);
  return a;
}

export async function withdraw(supabase: SupabaseClient, id: string): Promise<void> {
  const approvals = await readApprovals(supabase);
  if (!approvals[id]) return;
  delete approvals[id];
  await writeApprovals(supabase, approvals);
}

/** The blocker a send/preview shows, or null when the content is approved as it stands. */
export function approvalBlocker(state: ApprovalState): string | null {
  if (state === "approved") return null;
  if (state === "changed") return "The content changed after it was approved — approve it again before sending";
  return "Not approved yet — read the content below and press Approve before it can be sent or scheduled";
}
