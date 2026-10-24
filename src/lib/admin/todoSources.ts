// src/lib/admin/todoSources.ts
// Where each kind of waiting work is read from ⇒ lib/admin/todo.ts.
//
// ⚠️ Every source reads the SAME state its own screen reads, so the To do page
// and the screen it links to can never disagree about whether something waits.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TodoItem, TodoSource } from "@/lib/admin/todo";
import { readDirectory, sheetsConfigured } from "@/lib/voice/sheets";
import { STATUS, missedSchedule, phoneOf } from "@/lib/voice/rules";
import { AUDIENCES, AUDIENCE_LABEL, STEPS, STEP_LABEL } from "@/lib/outreach/sequence";
import { draftKey, readOutreach } from "@/lib/outreach/store";
import { approvalState, readApprovals } from "@/lib/broadcast/approval";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Calls: the "Needs a person" list, as the Voice calls screen shows it. */
export function voiceSource(): TodoSource {
  return {
    area: "Calls",
    roles: "admins",
    read: async () => {
      if (!sheetsConfigured()) return [];
      const d = await readDirectory();
      const now = new Date();
      const out: TodoItem[] = [];
      for (const c of d.contacts) {
        const who = `${c.v.name || phoneOf(c)}${c.v.organisation ? ` (${c.v.organisation})` : ""}`;
        // ⚠️ The id carries the call's own time: a NEW event for the same person comes back even after an old one was marked done.
        const id = (kind: string) => `voice:${kind}:${c.tab}:${phoneOf(c)}:${c.v.last_call_date || c.v.follow_up_datetime}`;
        const base = { area: "Calls", href: "/admin/voice" };
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
          case STATUS.interested:
            out.push({ ...base, id: id("interested"), urgency: "soon", manual: true, title: `${who} is interested — follow up personally`, detail: c.v.call_summary, action: "Mark done once followed up" });
            break;
        }
        if (missedSchedule(c, now)) {
          out.push({ ...base, id: id("missed"), urgency: "soon", title: `A scheduled call to ${who} was missed`, detail: "Its time passed while calling was off.", action: "Schedule it again or clear it" });
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
      for (const a of AUDIENCES) for (const st of STEPS) {
        const d = s.drafts[draftKey(a, st)];
        if (d?.status === "needs_review") {
          out.push({ id: `outreach:${draftKey(a, st)}:${d.writtenAt}`, area: "Outreach mail", urgency: "soon", title: `Approve the ${AUDIENCE_LABEL[a]} “${STEP_LABEL[st]}” email`, detail: `“${d.subject}”${d.findings.length ? ` — ${plural(d.findings.length, "check")} to fix first` : ""}`, href: "/admin/outreach", action: "Read and approve" });
        }
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
      const out: TodoItem[] = [];
      for (const b of rows ?? []) {
        if (b.status === "paused") {
          out.push({ id: `broadcast:paused:${b.id}`, area: "Broadcast mail", urgency: "now", title: `A broadcast stopped part-way: “${b.subject}”`, detail: "Sending hit an error and paused. Open it to read why, then resume.", href: "/admin?section=broadcast", action: "Open and resume" });
        } else if (approvalState(approvals, b.id as string, b) !== "approved") {
          out.push({ id: `broadcast:approve:${b.id}:${b.updated_at}`, area: "Broadcast mail", urgency: "soon", title: `Approve or discard: “${b.subject || "(no subject)"}”`, detail: "A draft waiting for approval.", href: "/admin?section=broadcast", action: "Read and approve" });
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
      return n === 0 ? [] : [{ id: "requests:new", area: "Requests", urgency: "soon", title: `${plural(n, "person", "people")} asked for updates`, detail: "Confirmed their email on imotara.com. Add them to a list, or ignore.", href: "/admin?section=broadcast", action: "Open Requests" }];
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
      if (payouts) out.push({ id: "connect:payouts", area: "Connect money", urgency: "today", title: `${plural(payouts, "companion payout")} to complete`, href: "/admin?section=connect", action: "Open payouts" });
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
      if (soon.length) out.push({ id: `social:drafts-soon:${soon.map((p) => p.id).join(",")}`, area: "Social", urgency: "today", title: `${plural(soon.length, "post")} due within a day still need approval`, detail: [...new Set(soon.map((p) => p.platform))].join(", "), href: "/admin/social", action: "Read and approve" });
      const later = (drafts?.length ?? 0) - soon.length;
      if (later > 0) out.push({ id: "social:drafts-later", area: "Social", urgency: "soon", title: `${plural(later, "draft")} waiting for approval`, detail: "Written up to ten days ahead.", href: "/admin/social", action: "Read and approve" });
      const { data: failed, error: fErr } = await supabase.from("social_posts").select("id, platform, subject, last_error").eq("status", "failed").limit(20);
      if (fErr) throw new Error(fErr.message);
      for (const p of failed ?? []) out.push({ id: `social:failed:${p.id}`, area: "Social", urgency: "today", title: `A ${p.platform} post failed to publish`, detail: `${p.subject ? `“${p.subject}” — ` : ""}${(p.last_error as string)?.slice(0, 160) ?? ""}`, href: "/admin/social", action: "Read why, retry or skip" });
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
