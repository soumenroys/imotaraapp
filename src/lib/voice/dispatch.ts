// src/lib/voice/dispatch.ts
// Placing due calls, applying results, and catching results that never arrived.
//
// 🔑 ONE PATH FOR THE BUTTON AND THE SCHEDULE. "Run now" in the admin marks
// rows Queued; the cron places queued rows as lines free up, and — only when
// the sheet's Settings say auto_dispatch — picks due contacts by itself too.
// So unattended calling later is a switch in the sheet, not new code.
//
// ⛔ calling_enabled is checked HERE, on every placement path. Off ⇒ nothing
// rings, whatever pressed the button.

import { sendOne, fromAddress, isResendConfigured } from "@/lib/broadcast/resendClient";
import { agentFor } from "@/lib/voice/agents";
import { placeCall, getExecution, readExecution, type ExecutionView } from "@/lib/voice/bolna";
import { readDirectory, writeRow, appendDnc } from "@/lib/voice/sheets";
import {
  ACTIVE_CALL_MINUTES, STATUS, phoneOf, selectDue, userData, writebackFor, normalisePhone,
  type Contact, type Directory, type Selection,
} from "@/lib/voice/rules";

export type DispatchReport = {
  ok: boolean;
  reason?: string;
  placed: { tab: string; name: string; phone: string; executionId: string }[];
  failed: { tab: string; name: string; error: string }[];
  selection?: Selection;
  reconciled: number;
};

const label = (c: Contact) => `${c.v.name}${c.v.organisation ? ` (${c.v.organisation})` : ""}`;

export async function dispatch(opts: { auto: boolean; dryRun?: boolean; now?: Date }): Promise<DispatchReport> {
  const now = opts.now ?? new Date();
  const d = await readDirectory();
  const reconciled = opts.dryRun ? 0 : await reconcile(d, now);
  const selection = selectDue(d, now, { auto: opts.auto && d.settings.autoDispatch });
  const report: DispatchReport = { ok: true, placed: [], failed: [], selection, reconciled };
  if (opts.dryRun) return report;
  if (!d.settings.callingEnabled) {
    return { ...report, ok: false, reason: "Calling is switched off (Settings tab: calling_enabled)." };
  }

  for (const c of selection.toCall) {
    const agent = agentFor(c.v.language, c.v.voice_gender)!;
    const phone = phoneOf(c);
    // ⚠️ Marked BEFORE the dial returns would be ideal; marked right after it,
    // with attempts counted on placement, so a crash later cannot re-dial.
    const placed = await placeCall(agent, phone, userData(c, d, now));
    if (!placed.ok) {
      report.failed.push({ tab: c.tab, name: label(c), error: placed.error });
      await writeRow(c, { next_action: `Dial failed: ${placed.error.slice(0, 120)}` });
      continue;
    }
    await writeRow(c, {
      status: STATUS.calling,
      call_attempts: String((Number(c.v.call_attempts) || 0) + 1),
      last_call_date: now.toISOString(),
      bolna_execution_id: placed.executionId,
    });
    report.placed.push({ tab: c.tab, name: label(c), phone, executionId: placed.executionId });
  }
  return report;
}

/** Mark chosen rows Queued — what "Run now" does. The cron places them. */
export async function queue(rows: { tab: string; row: number }[]): Promise<number> {
  const d = await readDirectory();
  let n = 0;
  for (const r of rows) {
    const c = d.contacts.find((x) => x.tab === r.tab && x.row === r.row);
    if (!c) continue;
    await writeRow(c, { status: STATUS.queued });
    n++;
  }
  return n;
}

function findContact(d: Directory, v: ExecutionView): Contact | undefined {
  if (v.executionId) {
    const byId = d.contacts.find((c) => c.v.bolna_execution_id === v.executionId);
    if (byId) return byId;
  }
  const phone = normalisePhone(v.phone);
  return d.contacts.find((c) => (!v.tab || c.tab === v.tab) && phoneOf(c) === phone && c.v.status === STATUS.calling);
}

/** Apply one finished call to its row. Idempotent: a row no longer "Calling" is left alone. */
export async function applyResult(v: ExecutionView, d?: Directory, now = new Date()): Promise<"applied" | "not_found" | "not_final" | "already"> {
  if (!v.final) return "not_final";
  const dir = d ?? (await readDirectory());
  const c = findContact(dir, v);
  if (!c) return "not_found";
  if (c.v.status !== STATUS.calling) return "already";

  // ⚠️ A non-completed final status (no-answer, busy, failed) has no extraction.
  const extraction = v.status === "completed" ? { ...v.extraction, summary: v.extraction.summary || v.summary } : { outcome: "no_answer" };
  const w = writebackFor(extraction, now, c.v.time_zone || "Asia/Kolkata");
  await writeRow(c, w.cells);
  if (w.addToDnc) await appendDnc(phoneOf(c), c.v.name, "Asked on call not to be called again");
  if (w.safety || w.meeting || w.sendInfo) await alertTeam(dir, c, w, extraction);
  return "applied";
}

async function reconcile(d: Directory, now: Date): Promise<number> {
  let n = 0;
  for (const c of d.contacts) {
    if (c.v.status !== STATUS.calling || !c.v.bolna_execution_id) continue;
    const t = Date.parse(c.v.last_call_date);
    if (!Number.isFinite(t) || now.getTime() - t < ACTIVE_CALL_MINUTES * 60_000) continue;
    const body = await getExecution(c.v.bolna_execution_id);
    const view = body ? readExecution(body) : null;
    if (view?.final) {
      if ((await applyResult({ ...view, executionId: c.v.bolna_execution_id }, d, now)) === "applied") n++;
    } else if (now.getTime() - t > 3 * 3600_000) {
      // ⚠️ Three hours with no answer from Bolna: free the line, retry later.
      await writeRow(c, { status: STATUS.noAnswer, next_action: "No result from the call service; will retry" });
      n++;
    }
  }
  return n;
}

/**
 * 🔴 SAFETY FIRST, AND AT ONCE. A person who expressed distress is never
 * auto-called again; a human must call the same day ⇒ spec §13.
 */
async function alertTeam(d: Directory, c: Contact, w: ReturnType<typeof writebackFor>, x: Record<string, string | undefined>) {
  const subject = w.safety
    ? `🔴 SAFETY — call ${c.v.name} back personally today`
    : w.meeting
      ? `Meeting booked — ${label(c)}${x.meeting_time ? ` · ${x.meeting_time}` : ""}`
      : `Send info — ${label(c)}`;
  const text = [
    w.safety
      ? "During an Imotara call this person said they are not okay. The agent stopped the call, gave a helpline, and offered a call back from a person. Please call them yourself today. They will not be called automatically again."
      : w.meeting
        ? `A meeting was agreed with ${c.v.team_member || "our team"}.`
        : "They asked for details before deciding. Please send them today.",
    "",
    `Name: ${c.v.name}`,
    `Organisation: ${c.v.organisation || "—"}`,
    `Phone: ${phoneOf(c)}`,
    `Language: ${c.v.language}`,
    `Ambassador: ${c.v.team_member || "—"}`,
    "",
    `Summary: ${x.summary || "—"}`,
    `Next action: ${x.next_action || "—"}`,
    "",
    `Sheet tab: ${c.tab}, row ${c.row}`,
  ].join("\n");

  if (!isResendConfigured()) {
    console.error("[voice] alert could not be emailed (email not configured)", { subject });
    return;
  }
  for (const to of d.settings.alertEmails) {
    await sendOne({ from: fromAddress(), to, subject, text, html: `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(text)}</pre>` });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
}
