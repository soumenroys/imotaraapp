// GET /api/admin/connect/pending
// Admin only. Lists pending consultant applications with full submitted data.

import { NextRequest, NextResponse } from "next/server";
import { connectAdminAuthorized } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  if (!(await connectAdminAuthorized(req))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("connect_consultants")
    .select(
      "id, user_id, display_name, gender, photo_url, status, bio, expertise_tags, " +
      "languages, rate_per_min, currency_code, availability_note, availability_windows, " +
      "contact_email, contact_phone, website_url, social_links, " +
      "payout_info, digital_signature, verification_docs, created_at"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[admin/connect/pending] query failed:", error.message);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }

  type ConsultantRow = {
    id: string; user_id: string; display_name: string; gender: string | null;
    photo_url: string | null; status: string; bio: string | null;
    expertise_tags: string[] | null; languages: string[] | null;
    rate_per_min: number; currency_code: string;
    availability_note: string | null; availability_windows: unknown[] | null;
    contact_email: string | null; contact_phone: string | null;
    website_url: string | null; social_links: string[] | null;
    payout_info: Record<string, string> | null;
    digital_signature: string | null;
    verification_docs: Record<string, { path?: string; same_as_profile?: boolean; label?: string }> | null;
    created_at: string;
  };

  const rows = (data ?? []) as unknown as ConsultantRow[];

  // Batch-fetch emails from auth.users in parallel — O(1) round-trips vs O(n) sequential loop
  const emailMap: Record<string, string> = {};
  await Promise.all(
    rows.map(async (row) => {
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(row.user_id);
        if (authUser?.user?.email) emailMap[row.user_id] = authUser.user.email;
      } catch { /* skip */ }
    })
  );

  // Mask sensitive banking fields before returning to admin UI —
  // raw account numbers / IBANs should not travel in JSON response.
  function maskPayout(info: Record<string, string> | null): Record<string, string> | null {
    if (!info) return null;
    const masked = { ...info };
    const sensitiveKeys = ["account_number", "iban", "swift_code", "routing_number", "upi_id"];
    for (const key of sensitiveKeys) {
      if (masked[key]) {
        const v = String(masked[key]);
        masked[key] = v.length > 4 ? `${"*".repeat(v.length - 4)}${v.slice(-4)}` : "****";
      }
    }
    return masked;
  }

  // Generate 1-hour signed URLs for verification documents stored in private Supabase Storage.
  // This lets the admin preview IDs without making the storage bucket public.
  async function signedDocUrls(
    docs: Record<string, { path?: string; same_as_profile?: boolean; label?: string }> | null
  ): Promise<Record<string, { signedUrl?: string; label?: string; sameAsProfile?: boolean }>> {
    if (!docs) return {};
    const result: Record<string, { signedUrl?: string; label?: string; sameAsProfile?: boolean }> = {};
    await Promise.all(
      Object.entries(docs).map(async ([key, doc]) => {
        if (doc?.same_as_profile) {
          result[key] = { label: doc.label, sameAsProfile: true };
          return;
        }
        if (!doc?.path) {
          result[key] = { label: doc?.label };
          return;
        }
        try {
          const { data: signed } = await supabase.storage
            .from("connect-docs")
            .createSignedUrl(doc.path, 3600);
          result[key] = { signedUrl: signed?.signedUrl ?? undefined, label: doc.label };
        } catch {
          result[key] = { label: doc?.label };
        }
      })
    );
    return result;
  }

  const consultants = await Promise.all(rows.map(async (c) => ({
    ...c,
    email:             emailMap[c.user_id] ?? null,
    payout_info:       maskPayout(c.payout_info),
    verification_docs: await signedDocUrls(c.verification_docs),
  })));

  return NextResponse.json({ ok: true, consultants });
}
