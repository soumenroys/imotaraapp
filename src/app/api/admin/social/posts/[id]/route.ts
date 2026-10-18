// PATCH /api/admin/social/posts/[id] — approve, edit, skip, or send it back
//
// 🔑 APPROVING IS THE WHOLE POINT OF THE QUEUE, so it is an admin action, not an
// owner one: reading a draft and saying yes is exactly the human step the
// design wants to be cheap. ⛔ What stays owner-only is letting a schedule
// publish with nobody reading it at all.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialAdmin } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { checkVoice, checkHouseStyle } from "@/lib/social/voiceGate";
import { publishingSentence } from "@/lib/social/platforms";
import { loadOverlay } from "@/lib/social/store";

type Body = { action?: string; subject?: string; body?: string };

const APPROVABLE = ["needs_review"];

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;

  let input: Body;
  try {
    input = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "the request body was not JSON" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { data: post, error: readError } = await db
    .from("social_posts")
    .select("id, status, language, platform, subject, body, gate_result")
    .eq("id", id)
    .single();

  if (readError || !post) return NextResponse.json({ error: "no such post" }, { status: 404 });

  const now = new Date().toISOString();

  switch (input.action) {
    case "approve": {
      if (!APPROVABLE.includes(post.status as string)) {
        return NextResponse.json(
          { error: `This post is ${post.status}, so there is nothing to approve.` },
          { status: 409 },
        );
      }
      /**
       * ⛔ RE-GATED AT APPROVAL, against the text as it stands now.
       *
       * ⚠️ Not paranoia about the reviewer: the words may have been edited
       * since the gate last saw them, and an edit is the one way a claim can
       * enter a post that was clean when it was written. An approval that
       * trusted the stored verdict would be checking the wrong text.
       */
      const overlay = await loadOverlay();
      const gate = checkVoice(`${post.subject}\n${post.body}`, post.language as string, overlay);
      if (!gate.ok) {
        return NextResponse.json(
          {
            error:
              `The gate objects to the text as it stands: ` +
              gate.findings.map((f) => `“${f.matched}” — ${f.because}`).join("; "),
            findings: gate.findings,
          },
          { status: 409 },
        );
      }

      const { data, error } = await db
        .from("social_posts")
        .update({ status: "approved", reviewed_by: guard.actor.id, reviewed_at: now, updated_at: now })
        .eq("id", id)
        // ⚠️ Conditional on the status we read, so two reviewers pressing
        // approve at once cannot both succeed.
        .eq("status", "needs_review")
        .select("id, status")
        .single();

      if (error || !data) {
        return NextResponse.json({ error: "Somebody else changed this post first." }, { status: 409 });
      }
      /**
       * ⚠️ NOT "it will publish at its slot". The banner directly above this
       * message says nothing publishes yet, and for a while this said the
       * opposite three lines below it — the exact contradiction that teaches
       * somebody to stop reading either one.
       */
      return NextResponse.json({
        post: data,
        // ⚠️ Derived ⇒ publishingSentence. The comment three lines above warns
        // about this message contradicting the screen; hard-coding the state
        // of the world is how that happened in the first place.
        note: `Approved. ${publishingSentence()}`,
      });
    }

    case "edit": {
      const subject = input.subject?.trim() ?? (post.subject as string);
      const body = input.body?.trim() ?? "";
      if (!body) return NextResponse.json({ error: "The post cannot be empty." }, { status: 400 });

      const overlay = await loadOverlay();
      const gate = checkVoice(`${subject}\n${body}`, post.language as string, overlay);
      if (!gate.ok) {
        return NextResponse.json(
          {
            error:
              `The gate objects: ` + gate.findings.map((f) => `“${f.matched}” — ${f.because}`).join("; "),
            findings: gate.findings,
          },
          { status: 400 },
        );
      }
      const houseStyle = checkHouseStyle(body, post.platform as string);

      // 🔑 An edited post goes back to needs_review even if it was approved.
      // Approval attaches to words, not to a row.
      const stored = (post.gate_result ?? {}) as Record<string, unknown>;
      const { data, error } = await db
        .from("social_posts")
        .update({
          subject,
          body,
          status: "needs_review",
          reviewed_by: null,
          reviewed_at: null,
          gate_result: {
            ...stored,
            listsRun: gate.listsRun,
            listsUnavailable: gate.listsUnavailable,
            findings: gate.findings,
            houseStyle: houseStyle.problems,
            editedBy: guard.actor.email,
            editedAt: now,
          },
          updated_at: now,
        })
        .eq("id", id)
        .select("id, status, subject, body")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({
        post: data,
        houseStyle: houseStyle.problems,
        note: "Saved, and back in the queue — approval belongs to the words, not to the row.",
      });
    }

    case "skip": {
      const { data, error } = await db
        .from("social_posts")
        .update({ status: "skipped", reviewed_by: guard.actor.id, reviewed_at: now, updated_at: now })
        .eq("id", id)
        .select("id, status")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ post: data, note: "Skipped. The subject stays claimed, so it will not come round again." });
    }

    case "unapprove": {
      const { data, error } = await db
        .from("social_posts")
        .update({ status: "needs_review", reviewed_by: null, reviewed_at: null, updated_at: now })
        .eq("id", id)
        .in("status", ["approved"])
        .select("id, status")
        .single();
      if (error || !data) {
        return NextResponse.json({ error: "It is no longer waiting to publish." }, { status: 409 });
      }
      return NextResponse.json({ post: data });
    }

    default:
      return NextResponse.json(
        { error: "action must be approve, edit, skip or unapprove" },
        { status: 400 },
      );
  }
}
