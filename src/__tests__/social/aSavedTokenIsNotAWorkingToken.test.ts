/**
 * 🔴 "CONNECTED" MEANT "WE WROTE IT DOWN".
 *
 * Until 18 Oct the health check compared an expiry date the platform gave us
 * at connect time and called that verification. A token revoked at the other
 * end, an app removed from the portfolio, a Page un-assigned from the system
 * user — all three read as healthy, and the first symptom would have been
 * somebody asking why nothing had been posted for three weeks
 * ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
 *
 * ⛔ THE EXPENSIVE WRONG MOVE THIS FILE GUARDS is telling somebody their token
 * is dead when it is not. Facebook answers `100/33` — "object does not exist,
 * or you do not have permission" — for BOTH a mistyped Page id and a Page the
 * token was never assigned to. Report that as a dead token and the owner
 * revokes a working credential, regenerates it, pastes it, and lands in
 * exactly the same place, having learned nothing.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkFacebookPage, classifyGraphError } from "@/lib/social/adapters/facebook";

const PAGE = "61591783672102";

/** A fetch that answers once, with whatever this test needs it to say. */
function fakeFetch(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

describe("what Facebook's numbers mean", () => {
  it("190 is a dead token, and says so", () => {
    const { kind, message } = classifyGraphError({ code: 190, error_subcode: 463, message: "expired" });
    expect(kind).toBe("token");
    expect(message).toMatch(/expired/i);
  });

  it("⛔ 100/33 is NOT reported as a dead token", () => {
    const { kind, message } = classifyGraphError({
      code: 100,
      error_subcode: 33,
      message: "Unsupported get request.",
    });
    expect(kind).toBe("page");
    // The sentence has to stop somebody re-pasting, not merely avoid the word.
    expect(message).toMatch(/do not re-paste/i);
  });

  it("200 is a permission gap, which no new token fixes", () => {
    expect(classifyGraphError({ code: 200, message: "nope" }).kind).toBe("permission");
  });

  it("4 is rate limiting, which is not a fault at all", () => {
    expect(classifyGraphError({ code: 4, message: "slow down" }).kind).toBe("rate");
  });

  it("an unrecognised code still carries what Facebook actually said", () => {
    const { kind, message } = classifyGraphError({ code: 99999, message: "something new" });
    expect(kind).toBe("unknown");
    expect(message).toContain("something new");
  });
});

describe("asking Facebook about the Page", () => {
  it("a Page that answers with a Page token is working and can post", async () => {
    const r = await checkFacebookPage({
      token: "t",
      pageId: PAGE,
      fetchImpl: fakeFetch({ id: PAGE, name: "Imotara", access_token: "page-token" }),
    });
    expect(r.ok).toBe(true);
    expect(r.ok && r.canPost).toBe(true);
  });

  /**
   * 🔴 THE FAILURE THAT READS AS SUCCESS. HTTP 200, a real Page name, and
   * posting would still fail every time — because minting a Page access token
   * is what publishing needs and reading does not.
   */
  it("a Page that answers WITHOUT a Page token is not postable, and says which", async () => {
    const r = await checkFacebookPage({
      token: "t",
      pageId: PAGE,
      fetchImpl: fakeFetch({ id: PAGE, name: "Imotara" }),
    });
    expect(r.ok).toBe(true);
    expect(r.ok && r.canPost).toBe(false);
    expect(r.ok && r.note).toMatch(/POSTING WILL NOT/);
  });

  /**
   * 🔴 THE ONE THAT WOULD HAVE PUBLISHED SOMEWHERE ELSE. Facebook resolves
   * some aliases, so a wrong id can return a real, healthy Page — and every
   * post would succeed, to a timeline that is not ours.
   */
  it("⛔ a different Page id coming back is a failure, not a detail", async () => {
    const r = await checkFacebookPage({
      token: "t",
      pageId: PAGE,
      fetchImpl: fakeFetch({ id: "999", name: "Somebody Else", access_token: "x" }),
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.kind).toBe("page");
    expect(!r.ok && r.message).toMatch(/wrong Page/i);
  });

  /**
   * 🔴 "EITHER/OR" IS NOT A DIAGNOSIS. The first live check on 18 Oct returned
   * exactly this and left the reader to guess which of two things it was — on
   * the screen where guessing wrong costs a working credential. The adapter
   * now asks a second question that settles it.
   */
  describe("a 100/33 is chased down rather than left ambiguous", () => {
    /** First call answers with the error; the second lists the Pages. */
    function twoAnswers(first: unknown, second: unknown): typeof fetch {
      let n = 0;
      return (async () => {
        n += 1;
        return new Response(JSON.stringify(n === 1 ? first : second), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as unknown as typeof fetch;
    }
    const denied = { error: { code: 100, error_subcode: 33, message: "Unsupported get request." } };

    it("names the id the token CAN see, and says not to replace the token", async () => {
      const r = await checkFacebookPage({
        token: "t",
        pageId: PAGE,
        fetchImpl: twoAnswers(denied, { data: [{ id: "777", name: "Imotara" }] }),
      });
      expect(r.ok).toBe(false);
      expect(!r.ok && r.message).toContain("777");
      expect(!r.ok && r.message).toMatch(/do not replace it/i);
    });

    it("an empty list means the assignment, and points at the right screen", async () => {
      const r = await checkFacebookPage({
        token: "t",
        pageId: PAGE,
        fetchImpl: twoAnswers(denied, { data: [] }),
      });
      expect(!r.ok && r.message).toMatch(/NO Pages at all/);
      expect(!r.ok && r.message).toMatch(/Assign assets/);
    });

    /**
     * ⛔ A QUESTION THAT FAILED IS NOT A QUESTION THAT ANSWERED "NONE".
     * Returning an empty list where the lookup errored would print "this token
     * can see NO Pages at all, so the Page is not assigned" — a confident,
     * specific, wrong diagnosis, which is strictly worse than the honest
     * either/or it replaced.
     */
    it("⛔ a failure of the second question never masks or invents an answer", async () => {
      const r = await checkFacebookPage({
        token: "t",
        pageId: PAGE,
        fetchImpl: twoAnswers(denied, { error: { code: 1, message: "unknown" } }),
      });
      expect(r.ok).toBe(false);
      expect(!r.ok && r.kind).toBe("page");
      expect(!r.ok && r.message).toMatch(/do not re-paste/i);
      // Says nothing at all about what the token can see, rather than "none".
      expect(!r.ok && r.message).not.toMatch(/NO Pages at all/);
      expect(!r.ok && r.message).not.toMatch(/Asked again/);
    });

    it("⛔ a dead token is not asked to list anything", async () => {
      let calls = 0;
      const counting = (async () => {
        calls += 1;
        return new Response(JSON.stringify({ error: { code: 190, message: "revoked" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as unknown as typeof fetch;
      await checkFacebookPage({ token: "t", pageId: PAGE, fetchImpl: counting });
      expect(calls).toBe(1);
    });
  });

  it("an error body is classified, not swallowed", async () => {
    const r = await checkFacebookPage({
      token: "t",
      pageId: PAGE,
      fetchImpl: fakeFetch({ error: { code: 190, message: "revoked" } }),
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.kind).toBe("token");
  });

  it("a network failure is its own kind, and disclaims the token", async () => {
    const boom = (async () => {
      throw new Error("ENOTFOUND");
    }) as unknown as typeof fetch;
    const r = await checkFacebookPage({ token: "t", pageId: PAGE, fetchImpl: boom });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.kind).toBe("network");
    expect(!r.ok && r.message).toMatch(/says nothing about the/i);
  });
});

/**
 * ⚠️ REACHABILITY, not content. A text assertion cannot see whether the branch
 * it describes actually runs ⇒ trap_text_assertions_cannot_see_reachability.
 * These pin the two decisions that make the difference between a status that
 * means something and one that does not.
 */
describe("the health cron uses the answer it got", () => {
  const health = readFileSync(
    join(process.cwd(), "src/app/api/cron/social-health/route.ts"),
    "utf8",
  );

  it("calls the adapter rather than inferring from a date", () => {
    expect(health).toContain("checkFacebookPage");
  });

  it("⛔ does not mark a channel ok when it cannot be posted to", () => {
    expect(health).toMatch(/result\.canPost \? "ok" : "dead"/);
  });

  it("⛔ does not stamp last_verified_at when nothing was verified", () => {
    // The guard is the `verified` flag, not an unconditional write.
    expect(health).toMatch(/verified \? \{ last_verified_at/);
    expect(health).not.toMatch(/\} else \{\s*await db\.from\("social_accounts"\)\.update\(\{ last_verified_at/);
  });
});

/**
 * 🔴 THE ROW SAID THREE THINGS AND THE TWO LOUDER ONES WERE WRONG.
 *
 * The adapter's careful "⛔ do not re-paste before checking the id and the
 * assignment" printed between a hard-coded "It stopped working. Generate a new
 * token and paste it in." and a hard-coded "▶️ Generate a new token on the
 * platform and connect it again." A correct diagnosis is worth nothing if the
 * screen shouts the wrong remedy around it.
 */
describe("a specific diagnosis replaces the generic remedy", () => {
  const page = readFileSync(join(process.cwd(), "src/app/admin/social/channels/page.tsx"), "utf8");

  it("the status blurb is shown only when there is no specific error", () => {
    expect(page).toMatch(/account\.last_error \?[\s\S]{0,200}?s && <p/);
  });

  it("⛔ the 'generate a new token' line is suppressed when we know better", () => {
    expect(page).toMatch(/account\.status === "expiring"\) &&\s*!account\.last_error/);
  });
});

describe("the check route refuses to invent a verdict", () => {
  const route = readFileSync(
    join(process.cwd(), "src/app/api/admin/social/channels/[id]/check/route.ts"),
    "utf8",
  );

  it("leaves the status alone when it could not reach Facebook", () => {
    expect(route).toMatch(/kind === "network"/);
    expect(route).toContain('status: "unchanged"');
  });

  it("says plainly that other channels cannot be checked yet", () => {
    expect(route).toMatch(/no way to check a \$\{cred\.platform\} token yet/);
  });
});
