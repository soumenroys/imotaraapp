// GET /api/admin/social/x/connect — send the owner to X's consent screen.
//
// 🔑 The state is signed, not stored (same as YouTube), and here it also carries
// the PKCE verifier — X needs it back at the token exchange, and keeping it
// inside the encrypted state means it is never readable in a URL.
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireSocialOwner } from "@/app/api/admin/social/_guard";
import { xOAuthConfig, xConsentUrl, pkcePair } from "@/lib/social/adapters/xAuth";
import { encryptToken, tokenStorageReady } from "@/lib/social/tokenCrypto";

export const X_STATE_AAD = "imotara:x:oauth-state";
export const X_STATE_MAX_AGE_MS = 10 * 60 * 1000;

export async function GET(req: NextRequest) {
  const guard = await requireSocialOwner(req, "connect the X account");
  if (!guard.ok) return guard.response;

  const storage = tokenStorageReady();
  if (!storage.ok) {
    return NextResponse.json(
      { error: `The token key is not usable (${storage.reason}). ⛔ Fix SOCIAL_TOKEN_KEY first — consenting now would waste the grant.` },
      { status: 500 },
    );
  }

  const origin = new URL(req.url).origin;
  const config = xOAuthConfig(process.env, origin);
  if (!config.ok) return NextResponse.json({ error: config.message }, { status: 500 });

  const { verifier, challenge } = pkcePair();
  const state = encryptToken(JSON.stringify({ t: Date.now(), n: randomUUID(), v: verifier }), X_STATE_AAD);
  return NextResponse.redirect(xConsentUrl(config.config, state, challenge), {
    status: 307,
    headers: { "cache-control": "no-store" },
  });
}
