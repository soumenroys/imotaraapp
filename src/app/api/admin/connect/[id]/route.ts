// DELETE /api/admin/connect/[id]
// Admin only. Permanently deletes a consultant record and their uploaded documents.

import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await adminAuthorized(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  // Fetch the record first to get doc paths for storage cleanup
  const { data: consultant, error: fetchErr } = await supabase
    .from("connect_consultants")
    .select("id, display_name, verification_docs")
    .eq("id", id)
    .single();

  if (fetchErr || !consultant) {
    return NextResponse.json({ ok: false, error: "Consultant not found" }, { status: 404 });
  }

  // Remove uploaded documents from private storage
  const docs = consultant.verification_docs as Record<string, { path?: string; same_as_profile?: boolean }> | null;
  if (docs) {
    const paths = Object.values(docs)
      .filter((d) => d && d.path && !d.same_as_profile)
      .map((d) => d.path as string);
    if (paths.length > 0) {
      await supabase.storage.from("connect-docs").remove(paths);
    }
  }

  // Delete the consultant row (cascades to sessions, reviews etc. if FK on delete cascade set)
  const { error } = await supabase
    .from("connect_consultants")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: id });
}
