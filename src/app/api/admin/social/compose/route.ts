// POST /api/admin/social/compose — a post written by a person
//
// ⛔ THE SAME GATE AS A GENERATED ONE. Writing it yourself is a different way
// in, never a way round: eight claims this product must never make were found
// in copy written by people who knew the rules, so this is the path the gate
// matters most on.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialAdmin } from "@/app/api/admin/social/_guard";
import { prepareWritten, wantsPicture, type ContentType } from "@/lib/social/pipeline";
import { liveDeps, savePreparedPost } from "@/lib/social/store";
import { isSupportedLanguage } from "@/lib/social/languages";

export const maxDuration = 60;

const CONTENT_TYPES: ContentType[] = ["text", "graphic", "text_graphic"];
const PLATFORMS = ["facebook", "linkedin", "instagram", "x"];

type Body = {
  platforms?: string[];
  language?: string;
  subject?: string;
  body?: string;
  support?: string;
  contentType?: ContentType;
  when?: "now" | "queue";
  scheduledFor?: string | null;
};

export async function POST(req: NextRequest) {
  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;

  let input: Body;
  try {
    input = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "the request body was not JSON" }, { status: 400 });
  }

  const platforms = (input.platforms ?? []).filter((p) => PLATFORMS.includes(p));
  if (platforms.length === 0) return NextResponse.json({ error: "Choose at least one channel." }, { status: 400 });

  const language = input.language ?? "";
  if (!isSupportedLanguage(language)) {
    return NextResponse.json({ error: "Choose one of the 22 languages. There is no default." }, { status: 400 });
  }

  const contentType = input.contentType ?? "text";
  if (!CONTENT_TYPES.includes(contentType)) {
    return NextResponse.json({ error: `Shape must be one of ${CONTENT_TYPES.join(", ")}.` }, { status: 400 });
  }

  const subject = input.subject?.trim() ?? "";
  const body = input.body?.trim() ?? "";
  if (subject.length < 8) return NextResponse.json({ error: "Say what the post is about, in a few words." }, { status: 400 });
  if (body.length < 20) return NextResponse.json({ error: "The post is too short to be a post." }, { status: 400 });

  /**
   * 🔑 "Post now" means a person is reading it, which IS the human in the loop.
   * So the language tier does not apply here — its whole purpose is to decide
   * what may go out with nobody reading it, and somebody just did.
   */
  const publishImmediately = input.when === "now";

  const deps = await liveDeps();
  const results: { platform: string; postId?: string; error?: string; notes?: string[] }[] = [];

  for (const platform of platforms) {
    const prepared = await prepareWritten(deps, {
      authorId: guard.actor.id,
      platform,
      language,
      subject: platforms.length > 1 ? `${subject} (${platform})` : subject,
      body,
      support: input.support,
      contentType,
      publishImmediately,
    });

    if (!prepared.ok) {
      results.push({ platform, error: prepared.reason });
      continue;
    }

    if (wantsPicture(contentType) && !prepared.post.picture) {
      prepared.post.notes.push(
        "A picture was asked for and none was composed — the reason is above. The post still works as text.",
      );
    }

    const saved = await savePreparedPost(prepared.post, { scheduledFor: input.scheduledFor ?? null });
    if (!saved.ok) results.push({ platform, error: saved.reason });
    else results.push({ platform, postId: saved.postId, notes: prepared.post.notes });
  }

  const anySaved = results.some((r) => r.postId);
  return NextResponse.json(
    {
      results,
      note: anySaved
        ? publishImmediately
          ? "Saved and approved. It publishes at the next drain."
          : "Saved to the queue."
        : "Nothing was saved.",
    },
    { status: anySaved ? 200 : 400 },
  );
}
