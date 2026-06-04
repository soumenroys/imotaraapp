// src/app/api/invoice/[invoiceId]/route.ts
// GET /api/invoice/[invoiceId] — download HTML invoice for a payment
// Authenticated: only the paying user or an org admin can access

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getSupabaseUserServerClient } from "@/lib/supabaseServer";
import { renderInvoiceHtml } from "@/lib/imotara/invoiceUtils";

type Params = { params: Promise<{ invoiceId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { invoiceId } = await params;

  // Resolve user
  let userId: string | null = null;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (bearer) {
    const { data } = await getSupabaseAdmin().auth.getUser(bearer);
    userId = data?.user?.id ?? null;
  }
  if (!userId) {
    try {
      const supabase = await getSupabaseUserServerClient();
      const { data } = await supabase.auth.getUser();
      userId = data?.user?.id ?? null;
    } catch { /* ignore */ }
  }
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const admin = getSupabaseAdmin();

  // Fetch invoice
  const { data: invoice, error } = await admin
    .from("payment_invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) return NextResponse.json({ error: "invoice not found" }, { status: 404 });

  // Auth: must be the user who paid, or an org admin of the org on the invoice
  const isOwner = invoice.user_id === userId;
  let isOrgAdmin = false;
  if (!isOwner && invoice.org_id) {
    const { data: mem } = await admin
      .from("org_members")
      .select("role")
      .eq("org_id", invoice.org_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .single();
    isOrgAdmin = mem?.role === "owner" || mem?.role === "admin";
  }

  if (!isOwner && !isOrgAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Fetch user details for the invoice
  const { data: authUser } = await admin.auth.admin.getUserById(invoice.user_id);
  const userEmail = authUser?.user?.email ?? "—";
  const userName  = authUser?.user?.user_metadata?.full_name ?? null;

  const html = renderInvoiceHtml({ ...invoice, user_email: userEmail, user_name: userName });

  const download = req.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...(download ? { "Content-Disposition": `attachment; filename="${invoice.invoice_number}.html"` } : {}),
    },
  });
}
