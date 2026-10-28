// POST /api/admin/voice/settings — change the calling switches (written to the sheet's Settings tab).
import { NextRequest, NextResponse } from "next/server";
import { writeSettings, type SettingKey } from "@/lib/voice/sheets";
import { voiceAdmin, readJson, failed } from "../_shared";

export const runtime = "nodejs";

type Body = { callingEnabled?: boolean; autoDispatch?: boolean; allowIndividuals?: boolean; maxConcurrency?: number; dailyCap?: number; retryStart?: number; retryEnd?: number };

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
  // ⚠️ A bad number is refused out loud — it used to be dropped while the page said "Saved".
  const bad: string[] = [];
  if (b.maxConcurrency !== undefined) {
    if (Number.isInteger(b.maxConcurrency) && b.maxConcurrency! >= 1 && b.maxConcurrency! <= 10) v.max_concurrency = String(b.maxConcurrency);
    else bad.push("Lines at once must be a whole number from 1 to 10.");
  }
  if (b.dailyCap !== undefined) {
    if (Number.isInteger(b.dailyCap) && b.dailyCap! >= 1 && b.dailyCap! <= 500) v.daily_cap = String(b.dailyCap);
    else bad.push("Calls per day must be a whole number from 1 to 500.");
  }
  if (b.retryStart !== undefined || b.retryEnd !== undefined) {
    const st = Number(b.retryStart), en = Number(b.retryEnd);
    if (Number.isInteger(st) && Number.isInteger(en) && st >= 0 && en <= 24 && st < en) v.retry_hours = `${String(st).padStart(2, "0")}-${String(en).padStart(2, "0")}`;
    else bad.push("Retry hours must be two whole hours from 0 to 24, the first before the second (0–24 = any hour).");
  }
  if (bad.length) return NextResponse.json({ error: bad.join(" ") }, { status: 400 });
  if (Object.keys(v).length === 0) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  try {
    await writeSettings(v);
  } catch (e) {
    return failed(e);
  }
  console.log("[admin/voice/settings]", { by: a.admin.email, ...v });
  return NextResponse.json({ ok: true, changed: v });
}
