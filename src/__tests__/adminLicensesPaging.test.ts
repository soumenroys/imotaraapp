// The admin licenses screen showed only the 20 most-recently-updated users and
// had no way to reach anyone older — the UI hardcoded limit=20 and never sent
// page. Measured against the real database on 2026-09-10: 255 users existed,
// so the screen was showing 7.8% of them.
//
// It is worse than a paging gap. The query reads auth.users, and the mobile app
// signs people in anonymously by default, so every guest occupies a row. 179 of
// those 255 — 70% — had no email and could not be licensed at all. Guests
// accumulate forever, so without a filter the window fills with rows nobody can
// act on and real users become permanently unreachable.
//
// Two things therefore have to hold, and they are easy to get wrong in opposite
// directions:
//   * the guest filter must run IN the query, never on the returned page
//   * the code must survive being deployed before the SQL migration is run

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const route = fs.readFileSync(
    path.join(__dirname, "..", "app", "api", "admin", "licenses", "route.ts"), "utf8");
const ui = fs.readFileSync(
    path.join(__dirname, "..", "app", "admin", "page.tsx"), "utf8");
const sql = fs.readFileSync(
    path.join(__dirname, "..", "..", "docs", "sql", "admin_v4_licenses_pagination.sql"), "utf8");

describe("every user is reachable", () => {
    it("the UI sends a page number, not just a limit", () => {
        expect(ui).toMatch(/params\.set\("search", q\)/);
        expect(ui).toMatch(/page: String\(p\)/);
    });

    it("the route reads page and clamps limit to what the RPC allows", () => {
        expect(route).toMatch(/Math\.max\(0, rawPage\)/);
        expect(route).toMatch(/Math\.min\(50, Math\.max\(1, rawLimit\)\)/);
        expect(route).toMatch(/page_offset:\s+page \* limit/);
    });

    it("a non-numeric page or limit falls back rather than producing NaN", () => {
        // parseInt("abc") is NaN; NaN * 20 is NaN, and offset: NaN would throw
        // at the database rather than showing page 0.
        expect(route).toMatch(/Number\.isFinite\(rawPage\)/);
        expect(route).toMatch(/Number\.isFinite\(rawLimit\)/);
    });

    it("changing the search or the filter returns you to the first page", () => {
        // Narrowing a search while on page 4 would otherwise land on an empty
        // screen that reads as "no results".
        expect(ui).toMatch(/useEffect\(\(\) => \{ setPage\(0\); \}, \[search, hideGuests, licTab\]\)/);
    });
});

describe("guests are filtered in the query, not after it", () => {
    it("the route forwards the flag to the RPC", () => {
        expect(route).toMatch(/exclude_anonymous: excludeAnonymous/);
        expect(route).toMatch(/excludeAnonymous = req\.nextUrl\.searchParams\.get\("excludeAnonymous"\) === "1"/);
    });

    it("nothing filters the returned rows after the query", () => {
        // Filtering the page would return fewer than `limit` rows AND still
        // skip the people it excluded — the bug this replaces.
        //
        // Asserted as "no .filter() anywhere in the route", not as a match on
        // one spelling: an earlier version looked for `users.filter(` and a
        // mutation written as `(data ?? []).filter(` sailed straight past it.
        expect(route).not.toMatch(/\.filter\(/);
        expect(ui).not.toMatch(/users\.filter\(/);
    });

    it("the SQL filters on is_anonymous, not on a null email", () => {
        // A real user with no email must not be misfiled as a guest.
        expect(sql).toMatch(/not exclude_anonymous or not coalesce\(u\.is_anonymous, false\)/);
        // `search_email is null` is the search filter and is fine; what must
        // not appear is the USER's email being used to infer anonymity.
        expect(sql).not.toMatch(/u\.email\s+is\s+null/i);
    });

    it("the SQL keeps the old three-argument call working", () => {
        expect(sql).toMatch(/exclude_anonymous boolean default false/);
        expect(sql).toMatch(/search_email\s+text\s+default null/);
        expect(sql).toMatch(/page_offset\s+integer default 0/);
        expect(sql).toMatch(/page_limit\s+integer default 20/);
    });

    it("the SQL still restricts execution to service_role", () => {
        expect(sql).toMatch(/revoke execute on function admin_search_users_with_licenses from public, anon, authenticated;/);
        expect(sql).toMatch(/grant\s+execute on function admin_search_users_with_licenses to service_role;/);
    });
});

describe("deploying before the migration must not break the screen", () => {
    it("the route retries with the old signature when the RPC is missing", () => {
        expect(route).toMatch(/Could not find the function\|PGRST202\|does not exist/);
        const retry = route.slice(route.indexOf("filterUnavailable = true"));
        expect(retry).toMatch(/supabase\.rpc\("admin_search_users_with_licenses", \{[\s\S]*?page_limit:\s+limit,\s*\n\s*\}\)/);
        // and the retry must NOT carry the argument that caused the failure
        const retryArgs = retry.slice(0, retry.indexOf("}));"));
        expect(retryArgs).not.toContain("exclude_anonymous");
    });

    it("it tells the UI the filter was not applied, rather than lying", () => {
        expect(route).toMatch(/filterUnavailable/);
        expect(ui).toMatch(/Guest filter needs the admin_v4 migration/);
    });

    it("paging still works on the fallback, where there is no total", () => {
        // total_count arrives with the migration. Until then Next is driven by
        // "did this page come back full?".
        expect(ui).toMatch(/users\.length < PAGE_SIZE/);
        expect(ui).toMatch(/\$\{users\.length\} on this page/);
    });

    it("the route reports total only when the RPC actually returned one", () => {
        expect(route).toMatch(/typeof users\[0\]\?\.total_count === "number"/);
    });
});
