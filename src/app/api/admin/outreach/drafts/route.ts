// POST /api/admin/outreach/drafts {audience, step, action: "write" | "save" | "approve", subject?, body?}
//
// ⛔ A draft with findings can never be approved — edit it until the checks pass.
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { AUDIENCES, STEPS, type Audience, type StepId } from "@/lib/outreach/sequence";
import { draftKey, readOutreach, updateOutreach } from "@/lib/outreach/store";
import { checkDraft, writeMailDraft } from "@/lib/outreach/writer";
import { outreachAdmin, failed } from "../_shared";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const a = await outreachAdmin(req);
  if (!a.ok) return a.response;
  const b = (await req.json().catch(() => null)) as { audience?: string; step?: string; action?: string; subject?: string; body?: string } | null;
  const audience = b?.audience as Audience;
  const step = b?.step as StepId;
  if (!AUDIENCES.includes(audience) || !STEPS.includes(step)) return NextResponse.json({ error: "Unknown audience or email." }, { status: 400 });
  const k = draftKey(audience, step);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  try {
    if (b?.action === "write") {
      const w = await writeMailDraft(audience, step);
      const s = await updateOutreach(supabase, (st) => { st.drafts[k] = { ...w, status: "needs_review", writtenAt: now, writtenBy: a.email }; });
      return NextResponse.json({ draft: s.drafts[k] });
    }
    if (b?.action === "save") {
      const subject = String(b.subject ?? "").trim().slice(0, 200);
      const body = String(b.body ?? "").trim().slice(0, 8000);
      const findings = checkDraft(subject, body);
      // ⚠️ Editing puts it back for review — approval belongs to the words, as on social.
      const s = await updateOutreach(supabase, (st) => { st.drafts[k] = { subject, body, findings, status: "needs_review", writtenAt: now, writtenBy: a.email }; });
      return NextResponse.json({ draft: s.drafts[k] });
    }
    if (b?.action === "approve") {
      const cur = (await readOutreach(supabase)).drafts[k];
      if (!cur) return NextResponse.json({ error: "There is no draft to approve yet." }, { status: 400 });
      const findings = checkDraft(cur.subject, cur.body);
      if (findings.length) return NextResponse.json({ error: `Fix these first: ${findings.join(" ")}` }, { status: 400 });
      const s = await updateOutreach(supabase, (st) => { st.drafts[k] = { ...cur, findings, status: "approved", approvedAt: now, approvedBy: a.email }; });
      console.log("[admin/outreach/drafts] approved", { by: a.email, k });
      return NextResponse.json({ draft: s.drafts[k] });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    return failed(e);
  }
}
