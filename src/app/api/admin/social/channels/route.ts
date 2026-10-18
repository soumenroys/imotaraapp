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
import { captureChannelStats } from "@/lib/social/stats";
import { listInstagramAccounts } from "@/lib/social/adapters/instagram";

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
  let externalId = input.externalId?.trim() ?? "";
  const accessToken = input.accessToken?.trim() ?? "";
  if (!displayName || !accessToken) {
    return NextResponse.json(
      { error: "A channel needs a name and a token." },
      { status: 400 },
    );
  }
  /**
   * ⚠️ Instagram is allowed to arrive without an id, because its id is the one
   * nobody can find — see below. Every other platform still must bring one.
   */
  if (!externalId && platform !== "instagram") {
    return NextResponse.json(
      { error: "A channel needs the platform's own id for it." },
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

  /**
   * 🔑 INSTAGRAM'S ID IS LOOKED UP RATHER THAN TYPED, and it has to happen
   * HERE — before the binding below. `external_id` is half the token's
   * encryption aad, so a value corrected afterwards does not fix anything: it
   * makes the stored token undecryptable, and the symptom reads like a dead
   * token ⇒ trap_an_id_can_be_half_an_encryption_key.
   *
   * ⚠️ The Instagram user id (17841…) is not shown in the app, on the profile,
   * or anywhere in Business Suite a person would naturally look. Asking
   * somebody to paste one is asking for a typo that surfaces days later.
   *
   * ⛔ A portfolio with two accounts is a QUESTION, not a coin toss.
   */
  if (platform === "instagram") {
    const found = await listInstagramAccounts({ token: accessToken });
    if (!found.ok) {
      return NextResponse.json({ error: found.message }, { status: 400 });
    }
    const wanted = externalId.replace(/^@/, "").toLowerCase();
    const matches = wanted
      ? found.accounts.filter((a) => a.igUserId === wanted || a.username.toLowerCase() === wanted)
      : found.accounts;

    if (matches.length === 0) {
      return NextResponse.json(
        {
          error:
            found.accounts.length === 0
              ? "This token can see no Instagram account on any Page. ▶️ Link the account to the " +
                "Page in Business settings, make sure it is a Business or Creator account, and " +
                "check the token carries instagram_basic."
              : `No Instagram account matching "${externalId}". ⚠️ This token can see: ` +
                found.accounts.map((a) => `@${a.username} on ${a.pageName}`).join(", "),
        },
        { status: 400 },
      );
    }
    if (matches.length > 1) {
      return NextResponse.json(
        {
          error:
            `This token can see ${matches.length} Instagram accounts, so it is not obvious which ` +
            `one you mean: ${matches.map((a) => `@${a.username} on ${a.pageName}`).join(", ")}. ` +
            `▶️ Put the @name in the id field.`,
        },
        { status: 400 },
      );
    }
    externalId = matches[0].igUserId;
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

  /**
   * 🔴 THE BASELINE IS TAKEN NOW OR NEVER.
   *
   * The owner, 18 Oct: "whenever you connect any social media channel, take
   * the stock of that channel and store that." ⇒ Without the figure from
   * BEFORE the scheduler has done anything, every later number is unreadable:
   * 63 followers is a success or a disappointment depending entirely on what
   * it was the day we started, and that cannot be asked for retroactively.
   *
   * ⛔ NEVER FAILS THE CONNECT. A channel that is connected and unmeasured is
   * a great deal better than a channel that could not be connected because a
   * statistics call timed out.
   */
  let baselineNote = "";
  try {
    const { data: row } = await db
      .from("social_accounts")
      .select("id")
      .eq("platform", platform)
      .eq("external_id", externalId)
      .maybeSingle();
    if (row) {
      const taken = await captureChannelStats(db, row.id as string, { note: "taken at connect" });
      baselineNote = taken.ok
        ? ` ${taken.note}`
        : ` ⚠️ The opening figures could not be taken (${taken.reason}) — the channel is connected ` +
          `either way, and the daily run will try again.`;
    }
  } catch (e) {
    baselineNote = ` ⚠️ The opening figures could not be taken (${(e as Error).message}).`;
  }

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
      "work. The daily check verifies it against the platform and tells you the hour it stops." +
      baselineNote,
  });
}
