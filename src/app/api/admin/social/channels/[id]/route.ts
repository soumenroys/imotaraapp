// PATCH /api/admin/social/channels/[id] — correct the platform's own id  🔐 owner
//
// 🔴 WHY THIS IS A ROUTE AND NOT AN UPDATE STATEMENT.
//
// `external_id` is not just a column. It is half of the aad the token is
// encrypted under ⇒ src/lib/social/tokenCrypto.ts, bound in deliberately so
// that ciphertext from one row cannot decrypt in another. ⛔ So editing the id
// in place — in SQL, in the Supabase table editor, anywhere — does not
// "correct a typo". It makes the stored token permanently unreadable, with no
// error at the moment of the edit and a decrypt failure at the moment somebody
// needed to post.
//
// 🔑 The correction is therefore: decrypt under the OLD binding, re-encrypt
// under the NEW one, write both in the same statement. This route exists so
// that is the easy path and the destructive one is not.
//
// ⚠️ It happened on day one. The Page was connected with 61591783672102 — the
// brand PROFILE's id — and the real Page is 1222416224285686.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialOwner } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { decryptToken, encryptToken, tokenAad, tokenStorageReady } from "@/lib/social/tokenCrypto";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const guard = await requireSocialOwner(req, "Correcting a channel's platform id");
  if (!guard.ok) return guard.response;

  let input: { externalId?: string };
  try {
    input = (await req.json()) as { externalId?: string };
  } catch {
    return NextResponse.json({ error: "the request body was not JSON" }, { status: 400 });
  }

  const next = input.externalId?.trim() ?? "";
  if (!next) {
    return NextResponse.json({ error: "A channel needs the platform's own id for it." }, { status: 400 });
  }

  const storage = tokenStorageReady();
  if (!storage.ok) {
    // ⛔ Without the key the token cannot be re-bound, and writing the new id
    // alone would strand it. Refuse rather than half-apply.
    return NextResponse.json({ error: storage.reason }, { status: 503 });
  }

  const db = getSupabaseAdmin();
  const { data: row, error: readError } = await db
    .from("social_accounts")
    .select("id, platform, external_id, access_token, refresh_token")
    .eq("id", id)
    .maybeSingle();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "There is no connected channel with that id." }, { status: 404 });

  if (row.external_id === next) {
    return NextResponse.json({ note: "That is already the id on this channel; nothing changed." });
  }

  const platform = row.platform as string;
  const oldAad = tokenAad(platform, row.external_id as string);
  const newAad = tokenAad(platform, next);

  let access: string;
  let refresh: string | null = null;
  try {
    access = encryptToken(decryptToken(row.access_token as string, oldAad), newAad);
    if (row.refresh_token) {
      refresh = encryptToken(decryptToken(row.refresh_token as string, oldAad), newAad);
    }
  } catch (e) {
    /**
     * ⛔ NOTHING IS WRITTEN IF THE RE-BIND FAILS. A new id with an old
     * ciphertext beside it is the exact state this route exists to prevent,
     * and it would be indistinguishable afterwards from a key problem.
     */
    return NextResponse.json(
      {
        error:
          `The stored token could not be re-bound to the new id (${(e as Error).message}). ` +
          `⛔ Nothing was changed. ▶️ Connect the channel again with a fresh token instead.`,
      },
      { status: 409 },
    );
  }

  const { error } = await db
    .from("social_accounts")
    .update({
      external_id: next,
      access_token: access,
      refresh_token: refresh,
      // ⚠️ Back to 'pending'. The last verdict was about a different target,
      // so keeping it would be stating a result nobody measured.
      status: "pending",
      last_error: null,
      last_verified_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    externalId: next,
    note:
      `Id corrected to ${next} and the token re-encrypted against it. ⚠️ Back to "Not checked yet" ` +
      `— the previous result was about a different Page. ▶️ Press “Check it now”.`,
  });
}
