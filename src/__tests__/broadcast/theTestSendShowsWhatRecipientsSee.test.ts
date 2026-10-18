/**
 * 🔴 "SEND ME A TEST" SENT THE MERGE TAGS RAW.
 *
 * The owner pressed it before a real send and received a message opening
 * `Hello {{name|there}},`. The real queue substitutes correctly, so the
 * recipients would have been fine — but the test is the one thing standing
 * between a draft and nineteen inboxes, and it was showing something no
 * recipient would ever get.
 *
 * ⚠️ IT IS WORSE THAN COSMETIC. The obvious reading of a raw tag is "this is
 * broken", and the obvious fix is to delete the tag and hard-code the
 * greeting — which sends "Hello there," to everybody, including the ones
 * whose name we hold. A misleading test does not just fail to catch a bug; it
 * invites one.
 *
 * 🔑 This route's own comment says it exists so that "the first time anyone
 * saw the true rendering" is not when the recipients did. It keeps the footer
 * for exactly that reason — and then skipped substitution.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mergeFields } from "@/lib/broadcast/markup";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const testRoute = read("src/app/api/admin/broadcast/broadcasts/[id]/test/route.ts");
const queue = read("src/app/api/cron/broadcast-queue/route.ts");

describe("the test renders what a recipient would get", () => {
  it("🔴 substitutes the merge fields at all", () => {
    expect(testRoute, "the test send does not merge anything").toContain("mergeFields");
  });

  it("⚠️ in all three places the queue does — subject, html and text", () => {
    // A subject left unmerged would deliver "[TEST] Hi {{name}}" to the inbox
    // list, which is where it is most visible and least excusable.
    /**
     * \u26a0\ufe0f EACH FIELD'S OWN STATEMENT, not a fixed-width window. The first
     * version took 220 characters from each label, which ran past `subject:`
     * into the `html:` line below it \u2014 so removing the merge from the subject
     * left the test green. Caught by mutating it, not by reading it.
     */
    const body = testRoute.slice(testRoute.indexOf("const [outcome] = await sendBatch"));
    const stmt = (field: string) => {
      const from = body.indexOf(`\n    ${field}`);
      expect(from, `${field} not found in the send call`).toBeGreaterThan(-1);
      // Up to the next field at the same indent level.
      const rest = body.slice(from + 1);
      const end = rest.search(/\n    [a-zA-Z]+:/);
      return end === -1 ? rest : rest.slice(0, end);
    };
    for (const field of ["subject:", "html:", "text:"]) {
      expect(stmt(field), `${field} is not merged in the test send`).toContain("mergeFields");
    }
  });

  it("🔑 escapes the HTML exactly as the queue does", () => {
    // ⛔ A recipient's own name is attacker-controlled data. The queue passes
    // `true` for the html body and `false` for subject and text; the test must
    // not differ, or the test stops being a test of the real thing.
    const htmlCall = testRoute.match(/mergeFields\(\s*b\.body_html as string,\s*asFields,\s*(\w+)\s*\)/);
    expect(htmlCall?.[1], "html merge must escape").toBe("true");
    // \u26a0\ufe0f Not a [^)]* pattern: `names.get(r.email)` contains parentheses, so
    // the first version of this assertion failed against correct code.
    const queueHtml = queue.slice(queue.indexOf("mergeFields(broadcast.body_html"));
    expect(queueHtml.slice(0, 160)).toMatch(/,\s*true\s*\)/);
  });

  it("⛔ still marks it as a test, so it cannot be mistaken for the real thing", () => {
    expect(testRoute).toMatch(/\[TEST\]/);
  });
});

describe("what substitution actually produces", () => {
  const body = "Hello {{name|there}},";

  it("uses the name when there is one", () => {
    expect(mergeFields(body, { name: "Afrin", email: "a@b.com" }, false)).toBe("Hello Afrin,");
  });

  it("🔑 falls back when there is not — which is the whole point of the pipe", () => {
    expect(mergeFields(body, { name: null, email: "a@b.com" }, false)).toBe("Hello there,");
    expect(mergeFields(body, { name: "", email: "a@b.com" }, false)).toBe("Hello there,");
  });

  it("⛔ never leaves the raw tag in the output", () => {
    for (const name of ["Afrin", null, "", "  "]) {
      const out = mergeFields(body, { name, email: "a@b.com" }, false);
      expect(out, `raw tag survived for name=${JSON.stringify(name)}`).not.toContain("{{");
    }
  });

  it("⚠️ escapes a name that contains markup", () => {
    const out = mergeFields("Hi {{name}}", { name: '<b>x</b>', email: "a@b.com" }, true);
    expect(out).not.toContain("<b>");
  });
});
