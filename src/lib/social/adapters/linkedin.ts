// src/lib/social/adapters/linkedin.ts
// Putting a post on the Imotara LinkedIn Page.
//
// 🔑 THE PAGE ALREADY EXISTS and we are admin of it: /company/imotara, 24
// followers ⇒ linkedin_company_page_exists_and_is_neglected.
//
// 🔴 WHAT STANDS BETWEEN THIS FILE AND A LIVE POST, and it is not code.
// Posting as an ORGANISATION needs the `w_organization_social` scope, which
// belongs to the Community Management API — and that is NOT self-serve. It is
// an application to LinkedIn with a review. ⇒ This adapter is written against
// the documented contract so it is ready the day access lands, and
// `checkLinkedInPage` is what proves it when a token first arrives.
//
// ⚠️ EVERY FACT HERE CAME FROM THE OFFICIAL DOCS, read 19 Oct 2026, not from
// memory ⇒ https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
// This project has published a wrong, confident API specific before
// ⇒ trap_a_model_invents_specifics_it_cannot_have.

const POSTS_URL = "https://api.linkedin.com/rest/posts";

/**
 * 🔴 THE VERSION IS A HEADER, IT IS DATED, AND IT EXPIRES.
 *
 * `Linkedin-Version: YYYYMM` is required on every call, and LinkedIn SUNSETS
 * versions: the docs read on 19 Oct 2026 carry "Marketing Version 202511 will
 * be sunset on November 16, 2026".
 *
 * ⛔ SO IT IS NOT A CONSTANT IN THIS FILE. A hardcoded version is a channel
 * that dies on a date nobody has written down, and the symptom is a quiet
 * feed ⇒ trap_a_dead_cron_fails_where_nobody_is_watching. It is also the same
 * shape as the Graph version trap, where an unknown version was read as a
 * NODE ID and failed as "object does not exist"
 * ⇒ trap_an_unknown_graph_version_reads_as_a_node_id.
 *
 * ⚠️ Changing it must not need a deploy, so it is an env var with a floor
 * built in: a default that was current when written, overridable the moment
 * LinkedIn moves.
 */
export const DEFAULT_LINKEDIN_VERSION = "202610";

export function linkedinVersion(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.LINKEDIN_API_VERSION ?? "").trim();
  if (!raw) return DEFAULT_LINKEDIN_VERSION;
  // ⛔ Refuse a malformed override rather than sending it. LinkedIn answers a
  // bad version with an error that says nothing about the version.
  if (!/^\d{6}$/.test(raw)) {
    throw new Error(
      `LINKEDIN_API_VERSION must be six digits in YYYYMM form; got "${raw}". ` +
        `⚠️ LinkedIn sunsets versions — check the current one before changing this.`,
    );
  }
  return raw;
}

// ─────────────────────────────────────────────────────────────────────────────
// little text — the format `commentary` is written in
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 THE TRAP THAT WOULD HAVE MANGLED EVERY POST, and which no amount of
 * reasoning would have produced. LinkedIn's `commentary` is not plain text; it
 * is "little text format", and the docs are explicit:
 *
 *   "All reserved characters need to be escaped with a backslash, EVEN IF
 *    those characters are not used in one of the supported elements or
 *    templates."
 *
 * ⚠️ The reserved set is wide and ordinary: our posts carry parentheses
 * constantly, and this channel is allowed three hashtags.
 */
const RESERVED = ["\\", "|", "{", "}", "@", "[", "]", "(", ")", "<", ">", "#", "*", "_", "~"] as const;

/** Every reserved character escaped. ⚠️ Backslash FIRST, or the escapes
 *  inserted after it would themselves be escaped. */
function escapeLittle(text: string): string {
  let out = text;
  for (const ch of RESERVED) {
    out = out.split(ch).join(`\\${ch}`);
  }
  return out;
}

/**
 * A plain body, turned into something LinkedIn will render as written.
 *
 * 🔑 HASHTAGS SURVIVE AS HASHTAGS. Everything is escaped first — the only safe
 * order — and the tags the writer genuinely meant are then put back in the
 * documented `{hashtag|\#|value}` template, with the value's own reserved
 * characters still escaped.
 *
 * ⛔ The tag pattern is the SAME ONE the gate counts with ⇒ voiceGate, so a
 * thing that counts as a hashtag against the channel's limit is a thing that
 * renders as a hashtag. Two different patterns would mean a post judged to
 * have three tags publishing with two.
 */
export function littleText(plain: string): string {
  const tags: string[] = [];

  // ⚠️ Lifted BEFORE escaping, and put back after, so the `#` of a real tag is
  // not escaped into literal text.
  const lifted = plain.replace(/(^|\s)#([\p{L}\p{N}\p{M}_]+)/gu, (_m, lead: string, tag: string) => {
    tags.push(tag);
    return `${lead}\u0000${tags.length - 1}\u0000`;
  });

  let out = escapeLittle(lifted);

  out = out.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => {
    // 🔑 The VALUE is escaped too: a tag may legitimately contain `_`, which is
    // itself reserved.
    const value = escapeLittle(tags[Number(i)]);
    return `{hashtag|\\#|${value}}`;
  });

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Failures
// ─────────────────────────────────────────────────────────────────────────────

export type LinkedInFailure =
  /** The token is missing, empty or rejected. */
  | "auth"
  /** 403 — the scope is not granted, or the member has no role on the Page. */
  | "permission"
  /** The post itself was refused: too long, a bad URN, a missing field. */
  | "content"
  /** LinkedIn is rate limiting us. */
  | "rate"
  /** LinkedIn's end, or the network. ⚠️ The only kind worth retrying. */
  | "transient";

export type LinkedInPublish =
  | { ok: true; postId: string; url: string }
  | { ok: false; kind: LinkedInFailure; message: string };

/**
 * 🔑 403 IS TWO DIFFERENT PROBLEMS WEARING ONE CODE, and they need different
 * people. The docs: ACCESS_DENIED means "the required OAuth scope … is granted
 * AND the authenticated member has the necessary company page role". So it is
 * either the app's approval or the person's role on the Page — and saying
 * "permission denied" alone sends somebody to re-generate a token that was
 * never the problem ⇒ the 18 Oct lesson about a row shouting a generic remedy
 * over a correct diagnosis.
 */
export function classifyLinkedInError(status: number, body: string): { kind: LinkedInFailure; message: string } {
  const code = /"serviceErrorCode"\s*:\s*(\d+)/.exec(body)?.[1];
  const said = /"message"\s*:\s*"([^"]+)"/.exec(body)?.[1] ?? body.slice(0, 300);

  if (status === 401) {
    return { kind: "auth", message: `LinkedIn rejected the token${code ? ` (${code})` : ""}: ${said}` };
  }
  if (status === 403) {
    return {
      kind: "permission",
      message:
        `LinkedIn refused the post (403). ⚠️ TWO DIFFERENT CAUSES share this code: either the app ` +
        `does not have \`w_organization_social\` — the Community Management API application — or the ` +
        `member who authorised the token no longer holds ADMINISTRATOR, DIRECT_SPONSORED_CONTENT_POSTER ` +
        `or CONTENT_ADMIN on the Page. ▶️ Check the role first; it is the one that changes quietly. ` +
        `LinkedIn said: ${said}`,
    };
  }
  if (status === 429) return { kind: "rate", message: `LinkedIn is rate limiting: ${said}` };
  if (status >= 500) return { kind: "transient", message: `LinkedIn's end (${status}): ${said}` };
  return { kind: "content", message: `LinkedIn refused the post (${status}): ${said}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Publishing
// ─────────────────────────────────────────────────────────────────────────────

function headers(token: string, env?: NodeJS.ProcessEnv): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    // ⚠️ BOTH of these are required on every call, per the docs. Omitting
    // X-Restli-Protocol-Version does not fail loudly; it fails oddly.
    "X-Restli-Protocol-Version": "2.0.0",
    "Linkedin-Version": linkedinVersion(env),
    "Content-Type": "application/json",
  };
}

/**
 * Put a post on the Page.
 *
 * ⛔ NOTHING IS RETRIED IN HERE, the same rule as Facebook. A retry around a
 * call that may have succeeded is how a post gets published twice, and a
 * duplicate on a feed cannot be un-seen. The caller owns the attempt count.
 */
export async function publishToLinkedIn(args: {
  token: string;
  /** The numeric id, NOT the vanity name. ⇒ urn:li:organization:{id}. */
  organizationId: string;
  text: string;
  /** An already-uploaded image URN ⇒ urn:li:image:{id}. ⚠️ Optional. */
  imageUrn?: string;
  /**
   * 🔑 WHAT THE CARD SAYS, FOR SOMEBODY WHO CANNOT SEE IT.
   *
   * ⛔ Our cards carry the post's HEADLINE as their main element, so a reader
   * on a screen reader gets nothing at all without this — on a product whose
   * whole subject is people who are struggling, some of whom are blind.
   * ⚠️ LinkedIn allows 4,086 characters and recommends under 120.
   */
  imageAltText?: string;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}): Promise<LinkedInPublish> {
  const doFetch = args.fetchImpl ?? fetch;

  if (!args.token.trim()) {
    return { ok: false, kind: "auth", message: "There is no LinkedIn token to post with." };
  }
  if (!/^\d+$/.test(args.organizationId.trim())) {
    /**
     * 🔴 THE VANITY NAME IS NOT THE ID. The Page is reached by humans at
     * /company/imotara; the API wants urn:li:organization:{numeric}. Sending
     * the vanity name produces INVALID_URN_ID, which reads like a bug in the
     * post rather than in the configuration.
     */
    return {
      ok: false,
      kind: "content",
      message:
        `"${args.organizationId}" is not a LinkedIn organization id. ⚠️ The API wants the NUMERIC id ` +
        `(urn:li:organization:1234567), not the vanity name from /company/imotara.`,
    };
  }

  const body: Record<string, unknown> = {
    author: `urn:li:organization:${args.organizationId}`,
    commentary: littleText(args.text),
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
  if (args.imageUrn) {
    body.content = {
      media: {
        id: args.imageUrn,
        // ⚠️ Trimmed to LinkedIn's recommended length rather than its ceiling:
        // a screen reader announcing 4,000 characters before the post is worse
        // than one announcing a sentence.
        ...(args.imageAltText ? { altText: args.imageAltText.slice(0, 120) } : {}),
      },
    };
  }

  let res: Response;
  try {
    res = await doFetch(POSTS_URL, { method: "POST", headers: headers(args.token, args.env), body: JSON.stringify(body) });
  } catch (e) {
    return { ok: false, kind: "transient", message: `LinkedIn could not be reached: ${(e as Error).message}` };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const { kind, message } = classifyLinkedInError(res.status, text);
    return { ok: false, kind, message };
  }

  /**
   * 🔴 THE POST ID IS IN A RESPONSE HEADER, NOT THE BODY.
   *
   * The docs: "You should get a 201 response and the response header
   * `x-restli-id` contains the Post ID". ⛔ Reading the body for an id gets
   * nothing, the post is live, and we have stored no way to find it again —
   * which is how a published post becomes invisible to our own statistics.
   * ⚠️ The same class of mistake as Instagram's first call returning an id
   * that is not the post's ⇒ trap_instagram_takes_a_url_not_an_image.
   */
  const postId = res.headers.get("x-restli-id") ?? "";
  if (!postId) {
    return {
      ok: false,
      kind: "transient",
      message:
        "LinkedIn accepted the post but returned no `x-restli-id` header, so there is no id to store. " +
        "⚠️ The post may well be live — check the Page before posting it again.",
    };
  }

  return {
    ok: true,
    postId,
    // ⚠️ The documented shape for viewing a published post.
    url: `https://www.linkedin.com/feed/update/${postId}/`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The card — uploaded before the post, because a post cannot carry bytes
// ─────────────────────────────────────────────────────────────────────────────

const IMAGES_URL = "https://api.linkedin.com/rest/images";

export type LinkedInUpload =
  | { ok: true; imageUrn: string }
  | { ok: false; kind: LinkedInFailure; message: string };

/**
 * ⚠️ LinkedIn accepts JPG, PNG and GIF, under 36,152,320 pixels. Our cards are
 * 1200×627 ⇒ platforms.ts, which is four orders of magnitude inside that.
 */
export const LINKEDIN_MAX_PIXELS = 36_152_320;

/**
 * 🔴 HOW LONG TO WAIT FOR LINKEDIN TO FINISH PROCESSING THE IMAGE, and why
 * waiting is not optional.
 *
 * ⛔ The docs, on the Assets page and applying equally here: "It is required
 * that image upload completes successfully before creating a UGC Post or
 * Share. If the post is created before confirming image upload success and
 * the image upload fails to process, THE POST WON'T BE VISIBLE TO MEMBERS."
 *
 * ⚠️ AND THE IMAGES API CANNOT BE ASKED TO BE SYNCHRONOUS — "SYNCHRONOUS_UPLOAD
 * is not supported in Images API". So polling is the only way to know, and
 * posting without it risks a post that publishes, reports success, stores an
 * id, and is invisible. That failure would look exactly like a healthy feed
 * from our side ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
 */
export const PROCESSING_TRIES = 10;
export const PROCESSING_WAIT_MS = 1_000;

/**
 * Put the card on LinkedIn and wait until it is really there.
 *
 * ⛔ THREE CALLS, AND THE MIDDLE ONE IS NOT THE ONE YOU WOULD GUESS:
 *   1. initializeUpload  → an upload URL and the image URN
 *   2. **PUT** the bytes to that URL, WITH the Authorization header
 *   3. poll the image until `status` is AVAILABLE
 *
 * ⚠️ PUT, not POST — and carrying the token, which is the opposite of the
 * VIDEO upload, where the docs say the call "shouldn't include an OAuth
 * token". Two upload endpoints at the same company with opposite rules is
 * exactly the kind of thing that is read, not remembered.
 */
export async function uploadLinkedInImage(args: {
  token: string;
  organizationId: string;
  bytes: Uint8Array;
  contentType?: string;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  /** ⚠️ Injected so a test does not sit through ten real seconds. */
  waitMs?: (ms: number) => Promise<void>;
}): Promise<LinkedInUpload> {
  const doFetch = args.fetchImpl ?? fetch;
  const wait = args.waitMs ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const h = headers(args.token, args.env);

  // ── 1. tell LinkedIn an upload is coming ──────────────────────────────────
  let init: Response;
  try {
    init = await doFetch(`${IMAGES_URL}?action=initializeUpload`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ initializeUploadRequest: { owner: `urn:li:organization:${args.organizationId}` } }),
    });
  } catch (e) {
    return { ok: false, kind: "transient", message: `LinkedIn could not be reached: ${(e as Error).message}` };
  }
  if (!init.ok) {
    const body = await init.text().catch(() => "");
    const { kind, message } = classifyLinkedInError(init.status, body);
    return { ok: false, kind, message: `The card could not be registered with LinkedIn. ${message}` };
  }

  const registered = (await init.json().catch(() => ({}))) as {
    value?: { uploadUrl?: string; image?: string };
  };
  const uploadUrl = registered.value?.uploadUrl;
  const imageUrn = registered.value?.image;
  if (!uploadUrl || !imageUrn) {
    return {
      ok: false,
      kind: "transient",
      message: "LinkedIn accepted the upload registration but returned no uploadUrl or image URN.",
    };
  }

  // ── 2. the bytes ──────────────────────────────────────────────────────────
  let put: Response;
  try {
    put = await doFetch(uploadUrl, {
      // 🔑 PUT. ⛔ And WITH the token: the video endpoint refuses one, this
      // one requires it, and getting them the wrong way round fails at the
      // byte upload with nothing useful said.
      method: "PUT",
      headers: {
        Authorization: `Bearer ${args.token}`,
        "Content-Type": args.contentType ?? "image/png",
      },
      body: new Uint8Array(args.bytes) as unknown as BodyInit,
    });
  } catch (e) {
    return { ok: false, kind: "transient", message: `The card could not be uploaded: ${(e as Error).message}` };
  }
  if (!put.ok) {
    const body = await put.text().catch(() => "");
    const { kind, message } = classifyLinkedInError(put.status, body);
    return { ok: false, kind, message: `LinkedIn refused the card's bytes. ${message}` };
  }

  // ── 3. wait until it is really processed ──────────────────────────────────
  for (let attempt = 0; attempt < PROCESSING_TRIES; attempt += 1) {
    let look: Response;
    try {
      look = await doFetch(`${IMAGES_URL}/${encodeURIComponent(imageUrn)}`, { headers: h });
    } catch {
      // ⚠️ A hiccup while polling is not a failed upload. Try again.
      await wait(PROCESSING_WAIT_MS);
      continue;
    }
    if (look.ok) {
      const seen = (await look.json().catch(() => ({}))) as { status?: string };
      if (seen.status === "AVAILABLE") return { ok: true, imageUrn };
      if (seen.status === "PROCESSING_FAILED") {
        return {
          ok: false,
          kind: "content",
          message:
            "LinkedIn could not process the card — it reports PROCESSING_FAILED. " +
            "⚠️ Usually the file is too large or the format is not one of JPG, PNG or GIF.",
        };
      }
    }
    await wait(PROCESSING_WAIT_MS);
  }

  /**
   * ⛔ A TIMEOUT IS NOT A SUCCESS, and it is not a failure of the post either.
   * The image may well finish a second later — but posting now is the one
   * thing the docs explicitly warn against, because the post would publish
   * INVISIBLE. ⇒ Refuse, and let the caller's attempt counter try again.
   */
  return {
    ok: false,
    kind: "transient",
    message:
      `LinkedIn is still processing the card after ${PROCESSING_TRIES} checks. ` +
      `⛔ Nothing was posted: a post made before its image is ready publishes INVISIBLY, ` +
      `which is worse than a post that is late.`,
  };
}

export type LinkedInCheck =
  | { ok: true; organizationId: string; name: string }
  | { ok: false; kind: LinkedInFailure; message: string };

/**
 * 🔑 DOES THIS TOKEN ACTUALLY LET US POST AS THE PAGE?
 *
 * ⛔ IT ASKS, rather than inspecting the token's claimed scopes. A scope list
 * says what was requested; only a call says what is allowed. The 18 Oct
 * Facebook work turned on exactly this: a wrong id and a dead assignment
 * produced the same error, and the truth came from asking.
 *
 * ⚠️ Deliberately a READ. A check that published something to find out
 * whether it could publish would put a test post on the Page.
 */
export async function checkLinkedInPage(args: {
  token: string;
  organizationId: string;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}): Promise<LinkedInCheck> {
  const doFetch = args.fetchImpl ?? fetch;
  const urn = encodeURIComponent(`urn:li:organization:${args.organizationId}`);

  let res: Response;
  try {
    res = await doFetch(`https://api.linkedin.com/rest/organizations/${args.organizationId}`, {
      headers: headers(args.token, args.env),
    });
  } catch (e) {
    return { ok: false, kind: "transient", message: `LinkedIn could not be reached: ${(e as Error).message}` };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const { kind, message } = classifyLinkedInError(res.status, text);
    return { ok: false, kind, message: `${message} (asked about ${decodeURIComponent(urn)})` };
  }

  const json = (await res.json().catch(() => ({}))) as { localizedName?: string; name?: string };
  return {
    ok: true,
    organizationId: args.organizationId,
    name: json.localizedName ?? json.name ?? "the Page",
  };
}
