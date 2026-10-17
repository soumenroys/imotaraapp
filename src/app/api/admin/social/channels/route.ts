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
import { PLATFORMS as CHANNELS } from "@/lib/social/platforms";
import { encryptToken, tokenAad, tokenTail, tokenFingerprint, tokenStorageReady } from "@/lib/social/tokenCrypto";

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
    // ⚠️ Said plainly in the admin rather than discovered on the first paste.
    tokenStorage: tokenStorageReady(),
    channels: Object.values(CHANNELS).map((c) => ({
      id: c.id,
      label: c.label,
      canPublish: c.canPublish,
      blockedBy: c.blockedBy,
    })),
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
   * ⛔ A PASSWORD IS NOT ACCEPTED HERE, AND NEVER WILL BE.
   *
   * The owner asked whether their social password could be encrypted and
   * stored so the app could log in as them. Encryption cannot do that job:
   * logging in needs the plaintext back, so the key sits beside the ciphertext
   * and anybody with both has the password. (Hashing cannot do it at all — a
   * hash can be checked, never used to log in.)
   *
   * ⚠️ It also would not work. None of these platforms allows programmatic
   * password login; driving a browser instead meets checkpoints, 2FA and
   * device verification, and is against their terms — on an estate that was
   * nearly lost to an enforcement action on 17 Oct.
   *
   * 🔑 And a TOKEN is better at the very thing that was wanted: it is scoped to
   * posting on one page, revoked on its own, and it SURVIVES A PASSWORD
   * CHANGE. A stored password would break posting every time one changed.
   * ⇒ no_credential_impersonation_for_paid_apis
   */
  const storage = tokenStorageReady();
  if (!storage.ok) {
    // ⛔ Refuses rather than writing plaintext "for now".
    return NextResponse.json({ error: storage.reason }, { status: 503 });
  }

  if (/^[^\s@]+@[^\s@]+$/.test(accessToken) || accessToken.length < 20) {
    return NextResponse.json(
      {
        error:
          "That does not look like a platform token. ⛔ This field never takes an email or a " +
          "password — only a token the platform itself issued, which you can revoke without " +
          "changing anything else about your account.",
      },
      { status: 400 },
    );
  }

  const db = getSupabaseAdmin();
  const aad = tokenAad(platform, externalId);

  // 🔑 The fingerprint tells a REPLACEMENT from a RE-PASTE without keeping the
  // old value — which is what makes "your credentials changed, re-validate"
  // possible at all.
  const fingerprint = tokenFingerprint(accessToken);
  const { data: existing } = await db
    .from("social_accounts")
    .select("id, token_fingerprint")
    .eq("platform", platform)
    .eq("external_id", externalId)
    .maybeSingle();

  const row = {
    platform,
    display_name: displayName,
    external_id: externalId,
    access_token: encryptToken(accessToken, aad),
    refresh_token: input.refreshToken?.trim() ? encryptToken(input.refreshToken.trim(), aad) : null,
    token_tail: tokenTail(accessToken),
    token_fingerprint: fingerprint,
    token_expires_at: input.expiresAt ?? null,
    scopes: input.scopes ?? [],
    // ⚠️ 'pending', not 'ok'. A token that has been STORED is not a token that
    // has been SHOWN TO WORK, and the difference is the whole point of the
    // health check.
    status: "pending",
    last_error: null,
    connected_by: guard.actor.id,
    updated_at: new Date().toISOString(),
  };

  const { error } = existing
    ? await db.from("social_accounts").update(row).eq("id", existing.id)
    : await db.from("social_accounts").insert(row);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const replaced = Boolean(existing && existing.token_fingerprint !== fingerprint);
  return NextResponse.json({
    platform,
    tokenTail: tokenTail(accessToken),
    replaced,
    status: "pending",
    note:
      (replaced
        ? "Token replaced. "
        : existing
          ? "That is the same token as before; nothing changed. "
          : "Channel connected. ") +
      "⚠️ It is stored as PENDING, not working: being saved is not the same as being shown to " +
      "work. The daily check verifies it against the platform and tells you the hour it stops.",
  });
}
