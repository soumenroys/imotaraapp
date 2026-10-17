// GET  /api/admin/social/languages — the tiers, and what is still owed
// POST /api/admin/social/languages — a speaker contributes abuse terms
//
// 🔑 THE OWNER'S DECISION, 17 Oct: ship English and let "the speaker can
// enhance this later". ⇒ Contributing is an INSERT, not a deploy. The day
// somebody who speaks Bengali is willing to spend ten minutes on this is not
// the day to be waiting on a release.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialAdmin, requireSocialOwner } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { isSupportedLanguage, languageName } from "@/lib/social/languages";
import { canAutoPublishIn } from "@/lib/social/voiceGate";
import { loadOverlay } from "@/lib/social/store";

export async function GET(req: NextRequest) {
  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;

  const db = getSupabaseAdmin();
  const [tiers, terms] = await Promise.all([
    db.from("social_language_tiers").select("*").order("code"),
    db.from("social_abuse_terms").select("language, term, script, contributed_by, created_at").order("created_at"),
  ]);

  const overlay = await loadOverlay();
  const counts: Record<string, number> = {};
  for (const t of terms.data ?? []) counts[t.language as string] = (counts[t.language as string] ?? 0) + 1;

  const languages = (tiers.data ?? []).map((t) => {
    const code = t.code as string;
    const verdict = canAutoPublishIn(code, overlay);
    return {
      ...t,
      contributedTerms: counts[code] ?? 0,
      mayPostUnattended: verdict.ok,
      // ⚠️ The reason travels with the row. "false" on its own invites somebody
      // to flip a flag; the sentence explains what would actually close it.
      reason: verdict.reason ?? null,
    };
  });

  return NextResponse.json({ languages, actorRole: guard.actor.role });
}

type Body = { language?: string; terms?: string[]; script?: "native" | "latin"; contributedBy?: string };

export async function POST(req: NextRequest) {
  /**
   * 🔐 OWNER ONLY, and this one is worth explaining because it looks like a
   * small edit. Contributing terms is what makes a language eligible for
   * unattended posting, via `abuse_list_ready`. ⇒ It is the same power as
   * switching auto-publish on, reached by a different door.
   *
   * ⚠️ That does NOT mean the owner has to write the words — a speaker sends
   * them, the owner adds them. The gate is on who commits them, not on who
   * knows the language.
   */
  const guard = await requireSocialOwner(req, "Adding abuse terms for a language");
  if (!guard.ok) return guard.response;

  let input: Body;
  try {
    input = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "the request body was not JSON" }, { status: 400 });
  }

  const language = input.language ?? "";
  if (!isSupportedLanguage(language)) {
    return NextResponse.json({ error: `${language} is not one of the 22 languages this product speaks.` }, { status: 400 });
  }

  const terms = (input.terms ?? [])
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter((t) => t.length > 0 && t.length <= 60);

  if (terms.length === 0) {
    return NextResponse.json({ error: "No terms to add." }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { error } = await db.from("social_abuse_terms").upsert(
    terms.map((term) => ({
      language,
      term,
      script: input.script ?? null,
      contributed_by: input.contributedBy?.trim() || guard.actor.email,
    })),
    { onConflict: "language,term", ignoreDuplicates: true },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // The trigger recomputed `abuse_list_ready`; read back what it decided
  // rather than asserting it here.
  const overlay = await loadOverlay();
  const verdict = canAutoPublishIn(language, overlay);

  return NextResponse.json({
    language,
    added: terms.length,
    mayPostUnattended: verdict.ok,
    note: verdict.ok
      ? `${languageName(language)} may now post unattended, once a schedule is switched on for it.`
      : `${languageName(language)} still cannot post unattended. ${verdict.reason}`,
    // ⚠️ Said even on success: a word list proves abuse can be checked. It does
    // not prove anybody here can read a draft.
    reminder:
      "A list makes the abuse check possible. It is not the same as somebody here being able to " +
      "read a draft and tell a person's voice from a translation's — both are needed.",
  });
}
