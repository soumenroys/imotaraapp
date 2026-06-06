// POST /api/connect/upload-photo
// Auth required. Accepts multipart/form-data with a "file" field (image, max 5 MB).
// Uploads to Supabase Storage bucket "connect-photos" and returns the public URL.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

const BUCKET   = "connect-photos";
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const user = await getConnectUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid form data" }, { status: 400 }); }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });

  // Allowlist by MIME type — never trust client-supplied filename extension
  const ALLOWED_TYPES: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png":  "png",
    "image/webp": "webp",
    "image/gif":  "gif",
  };
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ ok: false, error: "Only JPEG, PNG, WebP, or GIF images are allowed" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ ok: false, error: "File must be under 5 MB" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Create bucket if it doesn't exist yet
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find((b) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_SIZE,
      allowedMimeTypes: Object.keys(ALLOWED_TYPES),
    });
  }

  const path = `${user.id}/${Date.now()}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({ ok: true, url: publicUrl });
}
