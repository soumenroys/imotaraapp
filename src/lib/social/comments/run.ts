// src/lib/social/comments/run.ts
// Every 15 minutes: new comments under our Facebook and Instagram posts ⇒
//   team    left alone
//   spam    HIDDEN (never deleted)
//   crisis  the fixed worldwide crisis reply, at once, + an email to social@
//   genuine a reply DRAFT for the owner to approve in the admin
// One row per comment ever (social_comments), so nothing is done twice.
//
// ⛔ "Stop everything" (social_settings.posting_paused) stops this too.
// ⛔ A genuine comment is never answered without approval (owner, 31 Oct 2026).

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadChannelCredential } from "@/lib/social/channelCredentials";
import { pageAccessToken } from "@/lib/social/adapters/facebook";
import { sendOne, isResendConfigured, fromAddress } from "@/lib/broadcast/resendClient";
import { CRISIS_REPLY, classifyComment, type CommentKind } from "@/lib/social/comments/classify";
import { facebookComments, hideComment, instagramComments, replyToComment, type RawComment } from "@/lib/social/comments/graph";
import { draftReply, type Draft } from "@/lib/social/comments/draft";

/** Drafts written per IST day, at most — each is a model call. */
export const MAX_DRAFTS_PER_DAY = 20;
/** Older than this, a comment is not answered: a reply weeks late reads as neglect, not care. Spam is hidden at any age. */
export const REPLY_WINDOW_DAYS = 14;

export type Deps = {
  hide: (c: RawComment, token: string) => Promise<void>;
  reply: (c: RawComment, message: string, token: string) => Promise<string>;
  draft: (c: RawComment) => Promise<Draft>;
  alert: (subject: string, lines: string[]) => Promise<void>;
};

export type Planned = { c: RawComment; kind: CommentKind; action: "skip" | "hide" | "crisis_reply" | "draft" | "too_old" };

/** What to do with each NEW comment. ⚠️ PURE ⇒ tests. */
export function plan(fresh: RawComment[], now: Date): Planned[] {
  const cutoff = now.getTime() - REPLY_WINDOW_DAYS * 86_400_000;
  return fresh.map((c) => {
    const kind = classifyComment(c);
    const recent = !c.at || Date.parse(c.at) >= cutoff;
    if (kind === "team") return { c, kind, action: "skip" };
    if (kind === "spam") return { c, kind, action: "hide" };
    if (!recent) return { c, kind, action: "too_old" };
    return { c, kind, action: kind === "crisis" ? "crisis_reply" : "draft" };
  });
}

const istDay = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);

export async function runCommentReplies(db: SupabaseClient, deps: Deps = realDeps, now = new Date()) {
  const { data: settings } = await db.from("social_settings").select("posting_paused").eq("id", 1).maybeSingle();
  if (settings?.posting_paused) return { skipped: "Stop everything is on" };

  const { data: accounts } = await db.from("social_accounts").select("id, platform, external_id, status").in("platform", ["facebook", "instagram"]);
  const tokens: Partial<Record<"facebook" | "instagram", string>> = {};
  const found: RawComment[] = [];
  const errors: string[] = [];

  for (const a of accounts ?? []) {
    const cred = await loadChannelCredential(db, a.id);
    if (!cred.ok) { errors.push(`${a.platform}: ${cred.reason}`); continue; }
    try {
      if (a.platform === "facebook") {
        const page = await pageAccessToken({ token: cred.token, pageId: String(a.external_id) });
        if (!page.ok) { errors.push(`facebook: ${page.message}`); continue; }
        tokens.facebook = page.token;
        found.push(...(await facebookComments(String(a.external_id), page.token)));
      } else {
        tokens.instagram = cred.token;
        found.push(...(await instagramComments(String(a.external_id), cred.token)));
      }
    } catch (e) {
      errors.push(`${a.platform}: ${(e as Error).message}`);
    }
  }
  if (!found.length) return { found: 0, errors };

  // Only comments never seen before.
  const { data: seen, error: seenErr } = await db.from("social_comments").select("platform, comment_id").in("comment_id", found.map((c) => c.commentId));
  if (seenErr) throw new Error(`social_comments not readable (${seenErr.message}) — has docs/sql/social_comments.sql been run?`);
  const known = new Set((seen ?? []).map((r) => `${r.platform}:${r.comment_id}`));
  const fresh = found.filter((c) => c.commentId && !known.has(`${c.platform}:${c.commentId}`));

  const { count: draftedToday } = await db.from("social_comments").select("id", { count: "exact", head: true })
    .eq("status", "draft").gte("created_at", `${istDay(now)}T00:00:00+05:30`);
  let budget = MAX_DRAFTS_PER_DAY - (draftedToday ?? 0);

  const tally: Record<string, number> = {};
  const crisisLines: string[] = [];
  let newDrafts = 0;

  for (const p of plan(fresh, now)) {
    const token = tokens[p.c.platform]!;
    const row: Record<string, unknown> = {
      platform: p.c.platform, comment_id: p.c.commentId, post_id: p.c.postId, post_snippet: p.c.postSnippet,
      author: p.c.author, text: p.c.text, commented_at: p.c.at, kind: p.kind,
    };
    try {
      if (p.action === "skip") row.status = "skipped";
      else if (p.action === "too_old") { row.status = "skipped"; row.note = `older than ${REPLY_WINDOW_DAYS} days when first seen`; }
      else if (p.action === "hide") { await deps.hide(p.c, token); row.status = "hidden"; }
      else if (p.action === "crisis_reply") {
        row.reply_id = await deps.reply(p.c, CRISIS_REPLY, token);
        row.status = "crisis_replied";
        row.draft = CRISIS_REPLY;
        crisisLines.push(`• ${p.c.platform} — ${p.c.author ?? "(name hidden)"}: "${p.c.text.slice(0, 200)}"  (post: ${p.c.postSnippet.slice(0, 50)})`);
      } else {
        if (budget <= 0) continue; // ⚠️ Left unrecorded, so tomorrow's run drafts it.
        const d = await deps.draft(p.c);
        budget--;
        newDrafts++;
        Object.assign(row, { status: "draft", draft: d.reply, language: d.language, note: d.note });
      }
    } catch (e) {
      Object.assign(row, { status: "failed", note: (e as Error).message.slice(0, 500) });
    }
    const { error } = await db.from("social_comments").insert(row);
    if (error && !/duplicate key/.test(error.message)) errors.push(`store: ${error.message}`);
    tally[String(row.status)] = (tally[String(row.status)] ?? 0) + 1;
  }

  // 🔴 A crisis comment reaches a person the same quarter-hour.
  if (crisisLines.length) {
    await deps.alert(`🔴 Crisis words in a comment — answered with the crisis line, please look today`, [
      "A comment under our post used crisis words. Imotara replied publicly with the local emergency number and findahelpline.com.",
      "Please look at it today, and reply personally if it seems right:", "", ...crisisLines, "",
      "https://www.imotara.com/admin/social/comments",
    ]).catch((e) => errors.push(`alert: ${(e as Error).message}`));
  }
  if (newDrafts) {
    await deps.alert(`${newDrafts} comment repl${newDrafts === 1 ? "y waits" : "ies wait"} for your approval`, [
      "New comments under our posts have a reply drafted. Nothing is sent until you approve it:",
      "https://www.imotara.com/admin/social/comments",
    ]).catch((e) => errors.push(`alert: ${(e as Error).message}`));
  }
  return { found: found.length, fresh: fresh.length, tally, errors };
}

async function mail(subject: string, lines: string[]) {
  if (!isResendConfigured()) throw new Error("email is not configured");
  const text = lines.join("\n");
  const out = await sendOne({
    from: fromAddress(),
    to: "social@imotara.com",
    subject,
    html: `<pre style="font:14px/1.6 ui-monospace,monospace;white-space:pre-wrap">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`,
    text,
  });
  if (!out.ok) throw new Error(`${out.code}: ${out.message}`);
}

const realDeps: Deps = {
  hide: (c, token) => hideComment(c, token),
  reply: (c, message, token) => replyToComment(c, message, token),
  draft: (c) => draftReply(c),
  alert: mail,
};
