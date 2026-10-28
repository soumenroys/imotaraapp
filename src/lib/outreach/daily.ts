// src/lib/outreach/daily.ts
// The daily list: for one day, every email and every call the admin's schedule
// puts on it, and where each one stands.
//
// 🔑 OWNER, 28 Oct 2026: "during broadcasting of mails, the daily broadcasted
// list will also generated automatically … during calling to users, the daily
// calling list will also generated automatically". Nobody compiles it — it is
// computed from the sheet with the same rules that send and call, so the list
// cannot say one thing while the system does another.
//
// ⚠️ A DAY IS AN INDIAN DAY (Asia/Kolkata) — the admin's day. Each entry also
// shows the time in the person's own zone.
// ⚠️ PURE ⇒ src/__tests__/outreach/dailyList.test.ts. The sheet keeps only the
// LATEST call and email per person, so for days past, Call records (Bolna) and
// the Broadcast history hold the full log.

import { STATUS, MAX_ATTEMPTS, checkContact, sheetCallDue, localTime, type Contact, type Directory } from "@/lib/voice/rules";
import { callSlot, mailSlot, showSlot, yes } from "@/lib/voice/slots";
import { AUDIENCE_OF, MAIL, SEQUENCE, STEP_LABEL, dueStep, emailOf, mailCheck } from "@/lib/outreach/sequence";
import { sendableDraft, type OutreachState } from "@/lib/outreach/store";

export const ADMIN_ZONE = "Asia/Kolkata";

export type DailyEntry = {
  tab: string;
  row: number;
  name: string;
  organisation: string;
  /** e.g. "Introduction", "Call", "Retry", "Callback". */
  what: string;
  /** ISO instant, for sorting and the admin's own clock. */
  at: string;
  /** "3 Nov, 11:00 (Europe/London)" — the person's time. */
  theirTime: string;
  /** ✅ done · ⏳ scheduled / in queue · 🟡 waiting · ⛔ problem. */
  status: string;
};

export type DailyList = { day: string; mail: DailyEntry[]; calls: DailyEntry[] };

const dayOf = (at: Date | number) => localTime(new Date(at), ADMIN_ZONE)?.date ?? "";
const parse = (s: string) => { const t = Date.parse(s); return Number.isFinite(t) ? t : null; };
const clock = (t: number) => new Date(t).toLocaleTimeString("en-GB", { timeZone: ADMIN_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export function dailyList(
  d: Directory,
  suppressed: ReadonlySet<string>,
  state: OutreachState,
  day: string,
  now: Date,
): DailyList {
  const mail: DailyEntry[] = [];
  const calls: DailyEntry[] = [];
  const base = (c: Contact) => ({ tab: c.tab, row: c.row, name: c.v.name, organisation: c.v.organisation });

  for (const c of d.contacts) {
    // ── Email ────────────────────────────────────────────────────────────────
    if (emailOf(c) && (yes(c.v.contact_by_email) || c.v.mail_status)) {
      const sent = Number(c.v.mail_step) || 0;
      const lastSent = parse(c.v.mail_last_sent);
      const check = mailCheck(c, suppressed, d.dnc);
      const due = dueStep(c, suppressed, now, d.dnc);
      let listedSend = false;
      SEQUENCE.forEach((step, i) => {
        const slot = mailSlot(c, step.afterDays);
        if (slot.kind !== "at" || dayOf(slot.at) !== day) return;
        let status: string;
        if (sent > i) {
          const onTheDay = i === sent - 1 && lastSent !== null && dayOf(lastSent) === day;
          if (onTheDay) listedSend = true;
          status = onTheDay ? `✅ Sent ${clock(lastSent!)} IST` : "✅ Sent";
        } else if (check !== "OK") status = `⛔ ${check}`;
        else if (due === step.id) {
          status = !state.settings.enabled ? "⏸ Due — outreach email is OFF"
            : !sendableDraft(state, AUDIENCE_OF[c.tab], step.id) ? `⏳ Due — “${STEP_LABEL[step.id]}” is waiting for approval`
            : "⏳ Due — goes out in the next run (or tomorrow if today's limit is used)";
        } else if (i > sent) status = "🟡 After the earlier email is sent";
        else status = "⏳ Scheduled";
        mail.push({ ...base(c), what: STEP_LABEL[step.id], at: slot.at.toISOString(), theirTime: showSlot(slot.at, slot.zone), status });
      });
      // The details email a call asked for, and a send that landed on another day than planned.
      if (c.v.mail_status === MAIL.infoDue && day === dayOf(now)) {
        mail.push({ ...base(c), what: STEP_LABEL.info, at: now.toISOString(), theirTime: "", status: check === "OK" ? "⏳ Due — asked for on a call" : `⛔ ${check}` });
      } else if (lastSent !== null && dayOf(lastSent) === day && !listedSend) {
        const what = c.v.mail_status === MAIL.infoSent ? STEP_LABEL.info : sent > 0 ? STEP_LABEL[SEQUENCE[sent - 1].id] : "Email";
        mail.push({ ...base(c), what, at: new Date(lastSent).toISOString(), theirTime: "", status: `✅ Sent ${clock(lastSent)} IST` });
      }
    }

    // ── Calls ────────────────────────────────────────────────────────────────
    const lastCall = parse(c.v.last_call_date);
    let listedCall = false;
    const slot = callSlot(c);
    if (yes(c.v.contact_by_phone) && slot.kind === "at" && dayOf(slot.at) === day) {
      const at = slot.at.getTime();
      const placed = lastCall !== null && lastCall >= at;
      if (placed && dayOf(lastCall!) === day) listedCall = true;
      const check = checkContact(c, d);
      const s = sheetCallDue(c, now);
      const status = placed ? `📞 Called ${clock(lastCall!)} IST — ${c.v.status || "result pending"}`
        : check !== "OK" ? `⛔ ${check}`
        : s === "missed" ? "⛔ Missed — set a new call date"
        : !d.settings.callingEnabled ? "⏸ Calling is OFF"
        : s === "due" ? "⏳ In queue now"
        : "⏳ Scheduled";
      calls.push({ ...base(c), what: "Call", at: slot.at.toISOString(), theirTime: showSlot(slot.at, slot.zone), status });
    }
    // A console Schedule or a callback the person asked for.
    const follow = parse(c.v.follow_up_datetime);
    if (follow !== null && dayOf(follow) === day && [STATUS.scheduled, STATUS.callback].includes(c.v.status as never)) {
      const zone = c.v.call_time_zone || c.v.time_zone || ADMIN_ZONE;
      calls.push({ ...base(c), what: c.v.status === STATUS.callback ? "Callback" : "Call (scheduled in the console)", at: new Date(follow).toISOString(), theirTime: showSlot(new Date(follow), zone), status: "⏳ Scheduled" });
    }
    // Any other call placed that day — a retry, Call now, a callback.
    if (lastCall !== null && dayOf(lastCall) === day && !listedCall) {
      const tries = Number(c.v.call_attempts) || 0;
      calls.push({ ...base(c), what: tries > 1 ? `Retry (try ${tries})` : "Call", at: new Date(lastCall).toISOString(), theirTime: "", status: `📞 Called ${clock(lastCall)} IST — ${c.v.status || "result pending"}` });
    }
    // Today only: an unanswered call the system will try again.
    const tries = Number(c.v.call_attempts) || 0;
    if (day === dayOf(now) && c.v.status === STATUS.noAnswer && tries < MAX_ATTEMPTS && yes(c.v.contact_by_phone) && !(lastCall !== null && dayOf(lastCall) === day)) {
      calls.push({ ...base(c), what: `Retry (try ${tries + 1})`, at: now.toISOString(), theirTime: "", status: d.settings.autoDispatch ? "🟡 Retried automatically, within the retry hours" : "⏸ Automatic retries are OFF" });
    }
  }

  const byTime = (a: DailyEntry, b: DailyEntry) => a.at.localeCompare(b.at);
  return { day, mail: mail.sort(byTime), calls: calls.sort(byTime) };
}

/** Today's date in the admin's zone, e.g. "2026-10-28". */
export const adminToday = (now: Date) => dayOf(now);
