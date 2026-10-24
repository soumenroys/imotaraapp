// src/app/api/admin/voice/_shared.ts
// What every voice-console route checks before it touches a phone or the sheet.

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/api/admin/_auth";
import { sheetsConfigured } from "@/lib/voice/sheets";
import { bolnaConfigured } from "@/lib/voice/bolna";

export type VoiceAdmin = { email: string; role: string };

/** Owner/admin only (never connect_reviewer), and both services configured. */
export async function voiceAdmin(req: NextRequest): Promise<{ ok: true; admin: VoiceAdmin } | { ok: false; response: NextResponse }> {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return { ok: false, response: auth.response };
  if (auth.admin.role === "connect_reviewer") {
    return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (!sheetsConfigured() || !bolnaConfigured()) {
    return { ok: false, response: NextResponse.json({ error: "Voice calling is not set up yet (Google or Bolna access missing)." }, { status: 409 }) };
  }
  return { ok: true, admin: { email: auth.admin.email, role: auth.admin.role } };
}

export async function readJson<T>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export function rowsFrom(body: { rows?: unknown } | null): { tab: string; row: number }[] {
  const raw = Array.isArray(body?.rows) ? body!.rows : [];
  return raw
    .filter((r): r is { tab: string; row: number } => !!r && typeof (r as { tab?: unknown }).tab === "string" && Number.isInteger((r as { row?: unknown }).row))
    .slice(0, 200);
}
