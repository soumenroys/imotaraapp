/**
 * 🔴 THERE WAS NO WAY TO CHANGE A POST'S TIME FROM THE PRODUCT.
 *
 * On 18 Oct six posts were approved in one sitting with no scheduled time —
 * which in this schema means "as soon as it is approved". Unpausing would have
 * put five on the Page inside a minute and the sixth a minute later. On a page
 * with fifty followers that reads as spam, and it is the kind of thing that
 * costs the followers you have.
 *
 * ⚠️ I spread them with a direct database update. It worked, and it was the
 * wrong shape: it left the owner unable to do the same thing, so the next
 * backlog would have needed me again. An action only one party can perform is
 * a dependency, not a feature.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const route = read("src/app/api/admin/social/posts/[id]/route.ts");
const page = read("src/app/admin/social/page.tsx");

describe("the route can move a post's time", () => {
  it("has a reschedule action, and the error message lists it", () => {
    expect(route).toMatch(/case "reschedule":/);
    expect(route).toMatch(/approve, edit, skip, unapprove or reschedule/);
  });

  /**
   * ⛔ `null` IS A REAL VALUE and means "as soon as it is approved". Treating
   * it the same as a missing field would make it impossible to put a post
   * back to that state — and that state is the schema's own default.
   */
  it("tells a missing field apart from an explicit null", () => {
    expect(route).toMatch(/if \(raw === undefined\)/);
    expect(route).not.toMatch(/if \(!raw\)/);
  });

  it("refuses something that is not a date rather than storing it", () => {
    expect(route).toMatch(/Number\.isNaN\(parsed\.getTime\(\)\)/);
  });

  /**
   * ⛔ A PUBLISHED POST IS NOT RESCHEDULABLE. Moving the date on something
   * already public would rewrite the record of what went out in the company's
   * name ⇒ the same reasoning as the delete note on schedules.
   */
  it("will not move a post that has already been published", () => {
    const branch = route.slice(route.indexOf('case "reschedule":'));
    expect(branch).toMatch(/\.in\("status", \["drafting", "generating", "needs_review", "approved", "failed"\]\)/);
    expect(branch.slice(0, branch.indexOf("return NextResponse.json({\n        post: data"))).not.toMatch(
      /"published"/,
    );
  });

  /**
   * ⚠️ A PAST DATE IS ACCEPTED, deliberately — it means "send at the next
   * run", which somebody legitimately wants. Refusing it would send them back
   * to the database, which is the thing this case exists to prevent. But it
   * must SAY so, or it looks like nothing happened.
   */
  it("accepts a past time and says what that means", () => {
    expect(route).toMatch(/That time has already passed, so it will go at the next run/);
  });

  it("every answer carries what publishing actually does now", () => {
    const branch = route.slice(route.indexOf('case "reschedule":'));
    expect((branch.match(/publishingSentence\(\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

describe("the screen offers it", () => {
  it("has a control, and sends the action", () => {
    expect(page).toMatch(/Change the time/);
    expect(page).toMatch(/act\(post\.id, "reschedule"/);
  });

  /**
   * 🔴 THE BUG THIS PINS. A `datetime-local` input takes the LOCAL wall clock
   * with no zone. Handing it a stored UTC instant unshifted shows an Indian
   * 09:30 as 04:00 — the admin reads it as the wrong time and "corrects" it,
   * moving every post by five and a half hours.
   */
  it("⛔ shifts the stored instant into the reader's own zone to display it", () => {
    expect(page).toMatch(/getTimezoneOffset\(\) \* 60000/);
  });

  it("sends null, not an empty string, for “as soon as approved”", () => {
    expect(page).toMatch(/when\.value \? new Date\(when\.value\)\.toISOString\(\) : null/);
  });

  it("⚠️ warns that an empty time means several posts go out at once", () => {
    // The exact thing that happened. The warning is the point of the control.
    expect(page).toMatch(/several undated posts all go out/);
  });
});
