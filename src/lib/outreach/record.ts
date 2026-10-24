// src/lib/outreach/record.ts
// Outreach emails, recorded in the broadcast tables like any broadcast.
//
// 🔑 OWNER, 24 Oct 2026: "update sending status, recipient list, templates,
// request pages information properly for all broadcasted mails". So every
// outreach email is on the Broadcast screens too:
//   · each APPROVED VERSION of a draft is one `broadcasts` row (status 'sent',
//     so the broadcast sender never tries to drain it), prefixed "Outreach · "
//     in history;
//   · each person mailed is in a recipient list per audience ("Outreach — NGOs")
//     with honest provenance from the sheet (source + consent note);
//   · each email is a `broadcast_sends` row carrying its Resend id — which is
//     what lets the delivery webhook mark it delivered / bounced / complained,
//     and what makes the warm-up budget count it.
//
// ⛔ Recording never blocks sending: a send that went out but could not be
// recorded is logged, not retried — a retry would email the person twice.

import type { SupabaseClient } from "@supabase/supabase-js";
import { renderHtml, renderText } from "@/lib/broadcast/markup";
import { AUDIENCE_LABEL, STEP_LABEL, type Audience, type StepId } from "@/lib/outreach/sequence";
import type { Contact } from "@/lib/voice/rules";

export const OUTREACH_PREFIX = "Outreach · ";

/** Every outreach recipient list is named with this — it is not a newsletter list. */
export const OUTREACH_LIST_PREFIX = "Outreach — ";
export const listNameFor = (a: Audience) => `${OUTREACH_LIST_PREFIX}${AUDIENCE_LABEL[a]}`;

/** The broadcast_recipients.source enum, read from what the team typed. Unknown ⇒ meeting; the exact words go in source_detail. */
export function sourceFor(raw: string): string {
  const s = raw.toLowerCase();
  if (/whatsapp/.test(s)) return "whatsapp";
  if (/web|form|site/.test(s)) return "website_form";
  if (/facebook|instagram|linkedin|twitter|social|\bx\b/.test(s)) return "social";
  if (/e-?mail/.test(s)) return "email";
  if (/app/.test(s)) return "app_signup";
  if (/phone|call/.test(s)) return "phone";
  if (/event|seminar|demo|conference|workshop|fair|session|webinar/.test(s)) return "event";
  return "meeting";
}

export async function ensureList(supabase: SupabaseClient, a: Audience): Promise<string> {
  const name = listNameFor(a);
  const find = async () => (await supabase.from("broadcast_lists").select("id").ilike("name", name).maybeSingle()).data?.id as string | undefined;
  const existing = await find();
  if (existing) return existing;
  const { data, error } = await supabase.from("broadcast_lists").insert({ name }).select("id").single();
  if (data?.id) return data.id as string;
  // Two runs at once: the unique name index refused the second insert.
  const again = await find();
  if (again) return again;
  throw new Error(`Could not create the list ${name}: ${error?.message ?? "unknown"}`);
}

/** One broadcasts row for one approved version of a draft. */
export async function createVersion(
  supabase: SupabaseClient,
  args: { audience: Audience; step: StepId; subject: string; body: string; from: { name: string; email: string } },
): Promise<string> {
  const listId = await ensureList(supabase, args.audience);
  const { data, error } = await supabase
    .from("broadcasts")
    .insert({
      subject: `${OUTREACH_PREFIX}${AUDIENCE_LABEL[args.audience]} · ${STEP_LABEL[args.step]} — ${args.subject}`,
      body_html: renderHtml(args.body),
      body_text: renderText(args.body),
      body_source: args.body,
      message_type: "broadcast",
      list_id: listId,
      // ⚠️ 'sent', never 'sending': the broadcast cron drains 'sending' rows and would mark this finished on its own.
      status: "sent",
      from_email: args.from.email.toLowerCase(),
      from_name: args.from.name || null,
      reply_to: args.from.email.toLowerCase(),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not record the email version: ${error?.message ?? "unknown"}`);
  return data.id as string;
}

/** After a successful send: the person on the audience's list, the send on the version, the version's times. */
export async function recordSend(
  supabase: SupabaseClient,
  args: { broadcastId: string; audience: Audience; contact: Contact; email: string; resendId: string; now: Date },
): Promise<boolean> {
  const now = args.now.toISOString();
  try {
    const listId = await ensureList(supabase, args.audience);
    const c = args.contact.v;
    await supabase.from("broadcast_recipients").upsert(
      {
        list_id: listId,
        email: args.email,
        name: c.name || null,
        source: sourceFor(`${c.source} ${c.consent_note}`),
        source_detail: `${c.consent_note}${c.source ? ` (source: ${c.source})` : ""} — Call Directory sheet, ${args.contact.tab} row ${args.contact.row}`.slice(0, 500),
        collected_at: now.slice(0, 10),
      },
      { onConflict: "list_id,email", ignoreDuplicates: true },
    );
    await supabase.from("broadcast_sends").upsert(
      { broadcast_id: args.broadcastId, email: args.email, status: "sent", resend_id: args.resendId, queued_at: now, sent_at: now },
      { onConflict: "broadcast_id,email", ignoreDuplicates: true },
    );
    const { data: b } = await supabase.from("broadcasts").select("started_at").eq("id", args.broadcastId).maybeSingle();
    await supabase.from("broadcasts").update({ started_at: b?.started_at ?? now, finished_at: now }).eq("id", args.broadcastId);
    return true;
  } catch (e) {
    console.error("[outreach/record] sent but not recorded", { email: args.email, error: (e as Error).message });
    return false;
  }
}

/**
 * 🔴 WHO HAS ALREADY HAD WHAT — from the broadcast tables, not the sheet.
 * The sheet was the only record of a send; if writing to it failed (quota, a
 * timeout, a row moved), the next run mailed the same person again, every ten
 * minutes (review, 24 Oct). ⇒ The send row in broadcast_sends is the truth:
 * email → the outreach emails ("ngos:intro" …) it has received.
 */
export async function outreachHistory(supabase: SupabaseClient, emails: string[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (emails.length === 0) return out;
  const { data: versions, error } = await supabase.from("broadcasts").select("id, subject").ilike("subject", `${OUTREACH_PREFIX}%`);
  if (error) throw new Error(`Could not read outreach history: ${error.message}`);
  const keyOf = new Map<string, string>();
  for (const v of versions ?? []) {
    for (const [a, label] of Object.entries(AUDIENCE_LABEL)) for (const [st, sl] of Object.entries(STEP_LABEL)) {
      if ((v.subject as string).startsWith(`${OUTREACH_PREFIX}${label} · ${sl} —`)) keyOf.set(v.id as string, `${a}:${st}`);
    }
  }
  if (keyOf.size === 0) return out;
  for (let i = 0; i < emails.length; i += 200) {
    const { data: sends, error: e2 } = await supabase.from("broadcast_sends").select("broadcast_id, email")
      .in("broadcast_id", [...keyOf.keys()]).in("email", emails.slice(i, i + 200));
    if (e2) throw new Error(`Could not read outreach history: ${e2.message}`);
    for (const r of sends ?? []) {
      const k = keyOf.get(r.broadcast_id as string);
      if (k) out.set(r.email as string, (out.get(r.email as string) ?? new Set()).add(k));
    }
  }
  return out;
}
