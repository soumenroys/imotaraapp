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
import fs from "fs";
import path from "path";
import { PLATFORMS, PLATFORM_IDS, platformSpec, publishableToday, publishingSentence } from "@/lib/social/platforms";
import { PUBLISHABLE } from "@/lib/social/mediaPlan";
import { composePicture, wordsInPicture, imagesInPicture } from "@/lib/social/compose";
import { recipeHash, LAYOUTS, PALETTE_NAMES, TYPE_TREATMENTS, MOTIFS, WASHES } from "@/lib/social/visualRecipe";
import { qrTarget, qrContrastOk, LOGO_URL, QR_TARGETS } from "@/lib/social/brandMarks";
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
            qrCodes: [{ id: "web", label: "Website", color: "#312E81", ringColor: "#A5B4FC", dataUri: "data:image/png;base64,AAAA" }],
        });
        for (const src of imagesInPicture(picture)) {
            const allowed = src === LOGO_URL || src.startsWith("data:image/png;base64,");
            expect(allowed, `a picture loads ${src.slice(0, 60)}`).toBe(true);
        }
    });

    it("⛔ all THREE codes, and each one labelled", () => {
        /**
         * 🔴 I SHIPPED ONE GENERIC CODE AND DID NOT LOOK. The three had been
         * defined since the org-invite emails were built —
         * `scripts/generate-qr-codes.js`, pointing at the site, the Play
         * listing and the App Store listing.
         *
         * ⚠️ And they must be LABELLED. Three unlabelled codes side by side is
         * a puzzle: a reader has to scan one to discover whether it was the one
         * for their phone, which is worse than a single code would have been.
         */
        const codes = QR_TARGETS.map((t) => ({ id: t.id, label: t.label, color: t.color, ringColor: t.onDark, dataUri: `data:image/png;base64,${t.id}` }));
        const picture = composePicture({
            recipe: recipe(), headline: "A headline", language: "en", platform: "facebook", qrCodes: codes,
        });
        const images = imagesInPicture(picture);
        for (const c of codes) expect(images, `the ${c.id} code is missing`).toContain(c.dataUri);
        for (const c of codes) expect(wordsInPicture(picture), `the ${c.id} code has no label`).toContain(c.label);
    });

    it("the codes point where the email QR codes point", () => {
        // ⛔ Two places encoding different URLs for "the Android one" is the
        // drift that makes a QR point somewhere nobody checks.
        const script = fs.readFileSync(path.join(process.cwd(), "scripts/generate-qr-codes.js"), "utf8");
        for (const t of QR_TARGETS) {
            expect(script, `${t.id} points somewhere the email QR does not`).toContain(t.url);
        }
    });

    it("every channel carries them", () => {
        for (const id of PLATFORM_IDS) {
            expect(PLATFORMS[id].qr, `${id} has no QR codes`).toBe(true);
        }
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

    it("⛔ leaves the store links untagged", () => {
        // A store URL with unknown query parameters is a store URL that may
        // not resolve. Only our own site gets the utm tags.
        for (const t of QR_TARGETS) {
            const out = qrTarget("facebook", t.url);
            if (t.url.includes("imotara.com")) expect(out).toContain("utm_source");
            else expect(out, `${t.id} was tagged`).toBe(t.url);
        }
    });

    it("🔴 every QR colour clears the camera bar, not the reading bar", () => {
        /**
         * The owner asked for colourful codes, and colour is the one thing on a
         * card that can stop a QR working — silently, and only for the reader.
         *
         * ⚠️ A QR is read by a machine with none of a human eye's advantages:
         * no context, no expectation, one exposure, usually at an angle on a
         * lit screen. ⇒ 7:1, well above the 4.5:1 that text needs, and the
         * colour sits on the RING and the modules, never behind them.
         *
         * ⛔ A colour that fails is not used in a muted form or with a warning.
         * It is replaced with near-black and the code still works.
         */
        for (const t of QR_TARGETS) {
            expect(
                qrContrastOk(t.color, "#FFFFFF"),
                `the ${t.id} code's colour ${t.color} will not reliably scan`,
            ).toBe(true);
        }
    });

    it("the three are told apart by colour as well as by label", () => {
        // ⚠️ Colour alone would fail anybody who cannot distinguish them, which
        // is why the labels exist too — but three identical grey squares is
        // what the owner was looking at, and that was the complaint.
        const colours = new Set(QR_TARGETS.map((t) => t.color));
        expect(colours.size).toBe(QR_TARGETS.length);
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
    /**
     * 🔴 THIS USED TO ASSERT `publishableToday()` IS EMPTY. True until 18 Oct,
     * when Facebook started publishing — at which point the test was pinning
     * a fact about yesterday and standing in the way of recording today.
     *
     * ⛔ It now pins the RULE instead: a channel either publishes, or it says
     * in its own terms what is missing. Both halves matter — a blocker on a
     * working channel is as wrong as a missing one on a blocked channel.
     */
    it("every channel either publishes or says why not, in its own terms", () => {
        for (const id of PLATFORM_IDS) {
            const spec = PLATFORMS[id];
            if (spec.canPublish) {
                expect(spec.blockedBy, `${id} publishes but still states a blocker`).toBe("");
            } else {
                // ⛔ Not "coming soon". The reasons differ, and only some of
                // them are work that can be done from this side.
                expect(spec.blockedBy.length, `${id} has no stated blocker`).toBeGreaterThan(20);
                expect(spec.blockedBy.toLowerCase()).not.toContain("coming soon");
            }
        }
    });

    it("the sentence the admin reads follows what is actually built", () => {
        const sentence = publishingSentence();
        if (publishableToday().length === 0) {
            expect(sentence).toMatch(/Nothing publishes yet/i);
        } else {
            // ⚠️ Names the channels that work AND the ones that do not, so an
            // admin never assumes a post for X went out because Y did.
            for (const id of publishableToday()) expect(sentence).toContain(PLATFORMS[id].label);
            expect(sentence).toMatch(/paused/i);
        }
    });

    it("the recipe space is unchanged by any of this", () => {
        /**
         * ⚠️ 11,520 per language since 19 Oct, up from 1,152. The owner:
         * "the contents are always with a solid coloured background with a
         * text in front" — so a WASH axis was added (flat, linear, radial,
         * duotone), three large organic motifs joined the six thin-line
         * fields, and four lighter palettes joined the six mostly-dark ones.
         *
         * 🔑 The number is pinned, not computed from the arrays, so that
         * ADDING an axis is a decision somebody makes rather than something
         * a test quietly absorbs.
         */
        expect(
          LAYOUTS.length * PALETTE_NAMES.length * TYPE_TREATMENTS.length * MOTIFS.length * WASHES.length,
        ).toBe(11520);
    });
});

/**
 * ⛔ A CHANNEL THAT SAYS IT CAN PUBLISH MUST HAVE SOMETHING THAT PUBLISHES IT.
 *
 * 🔴 THE ONE-WORD CHANGE THIS GUARDS. `canPublish` is a boolean in
 * platforms.ts, and flipping it reads like paperwork — the day LinkedIn's
 * Community Management API is approved, the obvious move is to set it true.
 * ⛔ But the publisher dispatches by name, and a channel with no branch there
 * publishes nothing. The symptom is a quiet feed with every screen green
 * ⇒ trap_a_dead_cron_fails_where_nobody_is_watching.
 *
 * ⚠️ WHY A TEST AND NOT ONLY A FALLBACK BRANCH. The route does now refuse such
 * a platform out loud rather than handing it to Facebook — which it used to do,
 * because that branch was "Facebook" by POSITION rather than by name. But a
 * refusal at 17:00 is still a missed slot. This fires at build time instead.
 */
describe("⛔ nothing claims to publish without an adapter", () => {
  /**
   * 🔴 READ OUT OF THE ROUTE, NOT LISTED HERE — and that change is the point.
   *
   * ⛔ This used to be a hand-written `Set(["facebook", "instagram"])` whose own
   * comment called adding a name "the second half of wiring it". That makes the
   * test a MIRROR of the route: wiring YouTube and *forgetting* the branch fails
   * identically to adding the name with no branch at all, and the fix for a red
   * test is then to edit the list — which is the one edit that proves nothing
   * ⇒ trap_a_mirror_test_cannot_catch_a_refactor.
   *
   * ⚠️ So the set is derived from the publisher's own source. It can still be
   * fooled by a branch that dispatches some other way, but it can no longer be
   * satisfied by editing this file, which is the failure mode that actually
   * happened on 19 Oct while wiring YouTube.
   */
  const PUBLISHER = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/cron/social-publish/route.ts"),
    "utf8",
  );

  const dispatchesTo = (id: string) =>
    new RegExp(`platform\\s*===\\s*"${id}"`).test(PUBLISHER);

  it("every publishable channel has a branch in the publisher", () => {
    for (const id of PLATFORM_IDS) {
      if (!PLATFORMS[id].canPublish) continue;
      expect(
        dispatchesTo(id),
        `${id} is marked canPublish, but social-publish never dispatches on it — ` +
          `an approved post for it would go nowhere. ▶️ Wire the adapter in the route itself; ` +
          `⛔ there is no list here to add it to.`,
      ).toBe(true);
    }
  });

  it("🔴 a channel that publishes can be handed at least one shape", () => {
    /**
     * ⛔ THE GAP THIS CLOSES, found by reading and not by any test, 19 Oct.
     * `canPublish` was flipped true for YouTube while `PUBLISHABLE.youtube`
     * was still `[]`. Both files were internally consistent and the suite was
     * entirely green — and every YouTube post would have been written,
     * approved and then held at `mediaPlan`, one layer below where the
     * "can this channel publish?" question appears to be answered
     * ⇒ trap_a_constraint_nobody_told_the_writer.
     *
     * 🔑 TWO PLACES ANSWER "CAN THIS PUBLISH?" and nothing made them agree.
     * This is what makes them agree.
     */
    for (const id of PLATFORM_IDS) {
      if (!PLATFORMS[id].canPublish) continue;
      expect(
        (PUBLISHABLE[id] ?? []).length,
        `${id} is marked canPublish, but PUBLISHABLE.${id} is empty — every post for it would be ` +
          `written, approved, and then held at mediaPlan with nobody looking there. ` +
          `▶️ List the shapes the publisher actually handles.`,
      ).toBeGreaterThan(0);
    }
  });

  /**
   * ⛔ AND THE CONVERSE IS NOT TRUE, WHICH IS WORTH WRITING DOWN.
   *
   * I first wrote a second assertion here — "a channel that cannot publish is
   * handed no shapes" — and LinkedIn failed it immediately: `canPublish` is
   * false while `PUBLISHABLE.linkedin` is `["none", "graphic"]`. That pair is
   * CORRECT. The adapter is written and tested; what is missing is Community
   * Management API access, which is Google's… LinkedIn's to grant, not ours.
   *
   * 🔑 The two fields answer different questions — "is this channel live?" and
   * "what can the code hand it?" — and a channel is normally ready before it is
   * allowed. Pinning them together would have forced a false edit to make a
   * green tick ⇒ trap_a_guard_satisfied_by_a_neighbouring_value.
   */

  it("⛔ and the derivation really looks at the route, not at a list in here", () => {
    /**
     * 🔑 THE CONTROL. A check that reads a file proves nothing until you show
     * it answering NO for something absent — otherwise a typo'd path or an
     * always-true regex passes every channel forever
     * ⇒ trap_mutation_harness_can_report_false_caught.
     */
    expect(PUBLISHER.length, "the publisher source was not actually read").toBeGreaterThan(1000);
    expect(dispatchesTo("facebook"), "a channel that IS dispatched read as absent").toBe(true);
    expect(dispatchesTo("myspace"), "a channel that does not exist read as present").toBe(false);
  });

  it("⚠️ and a channel that cannot publish says why, so the queue can explain itself", () => {
    // 🔑 `blockedBy` is read straight into the "held" line the publisher
    // writes onto the post. An empty one produces "(not enabled)", which
    // tells a reader nothing they can act on.
    for (const id of PLATFORM_IDS) {
      if (PLATFORMS[id].canPublish) continue;
      expect(PLATFORMS[id].blockedBy.trim().length, `${id} is blocked for no stated reason`).toBeGreaterThan(10);
    }
  });

  it("🔑 LinkedIn is still blocked, and on the thing that actually blocks it", () => {
    /**
     * ⚠️ The adapter exists as of 19 Oct and is fully tested — but posting as
     * an organisation needs `w_organization_social`, which belongs to the
     * Community Management API and is NOT self-serve. ⛔ Code being ready is
     * not access being granted, and this is the line that stops the two being
     * confused ⇒ feedback_verify_env_var_before_shipped_claim.
     */
    expect(PLATFORMS.linkedin.canPublish).toBe(false);
    expect(PLATFORMS.linkedin.blockedBy).toMatch(/community management/i);
  });
});
