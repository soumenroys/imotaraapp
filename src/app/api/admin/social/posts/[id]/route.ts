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
import { ensureCard } from "@/lib/social/ensureCard";
import { dropCards } from "@/lib/social/cardStore";
import { publishingSentence } from "@/lib/social/platforms";
import { loadOverlay } from "@/lib/social/store";

type Body = { action?: string; subject?: string; body?: string; scheduledFor?: string | null };

const APPROVABLE = ["needs_review"];

/**
 * ⚠️ APPROVING NOW DOES REAL WORK. For a short video it renders five frames,
 * asks Azure to speak each sentence and runs ffmpeg ⇒ ensureCard — seconds,
 * not milliseconds. The default limit is for a route that writes a row.
 *
 * ⛔ Deliberately on the APPROVAL, where a person is waiting and watching,
 * rather than on the request Meta makes ⇒ docs/sql/social_card_store.sql.
 */
export const maxDuration = 120;

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

      /**
       * 🔴 THE CARD IS DRAWN BEFORE THE ROW IS APPROVED, NOT AFTER.
       *
       * For a script Satori cannot shape, the picture has to come from a
       * browser and be stored ⇒ ensureCard. ⛔ If that fails, the post must
       * NOT become approved: on Instagram there is no text-only post, so an
       * approved post with no card is one the publisher holds on every run
       * forever, and the only symptom is a channel going quiet
       * ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
       *
       * ⚠️ Costs nothing on the normal path: a Latin post returns "derived"
       * without starting anything.
       */
      const card = await ensureCard(id);
      if (!card.ok) {
        return NextResponse.json(
          {
            error: card.error,
            hint:
              "⛔ The post was NOT approved. A post that cannot produce a picture would be held by " +
              "the publisher on every run, and the channel would simply go quiet.",
          },
          { status: 422 },
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

      /**
       * 🔑 An edited post goes back to needs_review even if it was approved.
       * Approval attaches to words, not to a row.
       *
       * ⛔ AND ITS STORED PICTURES ARE THROWN AWAY. A stored card is a
       * picture of the OLD words; leaving it would mean the reviewer approves
       * new words and the old card publishes — and the card route prefers
       * stored bytes, so it would win ⇒ cardStore.dropCards.
       */
      await dropCards(id);
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

    /**
     * 🔴 THERE WAS NO WAY TO CHANGE A POST'S TIME FROM THE PRODUCT.
     *
     * On 18 Oct six posts were approved at once with no scheduled time, which
     * means "as soon as approved" — so unpausing would have put five on the
     * Page inside a minute and the sixth a minute later. On a page with fifty
     * followers that reads as spam.
     *
     * ⚠️ I spread them with a direct database update, which worked and was
     * the wrong shape: it left the owner unable to do the same thing, and the
     * next backlog would have needed me again.
     */
    case "reschedule": {
      const raw = input.scheduledFor;

      // ⛔ `null` is a real choice and means "as soon as it is approved" ⇒ the
      // schema. It is NOT the same as leaving the field out, which is a
      // request with nothing in it.
      if (raw === undefined) {
        return NextResponse.json(
          { error: "Say when it should go out, or send null for “as soon as it is approved”." },
          { status: 400 },
        );
      }

      let when: string | null = null;
      if (raw !== null) {
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json({ error: `“${raw}” is not a date I can read.` }, { status: 400 });
        }
        /**
         * ⚠️ A PAST DATE IS ACCEPTED, DELIBERATELY, and said out loud. It
         * means "send at the next run", which is a thing somebody legitimately
         * wants — and refusing it would send them back to the database, which
         * is what this whole case exists to prevent.
         */
        when = parsed.toISOString();
      }

      const { data, error } = await db
        .from("social_posts")
        .update({ scheduled_for: when, updated_at: now })
        .eq("id", id)
        // ⛔ Not a published one. Moving the date on something already public
        // would rewrite a record of what went out in the company's name.
        .in("status", ["drafting", "generating", "needs_review", "approved", "failed"])
        .select("id, status, scheduled_for")
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "That post cannot be rescheduled — it has already been published, or it is gone." },
          { status: 409 },
        );
      }

      const soon = when !== null && new Date(when).getTime() <= Date.now();
      return NextResponse.json({
        post: data,
        note:
          when === null
            ? `Set to go out as soon as it is approved. ${publishingSentence()}`
            : soon
              ? `That time has already passed, so it will go at the next run. ${publishingSentence()}`
              : `Set for ${new Date(when).toLocaleString()}. ${publishingSentence()}`,
      });
    }

    default:
      return NextResponse.json(
        { error: "action must be approve, edit, skip, unapprove or reschedule" },
        { status: 400 },
      );
  }
}
