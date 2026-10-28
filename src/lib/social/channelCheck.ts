// src/lib/social/channelCheck.ts
// "Does this channel still work?", asked once, for whichever channel it is.
//
// 🔴 WHY THIS IS ONE FUNCTION AND NOT A BRANCH IN EACH CALLER. There are two
// places that ask: the button somebody presses after pasting a token, and the
// daily cron. They had the same question and separate `if (platform ===
// "facebook")` ladders — and that already produced one real defect, where the
// button said **Working** and the cron said **Needs you** about the same Page
// an hour apart, because only one of them treated `canPost: false` as broken.
//
// ⛔ So adding a channel is an edit HERE, and nowhere else. A dispatcher that
// has to be updated in three files is a dispatcher that will be updated in
// two.

import type { ChannelCredential } from "@/lib/social/channelCredentials";
import { checkFacebookPage, type FacebookFailure } from "@/lib/social/adapters/facebook";
import { checkInstagramAccount } from "@/lib/social/adapters/instagram";
import { checkLinkedInPage, type LinkedInFailure } from "@/lib/social/adapters/linkedin";

export type ChannelCheck =
  | {
      ok: true;
      /** ⚠️ Carried separately because a channel we can READ and cannot POST
       *  to is the one failure that otherwise reads as a success. */
      canPost: boolean;
      note: string;
    }
  | { ok: false; kind: FacebookFailure; message: string };

/**
 * ⚠️ Takes a credential that has already been decrypted by its one door
 * ⇒ channelCredentials.ts, so nothing here has to know about the key, and no
 * caller gets a second chance to pass the wrong binding.
 */
export async function checkChannel(
  cred: Extract<ChannelCredential, { ok: true }>,
): Promise<ChannelCheck> {
  if (cred.platform === "facebook") {
    const r = await checkFacebookPage({ token: cred.token, pageId: cred.externalId });
    return r.ok ? { ok: true, canPost: r.canPost, note: r.note } : r;
  }

  if (cred.platform === "instagram") {
    const r = await checkInstagramAccount({ token: cred.token, igUserId: cred.externalId });
    return r.ok ? { ok: true, canPost: r.canPost, note: r.note } : r;
  }

  if (cred.platform === "youtube") {
    /**
     * 🔑 REACHING HERE IS ITSELF THE ANSWER. `loadCredentialFor` only returns
     * an ok credential for YouTube after exchanging the stored refresh token
     * with Google for a live access token — so by this line the grant has
     * already been proven alive, seconds ago.
     *
     * ⛔ THERE IS NO SECOND CALL TO MAKE, and that is deliberate rather than
     * lazy: `youtube.upload` cannot read the channel back (`channels.list`
     * wants a wider scope we chose not to ask for), and an upload is not a
     * health check — it publishes a video.
     *
     * ⚠️ WHAT THIS DOES AND DOES NOT PROVE. It proves the credential is
     * valid — which is the thing that silently dies when a grant is revoked
     * or the OAuth app slips back to "Testing", where refresh tokens expire
     * after 7 days. It does NOT prove the channel will accept a particular
     * video. Said plainly here rather than implied by a green tick.
     */
    return {
      ok: true,
      canPost: true,
      note:
        "Google exchanged the stored refresh token for a live access token, so the grant is good. " +
        "⚠️ That is the credential, not a test upload — the upload scope cannot read the channel back.",
    };
  }

  if (cred.platform === "linkedin") {
    /**
     * 🔑 A READ OF THE PAGE, NOT A POST ⇒ checkLinkedInPage. It proves the
     * token is alive and can see the organisation it was connected for.
     *
     * ⚠️ It does NOT prove `w_organization_social`: LinkedIn has no read that
     * answers "may this member post here" without asking for a wider scope.
     * Said in the note rather than implied by a green tick — the same honesty
     * as YouTube below.
     */
    const r = await checkLinkedInPage({ token: cred.token, organizationId: cred.externalId });
    return r.ok
      ? {
          ok: true,
          canPost: true,
          note:
            `LinkedIn answered for ${r.name} (${r.organizationId}), so the token is alive and can see the Page. ` +
            `⚠️ That is a read, not a test post — the posting permission is proven by the first post.`,
        }
      : { ok: false, kind: LINKEDIN_KIND[r.kind], message: r.message };
  }

  /**
   * ⛔ SAID, NOT SILENTLY PASSED. A channel with no adapter must not come back
   * looking healthy: all that is knowable about it is what the platform told
   * us at connect time, and a token revoked at the other end would still read
   * fine ⇒ which is why `pending` exists as a status at all.
   */
  if (cred.platform === "x") {
    // Same reasoning as YouTube: loadCredentialFor already exchanged (and
    // re-stored) the rotating refresh token, so reaching here proves the grant.
    return {
      ok: true,
      canPost: true,
      note: "X exchanged the stored refresh token for a live access token (and the new refresh token was saved).",
    };
  }

  return {
    ok: false,
    kind: "unknown",
    message:
      `There is no way to check a ${cred.platform} token yet — nothing has been built that can ` +
      `talk to it. ⚠️ Its status stays what it was, which is the truth.`,
  };
}

/**
 * ⚠️ LinkedIn's words mapped onto the ones both callers already act on.
 * `transient` becomes `network` because both callers leave the status alone
 * for it — LinkedIn's 5xx is not LinkedIn saying no.
 */
const LINKEDIN_KIND: Record<LinkedInFailure, FacebookFailure> = {
  auth: "token",
  permission: "permission",
  content: "unknown",
  rate: "rate",
  transient: "network",
};

/**
 * 🔴 THE EXPIRY RULE, IN ONE PLACE. Until LinkedIn, every channel with an
 * expiry date was a channel nothing could check, so the cron only looked at
 * the date when it could NOT ask the platform. A LinkedIn token is both
 * checkable AND dies after ~60 days ⇒ a successful check must not hide the
 * date, or the 10-day warning silently stops the day the check starts working.
 */
export const EXPIRY_WARN_DAYS = 10;

export function expiryVerdict(
  expiresAt: string | null | undefined,
  now: Date,
): { status: "dead" | "expiring"; why: string } | null {
  if (!expiresAt) return null;
  const days = (new Date(expiresAt).getTime() - now.getTime()) / 86_400_000;
  if (days <= 0) {
    return { status: "dead", why: `The token expired on ${new Date(expiresAt).toLocaleDateString()}.` };
  }
  if (days <= EXPIRY_WARN_DAYS) {
    return { status: "expiring", why: `The token expires in ${Math.ceil(days)} day(s).` };
  }
  return null;
}

/** Is there an adapter that can answer for this platform at all? ⚠️ Asked
 *  where the answer changes what a screen says, so "not checked" is never
 *  shown as "broken". */
export function channelCanBeChecked(platform: string): boolean {
  return (
    platform === "facebook" ||
    platform === "instagram" ||
    platform === "youtube" ||
    platform === "x" ||
    platform === "linkedin"
  );
}
