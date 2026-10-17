/**
 * Every job declared in vercel.json must answer the request Vercel actually makes.
 *
 * 🔴 FOUND 2026-10-13, and it had been true for MONTHS. **TWO of seven crons
 * were dead**, each for a different reason, each silently:
 *
 *   /api/push/cron        — exported POST. Vercel Cron issues a **GET**, so every
 *                           scheduled run answered **405** from 2026-04-03. The
 *                           daily push notification never fired once. Declared in
 *                           vercel.json and written as POST in the SAME commit.
 *   /api/cron/exchange-rates — exported GET correctly, but checked only
 *                           `x-cron-secret` / `?secret=`. Vercel sends
 *                           `Authorization: Bearer ${CRON_SECRET}`, so every run
 *                           answered **401**. app_settings.exchange_rates still
 *                           held the SEED PLACEHOLDER, byte-for-byte, from the day
 *                           the schema was applied — not stale data, NO data, while
 *                           international prices were converted at hardcoded guesses.
 *
 * 🔑 WHY ~3,800 GREEN TESTS MISSED BOTH. Every one of them exercised the cron
 * logic as FUNCTIONS — buildNudge, isDueNow, isSuppressed — and not one asked
 * which HTTP verb the handler answers or which credential it accepts. The unit
 * was perfect and the wire was never connected. A scheduled job fails with
 * nobody watching: there is no user to complain, and a 405 looks like silence.
 *
 * ⚠️ docs/ARCHITECTURE.md documented /api/push/cron as GET all along. The docs
 * were right and the code was wrong, which is the opposite of the usual drift.
 *
 * ⛔ This file deliberately reads vercel.json rather than a hand-kept list, so a
 * cron added later is covered the day it is added, with no one remembering to.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

type VercelConfig = { crons?: Array<{ path: string; schedule: string }> };

const ROOT = process.cwd();
const config: VercelConfig = JSON.parse(
    fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"),
);
const CRONS = config.crons ?? [];

/** "/api/push/cron" -> "src/app/api/push/cron/route.ts" */
const routeFileFor = (cronPath: string) =>
    path.join(ROOT, "src", "app", cronPath.replace(/^\//, ""), "route.ts");

const sourceFor = (cronPath: string) => fs.readFileSync(routeFileFor(cronPath), "utf8");

/**
 * The route's own source, plus the source of any `@/`-imported module it pulls
 * in — one level deep, no further.
 *
 * ⚠️ ADDED 2026-10-17, when /api/cron/social-queue moved its credential check
 * into a shared `cronAuthorised()` helper and this guard failed. The guard was
 * right about the property and wrong about where to look: nine copies of the
 * same header comparison is worse than one, and the original bug was a route
 * checking the WRONG header, not a route checking it somewhere else.
 *
 * ⛔ IT IS STRICTER, NOT LOOSER, in the way that matters: the header read and
 * `CRON_SECRET` must appear in the SAME file, so a route cannot pass by
 * importing one module that mentions the header and another that mentions the
 * secret. Exactly one file has to do the whole check.
 */
const authoritiesFor = (cronPath: string): { file: string; src: string }[] => {
    const routeFile = routeFileFor(cronPath);
    const src = sourceFor(cronPath);
    const out = [{ file: routeFile, src }];

    for (const m of src.matchAll(/from\s+["']@\/([^"']+)["']/g)) {
        for (const ext of [".ts", ".tsx"]) {
            const candidate = path.join(ROOT, "src", m[1] + ext);
            if (fs.existsSync(candidate)) {
                out.push({ file: candidate, src: fs.readFileSync(candidate, "utf8") });
                break;
            }
        }
    }
    return out;
};

describe("🔴 every cron in vercel.json is actually reachable", () => {
    it("vercel.json really declares crons — otherwise this whole file is vacuous", () => {
        // ⛔ Without this, deleting the crons array would make every test below
        // pass by iterating nothing. The guard must fail loudly, not quietly.
        expect(CRONS.length).toBeGreaterThanOrEqual(7);
    });

    it.each(CRONS.map((c) => [c.path] as const))("%s has a route file", (cronPath) => {
        expect(fs.existsSync(routeFileFor(cronPath))).toBe(true);
    });

    it.each(CRONS.map((c) => [c.path] as const))(
        "🔴 %s exports GET — the verb Vercel Cron sends",
        (cronPath) => {
            // THE push/cron BUG. It exported only POST ⇒ 405 on every run.
            const src = sourceFor(cronPath);
            expect(src).toMatch(/export\s+(async\s+)?function\s+GET\s*\(/);
        },
    );

    it.each(CRONS.map((c) => [c.path] as const))(
        "🔴 %s accepts the Authorization: Bearer credential Vercel sends",
        (cronPath) => {
            // THE exchange-rates BUG. It only honoured a custom header that
            // Vercel never sends ⇒ 401 on every run. Per Vercel's own docs the
            // scheme is `authHeader !== \`Bearer ${process.env.CRON_SECRET}\``.
            //
            // ⛔ BOTH halves must be in ONE file — the route itself or a single
            // helper it imports. A route that read the header in one place and
            // named the secret in another would satisfy two loose assertions
            // while checking nothing.
            const whole = authoritiesFor(cronPath).filter(
                (a) =>
                    /headers\.get\(\s*["']authorization["']\s*\)/i.test(a.src) &&
                    /CRON_SECRET/.test(a.src),
            );
            expect(
                whole.length,
                `${cronPath}: neither the route nor anything it imports both reads the ` +
                    `Authorization header and names CRON_SECRET. Vercel Cron sends ` +
                    `\`Authorization: Bearer $CRON_SECRET\` and nothing else.`,
            ).toBeGreaterThan(0);
        },
    );

    it("⛔ a cron must refuse when CRON_SECRET is unset, not fall open", () => {
        /**
         * 🔑 THE FAILURE MODE THE ORIGINAL BUG HID. Both dead crons answered
         * 401 and 405 — loud, in the sense that nothing happened. The quiet
         * version is worse: a route that treats a MISSING secret as "no auth
         * required" is an open endpoint on the public internet, and it works,
         * so nobody ever looks at it.
         *
         * ⚠️ Asserted as a property of the sources rather than by invoking the
         * handlers, which would need a request object and a database.
         */
        /**
         * ⚠️ MY FIRST VERSION OF THIS CHECK WAS WRONG and reported all eight
         * existing crons as falling open. It looked for `!secret`, while the
         * routes hold the value in a module constant and write
         * `if (!CRON_SECRET || authHeader !== ...)`. The routes were right.
         * ⇒ So the identifier is resolved from the assignment rather than
         * guessed, which is the difference between a guard and a nuisance.
         */
        const fallsOpen = CRONS.map((c) => c.path).filter((p) => {
            const src = authoritiesFor(p)
                .map((a) => a.src)
                .join("\n");

            // Whatever the secret was read into — `const CRON_SECRET = …`,
            // `const secret = …` — plus the direct form.
            const names = new Set<string>(["process.env.CRON_SECRET"]);
            for (const m of src.matchAll(
                /(?:const|let|var)\s+(\w+)\s*(?::[^=]+)?=\s*process\.env\.CRON_SECRET/g,
            )) {
                names.add(m[1]);
            }

            const refusesWhenMissing = [...names].some((n) => {
                const id = n.replace(/[.]/g, "\\.");
                return (
                    new RegExp(`!\\s*${id}\\b`).test(src) ||
                    new RegExp(`${id}\\s*(===|==)\\s*(undefined|null|["']{2})`).test(src) ||
                    new RegExp(`${id}\\s*\\?\\?`).test(src)
                );
            });
            return !refusesWhenMissing;
        });
        expect(
            fallsOpen,
            `these crons do not visibly refuse when CRON_SECRET is unset: ${fallsOpen.join(", ")}`,
        ).toEqual([]);
    });

    it("⛔ and no cron is left exported as POST-only", () => {
        // Stated as a whole-set assertion so the COUNT is pinned too: a future
        // cron that regresses to POST shows up here even if someone loosens the
        // per-path test above.
        const postOnly = CRONS.map((c) => c.path).filter((p) => {
            const src = sourceFor(p);
            const hasGet = /export\s+(async\s+)?function\s+GET\s*\(/.test(src);
            const hasPost = /export\s+(async\s+)?function\s+POST\s*\(/.test(src);
            return hasPost && !hasGet;
        });
        expect(postOnly).toEqual([]);
    });
});
