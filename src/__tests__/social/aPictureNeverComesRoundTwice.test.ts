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
    RECENT_WINDOW,
    TOTAL_COMBINATIONS,
    headlineFromBody,
    wordmarkFor,
} from "@/lib/social/visualRecipe";

/** A deterministic rng so a failure is reproducible rather than occasional. */
const seeded = (seed: number) => {
    let s = seed;
    return () => {
        s = (s * 1103515245 + 12345) % 2147483648;
        return s / 2147483648;
    };
};

describe("uniqueness is a guarantee", () => {
    it("never returns a recipe already in the register", () => {
        const used = new Set<string>();
        for (let i = 0; i < 300; i++) {
            const r = pickRecipe({ language: "en", usedHashes: used, rng: seeded(i + 1) });
            expect(r.ok, `ran out after ${i} picks, which should not happen inside 1,152`).toBe(true);
            if (!r.ok) return;
            expect(used.has(r.recipe.hash), `recipe repeated at pick ${i}`).toBe(false);
            used.add(r.recipe.hash);
        }
        expect(used.size).toBe(300);
    });

    it("refuses rather than repeats when a language is exhausted", () => {
        // ⛔ The important half. The honest failure is "add a palette", not a
        // quiet second helping of a picture somebody has already seen.
        const used = new Set<string>();
        for (const layout of LAYOUTS)
            for (const palette of PALETTE_NAMES)
                for (const typeTreatment of TYPE_TREATMENTS)
                    for (const motif of MOTIFS)
                        used.add(recipeHash({ layout, palette, typeTreatment, motif, script: "en" }));

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
                        used.add(recipeHash({ layout, palette, typeTreatment, motif, script: "en" }));

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
                        if (!(layout === "stacked-label" && palette === "ink"))
                            used.add(recipeHash({ layout, palette, typeTreatment, motif, script: "en" }));

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
