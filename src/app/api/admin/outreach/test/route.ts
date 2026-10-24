// POST /api/admin/outreach/test {audience, step} — send that draft to the signed-in admin only.
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { AUDIENCES, STEPS, type Audience, type StepId } from "@/lib/outreach/sequence";
import { draftKey, readOutreach } from "@/lib/outreach/store";
import { sendOutreach, senderIdentity } from "@/lib/outreach/send";
import { outreachAdmin, failed } from "../_shared";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const a = await outreachAdmin(req);
  if (!a.ok) return a.response;
  const b = (await req.json().catch(() => null)) as { audience?: string; step?: string } | null;
  const audience = b?.audience as Audience;
  const step = b?.step as StepId;
  if (!AUDIENCES.includes(audience) || !STEPS.includes(step)) return NextResponse.json({ error: "Unknown audience or email." }, { status: 400 });
  try {
    const supabase = getSupabaseAdmin();
    const draft = (await readOutreach(supabase)).drafts[draftKey(audience, step)];
    if (!draft) return NextResponse.json({ error: "There is no draft yet." }, { status: 400 });
    const from = await senderIdentity(supabase);
    if (!from) return NextResponse.json({ error: "No sender address is set up (Broadcast → sender identities)." }, { status: 409 });
    // ⛔ Only ever to the admin who pressed it.
    const out = await sendOutreach({ ...draft, subject: `[TEST] ${draft.subject}` }, { email: a.email, name: "", organisation: "Example Organisation" }, from);
    return out.ok ? NextResponse.json({ ok: true, to: a.email }) : NextResponse.json({ error: out.message }, { status: 502 });
  } catch (e) {
    return failed(e);
  }
}
