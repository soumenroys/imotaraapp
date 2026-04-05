// src/app/api/blog/comments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

// ── GET /api/blog/comments?slug=<slug>        → comments for one post
// ── GET /api/blog/comments?slugs=a,b,c        → { counts: {slug: n} }
// ── GET /api/blog/comments?recent=<n>         → last n approved comments across all posts

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const sp = req.nextUrl.searchParams;

  // ── Batch counts ─────────────────────────────────────────────────────────────
  const slugsParam = sp.get("slugs")?.trim();
  if (slugsParam) {
    const slugs = slugsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);

    const { data, error } = await supabase
      .from("blog_comments")
      .select("slug")
      .in("slug", slugs)
      .eq("approved", true);

    if (error) {
      console.error("[blog/comments counts]", error.message);
      return NextResponse.json({ error: "fetch failed" }, { status: 500 });
    }

    const counts: Record<string, number> = {};
    for (const slug of slugs) counts[slug] = 0;
    for (const row of data ?? []) counts[row.slug] = (counts[row.slug] ?? 0) + 1;

    return NextResponse.json({ counts });
  }

  // ── Recent comments across all posts ─────────────────────────────────────────
  const recentParam = sp.get("recent");
  if (recentParam !== null) {
    const limit = Math.min(Math.max(parseInt(recentParam, 10) || 5, 1), 20);

    const { data, error } = await supabase
      .from("blog_comments")
      .select("id, slug, name, message, created_at")
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[blog/comments recent]", error.message);
      return NextResponse.json({ error: "fetch failed" }, { status: 500 });
    }

    return NextResponse.json({ comments: data ?? [] });
  }

  // ── Single post comments ──────────────────────────────────────────────────────
  const slug = sp.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("blog_comments")
    .select("id, name, message, created_at")
    .eq("slug", slug)
    .eq("approved", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[blog/comments GET]", error.message);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }

  return NextResponse.json({ comments: data ?? [] });
}

// ── POST /api/blog/comments ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { slug?: string; name?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const slug = body.slug?.trim() ?? "";
  const name = body.name?.trim().slice(0, 80) ?? "";
  const message = body.message?.trim().slice(0, 1000) ?? "";

  if (!slug || !name || !message) {
    return NextResponse.json(
      { error: "slug, name, and message are required" },
      { status: 400 },
    );
  }

  // Basic spam guard — no URLs allowed
  const urlPattern = /https?:\/\//i;
  if (urlPattern.test(name) || urlPattern.test(message)) {
    return NextResponse.json({ error: "links not allowed" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("blog_comments").insert({
    slug,
    name,
    message,
    approved: false,
  });

  if (error) {
    console.error("[blog/comments POST]", error.message);
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
