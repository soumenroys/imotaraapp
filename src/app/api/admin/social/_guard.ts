// src/app/api/admin/social/_guard.ts
// Who may reach social posting, and who may do the three dangerous things.
//
// 🔑 THE OWNER SETTLED THIS ON 17 OCT: *"only owner or imotara admin can get
// this feature"*, and for connecting a channel, replacing a token and switching
// auto-publish on, *"the someone equivalent permission level of soumenroys or
// suchismita only"*. Both of those accounts are `role = 'owner'` — the highest
// tier that exists here — so that requirement resolves exactly to the role, and
// needs no new concept.
//
// ⛔ CHECKED PER REQUEST, IN THE ROUTE. Hiding a button is a hint, never a gate.
// The admin page disables the controls an `admin` may not use; this is what
// actually refuses them.

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, type SuperAdminInfo } from "@/app/api/admin/_auth";

export type SocialActor = { id: string; email: string; name: string; role: "owner" | "admin" };

export type GuardResult =
  | { ok: true; actor: SocialActor }
  | { ok: false; response: NextResponse };

function deny(status: number, error: string): { ok: false; response: NextResponse } {
  return { ok: false, response: NextResponse.json({ error }, { status }) };
}

/**
 * The read-and-write surface: the queue, approving, writing a post, editing a
 * schedule.
 *
 * ⛔ `connect_reviewer` is refused. It is scoped to Connect and has no business
 * publishing in the company's name — `adminAuthorized()` already excludes it
 * everywhere else, and this keeps that true here.
 *
 * ⛔ Org admins never reach this at all: they live in `org_members`, have no
 * `super_admins` row, and so are excluded by construction rather than by a
 * check somebody could forget to write.
 */
export async function requireSocialAdmin(req: NextRequest): Promise<GuardResult> {
  const result = await requireSuperAdmin(req);
  if (!result.ok) return { ok: false, response: result.response };

  const admin: SuperAdminInfo = result.admin;
  if (admin.role !== "owner" && admin.role !== "admin") {
    return deny(
      403,
      "Social posting is for the platform owner and Imotara admins. " +
        "A Connect reviewer's access is scoped to Connect.",
    );
  }
  return { ok: true, actor: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } };
}

/**
 * The three actions that can publish in the company's name without a human
 * reading the words, expose a credential, or attach a new public identity.
 *
 * 🔑 Why exactly these three and nothing else: everything else on this surface
 * is reversible, visible, and already requires a person. These are not.
 */
export async function requireSocialOwner(req: NextRequest, action: string): Promise<GuardResult> {
  const result = await requireSocialAdmin(req);
  if (!result.ok) return result;

  if (result.actor.role !== "owner") {
    return deny(
      403,
      `${action} is limited to the owner tier. An Imotara admin can read the queue, approve a ` +
        `post and write one — but not attach a channel, touch a token, or let a schedule post ` +
        `with nobody reading it.`,
    );
  }
  return result;
}

/**
 * The cron's own authorisation.
 *
 * ⚠️ Vercel Cron sends a GET with `Authorization: Bearer $CRON_SECRET`. Two
 * things have gone wrong with this before and both are guarded here:
 *   • expecting a POST, so the cron 405s forever and nobody notices
 *     ⇒ trap_a_dead_cron_fails_where_nobody_is_watching;
 *   • no secret set, so the route is open to the internet. ⛔ Missing secret is
 *     a REFUSAL, not a pass — an unauthenticated generator is worse than a
 *     dead one.
 */
export function cronAuthorised(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return {
      ok: false,
      reason:
        "CRON_SECRET is not set, so this route cannot tell Vercel's cron from anybody else. " +
        "Refusing rather than running.",
    };
  }
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`
    ? { ok: true }
    : { ok: false, reason: "not the scheduler" };
}
