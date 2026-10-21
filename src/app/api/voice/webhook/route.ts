// POST /api/voice/webhook — Bolna reports a call's status here.
//
// ⛔ BOLNA DOES NOT SIGN WEBHOOKS ⇒ spec §7.3. So: a shared token in the
// `x-imotara-token` header (compared in constant time), an optional IP
// allowlist, and a row that is no longer "Calling" is left alone, so a
// repeated event changes nothing.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { readExecution } from "@/lib/voice/bolna";
import { applyResult } from "@/lib/voice/dispatch";

export const runtime = "nodejs";
export const maxDuration = 60;

function tokenOk(req: NextRequest): boolean {
  const expected = process.env.VOICE_WEBHOOK_TOKEN?.trim();
  const got = req.headers.get("x-imotara-token")?.trim() ?? "";
  if (!expected || !got) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

function ipOk(req: NextRequest): boolean {
  const allow = (process.env.VOICE_WEBHOOK_IPS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (allow.length === 0) return true;
  const ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  return allow.includes(ip);
}

export async function POST(req: NextRequest) {
  if (!tokenOk(req) || !ipOk(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "not JSON" }, { status: 400 });
  }
  const view = readExecution(body);
  try {
    const result = await applyResult(view);
    // ⚠️ Logged without the transcript: the status and outcome are enough to debug.
    console.log("[voice/webhook]", { executionId: view.executionId, status: view.status, result, outcome: view.extraction.outcome });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("[voice/webhook] could not apply", { executionId: view.executionId, error: (e as Error).message });
    // ⚠️ 200 anyway: the reconcile pass in the cron will pick the call up.
    return NextResponse.json({ ok: false });
  }
}
