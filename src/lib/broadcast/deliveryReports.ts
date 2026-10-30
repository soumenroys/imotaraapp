// src/lib/broadcast/deliveryReports.ts
// Delivery reports that arrive early, and the ones that never arrived.
//
// 🔴 MEASURED 30 Oct 2026: 71 sends sat at "sent" for good. Resend itself said
// 52 of them were DELIVERED and 5 BOUNCED. The queue hands a batch to Resend
// and only then writes each row's resend_id, one at a time; Gmail confirms
// delivery in a second or two, so the report reached the webhook before its
// row existed — and the webhook answered 200, so Resend never sent it again.
// Our bounce count was too low and the delivery numbers wrong.
//
// Two halves: an early report is sent BACK (non-2xx ⇒ Resend retries a few
// seconds later, when the row is there), and a report lost anyway is fetched
// from Resend by the queue job (reconcileSent).

/** An unmatched report younger than this is "too early" and asked to come back. Older ⇒ really not ours. */
export const EARLY_REPORT_MINUTES = 10;

/**
 * Should an email.* event that matched no row be retried? Only a young one:
 * mail sent outside the broadcast table (sign-in, wallet) never matches, and
 * must not be bounced back for days.
 */
export function retryUnmatched(createdAt: string | undefined, now: Date): boolean {
  const t = Date.parse(createdAt ?? "");
  if (!Number.isFinite(t)) return false;
  return now.getTime() - t < EARLY_REPORT_MINUTES * 60_000;
}

/** Resend's `last_event` for one email ⇒ what our row should say, or null to leave it. */
export function statusFromLastEvent(lastEvent: string | null | undefined): "delivered" | "bounced" | "complained" | null {
  switch (lastEvent) {
    case "delivered":
    case "opened":
    case "clicked":
      return "delivered";
    case "bounced":
    // Resend refused to send: the address is on ITS suppression list, which only a hard bounce or a complaint puts it on.
    case "suppressed":
      return "bounced";
    case "complained":
      return "complained";
    default:
      return null; // sent, queued, delivery_delayed, unknown — not settled yet
  }
}

/** Sends still at "sent" after this long are asked about. */
export const RECONCILE_AFTER_HOURS = 2;
/** Resend keeps an email's record for a limited time; older rows are left alone. */
export const RECONCILE_WITHIN_DAYS = 14;

type Db = ReturnType<typeof import("@/lib/supabaseServer").getSupabaseAdmin>;

/**
 * 🔑 THE LOST ONES, FETCHED. A few sends still at "sent" after
 * RECONCILE_AFTER_HOURS are looked up at Resend and corrected. Called by the
 * queue job every minute, a few rows at a time — Resend allows ~2 requests a
 * second. ⚠️ Never throws: a failure here must not stop a broadcast going out.
 */
export async function reconcileSent(db: Db, limit = 3, now = new Date(), apiKey = process.env.RESEND_API_KEY?.trim() ?? ""): Promise<number> {
  if (!apiKey) return 0;
  try {
    const { data } = await db
      .from("broadcast_sends")
      .select("id, email, resend_id")
      .eq("status", "sent")
      .not("resend_id", "is", null)
      // ⚠️ One Resend never settles is marked below and not asked again — or it would be first in line every minute, for ever.
      .is("error", null)
      .lt("sent_at", new Date(now.getTime() - RECONCILE_AFTER_HOURS * 3600_000).toISOString())
      .gt("sent_at", new Date(now.getTime() - RECONCILE_WITHIN_DAYS * 86400_000).toISOString())
      .order("sent_at", { ascending: true })
      .limit(limit);
    let fixed = 0;
    for (const row of data ?? []) {
      const res = await fetch(`https://api.resend.com/emails/${encodeURIComponent(row.resend_id as string)}`, {
        headers: { authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      });
      const lastEvent = res.ok ? ((await res.json()) as { last_event?: string }).last_event : undefined;
      const status = statusFromLastEvent(lastEvent);
      if (!status) {
        await db.from("broadcast_sends").update({ error: `reconcile: no final report from Resend (${lastEvent ?? res.status}) on ${now.toISOString().slice(0, 10)}` }).eq("id", row.id).eq("status", "sent");
        continue;
      }
      await db
        .from("broadcast_sends")
        .update(status === "delivered" ? { status, delivered_at: now.toISOString() } : { status, error: "reported by Resend on reconcile" })
        .eq("id", row.id)
        .eq("status", "sent");
      fixed++;
    }
    return fixed;
  } catch (e) {
    console.warn("[broadcast] reconcileSent failed:", e instanceof Error ? e.message : String(e));
    return 0;
  }
}
