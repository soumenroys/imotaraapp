export const preferredRegion = ["sin1"];

// POST /api/connect/upload-photo
// Auth required. Accepts multipart/form-data with a "file" field (image, max 5 MB).
// Uploads to Supabase Storage bucket "connect-photos" and returns the public URL.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

const BUCKET   = "connect-photos";
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

async function verifyMagicBytes(file: File, declaredType: string): Promise<boolean> {
  const buf = await file.arrayBuffer();
  const b = new Uint8Array(buf, 0, Math.min(buf.byteLength, 12));
  switch (declaredType) {
    case "image/jpeg":
      return b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
    case "image/png":
      return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
    case "image/gif":
      return b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38;
    case "image/webp":
      // RIFF....WEBP
      return b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
          && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
    default:
      return false;
  }
}

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

  // Magic-byte verification — file.type is client-supplied and can be spoofed
  const magicOk = await verifyMagicBytes(file, file.type);
  if (!magicOk) {
    return NextResponse.json(
      { ok: false, error: "File content does not match its declared type." },
      { status: 422 }
    );
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
    console.error("[upload-photo] storage upload failed:", error.message);
    return NextResponse.json({ ok: false, error: "Failed to upload photo" }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({ ok: true, url: publicUrl });
}
