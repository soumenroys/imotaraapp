// src/lib/admin/todoSources.ts
// Where each kind of waiting work is read from ⇒ lib/admin/todo.ts.
//
// ⚠️ Every source reads the SAME state its own screen reads, so the To do page
// and the screen it links to can never disagree about whether something waits.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TodoItem, TodoSource } from "@/lib/admin/todo";
import { readDirectory, sheetLink, sheetsConfigured, tabGids } from "@/lib/voice/sheets";
import { STATUS, checkContact, missedSchedule, phoneOf } from "@/lib/voice/rules";
import { AUDIENCES, AUDIENCE_LABEL, AUDIENCE_OF, STEPS, STEP_LABEL, emailOf, mailCheck } from "@/lib/outreach/sequence";
import { draftKey, readOutreach } from "@/lib/outreach/store";
import { approvalState, readApprovals } from "@/lib/broadcast/approval";
import { availableIdentities } from "@/lib/broadcast/identities";
import { isResendConfigured } from "@/lib/broadcast/resendClient";
import { isUnsubscribeConfigured } from "@/lib/broadcast/unsubscribe";
import { readAuto } from "@/lib/broadcast/autoBroadcast";
import { OUTREACH_LIST_PREFIX } from "@/lib/outreach/record";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * ⚠️ The id carries the call's own time: a NEW event for the same person comes
 * back even after an old one was marked done. Shared with the Voice calls page,
 * so "Handled" there and "Mark done" here are the same record.
 */
export function voiceTodoId(c: { tab: string; v: Record<string, string> }, kind: string): string {
  return `voice:${kind}:${c.tab}:${phoneOf(c as never)}:${c.v.last_call_date || c.v.follow_up_datetime}`;
}

/** Status ⇒ the kind of To do item it raises (only the ones a person marks done). */
export const MANUAL_KIND: Record<string, string> = {
  [STATUS.safety]: "safety", [STATUS.review]: "review", [STATUS.meeting]: "meeting", [STATUS.interested]: "interested",
  [STATUS.sendInfo]: "sendinfo",
};

/** Calls: the "Needs a person" list, as the Voice calls screen shows it. */
export function voiceSource(): TodoSource {
  return {
    area: "Calls",
    roles: "admins",
    read: async () => {
      if (!sheetsConfigured()) return [];
      const [d, gids] = await Promise.all([readDirectory(), tabGids().catch(() => null)]);
      const now = new Date();
      const out: TodoItem[] = [];
      for (const c of d.contacts) {
        const who = `${c.v.name || phoneOf(c)}${c.v.organisation ? ` (${c.v.organisation})` : ""}`;
        const id = (kind: string) => voiceTodoId(c, kind);
        const base = { area: "Calls", href: "/admin/voice", sheet: sheetLink(gids, c.tab, c.row) };
        switch (c.v.status) {
          case STATUS.safety:
            out.push({ ...base, id: id("safety"), urgency: "now", manual: true, title: `🔴 Call ${who} back yourself — today`, detail: "They said on a call that they are not okay. They are never called automatically again.", action: "Mark done once you have called" });
            break;
          case STATUS.review:
            out.push({ ...base, id: id("review"), urgency: "today", manual: true, title: `Listen to the call with ${who}`, detail: c.v.next_action || "The call completed but no outcome came back.", href: "/admin/voice", action: "Mark done once reviewed" });
            break;
          case STATUS.dialFailed:
            out.push({ ...base, id: id("dialfailed"), urgency: "today", title: `The call to ${who} could not be placed`, detail: c.v.next_action, action: "Check the number, then Retry" });
            break;
          case STATUS.meeting:
            out.push({ ...base, id: id("meeting"), urgency: "today", manual: true, title: `Meeting booked with ${who}`, detail: `${c.v.team_member ? `${c.v.team_member}: ` : ""}hold the meeting${c.v.follow_up_datetime ? ` (${c.v.follow_up_datetime})` : ""}.`, action: "Mark done once held" });
            break;
          case STATUS.sendInfo:
            // With an email, the outreach mailer sends the details by itself; without one, a person must.
            if (!(c.v.email ?? "").trim()) out.push({ ...base, id: id("sendinfo"), urgency: "today", manual: true, title: `Send ${who} the details they asked for`, detail: "They asked on a call. There is no email in the sheet, so this is by hand (or add their email).", action: "Mark done once sent" });
            break;
          case STATUS.wrongNumber:
            out.push({ ...base, id: id("wrongnumber"), urgency: "soon", title: `Wrong number for ${who}`, detail: "Correct the phone in the sheet (column A), then press Retry — or type yes in do_not_contact.", action: "Open Needs a person" });
            break;
          case STATUS.interested:
            out.push({ ...base, id: id("interested"), urgency: "soon", manual: true, title: `${who} is interested — follow up personally`, detail: c.v.call_summary, action: "Mark done once followed up" });
            break;
        }
        if (missedSchedule(c, now)) {
          out.push({ ...base, id: id("missed"), urgency: "soon", title: `A scheduled call to ${who} was missed`, detail: "It could not be placed at its time (calling off, or outside their hours).", action: "Schedule it again or clear it" });
        }
      }
      return out;
    },
  };
}

/** Outreach mail: drafts waiting for approval; switched on with nothing approved. */
export function outreachSource(supabase: SupabaseClient): TodoSource {
  return {
    area: "Outreach mail",
    roles: "admins",
    read: async () => {
      const s = await readOutreach(supabase);
      const out: TodoItem[] = [];
      // 🔑 ONE line per audience: every email is now written ahead (owner, 25 Oct), and
      //    twenty separate lines would bury everything else on the page.
      for (const a of AUDIENCES) {
        const waiting = STEPS.map((st) => ({ st, d: s.drafts[draftKey(a, st)] })).filter((x) => x.d?.status === "needs_review");
        if (waiting.length === 0) continue;
        const toFix = waiting.filter((x) => x.d!.findings.length > 0).length;
        out.push({
          id: `outreach:${a}:${waiting.map((x) => `${x.st}@${x.d!.writtenAt}`).join(",")}`, area: "Outreach mail", urgency: "soon",
          title: waiting.length === 1 ? `Approve the ${AUDIENCE_LABEL[a]} “${STEP_LABEL[waiting[0].st]}” email` : `Approve the ${AUDIENCE_LABEL[a]} emails — ${waiting.length} waiting`,
          detail: `${waiting.map((x) => STEP_LABEL[x.st]).join(", ")}${toFix ? ` · ${plural(toFix, "email")} with checks to fix first` : ""}`,
          href: `/admin/outreach?audience=${a}&step=${waiting[0].st}`, action: "Read and approve",
        });
      }
      const approved = Object.values(s.drafts).filter((d) => d.status === "approved").length;
      if (s.settings.enabled && approved === 0) {
        out.push({ id: "outreach:on-but-nothing-approved", area: "Outreach mail", urgency: "today", title: "Outreach email is ON but no email is approved", detail: "Nothing can go out until at least one is approved.", href: "/admin/outreach", action: "Approve an email" });
      }
      return out;
    },
  };
}

/** Broadcast mail (owner): drafts waiting for approval, runs paused by an error. */
export function broadcastSource(supabase: SupabaseClient): TodoSource {
  return {
    area: "Broadcast mail",
    roles: "owner",
    read: async () => {
      const { data: rows, error } = await supabase
        .from("broadcasts")
        .select("id, subject, status, body_html, body_text, header_text, list_id, from_email, message_type, updated_at")
        .in("status", ["draft", "paused"])
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      const approvals = await readApprovals(supabase);
      // 🔑 The monthly newsletter's drafts say so, with their send time ⇒ autoBroadcast.ts.
      const auto = await readAuto(supabase).catch(() => null);
      const sendAtOf = new Map<string, string>();
      const findingsOf = new Map<string, string[]>();
      for (const r of Object.values(auto?.runs ?? {})) for (const id of r.broadcastIds) { sendAtOf.set(id, r.sendAt); if (r.findings?.length) findingsOf.set(id, r.findings); }
      const out: TodoItem[] = [];
      for (const b of rows ?? []) {
        if (b.status === "paused") {
          out.push({ id: `broadcast:paused:${b.id}`, area: "Broadcast mail", urgency: "now", title: `A broadcast stopped part-way: “${b.subject}”`, detail: "Sending hit an error and paused. Open it to read why, then resume.", href: `/admin?section=broadcast&status=${b.id}`, action: "Open and resume" });
        } else if (approvalState(approvals, b.id as string, b) !== "approved") {
          const due = sendAtOf.get(b.id as string);
          const late = due ? Date.parse(due) < Date.now() : false;
          const findings = findingsOf.get(b.id as string);
          const when = due ? new Date(due).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "";
          out.push({
            id: `broadcast:approve:${b.id}:${b.updated_at}`, area: "Broadcast mail",
            urgency: late ? "now" : due && Date.parse(due) - Date.now() < 2 * 86_400_000 ? "today" : "soon",
            title: due ? `Approve this month's newsletter: “${b.subject}”` : `Approve or discard: “${b.subject || "(no subject)"}”`,
            detail: due
              ? `${findings ? `Its checks found ${plural(findings.length, "problem")} — edit them out before approving. ` : ""}${late ? `It was due on ${when} IST — approve it and it goes out within the hour.` : `It goes out by itself on ${when} IST once approved.`}`
              : !b.list_id ? "No recipient list attached — attach one in the draft, or discard it if it is not needed." : "A draft waiting for approval.",
            href: `/admin?section=broadcast&review=${b.id}`, action: "Read and approve",
          });
        }
      }
      return out;
    },
  };
}

/** Requests from the website's updates form, confirmed by the person and not yet handled (owner). */
export function requestsSource(supabase: SupabaseClient): TodoSource {
  return {
    area: "Requests",
    roles: "owner",
    read: async () => {
      const { data, error } = await supabase
        .from("broadcast_interest_submissions")
        .select("id, email, created_at, confirmed_at")
        .eq("status", "new")
        .not("confirmed_at", "is", null)
        .limit(50);
      if (error) throw new Error(error.message);
      const n = data?.length ?? 0;
      return n === 0 ? [] : [{ id: "requests:new", area: "Requests", urgency: "soon", title: `${plural(n, "person", "people")} asked for updates`, detail: "Confirmed their email on imotara.com. Add them to a list, or ignore.", href: "/admin?section=broadcast&view=requests", action: "Open Requests" }];
    },
  };
}

/** Blog comments waiting for moderation (every admin, reviewers included). */
export function commentsSource(supabase: SupabaseClient): TodoSource {
  return {
    area: "Comments",
    roles: "all",
    read: async () => {
      const { count, error } = await supabase.from("blog_comments").select("id", { count: "exact", head: true }).eq("approved", false);
      if (error) throw new Error(error.message);
      const n = count ?? 0;
      return n === 0 ? [] : [{ id: "comments:pending", area: "Comments", urgency: "soon", title: `${plural(n, "comment")} waiting for moderation`, href: "/admin?section=comments", action: "Approve or remove" }];
    },
  };
}

/** Connect: companion applications (everyone who reviews Connect); payouts and refunds (owner/admin). */
export function connectSource(supabase: SupabaseClient): TodoSource {
  return {
    area: "Connect",
    roles: "all",
    read: async () => {
      const { data, error } = await supabase.from("connect_consultants").select("id, display_name, created_at").eq("status", "pending").order("created_at").limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        id: `connect:application:${r.id}`, area: "Connect", urgency: "today" as const,
        title: `Review the companion application from ${r.display_name || "a new applicant"}`,
        detail: `Applied ${new Date(r.created_at as string).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.`,
        href: "/admin?section=connect", action: "Approve or reject",
      }));
    },
  };
}

export function connectMoneySource(supabase: SupabaseClient): TodoSource {
  return {
    area: "Connect money",
    roles: "admins",
    read: async () => {
      const out: TodoItem[] = [];
      const { count: payouts, error: pErr } = await supabase.from("connect_payouts").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]);
      if (pErr) throw new Error(pErr.message);
      if (payouts) out.push({ id: "connect:payouts", area: "Connect money", urgency: "today", title: `${plural(payouts, "companion payout")} to complete`, href: "/admin?section=connect&tab=payouts", action: "Open payouts" });
      const { count: refunds, error: rErr } = await supabase.from("imotara_wallet_refund_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]);
      if (rErr) throw new Error(rErr.message);
      // ⚠️ No admin screen for refunds exists yet — said, rather than linking somewhere that cannot act on it.
      if (refunds) out.push({ id: "connect:refunds", area: "Connect money", urgency: "today", title: `${plural(refunds, "wallet refund request")} waiting`, detail: "There is no admin screen for refunds yet — ask for one to be added.", href: "/admin?section=connect", action: "See Connect" });
      return out;
    },
  };
}

/** Organisations that signed up or paid and wait to be activated. */
export function organisationsSource(supabase: SupabaseClient): TodoSource {
  return {
    area: "Organisations",
    roles: "admins",
    read: async () => {
      const { data, error } = await supabase.from("organizations").select("id, name, slug, created_at").eq("status", "pending").limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []).map((o) => ({
        id: `org:pending:${o.id}`, area: "Organisations", urgency: "today" as const,
        title: `Activate or decline ${o.name || o.slug}`, detail: "Waiting since it signed up.",
        href: "/admin?section=organizations", action: "Open organisations",
      }));
    },
  };
}

/** Social: drafts waiting (soonest first), posts that failed, channels that stopped working. */
export function socialSource(supabase: SupabaseClient): TodoSource {
  return {
    area: "Social",
    roles: "admins",
    read: async () => {
      const out: TodoItem[] = [];
      const now = Date.now();
      const { data: drafts, error: dErr } = await supabase.from("social_posts").select("id, platform, scheduled_for").eq("status", "needs_review").order("scheduled_for").limit(200);
      if (dErr) throw new Error(dErr.message);
      const soon = (drafts ?? []).filter((p) => Date.parse(p.scheduled_for as string) - now < 24 * 3600_000);
      if (soon.length) out.push({ id: `social:drafts-soon:${soon.map((p) => p.id).join(",")}`, area: "Social", urgency: "today", title: `${plural(soon.length, "post")} due within a day still need approval`, detail: [...new Set(soon.map((p) => p.platform))].join(", "), href: "/admin/social?view=queue", action: "Read and approve" });
      const later = (drafts?.length ?? 0) - soon.length;
      if (later > 0) out.push({ id: "social:drafts-later", area: "Social", urgency: "soon", title: `${plural(later, "draft")} waiting for approval`, detail: "Written up to ten days ahead.", href: "/admin/social", action: "Read and approve" });
      const { data: failed, error: fErr } = await supabase.from("social_posts").select("id, platform, subject, last_error").eq("status", "failed").limit(20);
      if (fErr) throw new Error(fErr.message);
      for (const p of failed ?? []) out.push({ id: `social:failed:${p.id}`, area: "Social", urgency: "today", title: `A ${p.platform} post failed to publish`, detail: `${p.subject ? `“${p.subject}” — ` : ""}${(p.last_error as string)?.slice(0, 160) ?? ""}`, href: `/admin/social?view=trouble&open=${p.id}`, action: "Read why, retry or skip" });
      const { data: ch, error: cErr } = await supabase.from("social_accounts").select("id, platform, display_name, status, last_error").in("status", ["dead", "expiring"]);
      if (cErr) throw new Error(cErr.message);
      for (const a of ch ?? []) out.push({ id: `social:channel:${a.id}:${a.status}`, area: "Social", urgency: a.status === "dead" ? "now" : "today", title: a.status === "dead" ? `${a.display_name || a.platform} stopped posting — reconnect it` : `${a.display_name || a.platform}'s token expires soon`, detail: (a.last_error as string)?.slice(0, 160), href: "/admin/social/channels", action: "Open Channels" });
      return out;
    },
  };
}

/** Scheduled jobs that are late or have never run — every automatic thing depends on them. */
export function cronSource(supabase: SupabaseClient, declared: { path: string; schedule: string }[]): TodoSource {
  return {
    area: "System",
    roles: "admins",
    read: async () => {
      const { judgeJobs } = await import("@/lib/cron/heartbeat");
      const { data, error } = await supabase.from("cron_heartbeats").select("job, last_fired_at, fire_count, last_note");
      if (error) throw new Error(error.message);
      return judgeJobs(declared, data ?? [])
        .filter((j) => j.state === "late" || j.state === "never")
        .map((j) => ({
          id: `cron:${j.job}:${j.state}`, area: "System", urgency: "today" as const,
          title: `A scheduled job is ${j.state === "never" ? "not running" : "late"}: ${j.job}`,
          detail: j.description ?? undefined, href: "/admin?section=stats", action: "See job health",
        }));
    },
  };
}

// ── Set up, in order ─────────────────────────────────────────────────────────
//
// 🔑 Owner, 24 Oct 2026: the admin fills the sheet once and sets the schedules
// once; after that everything runs by itself. These are those steps, NUMBERED,
// each read from the real state — a step is ticked because the thing is true,
// never because somebody pressed a button. All steps are always shown (done ones
// with ✓) so the sequence and the progress are visible at a glance.


const step = (n: number, done: boolean, title: string, detail: string, href: string, action: string, area = "Set up"): TodoItem =>
  ({ id: `setup:${n}`, area, urgency: "setup", step: n, done, title, detail, href, action });

/** Steps 1–7: mail, the sheet, social, outreach, calling. */
const INTENDED = /^(Call ended|On do-not-call|Stopped by admin|EXCLUDED|Individuals paused|Language not started)/;

/**
 * ⛔ One step failing to check must not hide the others (review, 24 Oct: one
 * error blanked the whole checklist). A failed check shows as NOT done, saying why.
 */
async function checked(n: number, title: string, href: string, action: string, read: () => Promise<TodoItem[]>): Promise<TodoItem[]> {
  try { return await read(); } catch (e) { return [step(n, false, title, `Could not check this: ${(e as Error).message}`, href, action)]; }
}

export function setupSource(supabase: SupabaseClient): TodoSource {
  return {
    area: "Set up",
    roles: "admins",
    read: async () => {
      const out: TodoItem[] = [];
      out.push(...await checked(1, "Mail can be sent", "/admin?section=broadcast&view=health", "Check sending", async () => {
        const from = (await availableIdentities(supabase))[0];
        const mailOk = Boolean(from) && isResendConfigured() && isUnsubscribeConfigured();
        return [step(1, mailOk, "Mail can be sent", mailOk ? `From ${from!.email}.` : "Set a sender in Broadcast mail → Sending status (and the mail keys).", "/admin?section=broadcast&view=health", "Check sending")];
      }));

      let d: Awaited<ReturnType<typeof readDirectory>> | null = null;
      const gids = sheetsConfigured() ? await tabGids().catch(() => null) : null;
      let contacts: Awaited<ReturnType<typeof readDirectory>>["contacts"] = [];
      out.push(...await checked(2, "Add your contacts to the Call Directory sheet", "/admin/voice", "Open the sheet", async () => {
        d = sheetsConfigured() ? await readDirectory() : null;
        contacts = (d?.contacts ?? []).filter((c) => !/^sample\b/i.test(c.v.name));
        const items = [step(2, contacts.length > 0, "Add your contacts to the Call Directory sheet",
          contacts.length ? `${plural(contacts.length, "contact")} in the sheet.` : "The sheet is empty. Fill the white columns: phone, name, organisation, language, time zone, consent note — and email for outreach mail.",
          "/admin/voice", "Open the sheet")];
        items[0].sheet = sheetLink(gids, contacts.length ? contacts[0].tab : "Start here");
        if (d) {
          const dir = d;
          // ⚠️ Only rows somebody must FIX. A row that is meant not to be called (ended, do-not-call,
          //    stopped, excluded, a paused tab or language) is not a mistake (review, 24 Oct).
          const broken = contacts.filter((c) => { const v = checkContact(c, dir); return v !== "OK" && !INTENDED.test(v); });
          items.push(step(3, contacts.length > 0 && broken.length === 0, "Fix the rows the sheet marks ⛔",
            contacts.length === 0 ? "Add contacts first." : broken.length ? `${plural(broken.length, "row")} cannot be contacted yet — the sheet's what_to_do column says what to fix on each.` : "Every row is complete.",
            "/admin/voice?tab=contacts", "See the rows"));
          if (broken.length) items[items.length - 1].sheet = sheetLink(gids, broken[0].tab, broken[0].row);
        }
        return items;
      }));

      out.push(...await checked(4, "Social: a channel connected and a schedule running", "/admin/social/channels", "Open Social", async () => {
        const { data: schedules, error: sErr } = await supabase.from("social_schedules").select("id").eq("active", true);
        const { data: channels, error: cErr } = await supabase.from("social_accounts").select("id").in("status", ["ok", "expiring"]);
        if (sErr || cErr) throw new Error((sErr ?? cErr)!.message);
        const socialOk = (schedules?.length ?? 0) > 0 && (channels?.length ?? 0) > 0;
        return [step(4, socialOk, "Social: a channel connected and a schedule running",
          socialOk ? `${plural(channels!.length, "channel")} working, ${plural(schedules!.length, "schedule")} running.` : "Connect a channel and create a schedule.",
          socialOk ? "/admin/social/schedules" : "/admin/social/channels", "Open Social")];
      }));

      out.push(...await checked(5, "Approve the outreach emails for your contacts", "/admin/outreach", "Read and approve", async () => {
        const o = await readOutreach(supabase);
        const dir = d as Awaited<ReturnType<typeof readDirectory>> | null;
        const emailable = contacts.filter((c) => emailOf(c) && mailCheck(c, new Set<string>(), dir?.dnc) === "OK");
        const needed = [...new Set(emailable.map((c) => AUDIENCE_OF[c.tab]))].flatMap((a) => (["intro", "followup", "last"] as const).map((st) => draftKey(a, st)));
        const missing = needed.filter((k) => o.drafts[k]?.status !== "approved");
        return [step(5, emailable.length > 0 && missing.length === 0, "Approve the outreach emails for your contacts",
          emailable.length === 0 ? "No contact with an email and a consent note yet." : missing.length ? `${plural(missing.length, "email")} still to approve (introduction, day 7, day 21 for each audience in your sheet).` : "All approved.",
          missing.length ? `/admin/outreach?audience=${missing[0].split(":")[0]}&step=${missing[0].split(":")[1]}` : "/admin/outreach", "Read and approve")];
      }));
      out.push(...await checked(6, "Switch Outreach email ON", "/admin/outreach?tab=settings", "Open Settings", async () => {
        const o = await readOutreach(supabase);
        return [step(6, o.settings.enabled, "Switch Outreach email ON", o.settings.enabled ? `ON — at most ${o.settings.dailyCap} a day.` : "Safe at any time — nothing is sent until an email is approved.", "/admin/outreach?tab=settings", "Open Settings")];
      }));

      const dir = d as Awaited<ReturnType<typeof readDirectory>> | null;
      const callOn = Boolean(dir?.settings.callingEnabled && dir?.settings.autoDispatch);
      out.push(step(7, callOn, "Switch Calling and Automatic calling ON",
        callOn ? "Calls go out by themselves at the date and time set in the sheet (09:00–21:00 their time)." : `Calling is ${dir?.settings.callingEnabled ? "ON" : "OFF"}, automatic is ${dir?.settings.autoDispatch ? "ON" : "OFF"}.`,
        "/admin/voice?tab=settings", "Open Voice calls → Settings"));
      return out;
    },
  };
}

/** Steps 8–9 (owner): a newsletter list, and the monthly newsletter switched on. */
export function setupBroadcastSource(supabase: SupabaseClient): TodoSource {
  return {
    area: "Set up",
    roles: "owner",
    read: async () => {
      const { data: lists, error } = await supabase.from("broadcast_lists").select("id, name, broadcast_recipients(count)");
      if (error) throw new Error(error.message);
      const count = (l: { broadcast_recipients?: unknown }) => Number((l.broadcast_recipients as { count?: number }[] | undefined)?.[0]?.count ?? 0);
      const usable = (lists ?? []).filter((l) => !(l.name as string).startsWith(OUTREACH_LIST_PREFIX) && count(l) > 0);
      const auto = await readAuto(supabase);
      return [
        step(8, usable.length > 0, "Have a recipient list for the newsletter",
          usable.length ? `${usable.map((l) => `${l.name} (${count(l)})`).join(", ")}.` : "No list with people on it. Make one under Recipient lists, or add people who asked for updates (Requests).",
          "/admin?section=broadcast&view=lists", "Open Recipient lists", "Set up"),
        step(9, auto.settings.enabled && auto.settings.listIds.length > 0, "Switch the monthly newsletter ON",
          auto.settings.enabled ? "ON — it waits on this page for your approval each month." : "Choose the day, the hour and the list.",
          "/admin?section=broadcast&view=auto", "Open Automatic", "Set up"),
      ];
    },
  };
}
