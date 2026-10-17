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
