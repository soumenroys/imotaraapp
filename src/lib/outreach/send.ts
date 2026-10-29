// src/lib/outreach/send.ts
// Turning an approved draft into one person's email, and sending it.
//
// 🔑 THE BROADCAST SENDER, NOT A SECOND ONE. Same Resend client, the same
// rendering (markup), the same signed one-click unsubscribe — so an outreach
// email is held to everything a broadcast is. ⚠️ But it is laid out as a
// plain letter, not the broadcast template ⇒ plainEmailDocument.
//
// ⚠️ Unsubscribe tokens bind an id that the suppression table stores as a
// uuid, so outreach mail carries one fixed id of its own rather than a word.

import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeFields, plainEmailDocument, plainFooterHtml, plainFooterText, renderHtml, renderText } from "@/lib/broadcast/markup";
import { sendOne, type BroadcastMessage, type SendOutcome } from "@/lib/broadcast/resendClient";
import { unsubscribeHeaders, unsubscribeUrl } from "@/lib/broadcast/unsubscribe";
import { availableIdentities } from "@/lib/broadcast/identities";
import type { Draft } from "@/lib/outreach/store";

/** Fallback id for unsubscribes (a test send, which is recorded nowhere); a real send uses its version's broadcast id. */
export const OUTREACH_ID = "0e7e0000-0000-4000-8000-00000000c0de";

export type Recipient = { email: string; name: string; organisation: string };

/** {{organisation}} is outreach's own field; {{name}} / {{email}} are the broadcast composer's. */
function withOrganisation(text: string, organisation: string): string {
  return text.replace(/( ?)\{\{organisation\}\}/g, (_w, lead: string) => (organisation ? `${lead}${organisation}` : ""));
}

export function buildMessage(draft: Pick<Draft, "subject" | "body">, to: Recipient, from: { name: string; email: string }, broadcastId = OUTREACH_ID): BroadcastMessage {
  const fields = { name: to.name, email: to.email };
  const body = withOrganisation(draft.body, to.organisation);
  return {
    from: from.name ? `${from.name} <${from.email}>` : from.email,
    to: to.email,
    subject: mergeFields(withOrganisation(draft.subject, to.organisation), fields, false),
    // 🔑 A plain letter, not the broadcast template ⇒ markup.plainEmailDocument (Promotions, 29 Oct 2026).
    html: plainEmailDocument(mergeFields(renderHtml(body), fields, true), plainFooterHtml(unsubscribeUrl(to.email, broadcastId))),
    text: mergeFields(renderText(body), fields, false) + plainFooterText(unsubscribeUrl(to.email, broadcastId)),
    replyTo: from.email,
    headers: unsubscribeHeaders("broadcast", to.email, broadcastId),
  };
}

/** The sender: the first configured broadcast identity (the owner chose it in Broadcast → identities). */
export async function senderIdentity(supabase: SupabaseClient): Promise<{ name: string; email: string } | null> {
  const ids = await availableIdentities(supabase);
  return ids[0] ?? null;
}

export async function sendOutreach(
  draft: Pick<Draft, "subject" | "body">,
  to: Recipient,
  from: { name: string; email: string },
  broadcastId?: string,
): Promise<SendOutcome> {
  return sendOne(buildMessage(draft, to, from, broadcastId));
}

/** Everyone who must never be emailed: unsubscribed, hard-bounced, complained. */
export async function suppressedEmails(supabase: SupabaseClient): Promise<Set<string>> {
  const out = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("broadcast_suppressions").select("email").range(from, from + 999);
    if (error) throw new Error(`Could not read the do-not-email list: ${error.message}`);
    for (const r of data ?? []) out.add(String(r.email).toLowerCase());
    if (!data || data.length < 1000) break;
  }
  return out;
}
