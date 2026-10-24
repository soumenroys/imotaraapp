// POST /api/admin/voice/contacts — add one contact to the Call Directory sheet
// (and optionally call them now). The sheet stays the contact list.
import { NextRequest, NextResponse } from "next/server";
import { appendContact } from "@/lib/voice/sheets";
import { callNow } from "@/lib/voice/dispatch";
import { CONTACT_TABS, STATUS, normalisePhone, type Column, type ContactTab } from "@/lib/voice/rules";
import { BOLNA_AGENTS } from "@/lib/voice/agents";
import { voiceAdmin, readJson } from "../_shared";

export const runtime = "nodejs";
export const maxDuration = 120;

type Body = Partial<Record<
  "tab" | "name" | "organisation" | "organisation_type" | "phone" | "country" | "time_zone" | "language" |
  "voice_gender" | "consent_note" | "team_member" | "context" | "call_reason", string
>> & { callNow?: boolean };

const validZone = (z: string) => {
  try { new Intl.DateTimeFormat("en", { timeZone: z }); return true; } catch { return false; }
};

export async function POST(req: NextRequest) {
  const a = await voiceAdmin(req);
  if (!a.ok) return a.response;
  const b = await readJson<Body>(req);
  if (!b) return NextResponse.json({ error: "not JSON" }, { status: 400 });

  const t = (k: keyof Body) => String(b[k] ?? "").trim().slice(0, 300);
  const tab = t("tab") as ContactTab;
  const phone = normalisePhone(t("phone"));
  const language = t("language").toLowerCase();
  const problems: string[] = [];
  if (!CONTACT_TABS.includes(tab)) problems.push("Choose a contact type.");
  if (!t("name")) problems.push("Name is required.");
  if (phone.replace("+", "").length < 10) problems.push("Phone needs the country code and number.");
  if (!BOLNA_AGENTS[language]) problems.push("Choose a language we have an agent for.");
  if (!/^[A-Za-z]{2}$/.test(t("country"))) problems.push("Country must be a 2-letter code, e.g. IN.");
  if (!validZone(t("time_zone"))) problems.push("Time zone must be like Asia/Kolkata.");
  // ⛔ No consent note, no call — the same rule the sheet's Check column enforces.
  if (!t("consent_note")) problems.push("Say how this contact agreed to be called (consent note).");
  if (problems.length) return NextResponse.json({ error: problems.join(" ") }, { status: 400 });

  const cells: Partial<Record<Column, string>> = {
    phone, name: t("name"), organisation: t("organisation"), organisation_type: t("organisation_type"),
    country: t("country").toUpperCase(), time_zone: t("time_zone"), language,
    source: `admin console (${a.admin.email})`, consent_note: t("consent_note"), team_member: t("team_member"),
    context: t("context"), call_reason: t("call_reason"), status: STATUS.pending, call_attempts: "0",
    voice_gender: t("voice_gender").toLowerCase() === "male" ? "male" : "female",
  };
  const row = await appendContact(tab, cells);
  console.log("[admin/voice/contacts] added", { by: a.admin.email, tab, row });
  const call = b.callNow ? await callNow([{ tab, row }], a.admin.email) : undefined;
  return NextResponse.json({ added: { tab, row }, call });
}
