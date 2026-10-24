// src/app/api/admin/voice/_shared.ts
// What every voice-console route checks before it touches a phone or the sheet.

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/app/api/admin/_auth";
import { sheetsConfigured } from "@/lib/voice/sheets";
import { bolnaConfigured } from "@/lib/voice/bolna";
import type { RowRef } from "@/lib/voice/dispatch";

export type VoiceAdmin = { email: string; role: string };

/** Owner/admin only (never connect_reviewer), and both services configured. */
export async function voiceAdmin(req: NextRequest): Promise<{ ok: true; admin: VoiceAdmin } | { ok: false; response: NextResponse }> {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return { ok: false, response: auth.response };
  if (auth.admin.role === "connect_reviewer") {
    return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (!sheetsConfigured() || !bolnaConfigured()) {
    return { ok: false, response: NextResponse.json({ error: "Voice calling is not set up yet (Google or Imotara calling access missing)." }, { status: 409 }) };
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

/** ⛔ Each row must carry the phone the page showed ⇒ rules.sameContact. */
export function rowsFrom(body: { rows?: unknown } | null): RowRef[] {
  const raw = Array.isArray(body?.rows) ? body!.rows : [];
  return raw
    .filter((r): r is RowRef => {
      const o = (r ?? {}) as Partial<Record<keyof RowRef, unknown>>;
      return typeof o.tab === "string" && Number.isInteger(o.row) && typeof o.phone === "string" && o.phone.length > 0;
    })
    .map((r) => ({ tab: r.tab, row: r.row, phone: r.phone }))
    .slice(0, 200);
}

/** A thrown Google/Bolna error as a JSON answer the console can show, never an HTML 500. */
export function failed(e: unknown): NextResponse {
  return NextResponse.json({ error: (e as Error).message || "Something went wrong." }, { status: 502 });
}
