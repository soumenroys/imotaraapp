// src/lib/social/adapters/facebook.ts
// Talking to the Facebook Page, and only to the Facebook Page.
//
// 🔑 WHY A VERIFY EXISTS SEPARATELY FROM A PUBLISH. Until 18 Oct the health
// check could say a token was SAVED and never that it WORKED — it compared an
// expiry date we were told at connect time and nothing else. A token revoked
// at the other end, an app removed from the portfolio, a Page un-assigned: all
// of those read as healthy, and the first symptom would have been a quiet week
// with nothing posted ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
//
// ⛔ SO `ok` IS ONLY EVER SET BY A REAL CALL THAT SUCCEEDED. Nothing in here
// infers health from a date, a column, or the absence of an error.

/**
 * ⚠️ PINNED, AND MEASURED RATHER THAN GUESSED. On 18 Oct v26.0 was the newest
 * version Facebook actually serves: v27.0 and above come back
 * `Unknown path components: /me`, because an unknown version is read as a node
 * id rather than refused. ⛔ Which means a wrong version here does not fail
 * loudly — it fails as "that object does not exist", and somebody spends an
 * afternoon on the token.
 *
 * 🔑 Overridable without a deploy, because Meta retires versions on a ~2-year
 * clock and the fix must not need an engineer.
 */
const DEFAULT_VERSION = "v26.0";

/**
 * ⚠️ EXPORTED so the Instagram adapter uses the SAME version pin. Instagram's
 * API is served by graph.facebook.com too, and a second copy of the version
 * string is a second thing to remember when Meta retires one — on a failure
 * mode that reads as "that object does not exist" rather than "wrong version"
 * ⇒ trap_an_unknown_graph_version_reads_as_a_node_id.
 */
export function graph(path: string): string {
  const version = process.env.FACEBOOK_GRAPH_VERSION?.trim() || DEFAULT_VERSION;
  return `https://graph.facebook.com/${version}/${path}`;
}

/**
 * What went wrong, in the terms that decide what somebody does about it.
 *
 * ⚠️ These are NOT a re-spelling of Meta's codes. They are the four different
 * actions available: paste a new token, fix the portfolio, fix the id, or wait.
 * A caller that only forwards Meta's own message makes every failure look like
 * the same failure.
 */
export type FacebookFailure =
  /** The token is gone: expired, revoked, or its app was removed. ▶️ Re-paste. */
  | "token"
  /** The token is alive but lacks a permission or the Page assignment. ▶️ Portfolio. */
  | "permission"
  /** The Page id does not name something this token can see. ▶️ Fix the id. */
  | "page"
  /** Rate limited. ▶️ Wait; nothing is broken. */
  | "rate"
  /** We could not reach Facebook at all. ▶️ Wait; says nothing about the token. */
  | "network"
  | "unknown";

export type FacebookCheck =
  | {
      ok: true;
      pageId: string;
      pageName: string;
      /** Did a Page access token come back? ⚠️ Posting needs one; reading does not. */
      canPost: boolean;
      note: string;
    }
  | { ok: false; kind: FacebookFailure; message: string };

type GraphError = {
  message?: string;
  code?: number;
  error_subcode?: number;
  type?: string;
};

/**
 * Meta's numbers, turned into the four actions above.
 *
 * ⚠️ `100/33` IS THE AMBIGUOUS ONE and it is the one that will actually
 * happen: "object does not exist, or you do not have permission" is the same
 * reply for a mistyped Page id and for a Page the token was never assigned.
 * ⛔ It must not be reported as a dead token — re-pasting a perfectly good
 * token is the most expensive wrong move available here.
 */
export function classifyGraphError(err: GraphError): { kind: FacebookFailure; message: string } {
  const code = err.code ?? 0;
  const sub = err.error_subcode ?? 0;
  const said = err.message?.trim() || "Facebook did not say why.";

  if (code === 190) {
    const why =
      sub === 463
        ? "it expired"
        : sub === 458
          ? "the app was removed from the account"
          : sub === 460
            ? "the password changed, which invalidated this kind of token"
            : "it was revoked or is no longer valid";
    return {
      kind: "token",
      message:
        `Facebook refused the token — ${why}. ▶️ Generate a new one on the system user and paste ` +
        `it in. ⛔ Your password is not involved.`,
    };
  }

  if (code === 200 || code === 10 || code === 3) {
    return {
      kind: "permission",
      message:
        `The token is alive but is not allowed to do this: ${said} ▶️ Check that the system user ` +
        `still has the Page assigned and that pages_manage_posts is on the token.`,
    };
  }

  if (code === 100 && sub === 33) {
    return {
      kind: "page",
      message:
        "Facebook cannot see that Page with this token. That is EITHER a wrong Page id OR a Page " +
        "the system user is no longer assigned to — it is not a dead token, so ⛔ do not re-paste " +
        "before checking the id and the assignment.",
    };
  }

  /**
   * ⚠️ A #100 ABOUT A METRIC IS NOT ABOUT THE PAGE. Sending somebody to check
   * a Page id that is perfectly correct is the same wasted afternoon as
   * telling them to re-paste a working token.
   */
  if (code === 100 && /valid insights metric|nonexisting field/i.test(said)) {
    /**
     * 🔴 THIS MESSAGE GAVE THE WRONG REMEDY, CONFIDENTLY, FOR WEEKS.
     *
     * ⛔ It said "Meta RETIRES these in waves, so this is almost certainly a
     * name that has been withdrawn" and sent the reader to update the metric
     * lists. On 19 Oct the real cause was neither: the request asked for a
     * FIELD CALLED `angry`, when Graph wants `reactions.type(ANGRY).as(angry)`.
     * A malformed field expression and a withdrawn metric produce the SAME
     * #100, and only one of them is Meta's doing.
     *
     * ⚠️ THE SAME SHAPE AS 18 OCT, when a row shouted "generate a new token"
     * over a correct diagnosis, on the screen where obeying it costs a
     * working credential. ⇒ A specific diagnosis must REPLACE a generic one,
     * never be stated as though it were the only possibility.
     */
    const alias = /nonexisting field/i.test(said);
    return {
      kind: "unknown",
      message:
        `Facebook does not recognise that field or metric: ${said} ` +
        (alias
          ? `⚠️ TWO THINGS LOOK LIKE THIS. Either the request asked for a field that does not exist — ` +
            `a reaction breakdown must be written \`reactions.type(ANGRY).as(angry)\`, not \`angry.type(ANGRY)\` — ` +
            `or Meta has withdrawn the name. ▶️ Check the field EXPRESSION first; it is the half we control.`
          : `⚠️ Meta retires insights metrics in waves, so this is likely a withdrawn name rather than ` +
            `anything wrong with the Page or the token. ▶️ Update the metric lists in facebook.ts.`),
    };
  }

  if (code === 100 || code === 2500) {
    return {
      kind: "page",
      message: `Facebook could not answer that request: ${said} ▶️ Check the Page id.`,
    };
  }

  if (code === 4 || code === 17 || code === 32 || code === 613) {
    return {
      kind: "rate",
      message: `Facebook is rate-limiting us: ${said} ▶️ Nothing is broken; it clears on its own.`,
    };
  }

  return { kind: "unknown", message: `Facebook said: ${said} (code ${code}${sub ? `/${sub}` : ""})` };
}

/**
 * Mint the Page's own access token from the system user's.
 *
 * 🔑 POSTING NEEDS THE PAGE'S TOKEN, NOT THE SYSTEM USER'S. A post made with
 * the user token is attributed to the person, not the Page — or refused. The
 * Page token comes from the Page node itself and is derived per call.
 *
 * ⛔ NEVER STORED. A second copy of a credential is a second place it can leak
 * from, it expires on its own schedule, and deriving it costs one request that
 * the publish was going to make anyway.
 */
export async function pageAccessToken(args: {
  token: string;
  pageId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; token: string } | { ok: false; kind: FacebookFailure; message: string }> {
  const doFetch = args.fetchImpl ?? fetch;
  try {
    const res = await doFetch(
      graph(encodeURIComponent(args.pageId)) +
        `?fields=access_token&access_token=${encodeURIComponent(args.token)}`,
      { signal: AbortSignal.timeout(15_000), cache: "no-store" },
    );
    const json = (await res.json()) as { access_token?: string; error?: GraphError };
    if (json.error) return { ok: false, ...classifyGraphError(json.error) };
    if (!json.access_token) {
      return {
        ok: false,
        kind: "permission",
        message:
          "Facebook returned no Page access token for this Page. ▶️ The token needs pages_show_list " +
          "and pages_read_engagement, and the system user needs the Page assigned.",
      };
    }
    return { ok: true, token: json.access_token };
  } catch (e) {
    return {
      ok: false,
      kind: "network",
      message: `Could not reach Facebook (${(e as Error).message}).`,
    };
  }
}

/**
 * 🔑 WHAT CAN THIS TOKEN ACTUALLY DO?
 *
 * 🔴 WRITTEN BECAUSE A WHOLE EVENING WENT ON INFERRING IT. Facebook refused
 * every post's figures with "requires the 'pages_read_engagement' permission".
 * The permission was ticked when the token was generated. The app holds it.
 * The token's last four characters did not change when a new one was pasted.
 * ⛔ Every one of those is EVIDENCE ABOUT something other than the token's
 * actual scopes, and three pieces of indirect evidence do not add up to one
 * direct answer ⇒ feedback_check_the_record_before_asserting.
 *
 * ⚠️ `/debug_token` says it outright: the scopes, the app, the expiry, whether
 * it is still valid. One call, and the guessing stops.
 *
 * ⛔ IT RETURNS NO SECRET. The token goes in; a description comes back. The
 * token itself is never echoed, and this function must never be changed to
 * return it ⇒ the admin screen would then display a credential.
 */
export type TokenFacts =
  | {
      ok: true;
      /** ⚠️ Empty on a system user token that carries none — which is the answer. */
      scopes: string[];
      appId: string | null;
      /** ⚠️ Null means "never", which is what a system user token usually is. */
      expiresAt: string | null;
      valid: boolean;
      type: string | null;
    }
  | { ok: false; kind: FacebookFailure; message: string };

export async function describeToken(args: {
  token: string;
  fetchImpl?: typeof fetch;
}): Promise<TokenFacts> {
  const doFetch = args.fetchImpl ?? fetch;
  try {
    /**
     * ⚠️ THE TOKEN INSPECTS ITSELF. `/debug_token` normally wants an app
     * access token to ask about somebody else's; asking about your OWN with
     * the same token is allowed and avoids putting an app secret in this path
     * at all ⛔ — an app secret is a worse thing to hold than the token.
     */
    const res = await doFetch(
      graph("debug_token") +
        `?input_token=${encodeURIComponent(args.token)}&access_token=${encodeURIComponent(args.token)}`,
      { signal: AbortSignal.timeout(15_000), cache: "no-store" },
    );
    const json = (await res.json()) as {
      data?: {
        scopes?: string[];
        app_id?: string;
        expires_at?: number;
        is_valid?: boolean;
        type?: string;
      };
      error?: GraphError;
    };
    if (json.error) return { ok: false, ...classifyGraphError(json.error) };
    if (!json.data) {
      return { ok: false, kind: "unknown", message: "Facebook answered without describing the token." };
    }
    return {
      ok: true,
      scopes: json.data.scopes ?? [],
      appId: json.data.app_id ?? null,
      // ⚠️ 0 means never, which is not the same as "unknown".
      expiresAt: json.data.expires_at ? new Date(json.data.expires_at * 1000).toISOString() : null,
      valid: json.data.is_valid === true,
      type: json.data.type ?? null,
    };
  } catch (e) {
    return { ok: false, kind: "network", message: `Could not reach Facebook (${(e as Error).message}).` };
  }
}

export type FacebookPublish =
  | { ok: true; postId: string; url: string }
  | { ok: false; kind: FacebookFailure; message: string };

/**
 * Put a post on the Page.
 *
 * 🔑 WHY A PICTURE IS UPLOADED UNPUBLISHED AND THEN ATTACHED, rather than
 * posted straight to `/photos`:
 *
 *   • `/photos` takes a `caption`, and a caption is not a post message — the
 *     two render differently and only one of them is the post's text;
 *   • the two-step form is the documented way to put a message and an image in
 *     ONE post rather than two things on the timeline;
 *   • and `attached_media` takes a LIST, so the same path carries a carousel
 *     the day we build one, without a second way of publishing.
 *
 * ⛔ NOTHING IS RETRIED IN HERE. A retry around a call that may have succeeded
 * is how a post gets published twice, and a duplicate on a timeline cannot be
 * un-seen. The caller owns the attempt count and the decision not to try again.
 */
export async function publishToFacebook(args: {
  token: string;
  pageId: string;
  message: string;
  /** PNG bytes, already rendered. ⚠️ Omitted for a text-only post. */
  picture?: Uint8Array;
  fetchImpl?: typeof fetch;
}): Promise<FacebookPublish> {
  const doFetch = args.fetchImpl ?? fetch;

  const page = await pageAccessToken({ token: args.token, pageId: args.pageId, fetchImpl: args.fetchImpl });
  if (!page.ok) return page;

  let attachedMedia: string | undefined;

  if (args.picture) {
    const form = new FormData();
    form.set("access_token", page.token);
    // ⚠️ `published=false` — this uploads the image and does NOT put it on the
    // timeline. The feed call below is the only thing that publishes.
    form.set("published", "false");
    form.set("source", new Blob([new Uint8Array(args.picture)], { type: "image/png" }), "post.png");

    let photoId: string;
    try {
      const res = await doFetch(graph(`${encodeURIComponent(args.pageId)}/photos`), {
        method: "POST",
        body: form,
        // ⚠️ Longer than a text post: this is an upload, and timing it out at
        // fifteen seconds would fail pictures that were about to succeed.
        signal: AbortSignal.timeout(60_000),
      });
      const json = (await res.json()) as { id?: string; error?: GraphError };
      if (json.error) return { ok: false, ...classifyGraphError(json.error) };
      if (!json.id) {
        return { ok: false, kind: "unknown", message: `Facebook accepted the image but returned no id (HTTP ${res.status}).` };
      }
      photoId = json.id;
    } catch (e) {
      return {
        ok: false,
        kind: "network",
        message:
          `The picture could not be uploaded (${(e as Error).message}). ⚠️ Nothing was posted — ` +
          `the image was uploaded unpublished, so there is nothing on the timeline to undo.`,
      };
    }
    attachedMedia = JSON.stringify([{ media_fbid: photoId }]);
  }

  const body = new URLSearchParams({ access_token: page.token, message: args.message });
  if (attachedMedia) body.set("attached_media", attachedMedia);

  try {
    const res = await doFetch(graph(`${encodeURIComponent(args.pageId)}/feed`), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(60_000),
    });
    const json = (await res.json()) as { id?: string; error?: GraphError };
    if (json.error) return { ok: false, ...classifyGraphError(json.error) };
    if (!json.id) {
      return { ok: false, kind: "unknown", message: `Facebook returned no post id (HTTP ${res.status}).` };
    }
    return {
      ok: true,
      postId: json.id,
      // ⚠️ The id comes back as `{pageId}_{postId}`; the permalink wants it
      // whole, exactly as given.
      url: `https://www.facebook.com/${json.id}`,
    };
  } catch (e) {
    /**
     * 🔴 THE ONE FAILURE THAT IS NOT SAFE TO ASSUME FAILED. A timeout here
     * means the request may have been received and the post may exist. ⛔ So
     * this says so rather than reporting a clean failure — the caller must not
     * treat it as "nothing happened" and try again.
     */
    return {
      ok: false,
      kind: "network",
      message:
        `The post call did not complete (${(e as Error).message}). ⛔ It may still have published — ` +
        `check the Page before trying again, because a retry would post it twice.`,
    };
  }
}

/**
 * Which Pages can this token actually see?
 *
 * 🔴 THIS EXISTS BECAUSE "EITHER/OR" IS NOT A DIAGNOSIS. Facebook answers
 * `100/33` for both a wrong Page id and an unassigned Page, and the first
 * version of this file simply told the reader it was one of the two and left
 * them to work out which — on the one screen where guessing wrong means
 * revoking a working credential.
 *
 * ⚠️ `/me/accounts` on a system user token lists exactly the Pages that user
 * has been assigned, which settles it: a list with our Page in it means the id
 * was wrong, and an empty list means the assignment is.
 *
 * ⛔ Best effort. A failure here must never overwrite the real finding — this
 * is extra evidence for a diagnosis already made, not a second verdict.
 */
export async function listFacebookPages(args: {
  token: string;
  fetchImpl?: typeof fetch;
}): Promise<{ id: string; name: string }[] | null> {
  const doFetch = args.fetchImpl ?? fetch;
  try {
    const res = await doFetch(
      graph("me/accounts") + `?fields=id,name&limit=50&access_token=${encodeURIComponent(args.token)}`,
      { signal: AbortSignal.timeout(15_000), cache: "no-store" },
    );
    const json = (await res.json()) as { data?: { id: string; name: string }[]; error?: GraphError };
    if (json.error || !Array.isArray(json.data)) return null;
    return json.data.map((p) => ({ id: String(p.id), name: String(p.name ?? "unnamed") }));
  } catch {
    return null;
  }
}

/** The sentence that turns "one of two things" into "this thing". */
function namePagesItCanSee(pages: { id: string; name: string }[] | null, wanted: string): string {
  if (pages === null) return "";
  if (pages.length === 0) {
    return (
      ` ⇒ Asked again: this token can see NO Pages at all, so the Page is not assigned to the ` +
      `system user. ▶️ Business settings → Users → System users → … → Assign assets → Facebook Pages.`
    );
  }
  const match = pages.find((p) => p.id === wanted);
  if (match) {
    return ` ⇒ Asked again: the token CAN see “${match.name}” (${match.id}), so this is something else.`;
  }
  const list = pages.map((p) => `“${p.name}” (${p.id})`).join(", ");
  return (
    ` ⇒ Asked again: this token can see ${list} — and not ${wanted}. ` +
    `▶️ That is the id to use. ⛔ The token is fine; do not replace it.`
  );
}

/**
 * Ask Facebook whether this token still reaches this Page.
 *
 * 🔑 ONE CALL ANSWERS THREE QUESTIONS: the token is alive (it did not 190), it
 * reaches the Page we think it does (the id comes back and matches), and a
 * Page access token can be minted from it (`access_token` is present), which
 * is the thing publishing will need.
 *
 * ⛔ The Page token is checked for PRESENCE and then dropped. It is never
 * returned, never logged, and never stored: a second copy of a credential is a
 * second place it can leak from, and this function's caller does not post.
 */
export async function checkFacebookPage(args: {
  token: string;
  pageId: string;
  /** ⚠️ Injected so tests never touch the network. */
  fetchImpl?: typeof fetch;
}): Promise<FacebookCheck> {
  const doFetch = args.fetchImpl ?? fetch;
  const url =
    graph(encodeURIComponent(args.pageId)) +
    `?fields=id,name,access_token&access_token=${encodeURIComponent(args.token)}`;

  let res: Response;
  try {
    // ⚠️ A timeout, because a hung call inside a cron is a cron that looks
    // dead — the exact failure this whole file exists to make visible.
    res = await doFetch(url, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  } catch (e) {
    return {
      ok: false,
      kind: "network",
      message:
        `Could not reach Facebook (${(e as Error).message}). ⚠️ This says nothing about the ` +
        `token — do not replace it on the strength of this.`,
    };
  }

  let json: { id?: string; name?: string; access_token?: string; error?: GraphError };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    return {
      ok: false,
      kind: "network",
      message: `Facebook replied with something that was not JSON (HTTP ${res.status}).`,
    };
  }

  if (json.error) {
    const verdict = classifyGraphError(json.error);
    // 🔑 Only for the ambiguous one. A dead token cannot list anything, and
    // asking would add a second failure to a message that is already clear.
    if (verdict.kind === "page") {
      const pages = await listFacebookPages({ token: args.token, fetchImpl: args.fetchImpl });
      return { ok: false, kind: "page", message: verdict.message + namePagesItCanSee(pages, args.pageId) };
    }
    return { ok: false, ...verdict };
  }

  if (!json.id) {
    return {
      ok: false,
      kind: "unknown",
      message: `Facebook answered without an id (HTTP ${res.status}).`,
    };
  }

  /**
   * ⛔ A DIFFERENT ID IS A FAILURE, not a detail. Facebook resolves some
   * aliases, so a wrong id can quietly return a REAL page — and then every
   * post would publish, successfully, to somewhere else.
   */
  if (json.id !== args.pageId) {
    return {
      ok: false,
      kind: "page",
      message:
        `That token reaches Page ${json.id} (“${json.name ?? "unnamed"}”), not ${args.pageId}. ` +
        `⛔ Posting would publish to the wrong Page. ▶️ Correct the id.`,
    };
  }

  const canPost = Boolean(json.access_token);
  return {
    ok: true,
    pageId: json.id,
    pageName: json.name ?? "unnamed",
    canPost,
    note: canPost
      ? `Facebook accepted the token and returned the Page “${json.name}”.`
      : `The token reaches “${json.name}”, but Facebook did not return a Page access token — ` +
        `⚠️ reading works and POSTING WILL NOT. ▶️ Add pages_show_list and pages_read_engagement ` +
        `to the token.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Taking the stock of a channel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔑 THE OWNER'S ASK, 18 Oct: take stock when a channel is connected, then
 * update it after every day's post, so the scheduler can be judged on whether
 * anything actually moved.
 *
 * ⛔ WHAT THIS CANNOT READ, said here rather than discovered as a column of
 * zeros. Page REACH and IMPRESSIONS live behind `read_insights`, and the token
 * carries `pages_manage_posts`, `pages_read_engagement` and `pages_show_list`.
 * Adding that scope means regenerating the token, so until somebody decides to
 * do that, impressions are NULL — never 0. "We could not ask" and "nobody saw
 * it" are different facts.
 */
export type PageStats = {
  followers: number | null;
  fans: number | null;
  name: string | null;
  raw: Record<string, unknown>;
};

export async function fetchPageStats(args: {
  token: string;
  pageId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; stats: PageStats } | { ok: false; kind: FacebookFailure; message: string }> {
  const doFetch = args.fetchImpl ?? fetch;
  try {
    const res = await doFetch(
      graph(encodeURIComponent(args.pageId)) +
        `?fields=id,name,followers_count,fan_count&access_token=${encodeURIComponent(args.token)}`,
      { signal: AbortSignal.timeout(15_000), cache: "no-store" },
    );
    const json = (await res.json()) as {
      name?: string;
      followers_count?: number;
      fan_count?: number;
      error?: GraphError;
    };
    if (json.error) return { ok: false, ...classifyGraphError(json.error) };

    /**
     * ⚠️ `?? null`, NOT `?? 0`. A field Facebook declined to return must not
     * enter the record as a real measurement of zero — it would drag every
     * average down and look like a collapse rather than a gap.
     */
    return {
      ok: true,
      stats: {
        followers: typeof json.followers_count === "number" ? json.followers_count : null,
        fans: typeof json.fan_count === "number" ? json.fan_count : null,
        name: json.name ?? null,
        raw: json as Record<string, unknown>,
      },
    };
  } catch (e) {
    return { ok: false, kind: "network", message: `Could not reach Facebook (${(e as Error).message}).` };
  }
}

/** How one published post is doing. ⚠️ Its numbers keep moving for days. */
export type PostStats = {
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  /** ⛔ NULL without `read_insights` ⇒ fetchPageStats. */
  impressions: number | null;
  /**
   * 🔴 THE SIGN OF THE REACTION, not just its size.
   *
   * ⚠️ NULL means the edge did not answer; 0 means nobody reacted that way.
   * Collapsing the two would make a missing measurement read as "nobody was
   * angry" — the reassuring answer, and the wrong one.
   */
  angry: number | null;
  sad: number | null;
  love: number | null;
  raw: Record<string, unknown>;
};

export async function fetchPostStats(args: {
  token: string;
  postId: string;
  /**
   * 🔴 THE PAGE ID, BECAUSE A POST'S ENGAGEMENT NEEDS A **PAGE** TOKEN.
   *
   * ⛔ THE DEFECT THIS FIXES, found 19 Oct by asking `/debug_token` instead of
   * inferring for a fourth time. Facebook refused every post's figures with
   * "requires the 'pages_read_engagement' permission" — and the token HAS
   * that permission. The inspector printed it plainly.
   *
   * ⚠️ The permission was never the problem. The TOKEN KIND was. Every
   * publishing path here exchanges the system-user token for a Page token
   * ⇒ pageAccessToken, called in four places. The two stats readers used the
   * raw system-user token, and reading a Page post's engagement with one is
   * refused in the words of a missing permission — which is why three
   * confident wrong answers all sounded supported.
   */
  pageId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; stats: PostStats } | { ok: false; kind: FacebookFailure; message: string }> {
  const doFetch = args.fetchImpl ?? fetch;

  const page = await pageAccessToken({ token: args.token, pageId: args.pageId, fetchImpl: args.fetchImpl });
  if (!page.ok) return page;

  try {
    /**
     * 🔑 `summary(true)` is what returns a COUNT rather than a page of
     * objects. Without it this asks Facebook for every reaction one by one and
     * then counts the first twenty-five of them.
     */
    const res = await doFetch(
      graph(encodeURIComponent(args.postId)) +
        /**
         * 🔴 THE REACTION TYPES, NOT JUST THE TOTAL — and for this brand that
         * is the measurement that matters most.
         *
         * A total of 40 reactions says a post did well. Forty ANGRY and SAD
         * reactions on a mental-health post says something has gone wrong, and
         * until now the two were the same number. ⛔ A feedback loop that
         * rewards engagement without reading its SIGN would treat a post
         * people are upset by as a success and ask for more like it.
         *
         * ⚠️ Each type needs its own summary edge — Graph has no single field
         * that breaks reactions down. `limit(0)` keeps them as counts rather
         * than pages of objects.
         */
        /**
         * 🔴 `.as(alias)`, AND IT WAS MISSING — so this has NEVER worked.
         *
         * ⛔ It asked for `angry.type(ANGRY)…`, which requests a FIELD CALLED
         * `angry`. There is no such field. Graph breaks reactions down by
         * asking the SAME field several times with different filters and
         * naming each result: `reactions.type(ANGRY).as(angry)`.
         *
         * ⚠️ Facebook said so plainly — "(#100) Tried accessing nonexisting
         * field (angry)" — and nobody saw it for weeks, because every other
         * post failed EARLIER on a missing `pages_read_engagement` permission
         * and never reached this call. One defect hid behind another, and it
         * took a post with a different id shape to get far enough to show it.
         */
        `?fields=reactions.summary(true).limit(0),comments.summary(true).limit(0),shares` +
        `,reactions.type(ANGRY).limit(0).summary(true).as(angry)` +
        `,reactions.type(SAD).limit(0).summary(true).as(sad)` +
        `,reactions.type(LOVE).limit(0).summary(true).as(love)` +
        // ⛔ The PAGE token, not the one passed in ⇒ the note on `pageId`.
        `&access_token=${encodeURIComponent(page.token)}`,
      { signal: AbortSignal.timeout(15_000), cache: "no-store" },
    );
    type Summary = { summary?: { total_count?: number } };
    const json = (await res.json()) as {
      reactions?: Summary;
      comments?: Summary;
      shares?: { count?: number };
      angry?: Summary;
      sad?: Summary;
      love?: Summary;
      error?: GraphError;
    };
    if (json.error) return { ok: false, ...classifyGraphError(json.error) };

    const num = (v: unknown) => (typeof v === "number" ? v : null);
    return {
      ok: true,
      stats: {
        reactions: num(json.reactions?.summary?.total_count),
        comments: num(json.comments?.summary?.total_count),
        /**
         * ⚠️ `shares` is ABSENT when a post has none — Facebook omits the
         * field rather than returning zero. Here, and only here, absent does
         * mean none: the field is part of the response shape, so its absence
         * is an answer rather than a refusal.
         */
        shares: typeof json.shares?.count === "number" ? json.shares.count : 0,
        impressions: null,
        /**
         * ⚠️ NULL WHEN THE EDGE DID NOT ANSWER, not 0. An older post, a
         * permission change or a Graph version that drops the edge would
         * otherwise read as "nobody was angry", which is the reassuring
         * answer and the wrong one.
         */
        angry: num(json.angry?.summary?.total_count),
        sad: num(json.sad?.summary?.total_count),
        love: num(json.love?.summary?.total_count),
        raw: json as Record<string, unknown>,
      },
    };
  } catch (e) {
    return { ok: false, kind: "network", message: `Could not reach Facebook (${(e as Error).message}).` };
  }
}

/**
 * Page reach and impressions — how many people actually SAW anything.
 *
 * 🔴 THE NUMBER THAT MAKES THE REST MEAN SOMETHING. Followers and reactions
 * describe people who already arrived; impressions describe whether a post was
 * put in front of anybody at all. Without it, "no reactions" is unreadable —
 * it could be a weak post or a post nobody was shown.
 *
 * ⛔ NEEDS `read_insights` ON THE TOKEN. If the scope is missing, Facebook
 * answers with a permission error rather than an empty series — which is why
 * this returns a classified failure and the caller stores NULL, never 0.
 */
export type PageInsights = {
  impressions: number | null;
  reach: number | null;
  raw: Record<string, unknown>;
};

/**
 * 🔴 META RETIRES INSIGHTS METRICS, IN WAVES, AND THE OLD NAME STOPS BEING A
 * NAME AT ALL.
 *
 * Asked for `page_impressions` on 18 Oct 2026, Facebook answered
 * `(#100) The value must be a valid insights metric` — not a permission
 * error. `page_impressions_unique` was deprecated in June 2026,
 * `page_impressions` and `post_impressions` in waves before it, and the
 * published replacements disagree between Meta's own changelog and every
 * connector vendor that tracks them.
 *
 * ⛔ SO THE NAME IS NOT GUESSED ONCE AND BAKED IN. Each list is tried in
 * order, newest first, and the first that ANSWERS is used — and the name that
 * worked is recorded, so the next person reads a fact instead of repeating
 * this search. ⚠️ One invalid metric fails the WHOLE request, which is why
 * they are tried one at a time rather than asked for together.
 *
 * ⇒ Same family as trap_an_unknown_graph_version_reads_as_a_node_id: a string
 * Meta publishes is a public identifier with a retirement date.
 */
const PAGE_REACH_METRICS = ["page_total_media_view_unique", "page_impressions_unique"];
const PAGE_VIEW_METRICS = ["page_media_view", "page_views_total", "page_impressions"];
const POST_VIEW_METRICS = ["post_media_view", "post_impressions_unique", "post_impressions"];

/** ⚠️ Returns null for a metric Facebook refuses as invalid, and THROWS
 *  nothing — the caller decides whether a missing figure matters. */
async function readMetric(
  doFetch: typeof fetch,
  node: string,
  metric: string,
  extra: string,
  token: string,
): Promise<{ value: number | null; invalid: boolean; raw: unknown; error?: GraphError }> {
  const res = await doFetch(
    graph(`${encodeURIComponent(node)}/insights`) +
      `?metric=${metric}${extra}&access_token=${encodeURIComponent(token)}`,
    { signal: AbortSignal.timeout(20_000), cache: "no-store" },
  );
  const json = (await res.json()) as {
    data?: { name?: string; values?: { value?: number }[] }[];
    error?: GraphError;
  };
  if (json.error) {
    /**
     * 🔴 "NOT A METRIC" IS RETIREMENT — TRY THE NEXT NAME. ANYTHING ELSE IS A
     * REAL FAILURE AND MUST BE RETURNED, NOT SWALLOWED.
     *
     * ⛔ The first version of this returned `{ value: null, invalid: false }`
     * for every other error, and the caller read that as "the metric answered
     * and there was no data". A `(#190) This method must be called with a
     * Page Access Token` therefore surfaced as a cheerful "Reach yesterday:
     * unknown" — a real, fixable error reported as an empty number.
     */
    const invalid = /valid insights metric|nonexisting field/i.test(json.error.message ?? "");
    return { value: null, invalid, raw: json, error: invalid ? undefined : json.error };
  }
  /**
   * ⚠️ THE LAST VALUE, not the first. Facebook returns a series and the most
   * recent complete day is at the END; reading [0] files a figure one day
   * older than the row it sits in.
   */
  const series = json.data?.find((m) => m.name === metric)?.values ?? [];
  const last = series[series.length - 1]?.value;
  return { value: typeof last === "number" ? last : null, invalid: false, raw: json };
}

export async function fetchPageInsights(args: {
  token: string;
  pageId: string;
  /** ⚠️ Yesterday by default: Facebook's "day" period is only complete once
   *  the day is over, and asking for today returns a partial figure that
   *  looks like a collapse. */
  day?: Date;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; insights: PageInsights } | { ok: false; kind: FacebookFailure; message: string }> {
  const doFetch = args.fetchImpl ?? fetch;
  // ⚠️ YESTERDAY. Facebook's "day" period is only complete once the day is
  // over; asking for today returns a partial figure that reads as a collapse.
  const until = args.day ?? new Date(Date.now() - 86_400_000);
  const since = new Date(until.getTime() - 86_400_000);
  const window = `&period=day&since=${Math.floor(since.getTime() / 1000)}&until=${Math.floor(until.getTime() / 1000)}`;

  /**
   * 🔴 INSIGHTS NEED THE PAGE'S OWN TOKEN, exactly like publishing does.
   * Asked with the system user's token, Facebook answers `(#190) This method
   * must be called with a Page Access Token` — which is nothing to do with
   * the metric name, the scope or the Page id.
   */
  const page = await pageAccessToken({ token: args.token, pageId: args.pageId, fetchImpl: args.fetchImpl });
  if (!page.ok) return page;

  const tried: string[] = [];
  const raw: Record<string, unknown> = {};
  let failure: GraphError | undefined;

  /** First name that ANSWERS wins; retired names are skipped and recorded.
   *  ⛔ A non-retirement error stops the search and is reported. */
  const firstThatWorks = async (names: string[]) => {
    for (const metric of names) {
      tried.push(metric);
      try {
        const got = await readMetric(doFetch, args.pageId, metric, window, page.token);
        raw[metric] = got.raw;
        if (got.error) {
          failure = got.error;
          return null;
        }
        if (!got.invalid) return { metric, value: got.value };
      } catch (e) {
        return { metric, value: null, network: (e as Error).message };
      }
    }
    return null;
  };

  try {
    const reach = await firstThatWorks(PAGE_REACH_METRICS);
    const views = await firstThatWorks(PAGE_VIEW_METRICS);

    // ⛔ A real error wins over the retirement message: telling somebody to
    // update a metric list when the token is wrong is the wrong afternoon.
    if (failure) return { ok: false, ...classifyGraphError(failure) };

    if (!reach && !views) {
      return {
        ok: false,
        kind: "unknown",
        message:
          `None of these are metrics Facebook still recognises: ${tried.join(", ")}. ` +
          `⚠️ This is RETIREMENT, not a permission problem — Meta removes Page Insights metrics ` +
          `in waves. ▶️ Check Meta's current Page Insights reference and add the new name to ` +
          `PAGE_REACH_METRICS / PAGE_VIEW_METRICS.`,
      };
    }

    return {
      ok: true,
      insights: {
        impressions: views?.value ?? null,
        reach: reach?.value ?? null,
        raw: { usedForReach: reach?.metric ?? null, usedForViews: views?.metric ?? null, tried, ...raw },
      },
    };
  } catch (e) {
    return { ok: false, kind: "network", message: `Could not reach Facebook (${(e as Error).message}).` };
  }
}

/** How many people saw ONE post. ⛔ Also behind `read_insights`. */
export async function fetchPostImpressions(args: {
  token: string;
  postId: string;
  /** ⚠️ Same reason as `fetchPostStats` — a post's insights want a PAGE token. */
  pageId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; impressions: number | null; metric: string | null } | { ok: false; kind: FacebookFailure; message: string }> {
  const doFetch = args.fetchImpl ?? fetch;

  /**
   * 🔴 THE PAGE ID IS PASSED IN NOW, NOT DERIVED — and the comment that used
   * to sit here explains why it had to change:
   *
   *   "A post's id is `{pageId}_{postId}`, so the page is derivable from it
   *    rather than passed in separately — one less argument for a caller to
   *    get wrong."
   *
   * ⛔ True of a photo or text post. NOT true of a video: `/videos` returns a
   * bare id with no underscore, so `split("_")[0]` returned the whole video
   * id and asked Facebook for a Page that does not exist. ⚠️ A derivation is
   * a guess about a format, and this one was right about three posts in four.
   */
  const page = await pageAccessToken({ token: args.token, pageId: args.pageId, fetchImpl: args.fetchImpl });
  if (!page.ok) return page;

  const tried: string[] = [];
  try {
    for (const metric of POST_VIEW_METRICS) {
      tried.push(metric);
      const got = await readMetric(doFetch, args.postId, metric, "", page.token);
      // ⛔ Same rule: retirement means try the next name, anything else is real.
      if (got.error) return { ok: false, ...classifyGraphError(got.error) };
      if (!got.invalid) return { ok: true, impressions: got.value, metric };
    }
    return {
      ok: false,
      kind: "unknown",
      message: `Facebook no longer recognises any of: ${tried.join(", ")}. ▶️ Update POST_VIEW_METRICS.`,
    };
  } catch (e) {
    return { ok: false, kind: "network", message: `Could not reach Facebook (${(e as Error).message}).` };
  }
}

/**
 * Put a video on the Page's timeline.
 *
 * 🔴 A DIFFERENT EDGE ENTIRELY, and that is the whole reason this exists.
 * `/feed` takes a message and attached photos; it cannot take a video. Video
 * goes to `/{page-id}/videos`, which publishes IN ONE CALL — unlike the photo
 * path, where the upload is deliberately `published=false` and `/feed` is the
 * only thing that posts.
 *
 * ⚠️ `file_url`, NOT BYTES. Facebook fetches the video itself, from a URL we
 * host — the same shape as Instagram's image publishing ⇒ cardUrl.ts. Uploading
 * the bytes is possible and is a chunked, resumable protocol with three phases;
 * a URL it can fetch is the same outcome with none of that, and we already have
 * a signed public route to serve one.
 *
 * ⛔ THE FIELD IS `description`, NOT `message`. A video posted with `message`
 * goes out with an EMPTY caption and no error — the field is simply ignored.
 * That is a silent loss of every word somebody approved.
 */
export async function publishVideoToFacebook(args: {
  token: string;
  pageId: string;
  message: string;
  /** ⚠️ Must be PUBLIC: Facebook fetches it ⇒ /api/social/video/[id]. */
  videoUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<FacebookPublish> {
  const doFetch = args.fetchImpl ?? fetch;

  const page = await pageAccessToken({ token: args.token, pageId: args.pageId, fetchImpl: args.fetchImpl });
  if (!page.ok) return page;

  const body = new URLSearchParams({
    file_url: args.videoUrl,
    // ⛔ See above: `description` is the caption on this edge.
    description: args.message,
    access_token: page.token,
  });

  try {
    const res = await doFetch(graph(`${encodeURIComponent(args.pageId)}/videos`), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      // ⚠️ Longer than a photo's: Facebook fetches and transcodes before it
      // answers, and a timeout here is a video that may or may not be live.
      signal: AbortSignal.timeout(90_000),
      cache: "no-store",
    });
    const json = (await res.json()) as { id?: string; error?: GraphError };
    if (json.error) return { ok: false, ...classifyGraphError(json.error) };

    if (!json.id) {
      return {
        ok: false,
        kind: "unknown",
        message:
          "Facebook accepted the video request and returned no id, so it is not known whether the " +
          "post exists. ⛔ Not retried: a second attempt is how one video becomes two.",
      };
    }

    /**
     * 🔴 THE ID IS A VIDEO ID, NOT A POST ID — and storing it as the post id
     * cost us every video's figures.
     *
     * ⛔ That sentence was already written here, two lines up, when the stats
     * reader began asking `GET /{external_post_id}?fields=reactions…`. A VIDEO
     * object has no `reactions` field, so Facebook answered "(#100) Tried
     * accessing nonexisting field" — which is literally true and reads like a
     * bug in the field list. It sent a whole afternoon at the wrong problem.
     * ⚠️ Third time in one day that the knowledge sat one function away from
     * the code contradicting it ⇒ trap_a_constraint_nobody_told_the_writer.
     *
     * 🔑 SO THE POST ID IS ASKED FOR, not derived. `pageid_postid` — the shape
     * photos use — does not resolve for a video, so guessing is not available.
     *
     * ⚠️ AND IT FALLS BACK RATHER THAN FAILING. This field could not be
     * verified against a live Page from here, so if it does not come back the
     * video id is stored exactly as before and the post still publishes. ⛔ A
     * missing statistic is worth less than a missing post.
     */
    let postId = json.id;
    try {
      const askPostId = await doFetch(
        graph(`${encodeURIComponent(json.id)}`) + `?fields=post_id&access_token=${encodeURIComponent(page.token)}`,
        { signal: AbortSignal.timeout(15_000), cache: "no-store" },
      );
      const resolved = (await askPostId.json()) as { post_id?: string; error?: GraphError };
      if (resolved.post_id) postId = resolved.post_id;
      else {
        console.warn("[facebook] a video published with no post_id, so its figures will not be readable", {
          videoId: json.id,
          said: resolved.error?.message ?? "(no post_id field returned)",
        });
      }
    } catch (e) {
      console.warn("[facebook] could not resolve a video's post id", { videoId: json.id, why: (e as Error).message });
    }

    return {
      ok: true,
      postId,
      // ⚠️ The PERMALINK still uses the video id: that is the address that
      // resolves for a video, and it is what a reader would be sent.
      url: `https://www.facebook.com/${encodeURIComponent(json.id)}`,
    };
  } catch (e) {
    return { ok: false, kind: "network", message: `Could not reach Facebook (${(e as Error).message}).` };
  }
}
