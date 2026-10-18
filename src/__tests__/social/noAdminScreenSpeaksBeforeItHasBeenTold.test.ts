/**
 * ⛔ NO SOCIAL ADMIN SCREEN MAY STATE THE SYSTEM'S CONDITION BEFORE IT HAS BEEN
 * TOLD THE SYSTEM'S CONDITION.
 *
 * 🔴 THE DEFECT THIS PINS, seen live on 18 Oct 2026. All three screens handled
 * a 401 by setting an error string and returning — and then rendered the rest
 * of the page from their REACT DEFAULTS as though it were loaded data. The
 * channels screen read:
 *
 *     Not signed in. Log in at /admin first.
 *     The master switch — Everything is held. Posts are still written and queued.
 *     Connected — No channel is connected, and none can be yet.
 *
 * Two of those three sentences are claims about production. Neither had been
 * fetched. The "everything is held" line came from `useState(true)`.
 *
 * 🔑 WHY IT MATTERS MORE HERE THAN ON MOST PAGES. "Everything is held" is
 * exactly what somebody checking in a hurry wants to be true, and it is the
 * sentence they would act on — closing the laptop believing posting is stopped
 * when the page never knew either way. A blank space would have been safer
 * than a reassuring default ⇒ ux_degradation_audit_2026_10_09.
 *
 * ⚠️ And the confusion that produced the screenshot is real: being signed in to
 * Imotara does not sign you in here. The admin panel has its own
 * `super_admins` session, so the top bar can show an address while the page
 * has no session at all. The replacement panel says that, instead of telling
 * somebody who is plainly signed in that they are not.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SCREENS = [
    "src/app/admin/social/page.tsx",
    "src/app/admin/social/compose/page.tsx",
    "src/app/admin/social/channels/page.tsx",
];

const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("every social admin screen knows whether it has a session", () => {
    for (const screen of SCREENS) {
        const src = read(screen);

        it(`${screen} starts not knowing, rather than assuming`, () => {
            // ⛔ `useState(true)` or `useState(false)` would both be an answer
            // the page has not earned. null is the only honest start.
            expect(src, "no auth state at all").toMatch(/const \[authed, setAuthed\] = useState<boolean \| null>\(null\)/);
        });

        it(`${screen} records the answer on both paths`, () => {
            expect(src, "a 401 does not set the auth state").toMatch(/setAuthed\(false\)/);
            expect(src, "a success does not set the auth state").toMatch(/setAuthed\(true\)/);
        });

        it(`${screen} shows the sign-in panel and hides the body`, () => {
            expect(src, "no signed-out panel").toMatch(/authed === false && <SignedOut/);
            /**
             * ⛔ `=== true`, not `!== false`. While the check is in flight
             * `authed` is null — and `!== false` is TRUE for null, so the body
             * rendered during loading with the master switch reading
             * "Everything is held" and every counter reading 0. Brief on a fast
             * connection; not brief on a slow one, and the same untrue claim
             * either way. Caught by screenshotting the page a moment too early.
             */
            expect(src, "the body renders before the session is known").toMatch(/authed === true && \(/);
            expect(src, "no loading state").toMatch(/authed === null &&/);
        });

        it(`${screen} no longer tells a signed-in person they are not signed in`, () => {
            /**
             * ⚠️ The old copy was literally wrong on the screen where it
             * appeared: the user WAS signed in — to the product. Saying it
             * again, in those words, is what sent them looking for a bug.
             */
            expect(src).not.toContain("Not signed in. Log in at /admin first.");
        });
    }

    it("the panel explains that admin sign-in is a separate one, and links to it", () => {
        const panel = read("src/app/admin/social/_components/SignedOut.tsx");
        expect(panel).toMatch(/href="\/admin"/);
        expect(panel.toLowerCase()).toMatch(/separate/);
        // ⛔ And says why nothing is shown, rather than leaving a blank page
        // that looks broken.
        expect(panel).toMatch(/nothing true to say/i);
    });
});

describe("the feature is reachable and usable at all", () => {
    /**
     * 🔴 BOTH OF THESE SHIPPED BROKEN AND BOTH WERE FOUND BY OPENING THE PAGE.
     *
     *   • Nothing in the admin tab bar pointed at /admin/social, so the only
     *     way in was typing the URL. A screen nobody can find is a feature
     *     nobody has.
     *   • The overview said "No schedules yet" next to NO BUTTON. The POST
     *     route existed, the cron existed, the queue existed — and there was
     *     no way to create the one thing all of them operate on.
     *
     * ⚠️ Neither is visible from a unit test, a type check or a build. Both
     * are the kind of gap only using the thing reveals.
     */
    it("the admin nav links to social posting", () => {
        // \u26a0\ufe0f The nav moved out of admin/page.tsx into the shared panel
        // furniture on 18 Oct, when Activity, Crisis and Social stopped being
        // three odd chips hanging off the end of the tab bar. The question is
        // unchanged: can somebody who does not know the URL get here?
        const nav = read("src/app/admin/_components/ui.tsx");
        expect(nav, "nothing in the admin nav points at /admin/social").toMatch(
            /href: "\/admin\/social"/,
        );
    });

    it("a schedule can be created", () => {
        // ⚠️ Moved off the overview on 18 Oct: "what needs me today" and "what
        // should happen every week" are not the same visit.
        const page = read("src/app/admin/social/schedules/page.tsx");
        expect(page, "no way to create a schedule").toMatch(/<NewSchedule/);
        expect(page).toMatch(/New schedule/);
    });

    it("the schedule form asks for everything the database will not default", () => {
        // ⛔ Each of these is a field the schema refuses to guess: no language,
        // no platform and no day are all rejected by a constraint, and the
        // brief is what every post on the schedule is written from.
        const form = read("src/app/admin/social/_components/NewSchedule.tsx");
        for (const needed of ["languages", "platforms", "days", "brief", "postAt", "contentType"]) {
            expect(form, `the form never sends ${needed}`).toContain(needed);
        }
    });

    it("auto-publish is disabled in the form for a non-owner", () => {
        const form = read("src/app/admin/social/_components/NewSchedule.tsx");
        expect(form).toMatch(/disabled=\{!isOwner\}/);
        // ⚠️ And the route checks again — the disabled input is only a hint.
        const route = read("src/app/api/admin/social/schedules/route.ts");
        expect(route).toMatch(/requireSocialOwner/);
    });
});

describe("the screens do not contradict themselves", () => {
    it("⛔ approving does not promise a publication that cannot happen", () => {
        /**
         * 🔴 SEEN LIVE. Every screen carries a banner reading "Phase 1: nothing
         * publishes yet" — and approving a post answered "Approved. It will
         * publish at its slot", three lines below it.
         *
         * ⚠️ Two sentences on one screen that cannot both be true is how a
         * person learns to stop reading either of them. On this feature the
         * banner is the one that matters, so the other had to change.
         */
        /**
         * ⚠️ COMMENTS STRIPPED FIRST. The fix explains itself in prose that
         * quotes the old sentence, and the first version of this guard failed
         * on its own explanation — the same shape as the `inset` check and the
         * third time this exact mistake has been made here
         * ⇒ trap_a_guard_satisfied_by_a_neighbouring_value.
         */
        const route = read("src/app/api/admin/social/posts/[id]/route.ts")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/^\s*\/\/.*$/gm, "");
        expect(route).not.toMatch(/will publish at its slot/i);

        /**
         * 🔴 THE FIX FOR THAT CONTRADICTION BECAME THE NEXT ONE. This used to
         * require the literal "Nothing publishes yet" — correct on 17 Oct,
         * and FALSE on 18 Oct the moment Facebook could publish. Eight places
         * carried that sentence and every one of them was then a confident
         * lie, including the banner this very test was protecting.
         *
         * ⛔ So the assertion is no longer on the WORDS. It is that the note
         * is DERIVED from what is actually built ⇒ publishingSentence — the
         * only version of this that cannot go stale.
         */
        expect(route, "the approval note is hard-coded again, so it will go stale again").toMatch(
            /publishingSentence\(\)/,
        );
        expect(route).not.toMatch(/Nothing publishes yet/i);
    });
});

describe("the screens stay readable", () => {
    /**
     * 🔴 WHAT THIS PINS, from the owner on 18 Oct: "its difficult for admin to
     * understand the all functionalities."
     *
     * They were right, and the measurement is blunt but real. The channels
     * screen had grown to roughly 1,800 words on one scroll — and ~750 of them
     * were THE SAME 40-WORD PARAGRAPH REPEATED NINETEEN TIMES, once per
     * language nobody here reads.
     *
     * ⚠️ The paragraph was true. Printing it nineteen times is what made it
     * unreadable: an explanation that cannot be skipped buries the one line
     * that changes what somebody does today.
     *
     * ⇒ Nothing was deleted. The reasoning moved into <Explain>, which folds it
     * behind a question, or into the code comments where the next editor reads.
     */
    const SCREENS = [
        "src/app/admin/social/page.tsx",
        "src/app/admin/social/schedules/page.tsx",
        "src/app/admin/social/channels/page.tsx",
        "src/app/admin/social/languages/page.tsx",
        "src/app/admin/social/compose/page.tsx",
    ];

    /** Visible copy only: JSX text and string literals that reach the screen,
     *  with code comments stripped — a comment is not something a user reads. */
    const visibleWords = (src: string) => {
        const noComments = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
        const text = noComments
            .replace(/import[\s\S]*?from\s+"[^"]+";/g, "")
            .replace(/className="[^"]*"/g, "")
            .replace(/<[^>]+>/g, " ");
        return text.split(/\s+/).filter((w) => /[a-z]{3,}/i.test(w)).length;
    };

    for (const screen of SCREENS) {
        it(`${screen} does not bury the reader`, () => {
            // ⚠️ A ceiling, not a target. It exists so that the next long
            // explanation goes into <Explain> rather than onto the page.
            expect(visibleWords(read(screen)), `${screen} is a wall of text again`).toBeLessThan(900);
        });

    }

    it("⛔ the per-language reason is not printed on every row", () => {
        /**
         * 🔴 THE EXACT DEFECT THAT PROMPTED THIS, pinned precisely rather than
         * by a heuristic. The languages list rendered `r.reason` as visible
         * text inside its `.map()`, so the same 40-word paragraph appeared
         * nineteen times — ~750 words of identical prose on one scroll.
         *
         * ⇒ It is now a `title` on the chip: available on hover, present for a
         * screen reader, and not shouted nineteen times at somebody scanning.
         * The shared explanation above the table says it once.
         *
         * ⚠️ My first attempt at this guard was a heuristic that flagged any
         * long string inside any `.map()`, and it fired on the Today page —
         * where the long text only renders for the ONE row that is expanded.
         * A guard that cannot tell those apart teaches people to ignore it.
         */
        const src = read("src/app/admin/social/languages/page.tsx");
        expect(src, "the reason is rendered as a text node per row").not.toMatch(/\{r\.reason\}/);
        expect(src, "the reason is not available at all").toMatch(/title=\{r\.reason/);
    });

    it("every screen carries the same navigation", () => {
        // Three screens that linked to each other from different corners gave
        // no way to tell what the section even contained.
        for (const screen of SCREENS) {
            expect(read(screen), `${screen} is not on the shared shell`).toMatch(/<SocialPage/);
        }
    });

    it("statuses are shown in words a person uses", () => {
        /**
         * ⛔ "needs_review", "rejected_by_gate" and "pending" are precise and
         * they are not English. Nobody should have to learn a private dialect
         * to use an admin screen.
         */
        const ui = read("src/app/admin/social/_components/ui.tsx");
        for (const [raw, plain] of [
            ["needs_review", "Waiting for you"],
            ["rejected_by_gate", "Blocked"],
            ["approved", "Ready to go"],
            ["published", "Posted"],
        ]) {
            expect(ui, `${raw} has no plain label`).toContain(plain);
        }
        // And each one says what it means, not just what it is called.
        expect(ui).toMatch(/means:/);
    });
});

describe("every screen tells you what to do on it", () => {
    /**
     * 🔑 THE OWNER, 18 Oct: "i am facing difficulty to understand this social
     * media scheduler part." Two different gaps sat behind that, and they need
     * two different answers:
     *
     *   • "What IS this?" — the concept. <HowItWorks>, once, on Today.
     *   • "What do I DO here?" — the sequence. <PageTutorial>, on each screen.
     *
     * ⚠️ A tool that needs a person to hold five screens in their head before
     * the first useful action is a tool nobody starts.
     */
    const PAGES: [string, string][] = [
        ["src/app/admin/social/page.tsx", "today"],
        ["src/app/admin/social/schedules/page.tsx", "schedules"],
        ["src/app/admin/social/compose/page.tsx", "compose"],
        ["src/app/admin/social/channels/page.tsx", "channels"],
        ["src/app/admin/social/languages/page.tsx", "languages"],
    ];

    for (const [page, key] of PAGES) {
        it(`${key} carries its own steps`, () => {
            const src = read(page);
            expect(src, `${key} has no tutorial`).toMatch(/<PageTutorial/);
            expect(src, `${key} does not pass its own steps`).toContain(`TUTORIALS.${key}`);
        });
    }

    it("every screen's steps exist and are real instructions", () => {
        // \u26a0\ufe0f The panel moved to the shared admin components when the rest
        // of the panel needed one too; social keeps only its steps.
        const src = read("src/app/admin/social/_components/PageTutorial.tsx");
        for (const [, key] of PAGES) {
            expect(src, `no steps defined for ${key}`).toMatch(new RegExp(`\\b${key}:\\s*\\{`));
        }
        const steps = [...src.matchAll(/do:\s*"([^"]+)"/g)].map((m) => m[1]);
        expect(steps.length, "barely any steps at all").toBeGreaterThanOrEqual(20);
        for (const s of steps) {
            /**
             * ⚠️ MY FIRST VERSION OF THIS DEMANDED MORE THAN FOUR WORDS, and it
             * failed on `Press "New schedule".` — which is three words and a
             * perfectly good instruction. Length is not the thing being
             * guarded; a bare NOUN is ("Schedules", "Languages"), because that
             * is a heading pretending to be a step.
             */
            expect(s.split(/\s+/).length, `"${s}" is a label, not an instruction`).toBeGreaterThan(2);
            expect(s, `"${s}" is not phrased as something to do`).toMatch(/[a-z]/);
        }
    });

    it("⛔ the tutorial survives storage being unavailable", () => {
        /**
         * A private window, cleared site data, or a browser that throws on
         * access. ⚠️ The failure mode must be "the tutorial shows again",
         * never a screen that does not render.
         */
        const src = read("src/app/admin/_components/PageTutorial.tsx");
        const reads = (src.match(/localStorage/g) ?? []).length;
        const catches = (src.match(/catch\s*\{/g) ?? []).length;
        expect(reads).toBeGreaterThan(0);
        expect(catches, "localStorage is touched outside a try/catch").toBeGreaterThanOrEqual(2);
    });

    it("the admin guide and the knowledge base describe it too", () => {
        // ⇒ tutorial_sync_rule: the tutorial and the KB move with the feature.
        expect(read("src/app/admin/guide/page.tsx"), "no Social section in the admin guide").toMatch(
            /SocialSection/,
        );
        const index = read("ImotaraKnowledgebase/00-START-HERE-Index.md");
        expect(index, "the KB index does not list it").toMatch(/Social Posting Scheduler/);
        const doc = read("ImotaraKnowledgebase/Social-Posting-Scheduler.md");
        expect(doc.length, "the KB doc is a stub").toBeGreaterThan(4000);
        // ⛔ And it must say the one thing that is most misunderstood.
        expect(doc).toMatch(/does not publish yet/i);
    });

    it("⛔ it is NOT in the end-user help", () => {
        /**
         * `src/content/help/*.md` is compiled into helpKb.json and answered by
         * the help chat. An answer describing an admin tool to somebody who
         * cannot reach it is worse than no answer.
         */
        const dir = path.join(ROOT, "src/content/help");
        for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
            const body = fs.readFileSync(path.join(dir, file), "utf8").toLowerCase();
            expect(body, `${file} mentions the admin-only scheduler`).not.toContain("/admin/social");
        }
    });
});
