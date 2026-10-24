/**
 * 📈 THIS WEEK'S MOMENTS — chosen outside the writer, filtered for a wellbeing
 * brand, used only inside their window (owner, 24 Oct 2026).
 */
import { describe, it, expect } from "vitest";
import { AWARENESS_DAYS, activeNotes, isBlocked, parseTrendsRss, pickTrend, upcomingAwarenessDays } from "@/lib/social/trends";

describe("⛔ the word filter refuses what a wellbeing brand must never ride", () => {
  for (const t of ["Actor dies at 54", "bus accident kills 12", "election results live", "मौत की खबर", "flood alert in Assam"]) {
    it(`refuses “${t}”`, () => expect(isBlocked(t)).toBe(true));
  }
  for (const t of ["Sharad Purnima", "board exam timetable", "Diwali holidays", "International Mother Language Day"]) {
    it(`lets “${t}” through to the judgement step`, () => expect(isBlocked(t)).toBe(false));
  }
});

describe("the awareness calendar", () => {
  it("has no day about suicide, and none for children", () => {
    expect(AWARENESS_DAYS.some((d) => /suicide|self-harm|child/i.test(d.name))).toBe(false);
  });
  it("a day is offered from three days before until it ends", () => {
    const notes = upcomingAwarenessDays(new Date("2026-10-08T00:00:00Z"));
    const mhd = notes.find((n) => n.topic === "World Mental Health Day");
    expect(mhd).toBeTruthy();
    expect(mhd!.activeFrom).toBe("2026-10-07T00:00:00.000Z");
    expect(mhd!.expiresAt).toBe("2026-10-11T00:00:00.000Z");
  });
});

describe("using them", () => {
  const note = (id: string, from: string, to: string, removed = false) => ({ id, topic: id, why: "", angle: "", source: "awareness-day" as const, activeFrom: from, expiresAt: to, addedAt: from, removed });
  it("only active, unexpired, unremoved notes are usable", () => {
    const s = { notes: [note("a", "2026-10-01", "2026-10-30"), note("b", "2026-10-01", "2026-10-02"), note("c", "2026-10-01", "2026-10-30", true)], rejected: [], refreshedAt: null };
    expect(activeNotes(s, new Date("2026-10-24")).map((n) => n.id)).toEqual(["a"]);
  });
  it("rotates like the angles", () => {
    const ns = [note("a", "", ""), note("b", "", "")];
    expect([0, 1, 2].map((i) => pickTrend(ns, i)?.id)).toEqual(["a", "b", "a"]);
    expect(pickTrend([], 0)).toBeNull();
  });
  it("reads Google's feed", () => {
    const xml = `<rss><channel><item><title>Sharad Purnima</title><ht:news_item_title>Kheer tradition explained</ht:news_item_title></item></channel></rss>`;
    expect(parseTrendsRss(xml, "google-trends-IN")).toEqual([{ topic: "Sharad Purnima", context: "Kheer tradition explained", source: "google-trends-IN" }]);
  });
});
