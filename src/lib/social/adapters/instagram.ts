// src/lib/social/adapters/instagram.ts
// Talking to the Instagram account, which is not Facebook with a different id.
//
// 🔴 THE FOUR DIFFERENCES THAT ACTUALLY MATTER, because every one of them is a
// place the Facebook adapter's shape would quietly fail:
//
//   1. THERE IS NO BYTE UPLOAD. Facebook takes the picture in the request.
//      Instagram is handed an `image_url` and FETCHES IT ITSELF, from Meta's
//      servers, with none of our credentials ⇒ src/lib/social/cardUrl.ts.
//   2. IT TAKES JPEG AND NOTHING ELSE. `ImageResponse` emits PNG and has no
//      format option ⇒ renderPostPictureJpeg.
//   3. PUBLISHING IS TWO CALLS. `/media` makes a CONTAINER and returns a
//      creation id; `/media_publish` is what puts it on the timeline.
//      ⛔ Stopping after the first leaves nothing published and NO ERROR —
//      the most expensive silence available here.
//   4. EVERY POST HAS A PICTURE. There is no text-only Instagram post, so a
//      card that fails to render is a post that does not go out, never a post
//      that goes out as words.
//
// ⚠️ AND THE CREDENTIAL IS THE PAGE'S, not the system user's — the same rule
// as Facebook publishing, for the same reason.

import {
  graph,
  classifyGraphError,
  type FacebookFailure,
} from "@/lib/social/adapters/facebook";

/** Reusing Facebook's vocabulary on purpose: the four remedies are the same
 *  four, and a second set of names would mean two things to learn. */
export type InstagramFailure = FacebookFailure;

type GraphError = { message?: string; code?: number; error_subcode?: number; type?: string };

const TIMEOUT = 20_000;

async function getJson(
  url: string,
  doFetch: typeof fetch,
  init?: RequestInit,
): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; kind: InstagramFailure; message: string }> {
  try {
    const res = await doFetch(url, { signal: AbortSignal.timeout(TIMEOUT), cache: "no-store", ...init });
    const json = (await res.json()) as Record<string, unknown> & { error?: GraphError };
    if (json.error) return { ok: false, ...classifyGraphError(json.error) };
    return { ok: true, json };
  } catch (e) {
    /**
     * ⛔ NETWORK IS NOT FAILURE, IT IS UNKNOWN — and on the publish call that
     * distinction decides whether a retry duplicates a post
     * ⇒ the same rule as src/app/api/cron/social-publish/route.ts.
     */
    return { ok: false, kind: "network", message: `Could not reach Instagram (${(e as Error).message}).` };
  }
}

export type InstagramLink = {
  /** The Instagram user id — 17841…, not the @name and not the Page id. */
  igUserId: string;
  username: string;
  /** The Page it is linked to, and that Page's own token. */
  pageId: string;
  pageName: string;
  pageToken: string;
};

/**
 * Find the Page this Instagram account is linked to, and mint that Page's token.
 *
 * 🔑 WHY THIS IS A SEARCH RATHER THAN A STORED PAGE ID. Instagram publishing
 * needs the linked Page's access token, so something has to connect the two.
 * Storing the Page id on the Instagram row would couple the two channels:
 * re-connecting Facebook, or correcting its id, would silently break
 * Instagram in a way nothing checks.
 *
 * ⚠️ So the link is READ FROM META every time, which costs one request and
 * means a broken link is reported as a broken link rather than as a dead
 * token. ⛔ If the account is ever unlinked, this is the call that says so.
 */
export async function instagramLink(args: {
  token: string;
  igUserId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; link: InstagramLink } | { ok: false; kind: InstagramFailure; message: string }> {
  const doFetch = args.fetchImpl ?? fetch;
  const res = await getJson(
    graph("me/accounts") +
      `?fields=id,name,access_token,instagram_business_account{id,username}` +
      `&limit=100&access_token=${encodeURIComponent(args.token)}`,
    doFetch,
  );
  if (!res.ok) return res;

  const pages = (res.json.data ?? []) as {
    id?: string;
    name?: string;
    access_token?: string;
    instagram_business_account?: { id?: string; username?: string };
  }[];

  const match = pages.find((p) => p.instagram_business_account?.id === args.igUserId);
  if (!match) {
    /**
     * ⛔ NOT REPORTED AS A DEAD TOKEN. The token worked — it answered. What
     * failed is the link or the id, and the remedies are different
     * ⇒ the 100/33 lesson in classifyGraphError.
     */
    const linked = pages
      .filter((p) => p.instagram_business_account?.id)
      .map((p) => `${p.instagram_business_account!.username ?? "?"} (${p.instagram_business_account!.id}) on ${p.name}`);
    return {
      ok: false,
      kind: "page",
      message:
        `No Page this token can see has the Instagram account ${args.igUserId} linked to it. ` +
        (linked.length
          ? `⚠️ What it CAN see: ${linked.join("; ")}. ▶️ Check the id on the channel.`
          : `⚠️ It can see ${pages.length} Page(s) and none has an Instagram account linked. ` +
            `▶️ Link the account to the Page in Business settings, and make sure it is a ` +
            `Business or Creator account — a personal Instagram account cannot publish by API.`),
    };
  }
  if (!match.access_token) {
    return {
      ok: false,
      kind: "permission",
      message:
        "The Page is linked to that Instagram account but returned no Page access token. " +
        "▶️ The token needs pages_show_list, and the system user needs the Page assigned.",
    };
  }

  return {
    ok: true,
    link: {
      igUserId: args.igUserId,
      username: match.instagram_business_account?.username ?? "",
      pageId: match.id ?? "",
      pageName: match.name ?? "",
      pageToken: match.access_token,
    },
  };
}

export type InstagramCheck =
  | { ok: true; igUserId: string; username: string; pageName: string; canPost: boolean; note: string }
  | { ok: false; kind: InstagramFailure; message: string };

/**
 * Is this channel actually able to publish, right now?
 *
 * ⛔ `ok` IS ONLY EVER SET BY A REAL CALL THAT SUCCEEDED — the same rule as
 * the Facebook check. Nothing here infers health from a stored column.
 */
export async function checkInstagramAccount(args: {
  token: string;
  igUserId: string;
  fetchImpl?: typeof fetch;
}): Promise<InstagramCheck> {
  const linked = await instagramLink(args);
  if (!linked.ok) return linked;

  const me = await getJson(
    graph(encodeURIComponent(args.igUserId)) +
      `?fields=username,followers_count,media_count&access_token=${encodeURIComponent(linked.link.pageToken)}`,
    args.fetchImpl ?? fetch,
  );
  if (!me.ok) return me;

  const username = (me.json.username as string) ?? linked.link.username;
  return {
    ok: true,
    igUserId: args.igUserId,
    username,
    pageName: linked.link.pageName,
    canPost: true,
    note:
      `@${username} is linked to ${linked.link.pageName} and answered with a Page token — ` +
      `${me.json.followers_count ?? "unknown"} followers, ${me.json.media_count ?? "unknown"} posts. ` +
      `⚠️ This proves the account can be READ and a Page token minted; the first publish is still ` +
      `the first publish.`,
  };
}

export type InstagramPublish =
  | { ok: true; mediaId: string; url: string }
  | { ok: false; kind: InstagramFailure; message: string; containerId?: string };

/**
 * 🔴 HOW LONG TO WAIT FOR A CONTAINER, and why waiting at all.
 *
 * Meta builds the container asynchronously: it fetches our image, checks it,
 * and only then is the container publishable. For a single square JPEG this
 * is usually instant — but "usually" published half the time is not a
 * scheduler. ⛔ And a container that is still IN_PROGRESS when `media_publish`
 * is called fails with an error about the media, which reads like a bad card.
 */
const CONTAINER_TRIES = 8;
const CONTAINER_WAIT_MS = 3_000;

/**
 * Put one picture and one caption on the Instagram timeline.
 *
 * ⚠️ TWO CALLS, AND THE SECOND ONE IS THE POST. The first makes a container
 * and returns an id that looks exactly like a success.
 */
export async function publishToInstagram(args: {
  token: string;
  igUserId: string;
  caption: string;
  /** ⚠️ Must be PUBLIC and JPEG: Meta fetches it ⇒ cardUrl.ts. */
  imageUrl: string;
  fetchImpl?: typeof fetch;
  /** ⚠️ Injected so the wait is instant under test rather than 24 seconds. */
  sleep?: (ms: number) => Promise<void>;
}): Promise<InstagramPublish> {
  const doFetch = args.fetchImpl ?? fetch;
  const sleep = args.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  const linked = await instagramLink({ token: args.token, igUserId: args.igUserId, fetchImpl: doFetch });
  if (!linked.ok) return linked;
  const pageToken = linked.link.pageToken;

  // ── 1. THE CONTAINER ──────────────────────────────────────────────────────
  const made = await getJson(graph(`${encodeURIComponent(args.igUserId)}/media`), doFetch, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    // ⚠️ In the body, not the query string: a caption is long, contains line
    // breaks, and a URL is a place things get logged.
    body: new URLSearchParams({
      image_url: args.imageUrl,
      caption: args.caption,
      access_token: pageToken,
    }).toString(),
  });
  if (!made.ok) return made;

  const containerId = made.json.id as string | undefined;
  if (!containerId) {
    return {
      ok: false,
      kind: "unknown",
      message: "Instagram accepted the media request but returned no container id, so nothing was published.",
    };
  }

  // ── 2. WAIT FOR META TO FETCH AND ACCEPT THE PICTURE ──────────────────────
  let lastStatus = "unknown";
  for (let attempt = 0; attempt < CONTAINER_TRIES; attempt += 1) {
    const state = await getJson(
      graph(encodeURIComponent(containerId)) +
        `?fields=status_code,status&access_token=${encodeURIComponent(pageToken)}`,
      doFetch,
    );
    if (!state.ok) return { ...state, containerId };

    lastStatus = (state.json.status_code as string) ?? "unknown";
    if (lastStatus === "FINISHED") break;
    if (lastStatus === "ERROR" || lastStatus === "EXPIRED") {
      /**
       * ⛔ AN ERROR HERE IS ALMOST ALWAYS THE IMAGE, NOT THE TOKEN. Meta could
       * not fetch the URL, or it was not a JPEG, or it was the wrong size.
       * Saying so is the difference between a five-minute fix and an
       * afternoon spent on permissions.
       */
      return {
        ok: false,
        kind: "unknown",
        containerId,
        message:
          `Instagram could not accept the picture (${lastStatus}: ${String(state.json.status ?? "no detail")}). ` +
          `⚠️ This is about the IMAGE, not the token: Meta fetches ${args.imageUrl} itself, and it ` +
          `must be publicly reachable and a JPEG. ⛔ Nothing was published.`,
      };
    }
    if (attempt < CONTAINER_TRIES - 1) await sleep(CONTAINER_WAIT_MS);
  }

  if (lastStatus !== "FINISHED") {
    return {
      ok: false,
      kind: "unknown",
      containerId,
      message:
        `Instagram was still preparing the picture after ${(CONTAINER_TRIES * CONTAINER_WAIT_MS) / 1000}s ` +
        `(last status ${lastStatus}). ⛔ Nothing was published — the container is not a post.`,
    };
  }

  // ── 3. THE CALL THAT ACTUALLY PUBLISHES ───────────────────────────────────
  const published = await getJson(graph(`${encodeURIComponent(args.igUserId)}/media_publish`), doFetch, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: containerId, access_token: pageToken }).toString(),
  });
  if (!published.ok) return { ...published, containerId };

  const mediaId = published.json.id as string | undefined;
  if (!mediaId) {
    return {
      ok: false,
      kind: "unknown",
      containerId,
      message: "Instagram returned no media id from the publish call, so it is not known whether the post exists.",
    };
  }

  /**
   * ⚠️ THE PERMALINK IS A SEPARATE READ, and its failure must not turn a
   * successful publish into a failure. The post is already on the timeline;
   * a missing link is a worse admin screen, not a worse outcome.
   */
  const link = await getJson(
    graph(encodeURIComponent(mediaId)) + `?fields=permalink&access_token=${encodeURIComponent(pageToken)}`,
    doFetch,
  );
  const url = link.ok && typeof link.json.permalink === "string"
    ? link.json.permalink
    : `https://www.instagram.com/${linked.link.username || ""}`;

  return { ok: true, mediaId, url };
}

export type InstagramStats = {
  followers: number | null;
  mediaCount: number | null;
  raw: unknown;
};

/** The channel's own figures. ⚠️ Followers come from the node, not from
 *  insights: the node answers for an account of any size, and the insights
 *  edge declines on small ones. */
export async function fetchInstagramStats(args: {
  token: string;
  igUserId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; stats: InstagramStats } | { ok: false; kind: InstagramFailure; message: string }> {
  const linked = await instagramLink(args);
  if (!linked.ok) return linked;

  const res = await getJson(
    graph(encodeURIComponent(args.igUserId)) +
      `?fields=username,followers_count,follows_count,media_count&access_token=${encodeURIComponent(linked.link.pageToken)}`,
    args.fetchImpl ?? fetch,
  );
  if (!res.ok) return res;

  return {
    ok: true,
    stats: {
      // ⛔ null, never 0, when the field is absent: "we could not ask" and
      // "nobody follows this account" are different facts, and a zero here
      // averages into every chart as if it were a measurement.
      followers: typeof res.json.followers_count === "number" ? res.json.followers_count : null,
      mediaCount: typeof res.json.media_count === "number" ? res.json.media_count : null,
      raw: res.json,
    },
  };
}

export type InstagramPostStats = {
  likes: number | null;
  comments: number | null;
  /** 🔑 THE ONE THAT MATTERS HERE. Instagram ranks on saves and shares far
   *  more than on likes, and the voice is written for exactly that. */
  saved: number | null;
  reach: number | null;
  views: number | null;
  raw: unknown;
};

/**
 * ⚠️ METRIC NAMES ARE RETIRED IN WAVES, exactly as on the Page side. Meta
 * replaced `impressions` with `views` on media insights, and an unknown name
 * fails the WHOLE request rather than being skipped — so the candidates are
 * tried one at a time ⇒ the same shape as readMetric in facebook.ts.
 */
const MEDIA_VIEW_METRICS = ["views", "impressions"];

export async function fetchInstagramPostStats(args: {
  token: string;
  mediaId: string;
  igUserId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; stats: InstagramPostStats } | { ok: false; kind: InstagramFailure; message: string }> {
  const doFetch = args.fetchImpl ?? fetch;
  const linked = await instagramLink({ token: args.token, igUserId: args.igUserId, fetchImpl: doFetch });
  if (!linked.ok) return linked;
  const pageToken = linked.link.pageToken;

  const node = await getJson(
    graph(encodeURIComponent(args.mediaId)) +
      `?fields=like_count,comments_count&access_token=${encodeURIComponent(pageToken)}`,
    doFetch,
  );
  if (!node.ok) return node;

  // ⚠️ `saved` and `reach` are stable names; only the view metric moved.
  const insights = await getJson(
    graph(`${encodeURIComponent(args.mediaId)}/insights`) +
      `?metric=saved,reach&access_token=${encodeURIComponent(pageToken)}`,
    doFetch,
  );
  const readFrom = (payload: Record<string, unknown>, name: string): number | null => {
    const rows = (payload.data ?? []) as { name?: string; values?: { value?: number }[] }[];
    const row = rows.find((r) => r.name === name);
    const v = row?.values?.[0]?.value;
    return typeof v === "number" ? v : null;
  };

  let views: number | null = null;
  for (const metric of MEDIA_VIEW_METRICS) {
    const got = await getJson(
      graph(`${encodeURIComponent(args.mediaId)}/insights`) +
        `?metric=${metric}&access_token=${encodeURIComponent(pageToken)}`,
      doFetch,
    );
    if (got.ok) {
      views = readFrom(got.json, metric);
      break;
    }
    /**
     * ⛔ A DEAD TOKEN MUST NOT BE SWALLOWED BY A METRIC FALLBACK. This is the
     * bug I shipped on the Page side: every candidate "failed", and a (#190)
     * was reported to the admin as "Reach yesterday: unknown".
     */
    if (got.kind === "token" || got.kind === "permission" || got.kind === "network") return got;
  }

  return {
    ok: true,
    stats: {
      likes: typeof node.json.like_count === "number" ? node.json.like_count : null,
      comments: typeof node.json.comments_count === "number" ? node.json.comments_count : null,
      saved: insights.ok ? readFrom(insights.json, "saved") : null,
      reach: insights.ok ? readFrom(insights.json, "reach") : null,
      views,
      raw: { node: node.json, insights: insights.ok ? insights.json : { error: insights.message } },
    },
  };
}
