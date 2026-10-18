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

  if (json.error) return { ok: false, ...classifyGraphError(json.error) };

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
