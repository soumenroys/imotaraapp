/**
 * #80 (15 Nov 2026): the chain verdict must outlive the 1-day log retention.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { chainEvidenceRow, PASS_KEY, FAIL_KEY } from "@/lib/apple/chainEvidence";
import { chainVerdictOf } from "@/lib/apple/storeServer";

describe("#80 the Apple chain verdict is written down", () => {
  const now = new Date("2026-11-15T06:00:00Z");

  it("a pass and a failure go to separate keys, so one never hides the other", () => {
    expect(chainEvidenceRow({ ok: true }, "report", now).key).toBe(PASS_KEY);
    const fail = chainEvidenceRow({ ok: false, reason: "not Apple's root" }, "report", now);
    expect(fail.key).toBe(FAIL_KEY);
    expect(fail.value).toEqual({ at: now.toISOString(), reason: "not Apple's root", mode: "report" });
  });

  it("a garbage answer gives a failure verdict, never a throw", () => {
    expect(chainVerdictOf("not-a-jws").ok).toBe(false);
    const noX5c = Buffer.from(JSON.stringify({ alg: "ES256" })).toString("base64url") + ".e30.sig";
    expect(chainVerdictOf(noX5c)).toEqual({ ok: false, reason: "no x5c in header" });
  });

  it("the record is made on the purchase path, before the accept/reject decision, and cannot fail it", () => {
    const src = readFileSync("src/lib/apple/storeServer.ts", "utf8");
    expect(src.indexOf("await recordAppleChainVerdict(chainVerdictOf(jws), appleChainMode())"))
      .toBeLessThan(src.indexOf("if (!verifyAppleJWS(jws)) {"));
    const lib = readFileSync("src/lib/apple/chainEvidence.ts", "utf8");
    expect(lib).toMatch(/catch \{\s*\/\/ ⛔ never let the evidence block or fail a purchase/);
  });
});
