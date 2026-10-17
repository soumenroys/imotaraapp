/**
 * ⛔ THE SOCIAL MIGRATION MUST LOCK ITSELF DOWN, AND ITS SEED MUST NOT DRIFT.
 *
 * ⚠️ THE HONEST LIMIT OF THIS FILE, stated first because it matters: there is
 * no postgres in this environment, so none of this executes the SQL. It reads
 * it. A statement can be syntactically wrong and pass everything below.
 * ⇒ The migration still has to be run in the Supabase SQL editor and the
 * trigger behaviour confirmed there.
 *
 * 🔑 WHAT IT CAN STILL CATCH, which is the part that has actually gone wrong:
 *
 *   • A TABLE THAT FORGETS RLS. The July 2026 failure was a table the anon key
 *     could read. `social_accounts` holds platform access tokens, so the same
 *     mistake here hands out credentials rather than rows.
 *   • A SEED LIST THAT HAS DRIFTED FROM THE CANONICAL ONE. I seeded the 22
 *     languages from memory on the first pass and got two wrong — Korean, which
 *     this product does not speak, and no Hebrew, which it does. A drifted seed
 *     makes a real language permanently unselectable, because the schedule
 *     trigger rejects any code not in this table.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { CONNECT_LANGUAGES } from "@/lib/connect/languages";

const SQL_PATH = "docs/sql/social_autopost_v1.sql";
const sql = fs.readFileSync(path.join(process.cwd(), SQL_PATH), "utf8");

/** Comments stripped: this file explains itself in prose, and a guard that
 *  reads its own explanation is the mutation-proof failure already hit three
 *  times ⇒ trap_a_guard_satisfied_by_a_neighbouring_value. */
const code = sql.replace(/^\s*--.*$/gm, "");

const tables = [...code.matchAll(/create table if not exists (\w+)/g)].map((m) => m[1]);

describe("every table is locked down", () => {
    it("declares the tables this feature needs", () => {
        // ⛔ Pinned by name: a table silently dropped from the migration would
        // make every check below pass while the feature could not run.
        expect(tables.sort()).toEqual(
            [
                "social_abuse_terms",
                "social_accounts",
                "social_language_tiers",
                "social_posts",
                "social_schedules",
                "social_settings",
                "social_topics_used",
                "social_visuals_used",
            ].sort(),
        );
    });

    for (const t of tables) {
        it(`${t} has row level security enabled`, () => {
            expect(
                code,
                `${t} is readable by the anon key unless RLS is enabled — and social_accounts holds tokens`,
            ).toContain(`alter table ${t} enable row level security;`);
        });
    }

    it("creates no policy and grants nothing to anon or authenticated", () => {
        // 🔑 RLS-on-with-no-policies is default-deny. A policy added later to
        // make a client page work is precisely how the July 2026 leak happened.
        expect(code.toLowerCase()).not.toContain("create policy");
        expect(code.toLowerCase()).not.toMatch(/grant\s+[\s\S]{0,80}\bto\s+(anon|authenticated)/);
    });

    it("references no table it does not create, except the admin table", () => {
        const referenced = new Set(
            [...code.matchAll(/references\s+(\w+)\s*\(/g)].map((m) => m[1]),
        );
        const unknown = [...referenced].filter((r) => !tables.includes(r) && r !== "super_admins");
        expect(unknown, `references tables that do not exist here: ${unknown.join(", ")}`).toEqual([]);
    });
});

describe("the language seed agrees with the canonical list", () => {
    const seeded = [...code.matchAll(/\(\s*'([a-z]{2})',\s*'([A-Za-z]+)',/g)].map((m) => ({
        code: m[1],
        name: m[2],
    }));

    it("seeds exactly the 22 this product speaks, with the same names", () => {
        expect(seeded.length, "parsed no seed rows — this guard would be blind").toBe(22);
        expect([...seeded].sort((a, b) => a.code.localeCompare(b.code))).toEqual(
            [...CONNECT_LANGUAGES]
                .map((l) => ({ code: l.code, name: l.label }))
                .sort((a, b) => a.code.localeCompare(b.code)),
        );
    });

    it("seeds no language this product does not speak", () => {
        // ⚠️ "ko" was in my first draft. Korean is not one of the 22.
        const canonical = new Set(CONNECT_LANGUAGES.map((l) => l.code));
        const extra = seeded.filter((r) => !canonical.has(r.code)).map((r) => r.code);
        expect(extra, `seeds languages that are not supported: ${extra.join(", ")}`).toEqual([]);
    });
});

describe("the two conditions on unattended posting stay separate", () => {
    it("the schedule trigger checks reviewed AND abuse_list_ready", () => {
        // 🔴 If these are ever collapsed into one flag, the owner's instruction
        // that posts carry no abusive words becomes unverifiable in exactly the
        // languages where nobody would notice.
        const guard = /social_schedule_language_guard[\s\S]*?\$\$;/.exec(code)?.[0] ?? "";
        expect(guard).toContain("not t.reviewed");
        expect(guard).toContain("not t.abuse_list_ready");
    });

    it("only English is seeded as having a list, and only English has it in code", () => {
        const en = /\('en',\s*'English',\s*(true|false),\s*(true|false),\s*(true|false)\)/.exec(code);
        expect(en, "the English seed row changed shape").toBeTruthy();
        expect(en?.slice(1)).toEqual(["true", "true", "true"]);

        // Every other row: reviewed may vary, but the two list flags are false.
        const others = [...code.matchAll(/\('(?!en')([a-z]{2})',\s*'[A-Za-z]+',\s*(?:true|false),\s*(true|false),\s*(true|false)\)/g)];
        expect(others.length).toBe(21);
        for (const row of others) {
            expect(
                [row[2], row[3]],
                `${row[1]} is seeded as having an abuse list, and no such list exists`,
            ).toEqual(["false", "false"]);
        }
    });

    it("abuse_list_ready is derived, not set by hand", () => {
        // A flag that an API route has to remember to maintain is a flag that
        // goes stale — and this one gates unattended publishing.
        expect(code).toContain("social_recompute_abuse_ready");
        expect(code).toContain("t.abuse_list_builtin");
    });

    it("demoting a language turns off the schedules already using it", () => {
        const guard = /social_language_demotion_guard\(\)[\s\S]*?\$\$;/.exec(code)?.[0] ?? "";
        expect(guard, "no demotion guard — a withdrawn language keeps posting unattended").toBeTruthy();
        expect(guard).toContain("set auto_publish = false");
        expect(guard).toContain("= any (languages)");
        // ⛔ It must not refuse the demotion: then withdrawing a language would
        // be the hard path, and in a hurry somebody skips the safe act.
        expect(guard.toLowerCase()).not.toContain("raise exception");
    });
});

describe("the invariants that are not about languages", () => {
    it("🔴 uses cardinality, never array_length, to test for an empty array", () => {
        /**
         * 🔴 THIS GUARD REPLACED ONE THAT PASSED WHILE THE CONSTRAINT WAS
         * INERT, and the difference is the whole lesson.
         *
         * The old assertion checked that the text
         * `check (array_length(languages, 1) >= 1)` was present. It was. It
         * also did nothing:
         *
         *     array_length('{}', 1)  →  NULL
         *     NULL >= 1              →  NULL
         *     CHECK rejects only FALSE, so NULL passes.
         *
         * ⇒ A schedule with NO LANGUAGE was accepted by the live database —
         * found by inserting one, not by reading anything.
         * ⇒ trap_a_guard_satisfied_by_a_neighbouring_value: the guard was
         * satisfied by the presence of the words rather than by the behaviour.
         *
         * ⛔ So this asserts the FUNCTION, which is the part that decides.
         */
        const emptyChecks = [...code.matchAll(/check\s*\(\s*array_length\s*\(/gi)];
        expect(
            emptyChecks.map((m) => code.slice(m.index, m.index + 70)),
            "array_length returns NULL for an empty array, so this check can never fail. Use cardinality().",
        ).toEqual([]);
    });

    it("a schedule cannot exist with no language, no platform or no day", () => {
        for (const col of ["languages", "platforms", "days"]) {
            expect(
                code,
                `${col} may be empty — nothing stops it`,
            ).toMatch(new RegExp(`check \\(cardinality\\(${col}\\) >= 1\\)`));
        }
    });

    it("the repair runs before the constraint is added, so re-running fixes a live table", () => {
        // ⚠️ The original constraints were created inline with auto-generated
        // names. Without the drops, re-running this file would leave the inert
        // ones in place and the fix would never reach the database it was
        // written for.
        const dropAt = code.indexOf("drop constraint if exists social_schedules_languages_check");
        const addAt = code.indexOf("add constraint social_schedules_languages_not_empty");
        expect(dropAt).toBeGreaterThan(-1);
        expect(addAt).toBeGreaterThan(dropAt);
    });

    it("every post is attributable to a schedule or to a person", () => {
        /**
         * ⛔ Nothing publishes anonymously: every published word has a name
         * against it, generated or written.
         *
         * ⚠️ Asserting the CONDITION, not just the constraint name. A
         * mutation run renamed the constraint to
         * `social_posts_origin_provenance_disabled` and replaced its body with
         * `check (true)` — and a `toContain` on the name still matched, because
         * the old name is a prefix of the new one. The name was never the
         * invariant.
         */
        const constraint = /constraint social_posts_origin_provenance check \(([\s\S]*?)\)\s*\n\);/.exec(code);
        expect(constraint, "the provenance constraint is gone or was renamed").toBeTruthy();
        const body = constraint?.[1] ?? "";
        expect(body).toContain("origin = 'generated' and schedule_id is not null");
        expect(body).toContain("origin = 'written'   and author_id   is not null");
        expect(body.trim(), "the constraint body was replaced with something that always passes")
            .not.toMatch(/^true$/i);
    });

    it("the subject and visual registers are uniquely indexed", () => {
        // 🔑 The register IS the uniqueness guarantee. Without the unique index
        // it is a log that happens to be checked by code that could be wrong.
        expect(code).toMatch(/create unique index[\s\S]{0,80}social_topics_used\s*\(subject_hash\)/);
        expect(code).toMatch(/create unique index[\s\S]{0,80}social_visuals_used\s*\(recipe_hash\)/);
    });

    it("declares every variable its triggers use", () => {
        for (const fn of code.matchAll(/declare([\s\S]*?)begin([\s\S]*?)\$\$;/g)) {
            const declared = [...fn[1].matchAll(/^\s*(\w+)\s+/gm)].map((m) => m[1]);
            for (const used of fn[2].matchAll(/into\s+(\w+)/g)) {
                expect(declared, `${used[1]} is selected into but never declared`).toContain(used[1]);
            }
        }
    });
});
