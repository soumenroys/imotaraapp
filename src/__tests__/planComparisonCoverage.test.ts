/**
 * The /upgrade comparison table must actually list what the product does.
 *
 * 🔴 WHY THIS EXISTS. On 2026-09-17 the table said "Every feature, side by
 * side" above 69 hand-maintained rows — and was missing twelve things the app
 * genuinely does, including **crisis resources**, hands-free conversation,
 * noise rejection, the grief space and guided breathing. Every one of them is
 * ungated and free, so the omission was not a pricing error: it was giving the
 * work away without getting credit for it, on the one page where a person
 * decides whether Imotara is worth paying for.
 *
 * The table is hand-maintained by necessity — most tutorial features carry no
 * tier metadata, so it cannot simply be generated. This test is the substitute
 * for generation: add a feature to the product, and the table has to admit it
 * exists.
 *
 * ⚠️ If you add a row here, add it because the FEATURE shipped — not to make
 * the test pass.
 *
 * 📐 Three columns since the Plus/Pro merge (L10): free · plus · ent. The
 * merged paid tier took Pro's column, so anything that was Pro-only is now
 * simply "Plus".
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..", "..");
const UPGRADE = fs.readFileSync(path.join(ROOT, "src/app/upgrade/page.tsx"), "utf8");

/** Just the comparison table, so a stray match elsewhere on the page cannot pass this. */
const TABLE = (() => {
    const i = UPGRADE.indexOf("{/* Feature comparison table */}");
    expect(i).toBeGreaterThan(-1);
    const j = UPGRADE.indexOf("</table>", i);
    expect(j).toBeGreaterThan(i);
    return UPGRADE.slice(i, j);
})();

const rowLabels = (): string[] =>
    Array.from(TABLE.matchAll(/label:\s*"([^"]+)"/g)).map((m) => m[1].toLowerCase());

describe("the comparison table covers what the app actually does", () => {
    it.each([
        // shipped in v1.4.1 — the release that prompted this test
        // ⚠️ needle must be the FULL label: a bare "hands-free" also matches the
        // "Noise rejection in hands-free" row, so deleting this row passed a
        // mutation test until the needle was tightened.
        ["hands-free conversation", "hands-free conversation"],
        ["noise rejection", "noise rejection"],
        ["naming your companion", "name your companion"],
        ["long-press menu", "long-press"],
        // long-standing features that were never listed
        ["grief space / unsent letter", "unsent letter"],
        ["guided breathing", "breathing"],
        ["bookmark & react", "bookmark"],
        ["emotion tags", "emotion tags"],
        ["quick-start feeling chips", "feeling chips"],
        ["retry a reply", "retry a reply"],
        ["collective pulse", "collective pulse"],
    ])("lists %s", (_name, needle) => {
        expect(rowLabels().join(" | ")).toContain(needle);
    });

    it("🔴 lists CRISIS RESOURCES, and shows them on every plan", () => {
        // The single most important thing this app does when someone is in
        // danger. It is ungated in code; a pricing page that does not say so
        // invites the reader to wonder whether safety is a paid feature.
        const i = TABLE.toLowerCase().indexOf("crisis resources");
        expect(i).toBeGreaterThan(-1);
        const row = TABLE.slice(i, i + 400);
        // Three columns since the Plus/Pro merge (L10) — free, plus, ent.
        expect(row).toMatch(/free:\s*true/);
        expect(row).toMatch(/plus:\s*true/);
        expect(row).toMatch(/ent:\s*true/);
        // And it must not have quietly grown a paid-only column back.
        expect(row).not.toMatch(/pro:/);
    });

    it("⚠️ the free column is not empty theatre", () => {
        // Most of what shipped in 1.4.1 is free, deliberately. If someone later
        // moves these behind a paywall, that is a real decision and this test
        // should make them take it consciously rather than by drift.
        const freeTrue = (TABLE.match(/free:\s*true/g) ?? []).length;
        expect(freeTrue).toBeGreaterThanOrEqual(25);
    });

    it("still claims to be comprehensive, and now has the rows to mean it", () => {
        expect(UPGRADE).toMatch(/Every feature, side by side/);
        expect(rowLabels().length).toBeGreaterThanOrEqual(80);
    });
});
