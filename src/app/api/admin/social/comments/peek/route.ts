// GET /api/admin/social/comments/peek — what people wrote under our posts  🔐 owner
//
// 🔑 #51, step 1 (owner, 1 Nov 2026): MEASURE before building auto-replies —
// read the real Facebook and Instagram comments with the token regenerated
// for it, and prove the Page token still carries the right to post.
//
// ⛔ READ-ONLY. It posts nothing, replies to nothing, stores nothing.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialOwner } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { loadChannelCredential } from "@/lib/social/channelCredentials";
import { graph, pageAccessToken } from "@/lib/social/adapters/facebook";

export const runtime = "nodejs";

type Comment = { id: string; on: string; who: string; text: string; at: string };

async function get(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  const json = (await res.json()) as Record<string, unknown> & { error?: { message?: string; code?: number } };
  if (json.error) throw new Error(`${json.error.code ?? res.status}: ${json.error.message ?? "refused"}`);
  return json;
}

const rows = (j: unknown) => ((j as { data?: Record<string, unknown>[] })?.data ?? []);
const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function GET(req: NextRequest) {
  const guard = await requireSocialOwner(req, "read social comments");
  if (!guard.ok) return guard.response;

  const db = getSupabaseAdmin();
  const { data: accounts } = await db.from("social_accounts").select("id, platform, external_id").in("platform", ["facebook", "instagram"]);
  const fbRow = accounts?.find((a) => a.platform === "facebook");
  const igRow = accounts?.find((a) => a.platform === "instagram");
  const out: Record<string, unknown> = {};

  if (fbRow) {
    const cred = await loadChannelCredential(db, fbRow.id);
    if (!cred.ok) out.facebook = { error: cred.reason };
    else {
      const pageId = String(fbRow.external_id);
      const fb: Record<string, unknown> = {};
      // 🔑 The Page tasks this token holds — CREATE_CONTENT is what posting needs.
      try {
        const acc = rows(await get(graph("me/accounts") + `?fields=id,tasks&access_token=${encodeURIComponent(cred.token)}`)).find((p) => p.id === pageId);
        fb.pageTasks = acc?.tasks ?? "page not listed for this token";
      } catch (e) {
        fb.pageTasks = `could not read: ${(e as Error).message}`;
      }
      const page = await pageAccessToken({ token: cred.token, pageId });
      if (!page.ok) fb.error = page.message;
      else {
        try {
          const posts = rows(await get(graph(`${pageId}/published_posts`) + `?fields=id,message,comments.limit(50){id,from,message,created_time}&limit=25&access_token=${encodeURIComponent(page.token)}`));
          const comments: Comment[] = posts.flatMap((p) =>
            rows(p.comments).map((c) => ({ id: str(c.id), on: str(p.message).slice(0, 60), who: str((c.from as { name?: string })?.name) || "(name hidden)", text: str(c.message), at: str(c.created_time) })),
          );
          fb.postsRead = posts.length;
          fb.comments = comments;
        } catch (e) {
          fb.error = (e as Error).message;
        }
      }
      out.facebook = fb;
    }
  }

  if (igRow) {
    const cred = await loadChannelCredential(db, igRow.id);
    if (!cred.ok) out.instagram = { error: cred.reason };
    else {
      const ig: Record<string, unknown> = {};
      try {
        const media = rows(await get(graph(`${igRow.external_id}/media`) + `?fields=id,caption,comments_count,comments.limit(50){id,username,text,timestamp}&limit=25&access_token=${encodeURIComponent(cred.token)}`));
        ig.postsRead = media.length;
        ig.comments = media.flatMap((m) =>
          rows(m.comments).map((c) => ({ id: str(c.id), on: str(m.caption).slice(0, 60), who: str(c.username), text: str(c.text), at: str(c.timestamp) })),
        );
      } catch (e) {
        ig.error = (e as Error).message;
      }
      out.instagram = ig;
    }
  }

  return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
}
