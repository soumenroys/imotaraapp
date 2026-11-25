/** #170 (25 Nov 2026): counts from our own test builds never reach the tally. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isTestBuild } from "@/lib/analytics/testBuild";

describe("isTestBuild", () => {
  it("only an explicit 'test' is dropped", () => {
    expect(isTestBuild("test")).toBe(true);
    expect(isTestBuild(" Test ")).toBe(true);
    for (const v of [null, "", "store", "production", "tests"]) expect(isTestBuild(v)).toBe(false);
  });
  it("the route checks it before writing anything", () => {
    const r = readFileSync(join(process.cwd(), "src/app/api/metrics/visit/route.ts"), "utf8");
    const check = r.indexOf('isTestBuild(req.headers.get("x-imotara-build"))');
    const write = r.indexOf("imotara_record_visit_tally");
    expect(check).toBeGreaterThan(0);
    expect(check).toBeLessThan(write);
  });
});
