/**
 * 🔴 AN ORGANISATION WITH A STRAY SPACE IN ITS NAME COULD NEVER BE DELETED.
 *
 * The typed-name confirmation compared the TRIMMED input against the
 * UNTRIMMED stored name. One of the four live organisations is called
 * "Child Care " — trailing space, almost certainly a slip when it was typed.
 *
 *   typed "Child Care "  → trim → "Child Care"  ≠ "Child Care "   ✗
 *   typed "Child Care"   → trim → "Child Care"  ≠ "Child Care "   ✗
 *
 * There was no string an admin could enter. The confirmation exists to make
 * somebody stop and read the name, not to test whether they can reproduce
 * invisible whitespace.
 *
 * ⚠️ Found while deleting organisations the owner had asked to remove — one of
 * them simply refused, and the reason was a character nobody can see.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** The comparison as the route performs it. */
const matches = (typed: string | undefined, stored: string) =>
  (typed ?? "").trim() !== stored.trim() ? "refused" : "accepted";

describe("the confirmation can be satisfied", () => {
  it("🔴 accepts the real name of an org whose stored name has a trailing space", () => {
    expect(matches("Child Care", "Child Care ")).toBe("accepted");
    expect(matches("Child Care ", "Child Care ")).toBe("accepted");
  });

  it("⛔ still refuses a different name", () => {
    // The guard must keep doing its job — this is a confirmation, not a
    // formality. "Child care" is a DIFFERENT live org from "Child Care ".
    expect(matches("Child care", "Child Care ")).toBe("refused");
    expect(matches("", "Child Care ")).toBe("refused");
    expect(matches(undefined, "Child Care ")).toBe("refused");
    expect(matches("XYZ School", "Child Care ")).toBe("refused");
  });

  it("⚠️ is case sensitive, because two orgs can differ only by case", () => {
    // "Child Care " and "Child care" both existed at once.
    expect(matches("child care", "Child Care ")).toBe("refused");
  });
});

describe("the route does it that way", () => {
  it("trims both sides, not just the input", () => {
    const route = read("src/app/api/admin/organizations/[orgId]/route.ts");
    expect(route).toMatch(/\(body\.confirmName \?\? ""\)\.trim\(\) !== org\.name\.trim\(\)/);
  });

  it("🔑 and the guard is still there at all", () => {
    // ⛔ The fix must not have been "remove the check".
    const route = read("src/app/api/admin/organizations/[orgId]/route.ts");
    expect(route).toMatch(/Type the organisation's exact name to confirm deletion/);
    expect(route).toMatch(/role !== "owner"/);
  });
});
