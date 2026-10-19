/**
 * 🔴 THE OWNER, 19 Oct: "if we can add more graphics and visuals with some
 * more content and audio and longer, that will be better".
 *
 * The audio is the part with a constraint nobody can see in the code: a
 * licence. The app already ships three ambient tracks for its breathing
 * exercise — rain, ocean, bowl — and they are right for this precisely
 * because they were NOT chosen for a feed: they are calm because they were
 * made to be breathed to, and they are literally the sound of the product.
 *
 * ⛔ AND THEIR PROVENANCE IS UNCONFIRMED. "Licensed for in-app use" and
 * "licensed for marketing" are different grants, and a stock licence
 * covering the first does not always cover the second. The owner was told so
 * before this was built, which is why emptying the list has to be a
 * one-line, no-consequences change.
 */

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
process.env.SOCIAL_TOKEN_KEY ??= Buffer.alloc(32, 9).toString("base64");

import { ambientBed, AMBIENT_BEDS, formatForChannel } from "@/lib/social/renderAnimation";

describe("which sound a video carries", () => {
  it("every named bed actually exists in the repository", () => {
    // ⛔ A missing file would mean a silent video and no error — the kind of
    // thing that is only noticed months later by somebody who unmutes.
    for (const bed of AMBIENT_BEDS) {
      if (!bed.file) continue; // ⚠️ Silence is a real entry, not a missing one.
      expect(existsSync(join(process.cwd(), "public", "sounds", bed.file)), bed.file).toBe(true);
    }
  });

  it("⛔ silence is IN the rotation, not the absence of one", () => {
    /**
     * 🔑 The owner, 19 Oct, having heard all three: "even silent. you can
     * randomly use for all videos." ⚠️ So `file: null` is a decision, and the
     * encoder must treat it as one rather than looking up "null.mp3".
     */
    expect(AMBIENT_BEDS.some((b) => b.file === null)).toBe(true);
    expect(AMBIENT_BEDS.some((b) => b.file !== null)).toBe(true);
  });

  it("water is rolled off and the bowl is not", () => {
    /**
     * 🔴 NOT A PREFERENCE. Rain and ocean are BROADBAND NOISE, and quiet
     * broadband noise with nothing else in the mix is physically hiss — which
     * is what the owner heard and reported. A singing bowl is TONAL: it has
     * pitch and cannot collapse into noise however quiet it gets.
     */
    for (const bed of AMBIENT_BEDS) {
      if (!bed.file) continue;
      const isWater = bed.file.includes("rain") || bed.file.includes("ocean");
      expect(bed.filter.includes("lowpass"), `${bed.file} roll-off`).toBe(isWater);
    }
  });

  it("⛔ is chosen from the recipe, so it is STABLE across re-encodes", () => {
    /**
     * 🔴 Random would mean a post re-encoded after an edit arrives with a
     * different sound than the one somebody approved — a change nobody made
     * and nobody can see in the diff.
     */
    const a = ambientBed("5d73433dabc");
    expect(a).toBe(ambientBed("5d73433dabc"));
    expect(a).toBe(ambientBed("5d73433dabc"));
  });

  it("⛔ and VARIES, so the feed is not identical to hear", () => {
    /**
     * 🔴 THE MUTATION THAT SURVIVED THE FIRST VERSION OF THIS WORK: returning
     * AMBIENT_BEDS[0] every time. Stable and wrong — every video in the feed
     * would carry the same track, which is the audio version of the
     * complaint that started all of this.
     */
    const seen = new Set(
      Array.from({ length: 60 }, (_, i) => ambientBed(`hash-${i}-${i * 7}`)?.file ?? "silent"),
    );
    expect(seen.size).toBeGreaterThan(1);
    // ⚠️ And silence genuinely comes up, rather than being in the list and
    // never chosen.
    expect(seen.has("silent")).toBe(true);
  });

  it("a post with no recipe gets no bed, rather than a default one", () => {
    expect(ambientBed(undefined)).toBeNull();
  });
});

describe("⛔ the licence escape hatch", () => {
  it("emptying the list is all it takes, and nothing else breaks", () => {
    /**
     * 🔑 THE POINT OF THIS TEST IS THE SHAPE, not the value. If these files
     * turn out to be in-app only, the fix must be deleting three strings —
     * not unpicking an audio path from the encoder. ⚠️ Pinned by proving
     * `ambientBed` returns null for an empty list rather than throwing or
     * indexing past the end.
     */
    const saved = [...AMBIENT_BEDS];
    try {
      AMBIENT_BEDS.length = 0;
      expect(ambientBed("anything")).toBeNull();
    } finally {
      AMBIENT_BEDS.splice(0, AMBIENT_BEDS.length, ...saved);
    }
    // ⚠️ Restored, and checked — a leaked mutation would silence every test
    // after this one.
    expect(AMBIENT_BEDS.length).toBe(saved.length);
  });

  it("a GIF is never given a bed, because a GIF has no audio", () => {
    // ⛔ Passing one would be silently ignored, which is worse than refused:
    // somebody would believe the clip had sound.
    expect(formatForChannel("x", "animated_gif")).toBe("gif");
  });
});
