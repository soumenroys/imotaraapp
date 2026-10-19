// src/lib/social/adapters/x.ts
// Putting a post on @imotaraofficial.
//
// 🔑 THE OWNER CHOSE PAY-PER-USE, 19 Oct 2026. X's free tier is gone and the
// $200 Basic and $5,000 Pro plans are closed to new signups; what is left is
// metered, with credits bought up front.
//
// 💰 WHY THIS FILE CARES ABOUT A URL. The reported rate card is **$0.015 to
// create a post** and **$0.200 if the post contains a URL** — a thirteenfold
// difference decided by one field. ⇒ `linksInBody` is false for X and the
// destination rides on the card's QR codes, exactly as it does on Facebook,
// Instagram and LinkedIn. On a 280-character limit a URL costs 23 characters
// as well as the money.
//
// ⚠️ THOSE FIGURES ARE NOT FROM X. developer.x.com answers a fetch with 402,
// so they come from several independent sources that agree. ⛔ Treat them as
// close, not as the contract ⇒ trap_a_model_invents_specifics_it_cannot_have.
//
// 🔑 THE ENDPOINTS, HOWEVER, ARE FROM X'S OWN DOCS, read 19 Oct 2026 — and
// they contradict every 2026-dated guide found by searching, which still say
// to upload media to `upload.twitter.com/1.1/media/upload.json`. X's
// documentation does not mention the v1.1 endpoint at all.

const API = "https://api.x.com";

export type XFailure = "auth" | "permission" | "content" | "rate" | "billing" | "transient";

export type XPublish =
  | { ok: true; postId: string; url: string }
  | { ok: false; kind: XFailure; message: string };

/** ⚠️ X's own ceiling. The body target sits well below it ⇒ platforms.ts. */
export const X_MAX_CHARACTERS = 280;

export function classifyXError(status: number, body: string): { kind: XFailure; message: string } {
  const title = /"title"\s*:\s*"([^"]+)"/.exec(body)?.[1] ?? "";
  const detail = /"detail"\s*:\s*"([^"]+)"/.exec(body)?.[1] ?? body.slice(0, 300);

  if (status === 401) return { kind: "auth", message: `X rejected the token: ${detail}` };
  if (status === 403) {
    /**
     * 🔴 403 AT X IS OFTEN ABOUT MONEY, not permission — which is new, and
     * which a message saying "forbidden" would hide. Under pay-per-use an
     * exhausted credit balance stops posting, and the fix is a payment, not a
     * token.
     */
    if (/credit|billing|payment|quota|plan/i.test(`${title} ${detail}`)) {
      return {
        kind: "billing",
        message:
          `X refused the post and the reason looks financial: ${detail} ` +
          `⚠️ Under pay-per-use, credits are bought UP FRONT and posting stops when they run out. ` +
          `▶️ Check the balance in the developer portal before touching the token.`,
      };
    }
    return { kind: "permission", message: `X refused the post (403 ${title}): ${detail}` };
  }
  if (status === 429) return { kind: "rate", message: `X is rate limiting: ${detail}` };
  if (status === 402) {
    return {
      kind: "billing",
      message: `X answered 402 Payment Required: ${detail} ⚠️ Credits are spent; nothing was posted.`,
    };
  }
  if (status >= 500) return { kind: "transient", message: `X's end (${status}): ${detail}` };
  return { kind: "content", message: `X refused the post (${status} ${title}): ${detail}` };
}

export type XUpload = { ok: true; mediaId: string } | { ok: false; kind: XFailure; message: string };

/**
 * Put the card on X and get an id to attach to the post.
 *
 * ⛔ THE v1.1 ENDPOINT IS NOT USED, and that is deliberate rather than an
 * oversight. Several 2026-dated guides still say media must go to
 * `upload.twitter.com/1.1/media/upload.json` with OAuth 1.0a signatures. X's
 * own documentation describes only `api.x.com/2/media/upload` with a Bearer
 * user token, and does not mention v1.1 at all. ⇒ The docs win.
 *
 * ⚠️ CHUNKED, EVEN THOUGH OUR CARDS ARE SMALL. It is the flow X documents,
 * every step of it is sourced, and a single segment is the whole file when
 * the file is under 5MB — which a ~200KB card always is. ⛔ Inventing a
 * simpler endpoint that is not in the docs is how this project has been
 * wrong before.
 */
export async function uploadXMedia(args: {
  token: string;
  bytes: Uint8Array;
  contentType?: string;
  fetchImpl?: typeof fetch;
}): Promise<XUpload> {
  const doFetch = args.fetchImpl ?? fetch;
  const auth = { Authorization: `Bearer ${args.token}` };

  if (args.bytes.byteLength === 0) {
    return { ok: false, kind: "content", message: "There are no card bytes to upload to X." };
  }

  // ── 1. initialize ─────────────────────────────────────────────────────────
  let init: Response;
  try {
    init = await doFetch(`${API}/2/media/upload/initialize`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      // ⚠️ JSON, not form fields — X's docs say so explicitly, because the
      // other two steps of this same flow ARE multipart.
      body: JSON.stringify({
        media_type: args.contentType ?? "image/png",
        total_bytes: args.bytes.byteLength,
        // 🔑 "Image on a Post" ⇒ X's own category table.
        media_category: "tweet_image",
      }),
    });
  } catch (e) {
    return { ok: false, kind: "transient", message: `X could not be reached: ${(e as Error).message}` };
  }
  if (!init.ok) {
    const { kind, message } = classifyXError(init.status, await init.text().catch(() => ""));
    return { ok: false, kind, message: `The card could not be registered with X. ${message}` };
  }

  const started = (await init.json().catch(() => ({}))) as { data?: { id?: string } };
  const mediaId = started.data?.id;
  if (!mediaId) {
    return { ok: false, kind: "transient", message: "X accepted the upload registration but returned no media id." };
  }

  // ── 2. append ─────────────────────────────────────────────────────────────
  const form = new FormData();
  form.set("segment_index", "0");
  form.set("media", new Blob([new Uint8Array(args.bytes)], { type: args.contentType ?? "image/png" }), "card.png");

  let appended: Response;
  try {
    appended = await doFetch(`${API}/2/media/upload/${encodeURIComponent(mediaId)}/append`, {
      method: "POST",
      headers: auth,
      body: form,
    });
  } catch (e) {
    return { ok: false, kind: "transient", message: `The card could not be uploaded to X: ${(e as Error).message}` };
  }
  if (!appended.ok) {
    const { kind, message } = classifyXError(appended.status, await appended.text().catch(() => ""));
    return { ok: false, kind, message: `X refused the card's bytes. ${message}` };
  }

  // ── 3. finalize ───────────────────────────────────────────────────────────
  let done: Response;
  try {
    done = await doFetch(`${API}/2/media/upload/${encodeURIComponent(mediaId)}/finalize`, {
      method: "POST",
      headers: auth,
    });
  } catch (e) {
    return { ok: false, kind: "transient", message: `The card upload could not be finished: ${(e as Error).message}` };
  }
  if (!done.ok) {
    const { kind, message } = classifyXError(done.status, await done.text().catch(() => ""));
    return { ok: false, kind, message: `X would not finalise the card. ${message}` };
  }

  return { ok: true, mediaId };
}

/**
 * Put a post on X.
 *
 * ⛔ NOTHING IS RETRIED IN HERE, the same rule as every other adapter — and
 * here it costs money as well as a duplicate.
 */
export async function publishToX(args: {
  token: string;
  text: string;
  /** ⚠️ From `uploadXMedia`. Omitted for a text-only post, which X allows. */
  mediaId?: string;
  fetchImpl?: typeof fetch;
}): Promise<XPublish> {
  const doFetch = args.fetchImpl ?? fetch;

  if (!args.token.trim()) return { ok: false, kind: "auth", message: "There is no X token to post with." };
  if (!args.text.trim()) return { ok: false, kind: "content", message: "An X post needs words and this one has none." };

  /**
   * ⛔ REFUSED HERE RATHER THAN SENT. Over the limit X answers with a generic
   * error — and under pay-per-use, a refused call may still be a call. The
   * gate already holds posts to a target well under this ⇒ platforms.ts; this
   * is the backstop.
   */
  const length = [...args.text].length;
  if (length > X_MAX_CHARACTERS) {
    return {
      ok: false,
      kind: "content",
      message: `${length} characters — X will not accept more than ${X_MAX_CHARACTERS}. Nothing was sent.`,
    };
  }

  const body: Record<string, unknown> = { text: args.text };
  if (args.mediaId) body.media = { media_ids: [args.mediaId] };

  let res: Response;
  try {
    res = await doFetch(`${API}/2/tweets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${args.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, kind: "transient", message: `X could not be reached: ${(e as Error).message}` };
  }

  if (!res.ok) {
    const { kind, message } = classifyXError(res.status, await res.text().catch(() => ""));
    return { ok: false, kind, message };
  }

  const made = (await res.json().catch(() => ({}))) as { data?: { id?: string } };
  const postId = made.data?.id;
  if (!postId) {
    return {
      ok: false,
      kind: "transient",
      message:
        "X accepted the post but returned no id. ⚠️ It may well be live, and under pay-per-use it " +
        "has been paid for — look at the profile before posting it again.",
    };
  }

  return { ok: true, postId, url: `https://x.com/imotaraofficial/status/${postId}` };
}
