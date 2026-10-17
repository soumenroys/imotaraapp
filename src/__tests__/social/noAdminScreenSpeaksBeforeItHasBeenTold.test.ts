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
    it("the admin tab bar links to social posting", () => {
        const adminPage = read("src/app/admin/page.tsx");
        expect(adminPage, "nothing in the admin nav points at /admin/social").toMatch(
            /href="\/admin\/social"/,
        );
    });

    it("a schedule can be created from the overview", () => {
        const overview = read("src/app/admin/social/page.tsx");
        expect(overview, "no way to create a schedule").toMatch(/<NewSchedule/);
        expect(overview).toMatch(/New schedule/);
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
        expect(route, "the approval note no longer says what actually happens").toMatch(
            /Nothing publishes yet/i,
        );
    });
});
