// POST /api/admin/auth/2fa/setup
// Generates a new TOTP secret and QR code for the current admin.
// Does NOT enable 2FA yet — call /verify to confirm and activate.
// Auth: session cookie required.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { requireSuperAdmin } from "@/app/api/admin/_auth";
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";

export async function POST(req: NextRequest) {
  const result = await requireSuperAdmin(req);
  if (!result.ok) return result.response;

  const secret = generateSecret();
  const otpauth = generateURI({ label: result.admin.email, issuer: "Imotara Admin", secret });
  const qrDataUrl = await QRCode.toDataURL(otpauth);

  // Store secret (not yet enabled)
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("super_admins")
    .update({ totp_secret: secret, totp_enabled: false })
    .eq("id", result.admin.id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, secret, qrDataUrl });
}
