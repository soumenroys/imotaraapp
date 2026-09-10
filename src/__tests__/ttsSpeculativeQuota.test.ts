import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { canUseSpeculativeCount } from "@/app/api/tts/route";

// /api/tts starts the anonymous daily-quota count from the `sub` claim in the
// bearer token WITHOUT verifying it, so the read can run alongside the auth
// round trip instead of after it. That took the route from 0.668s to 0.269s.
//
// It is safe only because of one rule: the speculative count is used ONLY when
// verified auth comes back with that same user id. Everything else discards it
// and re-queries.
//
// This codebase has already had an incident of exactly this shape —
// chat-reply trusted an unverified `sub` to decrement a paid token balance.
// The difference is that that code ACTED on the claim; this only lets a read
// begin. If the rule below ever weakens, that difference disappears and one
// user's quota can be read for another.

const route = fs.readFileSync(
    path.join(__dirname, "..", "app", "api", "tts", "route.ts"), "utf8");

const USER = "d1cce483-36a1-475d-8e54-0d9f346d67d0";
const OTHER = "00000000-1111-2222-3333-444444444444";

describe("the discard rule", () => {
    it("uses the speculative count when the claim matches the verified user", () => {
        expect(canUseSpeculativeCount(USER, USER, 3)).toBe(true);
        expect(canUseSpeculativeCount(USER, USER, 0)).toBe(true); // zero is a real count
    });

    it("refuses when the claimed user is not the authenticated one", () => {
        expect(canUseSpeculativeCount(OTHER, USER, 0)).toBe(false);
        expect(canUseSpeculativeCount(OTHER, USER, 99)).toBe(false);
    });

    it("refuses when there is no claim at all", () => {
        // Cookie-auth (web) requests, and anything without a bearer token.
        expect(canUseSpeculativeCount(null, USER, 0)).toBe(false);
    });

    it("refuses when the speculative query produced nothing", () => {
        // The query is .catch(() => null), so a failure must fall through to a
        // real query rather than being read as "quota zero".
        expect(canUseSpeculativeCount(USER, USER, null)).toBe(false);
    });

    it("treats a count of 0 as a value, not as absent", () => {
        // A `!speculative` style check would turn "0 used today" into a
        // re-query — harmless — but a `speculative || fallback` would turn it
        // into the fallback silently. Pin the distinction.
        expect(canUseSpeculativeCount(USER, USER, 0)).toBe(true);
        expect(canUseSpeculativeCount(USER, USER, null)).toBe(false);
    });

    it("an empty-string claim is not a match for anything", () => {
        expect(canUseSpeculativeCount("", USER, 5)).toBe(false);
        expect(canUseSpeculativeCount("", "", 5)).toBe(false);
    });
});

describe("the unverified claim never decides anything else", () => {
    it("is only ever used to start a read and to gate the discard rule", () => {
        // Every use of `claimed.` in the route. If a new one appears, this
        // fails and someone has to justify it.
        const uses = [...route.matchAll(/claimed\.[a-zA-Z]+/g)].map((m) => m[0]);
        // Only these two properties may ever be read...
        expect([...new Set(uses)].sort()).toEqual(["claimed.isAnonymous", "claimed.sub"]);
        // ...and only in these four places: the guard deciding whether to
        // speculate (sub + isAnonymous), the query itself (sub), and the
        // discard rule (sub). A fifth use means someone found a new thing to
        // do with an unverified claim, and that needs justifying, not passing.
        expect(uses).toHaveLength(4);
    });

    it("the quota decision reads the verified user, not the claim", () => {
        expect(route).toMatch(/if \(user\.is_anonymous\)/);
        expect(route).not.toMatch(/if \(claimed\.isAnonymous\)\s*\{[\s\S]{0,200}ANONYMOUS_TTS_DAILY_LIMIT/);
    });

    it("the speculative query is read-only", () => {
        const fn = route.slice(route.indexOf("async function ttsCountToday"));
        const body = fn.slice(0, fn.indexOf("\n}"));
        expect(body).toMatch(/head: true/);
        for (const write of ["insert(", "update(", "upsert(", "delete("]) {
            expect(body).not.toContain(write);
        }
    });

    it("a failed speculative query cannot be mistaken for a zero count", () => {
        expect(route).toMatch(/ttsCountToday\(claimed\.sub\)\.catch\(\(\) => null\)/);
    });

    it("carries the warning about why this shape is dangerous here", () => {
        // The next person to touch this needs the incident, not just the rule.
        expect(route).toMatch(/token[- ]drain/i);
        expect(route).toMatch(/without verifying|WITHOUT verifying/i);
    });
});

describe("the checks that must still run every request", () => {
    it("the rate limit is not speculative and is checked before serving", () => {
        expect(route).toMatch(/checkPersistentIpRateLimit\("tts", ip, RATE_LIMIT_PER_MIN, 60\)/);
        const gate = route.indexOf("if (!withinRateLimit)");
        expect(gate).toBeGreaterThan(-1);
        expect(gate).toBeLessThan(route.indexOf("if (user.is_anonymous)"));
    });

    it("auth is still verified — the claim never substitutes for getUser", () => {
        expect(route).toMatch(/anon\.auth\.getUser\(bearerToken\)/);
        expect(route).toMatch(/if \(!user\) return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\)/);
    });
});
