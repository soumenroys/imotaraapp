// POST /api/admin/users/[userId]/recovery-link
// Generates a one-time sign-in link for an existing user, for account
// recovery when someone has permanently lost access to the Google/Apple
// account their Imotara identity is tied to (no separate Imotara password
// exists to reset — see mailer note below).
//
// Deliberately does NOT send anything automatically. The link is returned
// to the superadmin only; delivering it to the right person, through a
// channel the superadmin is satisfied is genuinely controlled by the real
// account owner, is a manual human judgment call — this tool is not a
// self-service "recover my account" flow, and should never become one
// without a real identity-verification story behind it. Same risk class as
// a password-reset email, except there's no account-holder-initiated
// trigger (like "I have access to this inbox") to lean on here, since the
// whole scenario is that their usual channel is the one that's gone.
//
// Auth: superadmin only.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { requireSuperAdmin } from "@/app/api/admin/_auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const result = await requireSuperAdmin(req);
  if (!result.ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (result.admin.role === "connect_reviewer") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();

  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId);
  if (userErr || !userData?.user?.email) {
    return NextResponse.json({ ok: false, error: "User not found or has no email on file" }, { status: 404 });
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type:  "magiclink",
    email: userData.user.email,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    email: userData.user.email,
    actionLink: data.properties.action_link,
    // GoTrue magic links expire in 1 hour by default — surfaced so the
    // superadmin doesn't sit on it before delivering it.
    note: "This link expires in ~1 hour. Deliver it only once you're satisfied this request is genuinely from the account owner.",
  });
}
