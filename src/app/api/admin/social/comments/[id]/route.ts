// POST /api/admin/social/comments/[id] — approve (send) or reject one drafted reply  🔐 owner
//
// 🔑 Owner, 31 Oct 2026: a genuine comment is answered only after approval.
// ⚠️ An edited reply passes the same house rules before it goes out.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialOwner } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { loadChannelCredential } from "@/lib/social/channelCredentials";
import { pageAccessToken } from "@/lib/social/adapters/facebook";
import { replyToComment } from "@/lib/social/comments/graph";
import { MAX_REPLY_CHARS } from "@/lib/social/comments/draft";
import { checkVoice } from "@/lib/social/voiceGate";
import { isSupportedLanguage } from "@/lib/social/languages";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSocialOwner(req, "answer a comment");
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { action?: string; text?: string };
  const db = getSupabaseAdmin();
  const by = guard.actor.email ?? guard.actor.role;

  const { data: row } = await db.from("social_comments").select("*").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "No such comment." }, { status: 404 });
  if (row.status !== "draft") return NextResponse.json({ error: `Already ${row.status}.` }, { status: 409 });

  if (body.action === "reject") {
    await db.from("social_comments").update({ status: "rejected", decided_by: by, updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ ok: true, note: "Rejected — nothing was sent." });
  }
  if (body.action !== "approve") return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });

  const text = String(body.text ?? row.draft ?? "").trim();
  if (!text) return NextResponse.json({ error: "The reply is empty." }, { status: 400 });
  if (text.length > MAX_REPLY_CHARS) return NextResponse.json({ error: `Keep it under ${MAX_REPLY_CHARS} characters.` }, { status: 400 });
  const lang = isSupportedLanguage(String(row.language ?? "")) ? String(row.language) : "en";
  const gate = checkVoice(text, lang);
  if (!gate.ok) return NextResponse.json({ error: `Not sent — it breaks the house rules: ${gate.findings.map((f) => `"${f.matched}" (${f.because})`).join("; ")}` }, { status: 422 });

  const { data: acc } = await db.from("social_accounts").select("id, external_id").eq("platform", row.platform).maybeSingle();
  if (!acc) return NextResponse.json({ error: `${row.platform} is not connected.` }, { status: 409 });
  const cred = await loadChannelCredential(db, acc.id);
  if (!cred.ok) return NextResponse.json({ error: cred.reason }, { status: 409 });
  let token = cred.token;
  if (row.platform === "facebook") {
    const page = await pageAccessToken({ token: cred.token, pageId: String(acc.external_id) });
    if (!page.ok) return NextResponse.json({ error: page.message }, { status: 502 });
    token = page.token;
  }
  try {
    const replyId = await replyToComment({ platform: row.platform, commentId: row.comment_id }, text, token);
    await db.from("social_comments").update({ status: "sent", draft: text, reply_id: replyId, decided_by: by, updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ ok: true, note: "Sent — the reply is under the comment now." });
  } catch (e) {
    return NextResponse.json({ error: `Not sent: ${(e as Error).message}` }, { status: 502 });
  }
}
