/**
 * Emotion insights are a PREVIEW for free plans, not a blocked feature.
 *
 * 🔴 WHY THIS EXISTS. `grow/page.tsx` declares `useFeatureGate("TRENDS_INSIGHTS")`
 * and uses only `.nudge` — it never checks `.allowed`, so the radar chart and
 * heatmap render for everyone. EVERY other gate in the product blocks with
 * `.allowed`. That asymmetry reads as an oversight, and on 2026-09-26 it was
 * nearly "fixed" as one.
 *
 * It is a product decision (owner, 2026-09-26, asked explicitly): free plans
 * SEE the charts with an upgrade prompt. The data is not withheld — the preview
 * IS the upsell. Blocking it would remove the only way a free user discovers
 * the feature exists.
 *
 * 🔑 The danger this guards is SILENT DIVERGENCE between two places that must
 * agree: the page's behaviour and the tutorial's claim. Before this, the
 * tutorial said `free: false` while the page showed everything — advertising a
 * restriction that did not exist. Either half changing alone is a bug.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const strip = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("the Grow page previews, never blocks", () => {
    const grow = strip(read("src/app/grow/page.tsx"));

    it("🔴 insightsGate.allowed is NOT used to hide the charts", () => {
        // The moment this appears, free users lose the charts and the tutorial
        // becomes wrong in the other direction.
        expect(grow).not.toMatch(/insightsGate\.allowed/);
    });

    it("the upsell nudge is still shown", () => {
        // The other failure mode: someone removes the nudge because "it does
        // not block anything", and the upsell disappears entirely.
        expect(grow).toMatch(/insightsGate\.nudge/);
    });

    it("the charts render unconditionally", () => {
        expect(grow).toMatch(/<EmotionRadarChart/);
        expect(grow).toMatch(/<MoodHeatmap/);
    });
});

describe("the tutorial says the same thing", () => {
    const tut = read("src/app/tutorial/page.tsx");

    it.each([["Emotion Radar Chart"], ["Weekly Report"], ["30-Day Mood Trend"]])(
        "🔴 %s reads free: \"Preview\", not free: false",
        (title) => {
            const i = tut.indexOf(`title: "${title}"`);
            expect(i, `${title} not found`).toBeGreaterThan(-1);
            const block = tut.slice(i, tut.indexOf("tiers: {", i) + 220);
            expect(block).toMatch(/free: "Preview"/);
            expect(block).not.toMatch(/free: false/);
        },
    );

    it("each of the three explains that the data is not withheld", () => {
        for (const title of ["Emotion Radar Chart", "Weekly Report", "30-Day Mood Trend"]) {
            const i = tut.indexOf(`title: "${title}"`);
            const block = tut.slice(i, tut.indexOf("tiers: {", i) + 260);
            expect(block, `${title} has no explanatory note`).toMatch(/not withheld/);
        }
    });
});

describe("TRENDS_INSIGHTS stays a paid entitlement", () => {
    it("🔑 free does NOT hold the key — that is what makes the nudge appear", async () => {
        // The nudge is `!hasFeature`. Granting TRENDS_INSIGHTS to free would
        // silently delete the upsell, which is the opposite of the decision.
        const { featuresForTier } = await import("@/lib/imotara/featureGates");
        expect([...featuresForTier("free")]).not.toContain("TRENDS_INSIGHTS");
        expect([...featuresForTier("plus")]).toContain("TRENDS_INSIGHTS");
    });
});
