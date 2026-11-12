// src/app/api/admin/organizations/[orgId]/invoices/route.ts — #132 F part 2 (12 Nov 2026)
//
// Hand-written invoices for an organisation that pays by bank transfer / UPI (an NGO pilot
// becoming paid). ⇒ lib/imotara/manualInvoice.ts
//   GET                 — list this org's invoices (admin)
//   GET ?view=<id>      — the invoice as the customer sees it (HTML)
//   POST                — create one (super-admin): due, or paid with a bank reference
//   PATCH               — mark a due invoice paid { invoiceId, reference } (super-admin)
//
// The org OWNER also sees it in Settings → Invoices and at /api/invoice/<id> — same table.

import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized, requireSuperAdmin } from "@/app/api/admin/_auth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { buildManualInvoice, MANUAL_GATEWAY } from "@/lib/imotara/manualInvoice";
import { renderInvoiceHtml } from "@/lib/imotara/invoiceUtils";

type Params = { params: Promise<{ orgId: string }> };

const LIST_COLUMNS =
  "id, invoice_number, description, amount_paise, currency, payment_gateway, gateway_ref, status, issued_at, period_start, period_end";

async function loadOrg(orgId: string) {
  const { data } = await getSupabaseAdmin()
    .from("organizations")
    .select("id, name, slug, tier, owner_user_id")
    .eq("id", orgId)
    .maybeSingle();
  return data as { id: string; name: string; slug: string; tier: string | null; owner_user_id: string | null } | null;
}

export async function GET(req: NextRequest, { params }: Params) {
  if (!await adminAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { orgId } = await params;
  const admin = getSupabaseAdmin();

  const viewId = req.nextUrl.searchParams.get("view");
  if (viewId) {
    const { data: inv } = await admin.from("payment_invoices").select("*").eq("id", viewId).eq("org_id", orgId).maybeSingle();
    if (!inv) return NextResponse.json({ error: "invoice not found" }, { status: 404 });
    const org = await loadOrg(orgId);
    const { data: u } = await admin.auth.admin.getUserById(inv.user_id);
    const html = renderInvoiceHtml({
      ...inv,
      user_email: u?.user?.email ?? "—",
      user_name: (u?.user?.user_metadata?.full_name as string | undefined) ?? null,
      billed_to_org: org?.name ?? null,
    });
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const { data, error } = await admin
    .from("payment_invoices")
    .select(LIST_COLUMNS)
    .eq("org_id", orgId)
    .order("issued_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoices: data ?? [] });
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;
  if (auth.admin.role === "connect_reviewer") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { orgId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid JSON body" }, { status: 400 }); }

  const org = await loadOrg(orgId);
  if (!org) return NextResponse.json({ error: "organisation not found" }, { status: 404 });

  const built = buildManualInvoice(body, { id: org.id, slug: org.slug, tier: org.tier, ownerUserId: org.owner_user_id });
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 });

  const { data, error } = await getSupabaseAdmin().from("payment_invoices").insert(built.row).select(LIST_COLUMNS).single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "That bank reference is already on another invoice." }, { status: 409 });
    console.error("[admin/org invoices POST]", error.message);
    return NextResponse.json({ error: "Could not save the invoice." }, { status: 500 });
  }
  return NextResponse.json({ invoice: data }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return auth.response;
  if (auth.admin.role === "connect_reviewer") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { orgId } = await params;

  let body: { invoiceId?: string; reference?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid JSON body" }, { status: 400 }); }
  const reference = body.reference?.trim();
  if (!body.invoiceId || !reference) return NextResponse.json({ error: "invoiceId and the bank / UPI reference are required" }, { status: 400 });

  // ⛔ Only a hand-written, still-due invoice of THIS org — never a store or Razorpay receipt.
  const { data, error } = await getSupabaseAdmin()
    .from("payment_invoices")
    .update({ status: "paid", gateway_ref: reference })
    .eq("id", body.invoiceId)
    .eq("org_id", orgId)
    .eq("payment_gateway", MANUAL_GATEWAY)
    .eq("status", "due")
    .select(LIST_COLUMNS)
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "That bank reference is already on another invoice." }, { status: 409 });
    return NextResponse.json({ error: "Could not update the invoice." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "No due hand-written invoice with that id for this organisation." }, { status: 404 });
  return NextResponse.json({ invoice: data });
}
