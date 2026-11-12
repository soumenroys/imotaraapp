// POST /api/auth/email-code — #134 (12 Nov 2026): send a 6-digit sign-in code to ANY email address.
// Used by the web sign-in panel and (next) the app. ⇒ lib/auth/issueEmailCode.ts
//
// ⛔ Never says whether an account exists — the same answer either way.
// ⛔ Rate limits, shared across every server instance (Postgres-backed):
//     per IP: 10 codes / hour · per email: 5 codes / hour (keyed by a HASH, never the address).
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { checkPersistentIpRateLimit, getClientIp } from "@/lib/imotara/ipRateLimit";
import { issueEmailCode } from "@/lib/auth/issueEmailCode";
import { EMAIL_RX } from "@/lib/auth/signInOptions";

export const runtime = "nodejs";

const PER_IP_PER_HOUR = 10;
const PER_EMAIL_PER_HOUR = 5;

export async function POST(req: NextRequest) {
  let body: { email?: unknown; purpose?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RX.test(email) || email.length > 254) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  const purpose = body.purpose === "reset" ? "reset" : "signin";

  const ip = getClientIp(req);
  const emailKey = "e:" + createHash("sha256").update(email).digest("hex").slice(0, 32);
  if (!(await checkPersistentIpRateLimit("auth-email-code-ip", ip, PER_IP_PER_HOUR, 3600))
    || !(await checkPersistentIpRateLimit("auth-email-code-email", emailKey, PER_EMAIL_PER_HOUR, 3600))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const r = await issueEmailCode(email, purpose);
  if (!r.ok) return NextResponse.json({ error: r.reason === "mail" ? "mail_failed" : "failed" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
