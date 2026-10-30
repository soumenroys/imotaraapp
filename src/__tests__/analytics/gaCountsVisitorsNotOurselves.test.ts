// 🔑 31 Oct 2026, S4: 38% of GA page views were our own admin pages and 153
// were the unsubscribe page (mail scanners). Neither is a visitor.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isUntrackedPath } from "@/lib/analytics/ga";

describe("GA counts visitors, not ourselves or mail scanners", () => {
  it("does not track admin or unsubscribe pages", () => {
    for (const p of ["/admin", "/admin/social", "/admin/users/x", "/unsubscribe", "/unsubscribe/abc"]) {
      expect(isUntrackedPath(p)).toBe(true);
    }
  });

  it("still tracks every visitor page", () => {
    for (const p of ["/", "/chat", "/answers/anxious-at-night", "/administrator-guide", "/faq", null]) {
      expect(isUntrackedPath(p)).toBe(false);
    }
  });

  it("the GA component consults it both before loading and before each page view", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/components/analytics/GoogleAnalytics.tsx"), "utf8");
    expect(src.match(/isUntrackedPath\(pathname\)/g)?.length).toBe(2);
  });
});
