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

  /**
   * ⛔ SAID, NOT SILENTLY PASSED. A channel with no adapter must not come back
   * looking healthy: all that is knowable about it is what the platform told
   * us at connect time, and a token revoked at the other end would still read
   * fine ⇒ which is why `pending` exists as a status at all.
   */
  return {
    ok: false,
    kind: "unknown",
    message:
      `There is no way to check a ${cred.platform} token yet — nothing has been built that can ` +
      `talk to it. ⚠️ Its status stays what it was, which is the truth.`,
  };
}

/** Is there an adapter that can answer for this platform at all? ⚠️ Asked
 *  where the answer changes what a screen says, so "not checked" is never
 *  shown as "broken". */
export function channelCanBeChecked(platform: string): boolean {
  return platform === "facebook" || platform === "instagram";
}
