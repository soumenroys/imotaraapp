export const preferredRegion = ["sin1"];

// POST /api/connect/upload-doc
// Auth required. Accepts multipart/form-data:
//   file      — document file (image or PDF, max 10 MB)
//   doc_type  — "photo_id" | "address_proof" | "age_proof" | "eligibility"
// Uploads to PRIVATE Supabase Storage bucket "connect-docs".
// Returns { ok: true, path: string, name: string } — path stored in DB, not publicly accessible.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getConnectUser } from "@/lib/connect/auth";

const BUCKET    = "connect-docs";
const MAX_SIZE  = 10 * 1024 * 1024; // 10 MB
const DOC_TYPES = ["selfie", "photo_id", "address_proof", "age_proof", "eligibility"] as const;
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg":      "jpg",
  "image/png":       "png",
  "image/webp":      "webp",
  "application/pdf": "pdf",
};

async function verifyMagicBytes(file: File, declaredType: string): Promise<boolean> {
  const buf = await file.arrayBuffer();
  const b = new Uint8Array(buf, 0, Math.min(buf.byteLength, 12));
  switch (declaredType) {
    case "image/jpeg":
      return b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
    case "image/png":
      return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
    case "image/webp":
      // RIFF....WEBP
      return b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
          && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
    case "application/pdf":
      // %PDF
      return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
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

  const file    = formData.get("file") as File | null;
  const docType = formData.get("doc_type") as string | null;

  if (!file) return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
  if (!docType || !DOC_TYPES.includes(docType as typeof DOC_TYPES[number])) {
    return NextResponse.json({ ok: false, error: "Invalid doc_type" }, { status: 400 });
  }
  if (!ALLOWED_MIME[file.type]) {
    return NextResponse.json({ ok: false, error: "Only JPG, PNG, WebP, or PDF files are allowed" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ ok: false, error: "File must be under 10 MB" }, { status: 400 });
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

  // Ensure private bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find(b => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_SIZE,
      allowedMimeTypes: Object.keys(ALLOWED_MIME),
    });
  }

  const ext  = ALLOWED_MIME[file.type];
  const path = `${user.id}/${docType}/${Date.now()}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (error) {
    console.error("[upload-doc] storage upload failed:", error.message);
    return NextResponse.json({ ok: false, error: "Failed to upload document" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path, name: file.name });
}
