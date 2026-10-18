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

function graph(path: string): string {
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
async function pageAccessToken(args: {
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
  raw: Record<string, unknown>;
};

export async function fetchPostStats(args: {
  token: string;
  postId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; stats: PostStats } | { ok: false; kind: FacebookFailure; message: string }> {
  const doFetch = args.fetchImpl ?? fetch;
  try {
    /**
     * 🔑 `summary(true)` is what returns a COUNT rather than a page of
     * objects. Without it this asks Facebook for every reaction one by one and
     * then counts the first twenty-five of them.
     */
    const res = await doFetch(
      graph(encodeURIComponent(args.postId)) +
        `?fields=reactions.summary(true).limit(0),comments.summary(true).limit(0),shares` +
        `&access_token=${encodeURIComponent(args.token)}`,
      { signal: AbortSignal.timeout(15_000), cache: "no-store" },
    );
    const json = (await res.json()) as {
      reactions?: { summary?: { total_count?: number } };
      comments?: { summary?: { total_count?: number } };
      shares?: { count?: number };
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
  const until = args.day ?? new Date(Date.now() - 86_400_000);
  const since = new Date(until.getTime() - 86_400_000);
  const d = (x: Date) => Math.floor(x.getTime() / 1000);

  try {
    const res = await doFetch(
      graph(`${encodeURIComponent(args.pageId)}/insights`) +
        `?metric=page_impressions,page_impressions_unique&period=day` +
        `&since=${d(since)}&until=${d(until)}&access_token=${encodeURIComponent(args.token)}`,
      { signal: AbortSignal.timeout(20_000), cache: "no-store" },
    );
    const json = (await res.json()) as {
      data?: { name?: string; values?: { value?: number }[] }[];
      error?: GraphError;
    };
    if (json.error) return { ok: false, ...classifyGraphError(json.error) };

    /**
     * ⚠️ TAKE THE LAST VALUE, not the first. Facebook returns a series and the
     * most recent complete day is at the end; reading [0] silently reports a
     * figure one day older than the row it is filed under.
     */
    const pick = (name: string): number | null => {
      const series = json.data?.find((m) => m.name === name)?.values ?? [];
      const last = series[series.length - 1]?.value;
      return typeof last === "number" ? last : null;
    };

    return {
      ok: true,
      insights: {
        impressions: pick("page_impressions"),
        reach: pick("page_impressions_unique"),
        raw: json as Record<string, unknown>,
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
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; impressions: number | null } | { ok: false; kind: FacebookFailure; message: string }> {
  const doFetch = args.fetchImpl ?? fetch;
  try {
    const res = await doFetch(
      graph(`${encodeURIComponent(args.postId)}/insights`) +
        `?metric=post_impressions&access_token=${encodeURIComponent(args.token)}`,
      { signal: AbortSignal.timeout(20_000), cache: "no-store" },
    );
    const json = (await res.json()) as {
      data?: { name?: string; values?: { value?: number }[] }[];
      error?: GraphError;
    };
    if (json.error) return { ok: false, ...classifyGraphError(json.error) };
    const v = json.data?.find((m) => m.name === "post_impressions")?.values?.[0]?.value;
    return { ok: true, impressions: typeof v === "number" ? v : null };
  } catch (e) {
    return { ok: false, kind: "network", message: `Could not reach Facebook (${(e as Error).message}).` };
  }
}
