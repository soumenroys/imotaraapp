/**
 * 🔴 ONE FEELING, ONE FRAME — AND THE SUBJECT CHECK REFUSED THE NEXT ONE.
 *
 * 29 Oct 2026: 5 of the last 14 Instagram posts took the "ways-of-saying"
 * angle and every title was "How <feeling> shows up / feels in a day". Three
 * nights the Instagram slot failed 3 of 3 drafts: "75% of the meaningful words
 * are shared with a subject already used". The feeling changed; the frame did
 * not. ⇒ The frame now rotates in code.
 */
import { describe, it, expect } from "vitest";
process.env.SOCIAL_TOKEN_KEY ??= Buffer.alloc(32, 9).toString("base64");

import { TOPIC_POOLS } from "@/lib/social/topicPools";
import { titleFormLine } from "@/lib/social/pipeline";
import { judgeSubject } from "@/lib/social/subjects";

const forms = TOPIC_POOLS.find((p) => p.id === "ways-of-saying")!.titleForms!;
// The live titles that made the next one fail.
const USED = [
  "How overwhelm can show up in a day",
  "How uncertainty shows up in a day",
  "How missing someone really shows up",
  "How doubt actually feels in a day",
  "How self-doubt quietly shapes a day",
];
const fill = (f: string, feeling: string) => f.replace("{feeling}", feeling);

describe("the ways-of-saying angle rotates its title frame", () => {
  it("has several frames, none of them the used-up one", () => {
    expect(forms.length).toBeGreaterThanOrEqual(6);
    for (const f of forms) {
      expect(f).toContain("{feeling}");
      expect(f, f).not.toMatch(/^how\b|shows? up|in a day/i);
    }
  });

  it("🔑 a new feeling in any frame passes the subject check against the live titles", () => {
    for (const f of forms) {
      const v = judgeSubject(fill(f, "restlessness"), USED);
      expect(v.ok, `${f}: ${v.ok ? "" : v.reason}`).toBe(true);
    }
  });

  it("…and two new feelings in two different frames do not clash with each other", () => {
    for (let i = 0; i < forms.length; i++) {
      const others = forms.filter((_, j) => j !== i).map((f) => fill(f, "envy"));
      const v = judgeSubject(fill(forms[i], "loneliness"), others);
      expect(v.ok, `${forms[i]}: ${v.ok ? "" : v.reason}`).toBe(true);
    }
  });

  it("the frame is chosen by turn, so consecutive posts differ", () => {
    const a = titleFormLine(forms, 10), b = titleFormLine(forms, 11);
    expect(a).not.toBe(b);
    expect(a).toMatch(/TITLE: shape it like/);
    expect(titleFormLine(undefined, 3)).toBe("");
  });
});
