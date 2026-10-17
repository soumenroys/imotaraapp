// GET  /api/admin/social/channels — the channels, their health, and the switch
// POST /api/admin/social/channels — connect one, or replace its token  🔐 owner
//
// ⛔ NO TOKEN EVER LEAVES THIS ROUTE. The response carries the last four
// characters and the health fields, never the value. A token that can be read
// back out of an admin page is a token in a browser history, a screenshot and a
// support thread.

import { NextRequest, NextResponse } from "next/server";
import { requireSocialAdmin, requireSocialOwner } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { PLATFORM_IDS } from "@/lib/social/platforms";
import { scriptsAwaitingVerification } from "@/lib/social/fonts";

const PLATFORMS: string[] = PLATFORM_IDS;

export async function GET(req: NextRequest) {
  const guard = await requireSocialAdmin(req);
  if (!guard.ok) return guard.response;

  const db = getSupabaseAdmin();
  const [accounts, settings, tiers] = await Promise.all([
    db
      .from("social_accounts")
      .select("id, platform, display_name, external_id, token_tail, token_expires_at, scopes, status, last_verified_at, last_error, created_at")
      .order("platform"),
    db.from("social_settings").select("posting_paused, paused_at, note").eq("id", 1).single(),
    db.from("social_language_tiers").select("code, name, reviewed, abuse_list_ready, abuse_list_builtin").order("code"),
  ]);

  return NextResponse.json({
    accounts: accounts.data ?? [],
    settings: settings.data ?? { posting_paused: true, note: "settings row missing — treated as paused" },
    languages: tiers.data ?? [],
    scriptsAwaitingVerification: scriptsAwaitingVerification(),
    actorRole: guard.actor.role,
  });
}

type Body = {
  platform?: string;
  displayName?: string;
  externalId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string | null;
  scopes?: string[];
};

/**
 * 🔐 OWNER ONLY. Connecting a channel attaches a new public identity to this
 * system and replacing a token hands it a credential — the two actions on this
 * surface that an Imotara admin must not have.
 */
export async function POST(req: NextRequest) {
  const guard = await requireSocialOwner(req, "Connecting a channel or replacing a token");
  if (!guard.ok) return guard.response;

  let input: Body;
  try {
    input = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "the request body was not JSON" }, { status: 400 });
  }

  const platform = input.platform ?? "";
  if (!PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: `platform must be one of ${PLATFORMS.join(", ")}` }, { status: 400 });
  }
  const displayName = input.displayName?.trim() ?? "";
  const externalId = input.externalId?.trim() ?? "";
  const accessToken = input.accessToken?.trim() ?? "";
  if (!displayName || !externalId || !accessToken) {
    return NextResponse.json(
      { error: "A channel needs a name, the platform's own id for it, and a token." },
      { status: 400 },
    );
  }

  /**
   * ⛔ PHASE 1 STOPS HERE, AND SAYS SO RATHER THAN PRETENDING.
   *
   * ⚠️ Storing a token before there is encryption for it would put a live
   * credential in a database column in plain text, and the row would outlive
   * the intention to encrypt it later. The honest failure is to refuse the
   * write and name what is missing.
   *
   * ▶️ Phase 2 adds the encryption and the Facebook adapter together, because
   * the first is what makes the second safe to have.
   */
  return NextResponse.json(
    {
      error:
        "Channel connection is not built yet — and this route will not store a token until it can " +
        "encrypt it. A credential in a plain column outlives the intention to protect it later. " +
        "Phase 2 adds encryption and the Facebook adapter together.",
      wouldHaveStored: {
        platform,
        displayName,
        externalId,
        tokenTail: accessToken.slice(-4),
        scopes: input.scopes ?? [],
      },
    },
    { status: 501 },
  );
}
