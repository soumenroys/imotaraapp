// src/lib/social/adapters/youtube.ts
// Putting a Short on the Imotara channel.
//
// 🔴 WHY SHORTS AND NOT A COMMUNITY POST. The channel was configured for
// community posts — the card was even sized 1280×720, "the community-post
// ratio" — and THE YOUTUBE DATA API HAS NO ENDPOINT FOR CREATING THEM.
// Checked 19 Oct 2026: no official documentation describes one. So the plan
// rested on an assumption nobody had tested.
//
// ⚠️ WHAT THE API CAN DO IS UPLOAD A VIDEO, and this product now makes
// narrated ones daily ⇒ renderAnimation. A vertical video under three minutes
// is shown as a Short, so the content we already have IS the format.
//
// ⛔ EVERY FACT HERE CAME FROM GOOGLE'S OWN REFERENCE, read 19 Oct 2026, and
// where the reference is SILENT this file says so rather than inventing an
// answer ⇒ trap_a_model_invents_specifics_it_cannot_have.

import { headlineFor } from "@/lib/social/visualRecipe";

const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos";

/**
 * ⚠️ `youtube.upload` is the narrowest scope that can do this. The reference
 * also accepts `youtube`, `youtubepartner` and `youtube.force-ssl`, all of
 * which can do a great deal more. ⛔ Ask for the least.
 */
export const YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";

export type YouTubeFailure = "auth" | "permission" | "content" | "quota" | "transient";

export type YouTubePublish =
  | { ok: true; videoId: string; url: string }
  | { ok: false; kind: YouTubeFailure; message: string };

export function classifyYouTubeError(status: number, body: string): { kind: YouTubeFailure; message: string } {
  const reason = /"reason"\s*:\s*"([^"]+)"/.exec(body)?.[1] ?? "";
  const said = /"message"\s*:\s*"([^"]+)"/.exec(body)?.[1] ?? body.slice(0, 300);

  if (status === 401) return { kind: "auth", message: `YouTube rejected the token: ${said}` };
  if (status === 403) {
    /**
     * 🔑 403 IS THREE DIFFERENT PROBLEMS AT YOUTUBE, and they need different
     * people. Quota is ours and resets; a forbidden upload is the account's.
     */
    if (/quota/i.test(reason) || /quota/i.test(said)) {
      return {
        kind: "quota",
        message:
          `YouTube's daily quota is spent (${reason || "quotaExceeded"}). ⚠️ An upload costs 1,600 units ` +
          `against a default of 10,000 a day, so this is unusual for one post a day and worth looking at. ` +
          `${said}`,
      };
    }
    return {
      kind: "permission",
      message:
        `YouTube refused the upload (403, ${reason || "forbidden"}). ⚠️ Usually the account is not the ` +
        `channel's owner, the channel has no upload permission, or the project is not verified. ${said}`,
    };
  }
  if (status === 429) return { kind: "quota", message: `YouTube is rate limiting: ${said}` };
  if (status >= 500) return { kind: "transient", message: `YouTube's end (${status}): ${said}` };
  return { kind: "content", message: `YouTube refused the video (${status}, ${reason}): ${said}` };
}

/**
 * ⚠️ DEFENSIVE CLAMPS, NOT DOCUMENTED LIMITS. Google's `videos.insert`
 * reference states only that an invalid title returns `invalidTitle` and an
 * invalid description returns `invalidDescription` — it gives no lengths. ⇒
 * These are the widely reported ceilings, used to avoid a refusal rather than
 * asserted as the contract, and the error is still handled if they are wrong.
 */
export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 5_000;

/**
 * Put a Short on the channel.
 *
 * ⛔ NOTHING IS RETRIED IN HERE, the same rule as every other adapter. A retry
 * around a call that may have succeeded is how a video gets uploaded twice.
 */
export async function publishShortToYouTube(args: {
  accessToken: string;
  title: string;
  description: string;
  videoBytes: Uint8Array;
  /**
   * 🔴 ALWAYS SENT, NEVER OMITTED, and that is a deliberate choice about an
   * unknown. Google's reference describes `selfDeclaredMadeForKids` as the
   * owner's designation and DOES NOT SAY what happens when it is absent.
   *
   * ⛔ An undeclared audience on YouTube is not a small thing — the whole
   * COPPA regime hangs on it, and this channel's audience setting is exactly
   * what has been unresolved in Studio. ⇒ Declaring it explicitly on every
   * upload removes the question rather than inheriting whatever a default
   * turns out to be.
   *
   * ⚠️ FALSE for this product. Imotara is not child-directed and its own
   * minimum age is 18 ⇒ trap_a_guard_satisfied_by_a_neighbouring_value.
   */
  madeForKids?: boolean;
  /** ⚠️ The reference says an omitted value defaults to public — on SOME
   *  accounts. Sent explicitly for the same reason as the audience. */
  privacyStatus?: "public" | "private" | "unlisted";
  fetchImpl?: typeof fetch;
}): Promise<YouTubePublish> {
  const doFetch = args.fetchImpl ?? fetch;

  if (!args.accessToken.trim()) {
    return { ok: false, kind: "auth", message: "There is no YouTube token to upload with." };
  }
  if (!args.title.trim()) {
    // ⛔ Refused here rather than sent: `invalidTitle` from Google reads like
    // a bug in the upload, not an empty headline.
    return { ok: false, kind: "content", message: "A YouTube video needs a title and this one has none." };
  }
  if (args.videoBytes.byteLength === 0) {
    return { ok: false, kind: "content", message: "There are no video bytes to upload." };
  }

  const metadata = {
    snippet: {
      title: args.title.slice(0, TITLE_MAX),
      description: args.description.slice(0, DESCRIPTION_MAX),
    },
    status: {
      privacyStatus: args.privacyStatus ?? "public",
      selfDeclaredMadeForKids: args.madeForKids ?? false,
    },
  };

  /**
   * 🔑 MULTIPART, NOT RESUMABLE, and the reason is size. Resumable upload
   * exists for files that cannot survive one request; our Shorts are a few
   * hundred kilobytes ⇒ measured at 583KB for a narrated minute. A resumable
   * handshake for that is two round trips to save nothing.
   *
   * ⚠️ The body is `multipart/related` with the JSON first and the bytes
   * second, which is the shape Google's own samples use.
   */
  const boundary = `imotara-${Math.random().toString(36).slice(2)}`;
  const head = new TextEncoder().encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`,
  );
  const tail = new TextEncoder().encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(head.length + args.videoBytes.length + tail.length);
  body.set(head, 0);
  body.set(args.videoBytes, head.length);
  body.set(tail, head.length + args.videoBytes.length);

  let res: Response;
  try {
    res = await doFetch(`${UPLOAD_URL}?uploadType=multipart&part=snippet,status`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: body as unknown as BodyInit,
    });
  } catch (e) {
    return { ok: false, kind: "transient", message: `YouTube could not be reached: ${(e as Error).message}` };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const { kind, message } = classifyYouTubeError(res.status, text);
    return { ok: false, kind, message };
  }

  const made = (await res.json().catch(() => ({}))) as { id?: string };
  if (!made.id) {
    return {
      ok: false,
      kind: "transient",
      message:
        "YouTube accepted the upload but returned no video id. ⚠️ The video may well be on the " +
        "channel — look before uploading it again.",
    };
  }

  return {
    ok: true,
    videoId: made.id,
    /**
     * ⚠️ The /shorts/ URL is how a vertical video under three minutes is
     * shown. ⛔ YouTube decides that from the file, not from this link: a
     * landscape video at this URL is simply played as an ordinary video, so
     * the 9:16 frame is what makes it a Short, not the address
     * ⇒ platforms.ts.
     */
    url: `https://www.youtube.com/shorts/${made.id}`,
  };
}

/**
 * The title a Short should carry.
 *
 * 🔴 YOUTUBE REQUIRES A TITLE AND WE DO NOT HAVE ONE. Every other channel
 * publishes a body and nothing else; a Short has a title field that is the
 * first thing a stranger reads and the main thing search indexes.
 *
 * ⛔ SO IT IS TAKEN, NOT WRITTEN — `headlineFor`, the same function that picks
 * the headline on a card: the approved `subject` when it fits, otherwise the
 * body's own opening sentence. Both are words the safety gate has already read
 * ⇒ a generated title would be text on a live channel that nobody approved and
 * nothing checked ⇒ trap_a_model_invents_specifics_it_cannot_have.
 *
 * ⚠️ RETURNS NULL RATHER THAN TRUNCATING. A title cut mid-clause reads as a
 * bug, and unlike a card there is no "publish it as text instead" to fall back
 * on — so the honest outcome is to hold the post and say why. 100 characters
 * is generous against a `subject` written to be under sixty, so this is a rare
 * path, not a common one.
 */
export function youtubeTitleFrom(subject: string | null, body: string): string | null {
  return headlineFor(subject ?? "", body, TITLE_MAX);
}
