// src/app/api/admin/broadcast/upload/route.ts
// POST — put an image where a mail client can fetch it (BC-24).
//
// Email cannot carry an image the way a web page can. Base64 inlining pushes
// the HTML past Gmail's ~102KB clipping threshold — at which point the rest of
// the message, unsubscribe link included, disappears behind "View entire
// message" — and CID attachments are what filters expect from malware. So the
// file goes to public object storage and the message references a URL, which
// is what every ESP does.
//
// Owner role only.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireOwner } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const BUCKET = "broadcast-images";

const MAX_BYTES = 5 * 1024 * 1024;

// GIF is here because animation is the one motion format that works in mail —
// video does not play in Gmail. WebP is accepted but flagged back to the
// caller: Outlook 2016-2019 on Windows shows nothing at all for it.
const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ error: "Expected a file upload" }, { status: 400 }); }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was attached" }, { status: 400 });
  }

  const ext = TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "That file type cannot be used in an email", allowed: "PNG, JPEG, GIF or WebP" },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 5 MB`,
        hint: "Large images are slow on a phone and get the message flagged as heavy" },
      { status: 413 },
    );
  }

  const supabase = getSupabaseAdmin();

  // Creating the bucket here rather than in a migration: storage buckets are
  // not part of the SQL schema, and a feature that silently fails on its first
  // upload because someone skipped a dashboard step is worse than one extra
  // idempotent call. Errors other than "already exists" are ignored on
  // purpose — the upload below reports the real problem.
  await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: Object.keys(TYPES),
  }).catch(() => undefined);

  // The client's filename is never used. It is attacker-controlled, may carry
  // path separators, and leaks whatever the admin happened to call the file.
  const key = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, await file.arrayBuffer(), { contentType: file.type, upsert: false });

  if (error) {
    console.error("[broadcast/upload]:", error.message);
    return NextResponse.json({ error: "Could not store the image" }, { status: 500 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);

  return NextResponse.json({
    url: data.publicUrl,
    bytes: file.size,
    type: file.type,
    // Surfaced rather than blocked: it is the admin's call, but they should
    // not discover it from a recipient.
    warning: file.type === "image/webp"
      ? "Outlook on Windows shows nothing at all for WebP. PNG or JPEG is safer."
      : file.size > 500 * 1024
        ? "Over 500 KB — this will be slow to load on a phone."
        : null,
  }, { status: 201 });
}
