/**
 * Coarse usage geography must stay coarse, and must never sit in front of a
 * reply.
 *
 * 🔑 WHY THESE ASSERTIONS. The feature answers one question — *where is
 * Imotara being used, including on phones, which GA cannot see* — and the
 * entire reason it is safe is what it refuses to collect. Vercel sends
 * `x-vercel-ip-latitude`, `x-vercel-ip-longitude` and `x-vercel-ip-city` on
 * the SAME request, free, one line away. ⛔ The realistic way this becomes a
 * privacy incident is not a breach; it is someone adding "just the city"
 * eighteen months from now because it would make a nicer dashboard. These
 * tests are the thing standing in the way of that.
 *
 * ⚠️ A city, plus a mental-health session, plus a date is identifying in a
 * small town. That is the judgement being defended, not a general rule about
 * cities.
 */

import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { readUsageGeo, UNKNOWN_COUNTRY } from "@/lib/analytics/usageGeo";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const MODULE = read("src/lib/analytics/usageGeo.ts");
const MIGRATION = read("docs/sql/usage_geo_daily.sql");
const ROUTE = read("src/app/api/respond/route.ts");

/** A request whose headers are whatever the test says they are. */
const reqWith = (headers: Record<string, string>) => ({
    headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
});

describe("⛔ it collects nothing that could point at a person", () => {
    it("🔴 never reads latitude, longitude or city — they are on the same request", () => {
        // Strip comments first: this file's own header NAMES those headers in
        // order to explain why they are refused, and a comment-reading matcher
        // would report the explanation as the violation. Fifth time in this
        // repo.
        const code = MODULE.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
        for (const banned of ["x-vercel-ip-latitude", "x-vercel-ip-longitude", "x-vercel-ip-city"]) {
            expect(code, `${banned} is read`).not.toContain(banned);
        }
        expect(code).not.toMatch(/\blatitude\b|\blongitude\b/i);
    });

    it("🔴 the stored row has no user id, no IP and no finer time than the day", () => {
        const sql = MIGRATION.replace(/--[^\n]*/g, " ");
        const create = sql.slice(sql.indexOf("create table"), sql.indexOf("primary key"));
        for (const col of ["user_id", "anon_id", "session", "ip", "lat", "lon", "city"]) {
            expect(create.toLowerCase(), `${col} column present`).not.toMatch(
                new RegExp(`\\b${col}\\w*\\s+(text|uuid|inet|numeric|double|timestamptz)`),
            );
        }
        // `day date`, not `created_at timestamptz` — a finer timestamp would
        // let one row be matched to one session.
        expect(create).toMatch(/\bday\s+date\s+not null/);
    });

    it("🔴 NO FUTURE MIGRATION may add an identifying column to the table", () => {
        // ⚠️ THE REAL GAP. The assertion above reads only the original
        // `create table`, so an `alter table usage_geo_daily add column
        // user_id uuid` in a migration written next year would sail past it —
        // and that is precisely how an aggregate quietly becomes a per-person
        // location history. This walks EVERY migration in the repo.
        const SQL_DIR = path.join(process.cwd(), "docs", "sql");
        const offenders: string[] = [];
        for (const f of fs.readdirSync(SQL_DIR).filter((x) => x.endsWith(".sql"))) {
            const sql = fs.readFileSync(path.join(SQL_DIR, f), "utf8")
                .replace(/\/\*[\s\S]*?\*\//g, " ")
                .replace(/--[^\n]*/g, " ");
            for (const m of sql.matchAll(/alter table\s+(?:public\.)?usage_geo_daily([\s\S]*?);/gi)) {
                for (const c of m[1].matchAll(/add column\s+(?:if not exists\s+)?([a-z_]+)/gi)) {
                    const col = c[1].toLowerCase();
                    if (/user|anon|session|device|ip|lat|lon|city|email|phone|token/.test(col)) {
                        offenders.push(`${f}: adds usage_geo_daily.${col}`);
                    }
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it("⚠️ the data gets COARSER as it ages — the date is destroyed, not kept", () => {
        // The one way a row could ever come close to pointing at somebody is a
        // small count on a specific DAY in a specific region. After 100 days
        // the day is summed away into its month, so the trend survives and the
        // date does not.
        // ⚠️ COMMENTS STRIPPED. The migration's footer quotes this very SQL as
        // a "check what it would do" snippet, so an unstripped matcher is
        // satisfied by the comment and passes even after the real guard is
        // deleted — which is exactly what happened when this was written.
        // Sixth time in this repo; strip first, always.
        const retention = read("docs/sql/usage_geo_retention.sql")
            .replace(/\/\*[\s\S]*?\*\//g, " ")
            .replace(/--[^\n]*/g, " ");
        expect(retention).toMatch(/delete from public\.usage_geo_daily/i);
        expect(retention).toMatch(/date_trunc\('month', day\)/i);
        // ⛔ Without this guard a row already on the 1st would be folded into
        // itself every night, doubling its count.
        expect(retention).toMatch(/day <> date_trunc\('month', day\)/i);
        // And it must actually be called, or it is decoration.
        expect(read("src/app/api/cron/exchange-rates/route.ts"))
            .toMatch(/rpc\("imotara_roll_up_usage_geo"\)/);
    });

    it("⛔ the roll-up can never break the cron it rides on", () => {
        // That cron's real job is the exchange rates, which session billing
        // depends on. Analytics retention must not be able to fail it.
        const cron = read("src/app/api/cron/exchange-rates/route.ts");
        const at = cron.indexOf("imotara_roll_up_usage_geo");
        expect(at).toBeGreaterThan(-1);
        // ⚠️ Containment, not proximity: everything between the nearest
        // preceding `try {` and the call must contain no closing brace, or the
        // try opened and shut before reaching it and the call is unguarded.
        // ⚠️ PROXIMITY, NOT BRACE-COUNTING. Two cleverer versions of this
        // assertion were written first and BOTH passed against a verified
        // mutation that removed the try entirely: counting braces over
        // TypeScript is defeated by object literals and destructuring, and
        // `lastIndexOf("try {")` happily finds an unrelated try higher up the
        // file. A short window is cruder and actually works.
        // ⇒ trap_mutation_harness_can_report_false_caught — a control that
        //   does not fail is not a control.
        const window = cron.slice(Math.max(0, at - 120), at);
        expect(window, "the roll-up call is not inside a try").toContain("try {");
        expect(cron.slice(at, at + 400)).toMatch(/catch \{/);
    });

    it("🔑 and the table is service-role only, grant AND policy", () => {
        // The lesson of connect_consultants: a row policy is not the only
        // door. Revoke the grant too.
        expect(MIGRATION).toMatch(/using \(false\)/i);
        expect(MIGRATION).toMatch(/revoke all on public\.usage_geo_daily from anon/i);
        expect(MIGRATION).toMatch(/revoke all on public\.usage_geo_daily from authenticated/i);
    });

    it("✅ the SECURITY DEFINER function pins its search_path", () => {
        expect(MIGRATION).toMatch(/security definer/i);
        expect(MIGRATION).toMatch(/set search_path = public, pg_temp/i);
    });
});

describe("📋 it reads the two headers correctly, and distrusts them", () => {
    it("takes country and region from the edge headers", () => {
        const g = readUsageGeo(reqWith({
            "x-vercel-ip-country": "IN",
            "x-vercel-ip-country-region": "WB",
            "x-imotara-platform": "android",
        }));
        expect(g).toEqual({ country: "IN", region: "WB", platform: "android" });
    });

    it("🔑 falls back to ZZ rather than inventing a country", () => {
        // ⚠️ The column has an ISO-2 check constraint, so an unvalidated value
        // would turn a miscount into a failed insert — and the fallback must
        // not be a real country, or an unplaceable request would inflate it.
        for (const bad of ["", "   ", "XYZ", "1", "in-WB", "'; drop table--"]) {
            const g = readUsageGeo(reqWith({ "x-vercel-ip-country": bad }));
            expect(g.country, `"${bad}" was accepted`).toBe(UNKNOWN_COUNTRY);
        }
        expect(readUsageGeo(reqWith({})).country).toBe(UNKNOWN_COUNTRY);
    });

    it("⚠️ rejects an over-long region rather than truncating it", () => {
        // A long value here is not a region code — most likely a city name,
        // which is exactly what must not get in. Truncating would store a
        // mangled fragment of it.
        const g = readUsageGeo(reqWith({
            "x-vercel-ip-country": "IN",
            "x-vercel-ip-country-region": "West Bengal and beyond",
        }));
        expect(g.region).toBe("");
    });

    it("tells the three platforms apart — the thing GA cannot do", () => {
        // GA is scoped to the website only, by decision. Mobile is the whole
        // reason this exists.
        expect(readUsageGeo(reqWith({ "x-imotara-platform": "ios" })).platform).toBe("ios");
        expect(readUsageGeo(reqWith({ "x-imotara-platform": "android" })).platform).toBe("android");
        expect(readUsageGeo(reqWith({ "user-agent": "Mozilla/5.0 Chrome/120" })).platform).toBe("web");
        expect(readUsageGeo(reqWith({})).platform).toBe("unknown");
    });

    it("⛔ is pure — reading the geo touches no network and no database", () => {
        // So it can be called on any request without a thought. The write is
        // the separate, fire-and-forget half.
        const realFetch = globalThis.fetch;
        const spy = vi.fn();
        globalThis.fetch = spy as unknown as typeof fetch;
        try {
            readUsageGeo(reqWith({ "x-vercel-ip-country": "GB" }));
            expect(spy).not.toHaveBeenCalled();
        } finally {
            globalThis.fetch = realFetch;
        }
    });
});

describe("🔴 mobile is not recorded until the store declarations say so", () => {
    it("⛔ the recorder returns early for ios/android unless the switch is on", () => {
        // 🔑 THE TRAP. This runs SERVER-SIDE on /api/respond, which every
        // already-installed app calls, and those builds already send
        // X-Imotara-Platform. So mobile would start being recorded the instant
        // the WEB deploys — no app release involved — and therefore possibly
        // before the Play Data Safety form declares it. Google's rule on
        // IP-inferred approximate location is explicit, so that window would be
        // a false declaration on a live listing.
        const code = MODULE.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
        expect(code).toMatch(
            /platform !== "web" && process\.env\.IMOTARA_USAGE_GEO_MOBILE !== "true"/,
        );
        // ⚠️ It must RETURN, not merely branch — a log line here would still
        // leave the write below reachable.
        expect(code).toMatch(/IMOTARA_USAGE_GEO_MOBILE !== "true"\)\s*return;/);
    });

    it("🔑 and the gate sits BEFORE the write, not after it", () => {
        const code = MODULE.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
        const gateAt = code.indexOf("IMOTARA_USAGE_GEO_MOBILE");
        const writeAt = code.indexOf("imotara_record_usage_geo");
        expect(gateAt).toBeGreaterThan(-1);
        expect(writeAt).toBeGreaterThan(-1);
        expect(gateAt, "the gate is after the write — it would not prevent anything")
            .toBeLessThan(writeAt);
    });

    it("⚠️ the Play doc's gate names the WEB deploy, not a mobile release", () => {
        // My first version of that doc said the declaration became true at the
        // "next EAS build". It does not: it becomes true on the web deploy, for
        // apps already in people's hands. A gate that names the wrong trigger
        // is worse than none, because it buys false time.
        const play = fs.readFileSync(
            path.join(process.cwd(), "..", "imotara-mobile", "PLAY_DATA_SAFETY.md"),
            "utf8",
        );
        expect(play).toMatch(/IMOTARA_USAGE_GEO_MOBILE/);
    });
});

describe("🔴 it can never delay or break a reply", () => {
    it("⛔ the respond route does NOT await it", () => {
        // The standing constraint: nothing may degrade reply quality or user
        // experience. An analytics write has no business between a person in
        // distress and their answer.
        expect(ROUTE).toMatch(/void recordUsageGeo\(req\);/);
        expect(ROUTE, "awaited on the request path").not.toMatch(/await recordUsageGeo\(/);
    });

    it("🔑 and it swallows its own failures", () => {
        // If the migration has not been run in an environment, the person
        // still gets their reply. Pinned on the first statement of the
        // function body, because a try that does not WRAP the call is
        // decoration ⇒ trap_text_assertions_cannot_see_reachability.
        const fn = MODULE.slice(MODULE.indexOf("export async function recordUsageGeo"));
        // ⚠️ Anchor on the RETURN TYPE, not the first "{" — the first brace in
        // this signature belongs to the parameter type `{ headers: HeaderLike }`,
        // which is what the first version of this assertion matched.
        const body = fn.slice(fn.indexOf("Promise<void> {") + "Promise<void> {".length);
        expect(body.trimStart().startsWith("try {"), "the try does not wrap the call").toBe(true);
        expect(fn).toMatch(/catch\s*\{/);
    });

    it("⚠️ the counter is atomic — two requests in the same ms both count", () => {
        // A read-then-write would lose one, and PostgREST's upsert REPLACES
        // rather than adds, which is why this goes through an RPC at all.
        expect(MIGRATION).toMatch(/on conflict \(day, country, region, platform\)/i);
        expect(MIGRATION).toMatch(/hits = usage_geo_daily\.hits \+ 1/i);
        expect(MODULE).toMatch(/\.rpc\("imotara_record_usage_geo"/);
    });
});
