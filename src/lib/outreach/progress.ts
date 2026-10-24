// src/lib/outreach/progress.ts
// What the admin reads in the sheet: for every person, where calling and email
// stand — done, in queue, waiting, error — and what to do about a problem.
//
// 🔑 THE OWNER'S ASK (24 Oct 2026): "mark what is done, what is not done, what
// is in queue, what faced error and how the error can be resolved", in the
// sheet, so the admin never has to open the console to know.
//
// ⚠️ PURE and computed from the same rules that decide calling and mailing
// (rules.checkContact, sequence.mailCheck/dueStep), so the words in the sheet
// cannot drift from what the system actually does.

import {
  STATUS, MAX_ATTEMPTS, checkContact, missedSchedule, stoppedByAdmin, type Contact, type Directory,
} from "@/lib/voice/rules";
import { MAIL, SEQUENCE, STEP_LABEL, dueStep, emailOf, mailCheck, AUDIENCE_OF } from "@/lib/outreach/sequence";
import { sendableDraft, type OutreachState } from "@/lib/outreach/store";

export type ProgressCells = { call_progress: string; mail_progress: string; what_to_do: string };

const day = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "";
};

/** How to fix each "not callable" reason, in the admin's words. */
const CALL_FIX: [RegExp, string][] = [
  [/country code/i, "Type the phone with country code in column A, e.g. 919830012345."],
  [/Missing name/i, "Type the person's name in column C."],
  [/Sample row/i, "Delete this sample row."],
  [/consent note/i, "Write how they agreed to be contacted in column J (consent_note)."],
  [/Individuals paused/i, "Individuals are paused until TRAI/DLT is settled — the owner switches this on in Voice calls → Settings."],
  [/Language not started/i, "This language is not approved for calls yet — the owner sets it to Start on the Languages tab."],
  [/No agent/i, "No calling voice exists for this language and voice — choose another voice_gender (column X)."],
  [/time zone/i, "Type the time zone in column G, e.g. Asia/Kolkata."],
];

const MAIL_FIX: [RegExp, string][] = [
  [/Email looks wrong|correct the email/i, "Correct the email in column Z — it is retried by itself once fixed."],
  [/consent note/i, "Write how they agreed to be contacted in column J (consent_note)."],
  [/time zone/i, "Type the time zone in column G, e.g. Asia/Kolkata."],
  [/Missing name/i, "Type the person's name in column C."],
];

const fixFor = (reason: string, table: [RegExp, string][]) => table.find(([re]) => re.test(reason))?.[1] ?? "";

export function callProgress(c: Contact, d: Pick<Directory, "languages" | "dnc" | "settings">, now: Date): { text: string; fix: string } {
  const s = c.v.status || STATUS.pending;
  // 🔴 Safety first, even on a stopped row — "call them yourself today" must never be hidden (review, 24 Oct).
  if (s === STATUS.safety) return { text: "🔴 SAFETY — call them yourself today", fix: "A person must call them back today. They are never called automatically again." };
  if (stoppedByAdmin(c)) return { text: "⛔ Stopped by admin", fix: "" };
  const tries = Number(c.v.call_attempts) || 0;
  switch (s) {
    case STATUS.safety: return { text: "🔴 SAFETY — call them yourself today", fix: "A person must call them back today. They are never called automatically again." };
    case STATUS.review: return { text: "⛔ Needs review — no result came back", fix: "Listen to the call in Voice calls → Call records, then decide what to do next." };
    case STATUS.dialFailed: return { text: "⛔ Error — the call could not be placed", fix: `${c.v.next_action || "Dial failed."} Check the phone number (column A), then press Retry in Voice calls → Needs a person.` };
    case STATUS.calling: return { text: "📞 On a call now", fix: "" };
    case STATUS.queued: return { text: "⏳ In queue — next free line", fix: "" };
    case STATUS.scheduled:
      return missedSchedule(c, now)
        ? { text: `⛔ Missed — was scheduled for ${day(c.v.follow_up_datetime)}`, fix: "It could not be placed at that time (calling off, or outside their hours). Schedule it again, or Clear it." }
        : { text: `⏳ Scheduled — ${day(c.v.follow_up_datetime)}`, fix: "" };
    case STATUS.noAnswer:
      return tries >= MAX_ATTEMPTS
        ? { text: `✅ Done — no answer after ${tries} tries`, fix: "" }
        : { text: `🟡 No answer (${tries} of ${MAX_ATTEMPTS}) — retried ${d.settings.autoDispatch ? "automatically" : "only if you call again"}`, fix: "" };
    case STATUS.callback: return { text: `⏳ Callback — ${day(c.v.follow_up_datetime)}`, fix: d.settings.autoDispatch ? "" : "Automatic calling is OFF — call them back yourself from Voice calls." };
    case STATUS.sendInfo: return { text: "✅ Done — asked for details (email follows)", fix: "" };
    case STATUS.interested: return { text: "✅ Done — interested", fix: "Ambassador: follow up personally." };
    case STATUS.meeting: return { text: "✅ Done — meeting booked", fix: "Ambassador: hold the meeting." };
    case STATUS.notInterested: return { text: "✅ Done — not interested (never called again)", fix: "" };
    case STATUS.dnc: return { text: "✅ Done — asked not to be called (never again)", fix: "" };
    case STATUS.wrongNumber: return { text: "⛔ Wrong number", fix: "Correct the phone in column A, then press Retry in Voice calls → Needs a person. (Or type yes in do_not_contact.)" };
  }
  const check = checkContact(c, d);
  if (check !== "OK") return { text: `⛔ Not callable — ${check}`, fix: fixFor(check, CALL_FIX) };
  if (!d.settings.callingEnabled) return { text: "⏸ Not called yet — calling is OFF", fix: "" };
  return { text: d.settings.autoDispatch ? "⏳ In queue — called automatically" : "⏸ Not called yet — press 📞 in Voice calls", fix: "" };
}

export function mailProgress(c: Contact, suppressed: ReadonlySet<string>, state: OutreachState, now: Date): { text: string; fix: string } {
  if (!emailOf(c)) return { text: "— No email", fix: "" };
  const status = c.v.mail_status;
  const sent = Number(c.v.mail_step) || 0;
  if (status === MAIL.done) return { text: `✅ Done — all ${SEQUENCE.length} emails sent (last ${day(c.v.mail_last_sent)})`, fix: "" };
  if (status === MAIL.infoSent) return { text: `✅ Done — details sent ${day(c.v.mail_last_sent)}`, fix: "" };
  if (status === MAIL.unsubscribed) return { text: "✅ Unsubscribed — never emailed again", fix: "" };
  const check = mailCheck(c, suppressed);
  if (check !== "OK") {
    if (/never email/i.test(check)) return { text: "⛔ Unsubscribed or bounced — never emailed again", fix: "" };
    if (/Call outcome/i.test(check)) return { text: `✅ Stopped — ${check.replace("Call outcome: ", "call said ")}`, fix: "" };
    if (/Stopped by admin/i.test(check)) return { text: "⛔ Stopped by admin", fix: "" };
    return { text: `⛔ Not emailed — ${check}`, fix: fixFor(check, MAIL_FIX) };
  }
  const due = dueStep(c, suppressed, now);
  const progress = sent > 0 ? `${sent} of ${SEQUENCE.length} sent (last ${day(c.v.mail_last_sent)})` : status === MAIL.infoDue ? "details email due" : "not started";
  if (!state.settings.enabled) return { text: `⏸ ${progress} — outreach email is OFF`, fix: "" };
  if (due && !sendableDraft(state, AUDIENCE_OF[c.tab], due)) {
    return { text: `⏳ ${progress} — waiting for “${STEP_LABEL[due]}” to be approved`, fix: "Approve it in Outreach mail → Emails." };
  }
  if (due) return { text: `⏳ In queue — ${STEP_LABEL[due]}`, fix: "" };
  return { text: `🟡 ${progress} — next one on its day, in their daytime`, fix: "" };
}

/** The three status cells for one row. */
export function progressFor(
  c: Contact, d: Pick<Directory, "languages" | "dnc" | "settings">, suppressed: ReadonlySet<string>, state: OutreachState, now: Date,
): ProgressCells {
  const call = callProgress(c, d, now);
  const mail = mailProgress(c, suppressed, state, now);
  const fixes = [call.fix && `Call: ${call.fix}`, mail.fix && `Email: ${mail.fix}`].filter(Boolean);
  return { call_progress: call.text, mail_progress: mail.text, what_to_do: fixes.join("  ·  ") || (call.text.startsWith("✅") && !mail.text.startsWith("⏳") ? "Nothing — done." : "Nothing needed now.") };
}
