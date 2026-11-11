/** #131 (11 Nov 2026): "A reply …" titles are refused; ordinary titles still pass. */
import { describe, it, expect } from "vitest";
import { judgeSubject } from "@/lib/social/subjects";

describe("titles name the moment, not the product", () => {
  it.each(["A reply when the shift changes but the worry stays", "a reply that carries no badge", "A  reply in your own words"])("refused: %s", (s) => {
    const v = judgeSubject(s, []);
    expect(v.ok).toBe(false);
  });
  it.each(["The message you typed and deleted", "When every office is dark", "Replying to a friend at 2am"])("allowed: %s", (s) => {
    expect(judgeSubject(s, []).ok).toBe(true);
  });
});
