/**
 * src/__tests__/broadcast/parseRecipients.test.ts
 *
 * classify() decides what happens to every pasted address. The failures that
 * matter are the quiet ones:
 *
 *  - An address that is both suppressed AND already on the list must report as
 *    SUPPRESSED. Reporting "already on the list" implies it will be mailed,
 *    which is the opposite of true, and is how someone who unsubscribed gets
 *    mailed anyway.
 *  - A duplicate inside one paste must be counted once. Counting it twice
 *    inflates "will receive" and the review screen stops reconciling.
 *  - The email pattern must match the database CHECK constraint exactly. Looser
 *    and the API accepts what the DB rejects (generic 500, admin did nothing
 *    wrong); stricter and the two rules drift apart silently.
 */

import { describe, it, expect } from "vitest";
import {
  classify, validate, splitPasted, unwrap, suggestDomain, EMAIL_RE,
} from "@/lib/broadcast/parseRecipients";

const noneExisting = new Map<string, string | null>();
const noneSuppressed = new Map<string, string>();

describe("EMAIL_RE — must mirror the DB constraint", () => {
  // The constraint is ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$
  it.each([
    ["a@b.co", true],
    ["a+tag@sub.domain.co.uk", true],
    ["broken@invalid", false],      // no dot in domain — the case that hit prod
    ["deepa@childcare", false],
    ["@example.com", false],
    ["a@@b.com", false],
    ["john smith@example.com", false],
    ["", false],
  ])("%s → %s", (input, expected) => {
    expect(EMAIL_RE.test(input)).toBe(expected);
  });
});

describe("splitPasted / unwrap", () => {
  it("accepts newlines, commas and semicolons", () => {
    expect(splitPasted("a@x.com\nb@x.com, c@x.com; d@x.com")).toEqual([
      "a@x.com", "b@x.com", "c@x.com", "d@x.com",
    ]);
  });

  it("unwraps the Name <addr> form a mail client produces", () => {
    expect(unwrap("Priya N <priya.n@childcare.org>")).toBe("priya.n@childcare.org");
    expect(unwrap("  plain@x.com  ")).toBe("plain@x.com");
  });
});

describe("suggestDomain", () => {
  it("completes a truncated domain from one already seen", () => {
    expect(suggestDomain("deepa@childcare", ["childcare.org"]))
      .toBe("deepa@childcare.org");
  });

  it("returns nothing when there is no basis to guess", () => {
    expect(suggestDomain("deepa@childcare", ["example.com"])).toBeUndefined();
    expect(suggestDomain("already@complete.com", ["complete.com"])).toBeUndefined();
  });
});

describe("classify — the five buckets", () => {
  it("sorts a mixed paste into the right buckets", () => {
    const existing = new Map<string, string | null>([
      ["arun.mehta@childcare.org", "2026-08-12T00:00:00Z"],
    ]);
    const suppressed = new Map<string, string>([
      ["r.das@childcare.org", "unsubscribed"],
    ]);

    const b = classify(
      [
        "priya.n@childcare.org",       // new
        "arun.mehta@childcare.org",    // already on list
        "deepa@childcare",             // invalid, suggestable
        "priya.n@childcare.org",       // repeated in paste
        "r.das@childcare.org",         // suppressed
        "m.sarkar@childcare.org",      // new
      ].join("\n"),
      existing, suppressed,
    );

    expect(b.toAdd.map((a) => a.email)).toEqual([
      "priya.n@childcare.org", "m.sarkar@childcare.org",
    ]);
    expect(b.alreadyOnList).toEqual([
      { email: "arun.mehta@childcare.org", addedAt: "2026-08-12T00:00:00Z" },
    ]);
    expect(b.repeatedInPaste).toEqual(["priya.n@childcare.org"]);
    expect(b.suppressed).toEqual([{ email: "r.das@childcare.org", reason: "unsubscribed" }]);
    expect(b.invalid).toHaveLength(1);
    expect(b.invalid[0].original).toBe("deepa@childcare");
    // The suggestion comes from other addresses in the same paste.
    expect(b.invalid[0].suggestion).toBe("deepa@childcare.org");
  });

  it("reports a suppressed address as SUPPRESSED even when it is already on the list", () => {
    // The dangerous case: "already on the list" implies it will be mailed.
    const existing = new Map<string, string | null>([["gone@x.com", "2026-01-01T00:00:00Z"]]);
    const suppressed = new Map<string, string>([["gone@x.com", "hard_bounce"]]);

    const b = classify("gone@x.com", existing, suppressed);

    expect(b.suppressed).toEqual([{ email: "gone@x.com", reason: "hard_bounce" }]);
    expect(b.alreadyOnList).toHaveLength(0);
    expect(b.toAdd).toHaveLength(0);
  });

  it("never puts a suppressed address in toAdd", () => {
    const b = classify(
      "a@x.com\nblocked@x.com",
      noneExisting,
      new Map([["blocked@x.com", "complaint"]]),
    );
    expect(b.toAdd.map((a) => a.email)).toEqual(["a@x.com"]);
  });

  it("counts a repeat once, and still adds it once", () => {
    const b = classify("dup@x.com\ndup@x.com\ndup@x.com", noneExisting, noneSuppressed);
    expect(b.toAdd).toHaveLength(1);
    expect(b.repeatedInPaste).toEqual(["dup@x.com"]);
  });

  it("normalises case so Mixed@X.com and mixed@x.com are one address", () => {
    const b = classify("Mixed@X.com\nmixed@x.com", noneExisting, noneSuppressed);
    expect(b.toAdd).toHaveLength(1);
    expect(b.toAdd[0].email).toBe("mixed@x.com");
    expect(b.repeatedInPaste).toEqual(["mixed@x.com"]);
  });

  it("matches an existing address case-insensitively", () => {
    const existing = new Map<string, string | null>([["known@x.com", null]]);
    const b = classify("KNOWN@X.com", existing, noneSuppressed);
    expect(b.alreadyOnList).toHaveLength(1);
    expect(b.toAdd).toHaveLength(0);
  });

  it("every input lands in exactly one bucket — nothing is silently dropped", () => {
    const raw = "ok@x.com\nbad\ndup@x.com\ndup@x.com\nsup@x.com\nold@x.com";
    const b = classify(
      raw,
      new Map([["old@x.com", null]]),
      new Map([["sup@x.com", "unsubscribed"]]),
    );
    const accounted =
      b.toAdd.length + b.invalid.length + b.repeatedInPaste.length +
      b.suppressed.length + b.alreadyOnList.length;
    expect(accounted).toBe(splitPasted(raw).length);
  });
});

describe("validate — messages an admin can act on", () => {
  it("names the actual problem rather than saying 'invalid'", () => {
    expect(validate("nope").ok).toBe(false);
    expect((validate("nope") as { reason: string }).reason).toMatch(/No @/);
    expect((validate("a@@b.com") as { reason: string }).reason).toMatch(/more than one @/i);
    expect((validate("a b@c.com") as { reason: string }).reason).toMatch(/space/i);
    expect((validate("a@bcom") as { reason: string }).reason).toMatch(/no domain ending/i);
  });
});
