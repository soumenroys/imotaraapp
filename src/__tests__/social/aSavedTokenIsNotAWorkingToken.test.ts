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
    /**
     * ⚠️ The anchor moved and the rule did not. This pinned
     * `checkFacebookPage`; the cron now asks `checkChannel`, which dispatches
     * to the real adapter for whichever channel it is ⇒ channelCheck.ts. The
     * reason that exists: this cron and the button an admin presses had
     * separate platform ladders, and already disagreed once about the same
     * Page — the button said Working, the cron said Needs you.
     */
    expect(health).toContain("checkChannel");
    expect(health).toContain("channelCanBeChecked");
    // ⛔ And the date branch is still only ever the FALLBACK for a channel
    // with no adapter, never the answer for one that has one.
    expect(health.indexOf("checkChannel(cred)")).toBeLessThan(health.indexOf("a.token_expires_at"));
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

/**
 * 🔴 `external_id` IS HALF OF THE TOKEN'S ENCRYPTION BINDING.
 *
 * It is bound into the aad on purpose, so one row's ciphertext cannot decrypt
 * in another. ⛔ Which means correcting a wrong Page id with an UPDATE — in
 * SQL, in the table editor, anywhere — does not fix a typo. It makes the token
 * permanently unreadable, silently, with the failure arriving later at the
 * moment somebody needed to post.
 *
 * It happened on day one: the Page was connected with 61591783672102, the
 * brand PROFILE's id, and the real Page is 1222416224285686.
 */
describe("correcting the id re-binds the token instead of stranding it", () => {
  const route = readFileSync(
    join(process.cwd(), "src/app/api/admin/social/channels/[id]/route.ts"),
    "utf8",
  );

  it("decrypts under the old binding and re-encrypts under the new one", () => {
    expect(route).toMatch(/encryptToken\(decryptToken\(/);
    expect(route).toContain("oldAad");
    expect(route).toContain("newAad");
  });

  /**
   * ⛔ RE-ENCRYPTING AND NOT STORING IT is the same stranding by a longer
   * route: the new id lands beside ciphertext bound to the old one. The work
   * has to reach the row, so the assertion is on the UPDATE, not on the maths.
   */
  it("⛔ the re-encrypted token is what gets written", () => {
    // ⚠️ lastIndexOf: the READ above also ends `.eq("id", id)`, and taking the
    // first one sliced backwards to an empty string — which passed every
    // assertion in it. A test that measures nothing is green.
    const update = route.slice(route.indexOf(".update("), route.lastIndexOf('.eq("id", id)'));
    expect(update.length).toBeGreaterThan(50);
    expect(update).toMatch(/external_id: next/);
    expect(update).toMatch(/access_token: access/);
    expect(update).toMatch(/refresh_token: refresh/);
  });

  it("⛔ writes nothing at all if the re-bind fails", () => {
    // The update must sit after the try/catch, and the catch must return.
    const catchAt = route.indexOf("} catch (e) {");
    const updateAt = route.indexOf('.from("social_accounts")\n    .update(');
    expect(catchAt).toBeGreaterThan(-1);
    expect(updateAt).toBeGreaterThan(catchAt);
    expect(route.slice(catchAt, updateAt)).toMatch(/return NextResponse\.json/);
  });

  it("⛔ does not carry the old verdict over to a different target", () => {
    expect(route).toMatch(/status: "pending"/);
    expect(route).toMatch(/last_verified_at: null/);
  });

  /**
   * ⚠️ On the CALL, not on the identifier. `requireSocialOwner` appears in the
   * import line too, so `toContain` stayed green with the guard swapped for
   * the admin one — found by mutation, which is the only way that shows up.
   */
  it("is owner-only, because it moves a credential", () => {
    expect(route).toMatch(/await requireSocialOwner\(req,/);
    expect(route).not.toMatch(/await requireSocialAdmin\(/);
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

  /**
   * 🔴 THE BUTTON AND THE CRON MUST NOT DISAGREE. This route first read
   * `result.ok ? "ok" : …`, so a Page that could be read and not posted to
   * showed **Working** when the owner pressed the button and **Needs you**
   * when the daily check ran an hour later — and the verdict they would have
   * trusted is the one they pressed themselves.
   */
  it("⛔ applies canPost exactly as the cron does", () => {
    const health = readFileSync(
      join(process.cwd(), "src/app/api/cron/social-health/route.ts"),
      "utf8",
    );
    const strip = (s: string) => s.replace(/\s+/g, "");
    expect(strip(health)).toContain(strip('result.canPost ? "ok" : "dead"'));

    /**
     * ⚠️ THE STATEMENT, NOT THE FILE. The first version of this assertion
     * searched the whole source for the weaker rule and failed on the COMMENT
     * that explains why the weaker rule is wrong — a test that cannot tell
     * code from prose about code.
     */
    const stmt = route.slice(route.indexOf("const status ="), route.indexOf('const { error }'));
    expect(stmt.length).toBeGreaterThan(20);
    expect(strip(stmt)).toContain(strip('result.canPost ? "ok" : "dead"'));
    expect(strip(stmt)).not.toContain(strip('result.ok ? "ok" :'));
  });
});

/**
 * 🔴 A READER WHOSE FIRST RUN IS UNATTENDED.
 *
 * `capturePostStats` had exactly one caller: the 19:30 cron. So the first
 * time a newly connected channel's per-post reader ever ran, it ran at night
 * with nobody to read the error — the shape of failure this whole feature
 * exists to prevent ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
 *
 * ⚠️ On Instagram the figure it fetches is SAVES, which is the number the
 * channel's voice was written for. A reader that silently cannot read it
 * would leave the one metric we optimise for permanently null.
 */
describe("the check button exercises the post reader too", () => {
  const raw = readFileSync(
    join(process.cwd(), "src/app/api/admin/social/channels/[id]/check/route.ts"),
    "utf8",
  );
  /**
   * ⚠️ COMMENTS STRIPPED AND IMPORTS DROPPED, both learned the hard way
   * tonight. `toContain("capturePostStats")` passed with the call replaced by
   * a stub, because the IMPORT line still said the name; and a regex for the
   * failure message matched the sentence in the catch branch explaining it.
   * ⇒ trap_text_assertions_cannot_see_reachability.
   */
  const check = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("import "))
    .join("\n");

  it("captures post figures, not only the channel's", () => {
    expect(check).toContain("await capturePostStats(");
    expect(check).toContain("await captureChannelStats(");
  });

  it("says when the post reader failed instead of swallowing it", () => {
    // ⛔ The whole point is that somebody is standing there and can still fix
    // it. A silent catch would make the button a lie.
    const call = check.indexOf("await capturePostStats(");
    expect(call).toBeGreaterThan(-1);
    const block = check.slice(call, check.indexOf("return NextResponse.json", call));
    expect(block).toContain("posts.problems.join");
    expect(block).toContain("figures +=");
  });

  it("⛔ still never fails the check itself over figures", () => {
    // The verdict is what somebody pressed the button for; figures are a bonus.
    const call = check.indexOf("await capturePostStats(");
    const block = check.slice(call, check.indexOf("return NextResponse.json", call));
    expect(block).not.toMatch(/status:\s*\d{3}/);
  });
});
