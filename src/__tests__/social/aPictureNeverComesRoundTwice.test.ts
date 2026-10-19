/**
 * ⛔ A COMPOSED PICTURE MAY NEVER REPEAT, AND A RELAXED PREFERENCE MAY NEVER BE
 * SILENT.
 *
 * 🔑 THE TWO RULES ARE DIFFERENT IN KIND, and conflating them is the mistake
 * this file exists to prevent:
 *
 *   • "never used before" is a GUARANTEE, backed by a unique index. The picker
 *     must fail rather than break it.
 *   • "not among the last five palettes or layouts" is a PREFERENCE. When it
 *     cannot be honoured it must be DROPPED AND REPORTED — a preference that
 *     lapses quietly is indistinguishable from a bug, and the first symptom
 *     would be a feed that looks samey with every check green.
 *
 * 🔴 ALSO PINNED HERE: the arithmetic. I first wrote the rule as "no palette
 * within 14 days", which is impossible with six palettes and daily posting. The
 * invariant below is what stops that returning as somebody adds a palette-free
 * window of 20.
 */

import { describe, it, expect } from "vitest";
import {
    pickRecipe,
    recipeHash,
    LAYOUTS,
    PALETTE_NAMES,
    PALETTES,
    TYPE_TREATMENTS,
    MOTIFS,
    WASHES,
    RECENT_WINDOW,
    TOTAL_COMBINATIONS,
    headlineFromBody,
    wordmarkFor,
    RETIRED_LAYOUTS,
    canonicalLayout,
} from "@/lib/social/visualRecipe";
import { composePicture } from "@/lib/social/compose";

/** A deterministic rng so a failure is reproducible rather than occasional. */
const seeded = (seed: number) => {
    let s = seed;
    return () => {
        s = (s * 1103515245 + 12345) % 2147483648;
        return s / 2147483648;
    };
};

describe("uniqueness is a guarantee", () => {
    /**
     * ⚠️ THE SLOW ONE, AND DELIBERATELY SO. `pickRecipe` enumerates the whole
     * space — 11,520 candidates, each hashed — on EVERY call, because it builds
     * the full unused pool to choose from and to report on honestly. That costs
     * nothing in production, where it runs once a day, but this test calls it
     * 300 times ⇒ ~3.5M hashes.
     *
     * 🔴 MEASURED 19 Oct 2026: **2,026 ms** on the author's machine against
     * vitest's 5,000 ms default. A GitHub runner is roughly 2.5× slower, so it
     * tipped over and **failed every CI run of the day** while passing locally
     * every time ⇒ the figure is recorded here so the next person does not have
     * to re-measure it.
     *
     * ⛔ The loop was NOT shortened to make it fit. 300 picks is most of a
     * year of daily posting; trimming it would trade the guarantee for a
     * stopwatch. The timeout is ~10× the measured cost — loose enough never to
     * flake, tight enough that a genuinely slower `pickRecipe` still shows up.
     */
    it("never returns a recipe already in the register", () => {
        const used = new Set<string>();
        for (let i = 0; i < 300; i++) {
            const r = pickRecipe({ language: "en", usedHashes: used, rng: seeded(i + 1) });
            expect(r.ok, `ran out after ${i} picks, which should not happen inside the space`).toBe(true);
            if (!r.ok) return;
            expect(used.has(r.recipe.hash), `recipe repeated at pick ${i}`).toBe(false);
            used.add(r.recipe.hash);
        }
        expect(used.size).toBe(300);
    }, 20_000);

    it("refuses rather than repeats when a language is exhausted", () => {
        // ⛔ The important half. The honest failure is "add a palette", not a
        // quiet second helping of a picture somebody has already seen.
        const used = new Set<string>();
        for (const layout of LAYOUTS)
            for (const palette of PALETTE_NAMES)
                for (const typeTreatment of TYPE_TREATMENTS)
                    for (const motif of MOTIFS)
                        // ⚠️ THE WASH AXIS, added 19 Oct. An exhaustion test
                        // that misses an axis does not exhaust anything — it
                        // just proves the generator found the gap it left.
                        for (const wash of WASHES)
                            used.add(recipeHash({ layout, palette, typeTreatment, motif, wash, script: "en" }));

        const r = pickRecipe({ language: "en", usedHashes: used });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toMatch(/used/i);
    });

    it("exhausting one language leaves the others untouched", () => {
        // 🔑 The script is part of the hash, so the same layout and palette in
        // Bengali is a different picture — which is the point of that axis.
        const used = new Set<string>();
        for (const layout of LAYOUTS)
            for (const palette of PALETTE_NAMES)
                for (const typeTreatment of TYPE_TREATMENTS)
                    for (const motif of MOTIFS)
                        // ⚠️ THE WASH AXIS, added 19 Oct. An exhaustion test
                        // that misses an axis does not exhaust anything — it
                        // just proves the generator found the gap it left.
                        for (const wash of WASHES)
                            used.add(recipeHash({ layout, palette, typeTreatment, motif, wash, script: "en" }));

        expect(pickRecipe({ language: "en", usedHashes: used }).ok).toBe(false);
        expect(pickRecipe({ language: "bn", usedHashes: used }).ok).toBe(true);
    });

    it("the hash depends on every axis", () => {
        const base = { layout: "stacked-label", palette: "ink", typeTreatment: "display", motif: "arcs", script: "en" };
        const variants = [
            { ...base, layout: "side-bar" },
            { ...base, palette: "sand" },
            { ...base, typeTreatment: "measured" },
            { ...base, motif: "bands" },
            { ...base, script: "bn" },
        ];
        const hashes = new Set([recipeHash(base), ...variants.map(recipeHash)]);
        // ⚠️ If any axis were left out of the hash, two of these would collide
        // and a picture would be free to repeat along that axis forever.
        expect(hashes.size).toBe(6);
    });
});

describe("the recency preference is honoured, or reported", () => {
    it("avoids a recent palette and layout when it can", () => {
        const r = pickRecipe({
            language: "en",
            usedHashes: new Set(),
            recentPalettes: ["ink", "slate"],
            recentLayouts: ["stacked-label"],
            rng: seeded(7),
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(["ink", "slate"]).not.toContain(r.recipe.palette);
        expect(r.recipe.layout).not.toBe("stacked-label");
        expect(r.relaxed).toEqual([]);
    });

    it("says so out loud when it has to drop the preference", () => {
        // Every recipe outside one palette/layout pair is already used, so the
        // only unused recipes are ones the preference forbids.
        const used = new Set<string>();
        for (const layout of LAYOUTS)
            for (const palette of PALETTE_NAMES)
                for (const typeTreatment of TYPE_TREATMENTS)
                    for (const motif of MOTIFS)
                        // ⚠️ The wash axis too, or the "everything else is
                        // used" premise is false and the pick simply finds a
                        // recipe the preference never forbade.
                        for (const wash of WASHES)
                            if (!(layout === "stacked-label" && palette === "ink"))
                                used.add(recipeHash({ layout, palette, typeTreatment, motif, wash, script: "en" }));

        const r = pickRecipe({
            language: "en",
            usedHashes: used,
            recentPalettes: ["ink"],
            recentLayouts: ["stacked-label"],
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.recipe.palette).toBe("ink");
        // ⛔ The assertion that matters: it did not pretend.
        expect(r.relaxed.length).toBeGreaterThan(0);
        expect(r.relaxed[0]).toMatch(new RegExp(String(RECENT_WINDOW)));
    });

    it("the window is satisfiable by arithmetic, not by hope", () => {
        expect(
            PALETTE_NAMES.length,
            `RECENT_WINDOW is ${RECENT_WINDOW}; there must be more palettes than that or the preference can never be met`,
        ).toBeGreaterThan(RECENT_WINDOW);
        expect(LAYOUTS.length).toBeGreaterThan(RECENT_WINDOW);
    });
});

describe("the axes themselves", () => {
    it("offers enough combinations to be worth calling unique", () => {
        expect(TOTAL_COMBINATIONS).toBeGreaterThan(25000);
    });

    it("every palette carries its own text colours", () => {
        // ⚠️ Contrast is a property of the PAIR. A palette that named only a
        // ground, with caption grey chosen elsewhere, is how unreadable text
        // on a tinted card happens.
        for (const [name, p] of Object.entries(PALETTES)) {
            for (const key of ["ground", "ink", "muted", "accent", "accentInk"] as const) {
                expect(p[key], `${name} is missing ${key}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
            }
        }
    });

    it("has no gradient and no photographic axis", () => {
        // ⛔ Structural: there is deliberately no value anywhere that could put
        // a face or a stock photograph on a picture, so adding one has to be a
        // visible decision rather than a convenient import.
        const everyValue = [...LAYOUTS, ...PALETTE_NAMES, ...TYPE_TREATMENTS, ...MOTIFS].join(" ");
        for (const forbidden of ["gradient", "photo", "face", "portrait", "person", "stock"]) {
            expect(everyValue, `an axis offers "${forbidden}"`).not.toContain(forbidden);
        }
    });
});

describe("the words on a picture", () => {
    it("come from the post, and are never invented", () => {
        expect(headlineFromBody("Most of the hard hours are not office hours. They are at two in the morning."))
            .toBe("Most of the hard hours are not office hours");
    });

    it("returns nothing rather than half a thought", () => {
        // 🔑 A truncated sentence on a card is worse than no card, and the
        // caller can fall back to text-only. ⛔ Truncating here would also be
        // the one place a picture could say something the gate never read as a
        // complete sentence.
        const long = "This opening sentence is deliberately far longer than any headline could reasonably hold.";
        expect(headlineFromBody(long)).toBeNull();
        expect(headlineFromBody("   ")).toBeNull();
    });

    it("sets the wordmark in the post's own script", () => {
        expect(wordmarkFor("bn")).toBe("ইমোতারা");
        expect(wordmarkFor("kn")).toBe("ಇಮೋತಾರಾ");
        expect(wordmarkFor("ur")).toBe("اموتارا");
        expect(wordmarkFor("en")).toBe("Imotara");
    });
});

describe("a picture stored yesterday still renders today", () => {
    /**
     * 🔴 THE DEFECT THIS PINS, seen live on 18 Oct. The layouts were renamed to
     * describe geometry instead of alignment — and the recipe is PERSISTED, as
     * JSON on the post. A post approved an hour before the rename then rendered
     * as `unknown layout "split-rule"`: a 422, and a broken image sitting in
     * the review queue.
     *
     * ⚠️ THE LESSON IS BIGGER THAN THE MAP. Any value that is stored and later
     * matched by name is a public identifier, even when it looks internal.
     * Renaming one is a migration, not a tidy-up.
     */
    it("every retired layout name maps to one that exists", () => {
        for (const [old, now] of Object.entries(RETIRED_LAYOUTS)) {
            expect(LAYOUTS as readonly string[], `${old} maps to "${now}", which is not a layout`).toContain(now);
            // ⛔ And a retired name must not also be a current one, or the map
            // would silently shadow a real layout.
            expect(LAYOUTS as readonly string[]).not.toContain(old);
        }
    });

    it("composes a picture from a recipe saved under an old name", () => {
        const base = { layout: "split-rule", palette: "ink", typeTreatment: "tight-display", motif: "arcs", script: "en" };
        expect(() =>
            composePicture({
                recipe: { ...base, hash: recipeHash(base as never) } as never,
                headline: "Your words stay on your device",
                language: "en",
                platform: "facebook",
            }),
        ).not.toThrow();
    });

    it("⛔ still refuses a name that was never a layout", () => {
        // A typo must not quietly become a picture.
        expect(canonicalLayout("diagonal")).toBe("diagonal");
        expect(() =>
            composePicture({
                recipe: { layout: "diagonal", palette: "ink", typeTreatment: "display", motif: "none", script: "en", hash: "x" } as never,
                headline: "A headline",
                language: "en",
                platform: "facebook",
            }),
        ).toThrow(/unknown layout/i);
    });

    it("⛔ does not rewrite the stored hash", () => {
        /**
         * 🔑 The register recorded what was actually used. Rewriting history to
         * match a new vocabulary would be a worse bug than the one the alias
         * fixes: two different recipes could collapse onto one hash, and a
         * picture could then be used twice.
         */
        const oldName = { layout: "split-rule", palette: "ink", typeTreatment: "display", motif: "arcs", script: "en" };
        const newName = { ...oldName, layout: "side-bar" };
        expect(recipeHash(oldName as never)).not.toBe(recipeHash(newName as never));
    });
});

/**
 * 🔴 A PORTRAIT CARD RUNS OUT OF WORDS BEFORE IT RUNS OUT OF FRAME.
 *
 * When Facebook moved to 1080×1350 — because 1200×630 was being cropped on
 * both sides by the mobile feed — the card began to read sparse. The width
 * did not change, so a headline wraps exactly as it does on Instagram and the
 * text block is the same height, while the card is 270px taller. That 20% of
 * the frame is empty by construction, not by accident.
 *
 * ⛔ THE FIX IS NOT A BLANKET MULTIPLIER, and the reason is worth keeping: a
 * feed renders a card at a fixed WIDTH, so type at 1080 across already reads
 * the same size to a person whatever the height. Scaling everything would
 * make the card louder, not more readable, and would crowd long headlines.
 *
 * ⇒ The existing self-limiting `fit` rule now applies on 4:5 as well, with a
 * lower ceiling: short text grows into the room it has, and a headline at the
 * gate's 64-character limit is left exactly as it was.
 */
describe("⛔ a 4:5 card fills itself without crowding", () => {
    const recipe = {
        layout: "full-bleed-type", palette: "ink", typeTreatment: "display",
        motif: "none", script: "en", wash: "flat",
    };
    const sized = (platform: string, headline: string) => {
        const picture = composePicture({
            recipe: { ...recipe, hash: recipeHash(recipe as never) } as never,
            headline,
            support: "A support line, so this is not the lone-headline case the old rule already covered.",
            language: "en",
            platform,
        } as never);
        type CNode = { role?: string; style?: Record<string, unknown>; children?: CNode[] };
        const find = (n: CNode): number | null => {
            if (n.role === "headline") return parseInt(String(n.style?.fontSize ?? "0"), 10);
            for (const c of n.children ?? []) { const r = find(c); if (r) return r; }
            return null;
        };
        // ⚠️ composePicture returns a Picture, not a Node — the tree is `.root`.
        return find(picture.root as unknown as CNode)!;
    };

    const SHORT = "Here at any hour";
    const LIMIT = "a".repeat(64);

    it("🔑 a SHORT headline grows on 4:5, where there is room going spare", () => {
        expect(sized("facebook", SHORT)).toBeGreaterThan(sized("facebook", LIMIT));
    });

    it("⛔ a headline at the gate's limit is NOT enlarged — no crowding", () => {
        // 🔑 The self-limiting half. A blanket multiplier would have pushed this
        // one further down a frame it already fills.
        const atLimit = sized("facebook", LIMIT);
        const unboosted = sized("x", LIMIT) / (Math.sqrt(1600 * 900) / Math.sqrt(1080 * 1350));
        expect(Math.abs(atLimit - unboosted)).toBeLessThan(2);
    });

    it("⛔ and 1:1 and 9:16 are untouched, because nobody complained about them", () => {
        /**
         * ⚠️ My first version of this rule was `h > w`, which also catches
         * YouTube's 1080×1920 — a frame whose card is already placed around
         * YouTube's own chrome and was checked by rendering
         * ⇒ trap_blunt_fix_trades_one_failure_for_its_opposite.
         */
        expect(sized("instagram", SHORT)).toBe(sized("instagram", LIMIT));
        expect(sized("youtube", SHORT)).toBe(sized("youtube", LIMIT));
    });
});
