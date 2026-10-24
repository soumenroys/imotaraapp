// POST /api/admin/voice/settings — change the calling switches (written to the sheet's Settings tab).
import { NextRequest, NextResponse } from "next/server";
import { writeSettings, type SettingKey } from "@/lib/voice/sheets";
import { voiceAdmin, readJson } from "../_shared";

export const runtime = "nodejs";

type Body = { callingEnabled?: boolean; autoDispatch?: boolean; allowIndividuals?: boolean; maxConcurrency?: number; dailyCap?: number };

export async function POST(req: NextRequest) {
  const a = await voiceAdmin(req);
  if (!a.ok) return a.response;
  const b = await readJson<Body>(req);
  if (!b) return NextResponse.json({ error: "not JSON" }, { status: 400 });
  const v: Partial<Record<SettingKey, string>> = {};
  const yn = (x: boolean) => (x ? "yes" : "no");
  if (typeof b.callingEnabled === "boolean") v.calling_enabled = yn(b.callingEnabled);
  if (typeof b.autoDispatch === "boolean") v.auto_dispatch = yn(b.autoDispatch);
  if (typeof b.allowIndividuals === "boolean") v.allow_individuals = yn(b.allowIndividuals);
  if (Number.isInteger(b.maxConcurrency) && b.maxConcurrency! >= 1 && b.maxConcurrency! <= 10) v.max_concurrency = String(b.maxConcurrency);
  if (Number.isInteger(b.dailyCap) && b.dailyCap! >= 1 && b.dailyCap! <= 500) v.daily_cap = String(b.dailyCap);
  if (Object.keys(v).length === 0) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  await writeSettings(v);
  console.log("[admin/voice/settings]", { by: a.admin.email, ...v });
  return NextResponse.json({ ok: true, changed: v });
}
