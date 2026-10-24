// GET /api/admin/social/x/callback — X sends the owner back here after consent.
//
// ⛔ Only @ImotaraOfficial may be connected: the account that consented is read
// back from X and refused if it is anyone else — a personal account connected
// by mistake would post the brand's words under a person's name.
import { NextRequest, NextResponse } from "next/server";
import { requireSocialOwner } from "@/app/api/admin/social/_guard";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { xOAuthConfig, exchangeXCode, xWhoAmI, X_SCOPES } from "@/lib/social/adapters/xAuth";
import { encryptToken, decryptToken, tokenAad, tokenTail, tokenFingerprint } from "@/lib/social/tokenCrypto";
import { X_STATE_AAD, X_STATE_MAX_AGE_MS } from "@/app/api/admin/social/x/connect/route";

export const IMOTARA_X_USERNAME = "imotaraofficial";

function back(origin: string, note: string, ok: boolean) {
  const url = new URL("/admin/social/channels", origin);
  url.searchParams.set(ok ? "connected" : "error", note);
  return NextResponse.redirect(url, { status: 307, headers: { "cache-control": "no-store" } });
}

export async function GET(req: NextRequest) {
  const guard = await requireSocialOwner(req, "finish connecting the X account");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const origin = url.origin;
  const denied = url.searchParams.get("error");
  if (denied) return back(origin, `X did not grant access (${denied}). Nothing was changed.`, false);

  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!state || !code) return back(origin, "That callback was missing its code or state.", false);

  let parsed: { t?: number; v?: string } = {};
  try {
    parsed = JSON.parse(decryptToken(state, X_STATE_AAD)) as { t?: number; v?: string };
  } catch {
    return back(origin, "That callback's state did not come from here. Nothing was changed.", false);
  }
  if (!parsed.t || Date.now() - parsed.t > X_STATE_MAX_AGE_MS || !parsed.v) {
    return back(origin, "That consent link had gone stale. Start the connection again.", false);
  }

  const config = xOAuthConfig(process.env, origin);
  if (!config.ok) return back(origin, config.message, false);

  const tokens = await exchangeXCode({ config: config.config, code, verifier: parsed.v });
  if (!tokens.ok) return back(origin, tokens.message, false);

  const who = await xWhoAmI(tokens.accessToken);
  if (!who.ok) return back(origin, who.message, false);
  if (who.username.toLowerCase() !== IMOTARA_X_USERNAME) {
    return back(
      origin,
      `That was @${who.username}, not @ImotaraOfficial. Nothing was stored. ▶️ Sign out of X, sign in as @ImotaraOfficial and connect again.`,
      false,
    );
  }

  const aad = tokenAad("x", who.id);
  const { error } = await getSupabaseAdmin()
    .from("social_accounts")
    .upsert(
      {
        platform: "x",
        external_id: who.id,
        display_name: `@${who.username}`,
        access_token: null,
        refresh_token: encryptToken(tokens.refreshToken, aad),
        token_tail: tokenTail(tokens.refreshToken),
        token_fingerprint: tokenFingerprint(tokens.refreshToken),
        scopes: [...X_SCOPES],
        status: "ok",
        last_verified_at: new Date().toISOString(),
        last_error: null,
        token_expires_at: null,
      },
      { onConflict: "platform,external_id" },
    );
  if (error) {
    return back(origin, `X granted access but it could not be stored (${error.message}). ⚠️ Run Connect again.`, false);
  }
  return back(origin, `X is connected as @${who.username}. Posts can now go out on the weekly schedule.`, true);
}
