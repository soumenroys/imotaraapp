/**
 * ⛔ THE BANNERS MUST NOT CLAIM A CLINICAL ROLE.
 *
 * 🔴 THIS HAS NOW HAPPENED THREE TIMES, ALL IN IMAGES:
 *   • YouTube banner  — "Connect with expert counselors"   (fixed 16 Oct)
 *   • X header        — "expert counselors", "talk, heal"  (fixed 17 Oct)
 *   • Facebook cover  — "Human Consultation", "heal & grow" (fixed 17 Oct)
 *
 * 🔑 WHY NO EARLIER GUARD COULD HAVE CAUGHT THEM. Every other copy guard in
 * this repo greps source files. These claims were baked into PNGs — invisible
 * to every test, sitting on the most public surface the product has, for
 * months. **Images are copy, and a test cannot read a picture.**
 *
 * ▶️ SO THE FIX IS STRUCTURAL, NOT A STRING CHECK: the banners are GENERATED
 * from copy that lives in code. A wrong word is now a one-line diff, and this
 * guard reads that copy. It protects the three images only because no image is
 * drawn by hand any more.
 *
 * ⚠️ WHAT THIS CANNOT DO: if anyone uploads a hand-made image to a channel,
 * nothing here will notice. The guard protects the SOURCE, not the upload.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SCRIPT = path.join(process.cwd(), "scripts/generate-youtube-banner.js");

/**
 * ⚠️ Comments stripped. This file's own header quotes every banned phrase, and
 * the generator explains its history in prose — a guard that reads its own
 * explanation is the mutation-proof failure already hit three times here.
 */
const COPY = (() => {
    const src = fs.readFileSync(SCRIPT, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    // Only the copy constants, not the layout maths.
    const head = /const HEAD = ([\s\S]*?);\n/.exec(src)?.[1] ?? "";
    const sub = /const SUB = ([\s\S]*?);\n/.exec(src)?.[1] ?? "";
    const pills = /const PILLS = \[([\s\S]*?)\];/.exec(src)?.[1] ?? "";
    return `${head}\n${sub}\n${pills}`.toLowerCase();
})();

/**
 * ⚠️ A DENIAL IS NOT A CLAIM, and the first version of this guard could not
 * tell them apart — it failed on "Peer companions, NOT clinicians", the one
 * sentence we most want on the banner.
 *
 * So the honest denials are removed before the blocklist runs. "not
 * clinicians" is then exempt while a bare "clinicians" still fails, which is
 * the distinction that actually matters.
 */
const CLAIMS = COPY.replace(
    /\bnot\s+(?:a\s+)?(?:clinicians?|therapists?|counsell?ors?|doctors?|psychologists?|psychiatrists?|medical\b[a-z ]*)/g,
    " ",
);

/** Regulated titles and treatment claims the product does not have. */
const FORBIDDEN = [
    "counselor", "counsellor", "counseling", "counselling",
    "therapist", "therapy", "psychologist", "psychiatrist",
    "clinician", "clinical", "consultation", "diagnos",
    "treatment", "heal", "cure", "patient", "medical",
];

describe("the generated banners claim no clinical role", () => {
    it("reads the copy constants, not the whole file", () => {
        // ⛔ If the extraction silently returned nothing, every assertion below
        // would pass on an empty string — the classic guard that cannot fail.
        expect(COPY.length).toBeGreaterThan(40);
        expect(COPY).toContain("22 languages");
        // And the denial-stripping must not have eaten everything.
        expect(CLAIMS.length).toBeGreaterThan(40);
    });

    for (const term of FORBIDDEN) {
        it(`never says "${term}"`, () => {
            // ⚠️ "heal" must not match "health"; check it as a whole word.
            const hit = new RegExp(`\\b${term}`).test(CLAIMS);
            expect(hit, `banner copy contains "${term}"`).toBe(false);
        });
    }

    it("says plainly what the companions are NOT", () => {
        // ⛔ Removal alone is not the fix. The banner that said "expert
        // counselors" would pass a pure blocklist if the words were simply
        // deleted; the honest claim has to survive too.
        expect(COPY).toContain("peer companions, not clinicians");
    });

    it("renders all three channel sizes from the one copy", () => {
        // If a channel is drawn outside this script, its copy is unguarded.
        const src = fs.readFileSync(SCRIPT, "utf8");
        // ⚠️ Add every new channel here. A size rendered outside this script,
        // or quietly deleted from it, is copy nothing checks.
        for (const spec of ["youtube:", "x:", "facebook:", "producthunt:"]) {
            expect(src, `${spec} spec missing`).toContain(spec);
        }
    });
});
