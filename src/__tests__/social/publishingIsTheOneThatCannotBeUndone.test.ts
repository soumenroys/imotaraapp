/**
 * 🔴 EVERY OTHER JOB IN THIS FEATURE WRITES ROWS SOMEBODY CAN THROW AWAY.
 *
 * This one makes words public under the brand's name, and there is no edit
 * that un-shows a post to the people who already saw it. So the failures worth
 * testing here are not "did it post" — they are the two ways an irreversible
 * action goes wrong:
 *
 *   1. it posts something nobody approved (a card that failed to render, a
 *      caption where a message should be, a post to the wrong Page);
 *   2. it posts the same thing twice (a retry around a call that may have
 *      succeeded, two cron runs claiming one row).
 *
 * ⛔ A DUPLICATE ON A TIMELINE CANNOT BE UN-SEEN. A post that needed one click
 * to re-approve can. Every ambiguous case below resolves towards the second.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { publishToFacebook } from "@/lib/social/adapters/facebook";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const PAGE = "1222416224285686";

type Call = { url: string; method: string; body: unknown };

/**
 * A fetch that answers each call in turn and records what it was asked.
 * ⚠️ Records the BODY too — half of what matters here is which field the
 * message went into, not whether a call was made.
 */
function recording(answers: unknown[]): { fetchImpl: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  let n = 0;
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? "GET", body: init?.body });
    const answer = answers[Math.min(n, answers.length - 1)];
    n += 1;
    if (answer instanceof Error) throw answer;
    return new Response(JSON.stringify(answer), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const PAGE_TOKEN = { access_token: "page-token" };

describe("a text-only post", () => {
  it("mints the Page token and makes exactly one post", async () => {
    const { fetchImpl, calls } = recording([PAGE_TOKEN, { id: `${PAGE}_99` }]);
    const r = await publishToFacebook({ token: "sys", pageId: PAGE, message: "A plain sentence.", fetchImpl });

    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toContain(`${PAGE}/feed`);
    expect(calls[1].method).toBe("POST");
    expect(String(calls[1].body)).toContain("message=A+plain+sentence.");
    // ⛔ No photo call for a post with no picture.
    expect(calls.some((c) => c.url.includes("/photos"))).toBe(false);
  });

  /**
   * 🔑 POSTING NEEDS THE PAGE'S TOKEN, NOT THE SYSTEM USER'S. With the user
   * token the post is attributed to the person rather than the Page, or is
   * refused outright — and the first is worse, because it looks like it worked.
   */
  it("posts with the PAGE token, never the system user's", async () => {
    const { fetchImpl, calls } = recording([PAGE_TOKEN, { id: `${PAGE}_99` }]);
    await publishToFacebook({ token: "sys", pageId: PAGE, message: "Hello.", fetchImpl });
    expect(String(calls[1].body)).toContain("access_token=page-token");
    expect(String(calls[1].body)).not.toContain("access_token=sys");
  });

  it("turns the returned id into a permalink", async () => {
    const { fetchImpl } = recording([PAGE_TOKEN, { id: `${PAGE}_99` }]);
    const r = await publishToFacebook({ token: "s", pageId: PAGE, message: "m", fetchImpl });
    expect(r.ok && r.url).toBe(`https://www.facebook.com/${PAGE}_99`);
  });
});

describe("a post with a picture", () => {
  const bytes = new Uint8Array([137, 80, 78, 71]);

  /**
   * 🔑 UPLOAD UNPUBLISHED, THEN ATTACH. Posting straight to `/photos` puts a
   * CAPTION on a photo, which is not the same thing as a post with a message —
   * and it is two items on the timeline rather than one.
   */
  it("uploads the image unpublished and attaches it to one feed post", async () => {
    const { fetchImpl, calls } = recording([PAGE_TOKEN, { id: "photo-1" }, { id: `${PAGE}_7` }]);
    const r = await publishToFacebook({ token: "s", pageId: PAGE, message: "Words.", picture: bytes, fetchImpl });

    expect(r.ok).toBe(true);
    expect(calls[1].url).toContain(`${PAGE}/photos`);
    const form = calls[1].body as FormData;
    expect(form.get("published"), "the image would have gone to the timeline on its own").toBe("false");
    expect(form.get("source")).toBeInstanceOf(Blob);

    expect(calls[2].url).toContain(`${PAGE}/feed`);
    expect(String(calls[2].body)).toContain("message=Words.");
  });

  /**
   * 🔑 A LIST, NOT A FIELD. `attached_media` takes an array, so the day a
   * carousel exists it travels this same path rather than growing a second
   * way to publish — which is how two publishers end up disagreeing.
   */
  it("attaches the media as a list, so a carousel needs no second publisher", async () => {
    const { fetchImpl, calls } = recording([PAGE_TOKEN, { id: "photo-1" }, { id: `${PAGE}_7` }]);
    await publishToFacebook({ token: "s", pageId: PAGE, message: "m", picture: bytes, fetchImpl });
    const sent = new URLSearchParams(String(calls[2].body));
    expect(JSON.parse(sent.get("attached_media") as string)).toEqual([{ media_fbid: "photo-1" }]);
  });

  /**
   * ⛔ NOTHING REACHES THE TIMELINE IF THE UPLOAD FAILS. The image was
   * uploaded unpublished, so there is nothing to undo — but only if the feed
   * call is not made anyway.
   */
  it("does not post at all when the upload fails", async () => {
    const { fetchImpl, calls } = recording([PAGE_TOKEN, { error: { code: 100, message: "bad image" } }]);
    const r = await publishToFacebook({ token: "s", pageId: PAGE, message: "m", picture: bytes, fetchImpl });
    expect(r.ok).toBe(false);
    expect(calls.some((c) => c.url.includes("/feed")), "it posted the words without the card").toBe(false);
  });
});

describe("the failures that must not be retried", () => {
  /**
   * 🔴 A TIMEOUT ON THE POST CALL IS NOT A FAILURE — IT IS AN UNKNOWN. The
   * request may have been received. The message has to say so, because the
   * obvious reaction to "failed" is to try again, and trying again is how the
   * same post appears twice.
   */
  it("says plainly that a timed-out post may already be live", async () => {
    const { fetchImpl } = recording([PAGE_TOKEN, new Error("aborted")]);
    const r = await publishToFacebook({ token: "s", pageId: PAGE, message: "m", fetchImpl });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toMatch(/may still have published/i);
    expect(!r.ok && r.message).toMatch(/post it twice/i);
  });

  it("⛔ never retries anything by itself", async () => {
    const { fetchImpl, calls } = recording([PAGE_TOKEN, { error: { code: 190, message: "revoked" } }]);
    await publishToFacebook({ token: "s", pageId: PAGE, message: "m", fetchImpl });
    // One token call, one feed call, and no second attempt at either.
    expect(calls).toHaveLength(2);
  });

  it("a dead token stops it before anything is uploaded", async () => {
    const { fetchImpl, calls } = recording([{ error: { code: 190, message: "revoked" } }]);
    const r = await publishToFacebook({
      token: "s",
      pageId: PAGE,
      message: "m",
      picture: new Uint8Array([1]),
      fetchImpl,
    });
    expect(!r.ok && r.kind).toBe("token");
    expect(calls).toHaveLength(1);
  });
});

/**
 * ⚠️ Source assertions, because what matters here is the ORDER of two writes
 * and a database nothing in this suite can reach. A text test cannot see
 * whether a line runs ⇒ trap_text_assertions_cannot_see_reachability — so each
 * one below pins a specific statement, not a word.
 */
describe("the drain claims a post before it publishes it", () => {
  const cron = read("src/app/api/cron/social-publish/route.ts");

  /**
   * 🔴 THE CRON RUNS EVERY MINUTE. Two overlapping invocations reading the
   * same `approved` row would both publish it. The claim is what makes that
   * impossible: only the run that still sees `approved` gets it.
   */
  it("⛔ moves the row to 'publishing' guarded on it still being 'approved'", () => {
    const claim = cron.slice(cron.indexOf("const { error: claimError"), cron.indexOf("let picture"));
    expect(claim).toMatch(/status: "publishing"/);
    expect(claim).toMatch(/\.eq\("status", "approved"\)/);
    expect(claim).toMatch(/attempts: \(post\.attempts as number\) \+ 1/);
  });

  it("claims BEFORE calling Facebook, not after", () => {
    expect(cron.indexOf('status: "publishing"')).toBeLessThan(cron.indexOf("publishToFacebook("));
  });

  it("counts the attempt in a column, so a cap survives a restart", () => {
    expect(cron).toMatch(/\.lt\("attempts", MAX_ATTEMPTS\)/);
  });

  /**
   * ⛔ A POST MEANT TO HAVE A PICTURE DOES NOT GO OUT WITHOUT ONE. The card
   * carries the brand marks and the second line; the words alone are not what
   * was approved.
   */
  it("does not publish the words when the card fails to render", () => {
    const branch = cron.slice(cron.indexOf("if (!rendered.ok)"), cron.indexOf("picture = rendered.bytes"));
    // ⚠️ 24 Oct: released via release() — 'approved' until the attempts are spent, then 'failed'.
    expect(branch).toContain("release(post,");
    expect(branch).toContain("continue;");
  });

  /**
   * 🔴 THE ASYMMETRY THAT MATTERS. A failed publish stays `failed` — it is NOT
   * put back to `approved`, because an unverifiable network failure would then
   * be republished on the next run.
   */
  it("⛔ leaves a failed publish failed rather than re-queueing it", () => {
    const after = cron.slice(cron.indexOf("const unverified"));
    expect(after).toMatch(/status: "failed"/);
    expect(after).not.toMatch(/status: "approved"/);
  });

  /**
   * ⚠️ CALL SITES, NOT NAMES. The first version of these two compared
   * `indexOf("markCronFired")` against `indexOf("postingIsPaused")` and was
   * really comparing the order of two IMPORT lines — it would have passed
   * with the heartbeat moved to the very end of the function.
   */
  it("reads the master switch, and reads it before publishing anything", () => {
    expect(cron.indexOf("await postingIsPaused()")).toBeLessThan(cron.indexOf("publishToFacebook({"));
  });

  it("holds a channel with no publisher instead of failing it", () => {
    expect(cron).toMatch(/There is no publisher for \$\{platform\} yet/);
  });

  it("is a GET with a Bearer, like every other cron here", () => {
    expect(cron).toContain("cronAuthorised");
    expect(cron).toMatch(/export async function GET\(/);
    expect(cron).not.toMatch(/export async function POST\(/);
  });

  it("records the heartbeat before the work, so a crash still proves it fired", () => {
    expect(cron.indexOf('void markCronFired("/api/cron/social-publish")')).toBeGreaterThan(-1);
    expect(cron.indexOf("void markCronFired(")).toBeLessThan(cron.indexOf("await postingIsPaused()"));
  });
});

describe("the job is declared, so the monitor can miss it", () => {
  it("⛔ is in vercel.json — an undeclared cron never runs and never alarms", () => {
    const crons = JSON.parse(read("vercel.json")).crons as { path: string; schedule: string }[];
    const job = crons.find((c) => c.path === "/api/cron/social-publish");
    expect(job, "the publisher is not declared, so it would simply never run").toBeTruthy();
    // 🔑 judgeJobs reads vercel.json, so declaring it is also what makes a
    // dead publisher visible ⇒ src/lib/cron/heartbeat.ts.
    expect(job?.schedule).toBe("* * * * *");
  });
});

describe("there is one renderer, not two", () => {
  /**
   * ⛔ The admin's preview and the published card must come from the same
   * code. Two renderers could differ silently, and only on the one nobody can
   * check after the fact.
   */
  it("the admin route and the publisher both call the shared renderer", () => {
    const route = read("src/app/api/admin/social/picture/[id]/route.ts");
    const cron = read("src/app/api/cron/social-publish/route.ts");
    expect(route).toContain("renderPostPicture");
    expect(cron).toContain("renderPostPictureBytes");
    // ⛔ And the route no longer composes a picture itself.
    expect(route).not.toContain("composePicture");
  });
});
