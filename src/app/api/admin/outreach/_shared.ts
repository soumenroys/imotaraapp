// src/app/api/admin/outreach/_shared.ts
// Who may use the outreach mailer's admin routes: owner/admin, never connect_reviewer.
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/api/admin/_auth";

export async function outreachAdmin(req: NextRequest): Promise<{ ok: true; email: string } | { ok: false; response: NextResponse }> {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return { ok: false, response: auth.response };
  if (auth.admin.role === "connect_reviewer") return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  return { ok: true, email: auth.admin.email };
}

export function failed(e: unknown): NextResponse {
  return NextResponse.json({ error: (e as Error).message || "Something went wrong." }, { status: 502 });
}
