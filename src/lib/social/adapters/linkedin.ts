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
  if (args.imageUrn) body.content = { media: { id: args.imageUrn } };

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
