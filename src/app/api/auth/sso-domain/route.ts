// src/app/api/auth/sso-domain/route.ts — "does this email's domain sign in through its
// organisation (company SSO)?" Used by the sign-in panel to offer "Continue with your
// organisation's sign-in". ⇒ lib/auth/companySso.ts
//
// ⛔ Answers yes/no and the DOMAIN only — never which organisation, never anything about the person.
// ⛔ POST with the email in the BODY — an address in a URL would sit in server and proxy logs.
// Rate-limited per IP so it cannot be used to sweep a list of domains quickly.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { checkPersistentIpRateLimit, getClientIp } from "@/lib/imotara/ipRateLimit";
import { emailDomain, findActiveSsoDomain } from "@/lib/auth/companySso";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const domain = emailDomain(body.email);
  if (!domain) return NextResponse.json({ sso: false });

  const ip = getClientIp(req);
  if (!(await checkPersistentIpRateLimit("auth-sso-domain-ip", ip, 120, 3600))) {
    return NextResponse.json({ sso: false }, { status: 429 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("organizations")
    .select("org_settings")
    .eq("status", "active")
    .eq("org_settings->saml->>status", "active");
  if (error) return NextResponse.json({ sso: false });

  const sso = findActiveSsoDomain(domain, data ?? []);
  return NextResponse.json(sso ? { sso: true, domain } : { sso: false }, { headers: { "Cache-Control": "no-store" } });
}
