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
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path, name: file.name });
}
