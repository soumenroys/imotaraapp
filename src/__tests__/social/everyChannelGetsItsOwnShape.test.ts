/**
 * ⛔ EACH CHANNEL GETS ITS OWN SHAPE, AND THE SHAPING MUST NOT BECOME
 * SEGMENTING.
 *
 * 🔑 THE DISTINCTION THIS FILE EXISTS TO HOLD, and it is a fine one that would
 * be easy to lose in a later edit.
 *
 * The owner asked for posts aimed at each channel — "LinkedIn posts should
 * catch professionals, facebook posts should catch facebook user types". The
 * standing editorial rule says a post is written for everyone and never
 * addresses a segment.
 *
 * ⇒ Those are not in conflict. The channel changes the REGISTER and the ANGLE:
 * how a thing is said, and which true thing is chosen. It never changes who is
 * welcome to read it. A voice note that said "for HR leaders" would cross from
 * one to the other, and nothing in a build or a type check would notice.
 */

import { describe, it, expect } from "vitest";
import { PLATFORMS, PLATFORM_IDS, platformSpec, publishableToday } from "@/lib/social/platforms";
import { composePicture, wordsInPicture, imagesInPicture } from "@/lib/social/compose";
import { recipeHash, LAYOUTS, PALETTE_NAMES, TYPE_TREATMENTS, MOTIFS } from "@/lib/social/visualRecipe";
import { qrTarget, qrContrastOk, LOGO_URL } from "@/lib/social/brandMarks";
import { buildPrompt } from "@/lib/social/writer";

const recipe = (over: Record<string, string> = {}) => {
  const base = { layout: "rule-over", palette: "ink", typeTreatment: "display", motif: "arcs", script: "en", ...over };
  return { ...base, hash: recipeHash(base as never) } as never;
};

describe("the shaping never becomes segmenting", () => {
    /**
     * ⛔ Each of these would address a kind of person rather than set a
     * register. They are the exact phrasings the editorial rule forbids, and
     * the exact ones a "make it more targeted" edit would reach for.
     */
    const SEGMENTS = [
        "hr leader", "manager", "founder", "student", "parent of", "women", "men",
        "millennial", "gen z", "young people", "teenager", "employee", "recruiter",
        "indian", "diwali", "christmas", "ramadan",
    ];

    for (const id of PLATFORM_IDS) {
        it(`${id}'s voice sets a register, not an audience`, () => {
            /**
             * ⚠️ WHOLE WORDS. The first version used `includes`, and "men"
             * matched inside "moment" — so Facebook's voice, which says "a
             * moment, an hour of the day", was reported as addressing a
             * gender. The same substring mistake the gate's matcher made.
             */
            const voice = PLATFORMS[id].voice.toLowerCase();
            const hits = SEGMENTS.filter((seg) =>
                new RegExp(`(^|[^a-z])${seg.replace(/ /g, "\\s+")}([^a-z]|$)`).test(voice),
            );
            expect(
                hits,
                `${id} addresses ${hits.join(", ")} — that is a segment, not a register`,
            ).toEqual([]);
        });
    }

    it("the prompt repeats the rule on every channel", () => {
        for (const id of PLATFORM_IDS) {
            const prompt = buildPrompt({
                brief: "Say one true thing.",
                tone: "gentle_plain",
                lengthHint: "short",
                language: "en",
                topicPool: ["privacy"],
                avoid: [],
                platform: id,
            });
            expect(prompt, `${id} does not carry the channel's voice`).toContain(PLATFORMS[id].label.toUpperCase());
            // ⛔ And the reminder that the register changed, not the reader.
            expect(prompt, `${id} drops the for-everyone rule`).toMatch(/Still for everyone/i);
            expect(prompt).toMatch(/no job title addressed/i);
        }
    });

    it("the prompt carries each channel's own ceiling", () => {
        const li = buildPrompt({ brief: "b", tone: "t", lengthHint: "short", language: "en", topicPool: [], avoid: [], platform: "linkedin" });
        const x = buildPrompt({ brief: "b", tone: "t", lengthHint: "short", language: "en", topicPool: [], avoid: [], platform: "x" });
        expect(li).toContain(String(PLATFORMS.linkedin.limits.soft));
        expect(x).toContain(String(PLATFORMS.x.limits.soft));
        // ⚠️ Facebook takes no hashtags; the prompt must say so rather than
        // leaving it to taste.
        const fb = buildPrompt({ brief: "b", tone: "t", lengthHint: "short", language: "en", topicPool: [], avoid: [], platform: "facebook" });
        expect(fb).toMatch(/no hashtags at all/i);
    });
});

describe("each channel is composed at its own size", () => {
    it("every channel has a size, and no two share every dimension by accident", () => {
        const sizes = PLATFORM_IDS.map((id) => `${PLATFORMS[id].picture.width}x${PLATFORMS[id].picture.height}`);
        // ⚠️ Facebook and LinkedIn are deliberately near-identical (630 vs 627);
        // the point is that a square and a 16:9 are NOT quietly the same.
        expect(new Set(sizes).size).toBeGreaterThanOrEqual(4);
        expect(sizes).toContain("1080x1080");
        expect(sizes).toContain("1600x900");
    });

    for (const id of PLATFORM_IDS) {
        it(`${id} composes at exactly its declared size`, () => {
            const picture = composePicture({
                recipe: recipe(),
                headline: "Most of the hard hours are not office hours",
                language: "en",
                platform: id,
            });
            expect(picture.width).toBe(PLATFORMS[id].picture.width);
            expect(picture.height).toBe(PLATFORMS[id].picture.height);
        });
    }

    it("refuses a channel it does not know, rather than falling back to Facebook", () => {
        // ⛔ A post composed at the wrong size is cropped by the channel,
        // usually through the words.
        expect(() => platformSpec("mastodon")).toThrow(/not a channel/i);
        expect(() =>
            composePicture({ recipe: recipe(), headline: "A headline", language: "en", platform: "mastodon" }),
        ).toThrow();
    });

    it("every layout survives every frame", () => {
        // 🔑 A layout that works on 16:9 and collapses on a square is found on
        // the day the picker chooses it for Instagram, not before.
        for (const id of PLATFORM_IDS)
            for (const layout of LAYOUTS)
                for (const motif of MOTIFS) {
                    const picture = composePicture({
                        recipe: recipe({ layout, motif }),
                        headline: "Most of the hard hours are not office hours",
                        support: "22 languages, eleven of them Indian.",
                        language: "en",
                        platform: id,
                    });
                    expect(wordsInPicture(picture)).toContain("Most of the hard hours are not office hours");
                }
    });
});

describe("the logo and the QR", () => {
    it("the logo is on every picture", () => {
        for (const id of PLATFORM_IDS) {
            const picture = composePicture({ recipe: recipe(), headline: "A headline", language: "en", platform: id });
            expect(imagesInPicture(picture), `${id} has no logo`).toContain(LOGO_URL);
        }
    });

    it("⛔ a picture loads NOTHING but the logo and a QR", () => {
        /**
         * 🔑 The structural guarantee behind "no faces, no stock". It is not a
         * rule somebody has to remember — there is no code path that can put
         * another image on a card, and this is what keeps that true when one is
         * added.
         */
        const picture = composePicture({
            recipe: recipe(),
            headline: "A headline",
            language: "en",
            platform: "facebook",
            qrImage: "data:image/png;base64,AAAA",
        });
        for (const src of imagesInPicture(picture)) {
            const allowed = src === LOGO_URL || src.startsWith("data:image/png;base64,");
            expect(allowed, `a picture loads ${src.slice(0, 60)}`).toBe(true);
        }
    });

    it("appears only where the channel earns it", () => {
        const qr = "data:image/png;base64,AAAA";
        for (const id of PLATFORM_IDS) {
            const picture = composePicture({
                recipe: recipe(), headline: "A headline", language: "en", platform: id,
                qrImage: PLATFORMS[id].qr ? qr : undefined,
            });
            const hasQr = imagesInPicture(picture).includes(qr);
            expect(hasQr, `${id} QR presence does not match its spec`).toBe(PLATFORMS[id].qr);
        }
        // ⛔ Not on X or Instagram: there the image is a thumbnail in a feed on
        // the same phone that would have to scan it.
        expect(PLATFORMS.x.qr).toBe(false);
        expect(PLATFORMS.instagram.qr).toBe(false);
    });

    it("the scan target carries no identifier", () => {
        /**
         * ⚠️ A QR on a mental-health post is exactly the place not to build a
         * tracking link. utm tags say which channel; nothing says which reader,
         * and nothing lets two scans be tied together.
         */
        for (const id of PLATFORM_IDS) {
            const target = qrTarget(id);
            expect(target).toContain(`utm_source=${id}`);
            expect(target).not.toMatch(/post_?id|schedule|uid|user|session|[0-9a-f]{16,}/i);
        }
    });

    it("the code is rendered at a contrast a camera can actually threshold", () => {
        // 🔴 A low-contrast QR is not a subtle QR. It is one that does not work,
        // silently, and only for the reader.
        expect(qrContrastOk("#111827", "#FFFFFF")).toBe(true);
        /**
         * ⚠️ My first example here was wrong: #5EEAD4 on #0F3D3E is 8.2:1 and
         * passes. Picking a "clearly bad" pair by eye is exactly the judgement
         * this function exists to replace — an accent on its own dark ground
         * looks low-contrast and often is not, and looks fine and often is not.
         */
        expect(qrContrastOk("#818CF8", "#111827")).toBe(false); // 5.9:1 — fine for text, not for a camera
        expect(qrContrastOk("#5EEAD4", "#0F3D3E")).toBe(true);  // 8.2:1
    });
});

describe("what the admin is told about publishing", () => {
    it("nothing can publish yet, and each channel says why in its own terms", () => {
        expect(publishableToday()).toEqual([]);
        for (const id of PLATFORM_IDS) {
            // ⛔ Not "coming soon". The reasons differ, and only one of them is
            // work that can be done from this side.
            expect(PLATFORMS[id].blockedBy.length, `${id} has no stated blocker`).toBeGreaterThan(20);
            expect(PLATFORMS[id].blockedBy.toLowerCase()).not.toContain("coming soon");
        }
    });

    it("the recipe space is unchanged by any of this", () => {
        expect(LAYOUTS.length * PALETTE_NAMES.length * TYPE_TREATMENTS.length * MOTIFS.length).toBe(1152);
    });
});
