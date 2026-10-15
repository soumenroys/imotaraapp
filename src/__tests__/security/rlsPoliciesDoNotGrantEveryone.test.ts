/**
 * Structural guards on the RLS policies, from the owner-requested security
 * review of 2026-10-16.
 *
 * 🔑 WHY THESE ASSERTIONS AND NOT A MIRROR OF THE SQL. RLS is the ENTIRE
 * database boundary for this app: the Supabase anon key ships in the client
 * bundle by design, so any row a policy exposes is a row the public can read. A
 * test that merely restated the current policy text would stay green through
 * any rewrite ⇒ trap_a_mirror_test_cannot_catch_a_refactor. These assert the
 * two shapes that were actually wrong instead.
 *
 * 🔴 WHAT WAS FOUND:
 *   ① a SELECT policy ON org_members whose USING clause READ org_members —
 *      42P17 infinite recursion, which broke RLS reads on TEN tables. It fails
 *      closed, so it was a correctness defect rather than a hole.
 *   ② `using (true)` on org_invites, under a comment claiming "by token" when
 *      the predicate had no token filter — full disclosure of every pending
 *      invite's email, role, org_id and TOKEN, and a token is all
 *      /org/invite/[token] needs to join an organisation.
 *
 * ⛔ AND THE RELATIONSHIP BETWEEN THEM, which is the part worth remembering:
 * permissive policies are OR'd and an error in any one fails the query, so ①
 * MASKED ②. Repairing the recursion on its own would have opened the hole.
 * That is why both guards live in one file.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SQL_DIR = path.join(process.cwd(), "docs", "sql");
const sqlFiles = fs.readdirSync(SQL_DIR).filter((f) => f.endsWith(".sql"));
const rawSql = (f: string) => fs.readFileSync(path.join(SQL_DIR, f), "utf8");

/**
 * ⛔ COMMENTS STRIPPED BEFORE PARSING. The migration that fixes these defects
 * QUOTES the bad SQL in its header to explain what was wrong — so a parser that
 * reads comments finds `using (true)` in the very file that removes it and
 * reports the fix as the bug. This codebase has now hit that shape four times:
 * "diagnos" matched "does not diagnose", "children" matched an adult's
 * children, "under 13" matched its own denial of it, and now this.
 */
const readSql = (f: string) =>
    rawSql(f)
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/--[^\n]*/g, " ");

type Policy = { file: string; name: string; table: string; verb: string; body: string };

function allPolicies(): Policy[] {
    const out: Policy[] = [];
    for (const file of sqlFiles) {
        const sql = readSql(file);
        const re = /create policy\s+"([^"]+)"\s*(?:\n\s*)?on\s+([a-z_.]+)\s+for\s+(\w+)([\s\S]*?);/gi;
        let m: RegExpExecArray | null;
        while ((m = re.exec(sql))) {
            out.push({
                file,
                name: m[1],
                table: m[2].replace(/^public\./, ""),
                verb: m[3].toLowerCase(),
                body: m[4],
            });
        }
    }
    return out;
}

/** Policies dropped somewhere, so a retired one is not reported as live. */
function droppedPolicyNames(): Set<string> {
    const dropped = new Set<string>();
    for (const file of sqlFiles) {
        const sql = readSql(file);
        const re = /drop policy\s+(?:if exists\s+)?"([^"]+)"\s+on\s+([a-z_.]+)/gi;
        let m: RegExpExecArray | null;
        while ((m = re.exec(sql))) {
            dropped.add(`${m[2].replace(/^public\./, "")}::${m[1]}`);
        }
    }
    return dropped;
}

const POLICIES = allPolicies();
const DROPPED = droppedPolicyNames();
/** ⚠️ A policy both created and dropped is live only in its recreated form. */
const live = (p: Policy) =>
    !DROPPED.has(`${p.table}::${p.name}`) || p.file.includes("org_rls_recursion");

describe("🔴 no RLS policy grants every row to everyone", () => {
    it("finds the policies at all — the parser must not silently match nothing", () => {
        // ⚠️ A regex matching nothing would make every assertion below pass
        // vacuously. This is the control.
        expect(POLICIES.length).toBeGreaterThan(20);
        expect(new Set(POLICIES.map((p) => p.table)).size).toBeGreaterThan(8);
    });

    it("⛔ no LIVE policy uses `using (true)`", () => {
        // The anon key is public, so `using (true)` on a table holding user data
        // is a public dump of that table.
        //
        // ⚠️ THERE IS NO ALLOW-LIST ON PURPOSE. Both of the two that existed
        // were justified at the time and wrong later:
        //   · org_invites — "Anyone can read invite by token", with no token
        //     filter in the predicate at all
        //   · app_settings — reasoned for exchange_rates, which is genuinely
        //     public, then the table grew a `broadcast_identities` key holding
        //     staff addresses, which silently inherited the read
        // A per-table exception would have let the second one through, because
        // the exception was granted to the TABLE and the risk arrived in a ROW.
        // If a future row really must be world-readable, scope the policy to
        // that row (`using (key = '...')`) rather than widening this test.
        const offenders = POLICIES.filter(live)
            .filter((p) => /using\s*\(\s*true\s*\)/i.test(p.body))
            .map((p) => `${p.file}: ${p.table}.${p.verb} "${p.name}"`);
        expect(offenders).toEqual([]);
    });

    it("🔴 org_invites grants anon nothing — a token is a credential", () => {
        // Each row carries the invite TOKEN, and /org/invite/[token] accepts an
        // invite from a token alone. One readable row is an organisation joined.
        const invitePolicies = POLICIES.filter(live).filter((p) => p.table === "org_invites");
        expect(invitePolicies.length, "org_invites has no policy at all").toBeGreaterThan(0);
        for (const p of invitePolicies) {
            expect(p.body, `org_invites "${p.name}" is unconditional`).not.toMatch(
                /using\s*\(\s*true\s*\)/i,
            );
        }
    });
});

describe("⛔ no RLS policy recurses into its own table", () => {
    it("🔴 a policy ON a table must not SELECT FROM that table", () => {
        // The exact defect: "Org admins read all members" on org_members read
        // org_members. Postgres raises 42P17, and the error propagates to every
        // other table whose policy reads org_members — ten of them.
        const offenders = POLICIES.filter(live)
            .filter((p) => new RegExp(`from\\s+(public\\.)?${p.table}\\b`, "i").test(p.body))
            .map((p) => `${p.file}: policy "${p.name}" on ${p.table} reads ${p.table}`);
        expect(offenders).toEqual([]);
    });

    it("✅ the helpers that replaced it pin their search_path", () => {
        // ⛔ A SECURITY DEFINER function without a fixed search_path can be
        // hijacked by a caller-controlled schema shadowing org_members — which
        // would make the fix a worse hole than the bug.
        const fix = readSql("org_rls_recursion_and_invite_disclosure_fix.sql");
        // ⚠️ Count DEFINITIONS, not the phrase — it also appears in the prose
        // of the header, which is exactly the over-matching this file strips
        // comments to avoid.
        const defs = fix.match(/create or replace function[\s\S]*?security definer/gi) ?? [];
        expect(defs.length, "no SECURITY DEFINER helper found").toBe(2);
        expect((fix.match(/set search_path = public, pg_temp/gi) ?? []).length).toBe(defs.length);
    });

    it("✅ and they answer only about the CALLER — they cannot enumerate", () => {
        // `auth.uid()` in the predicate is what makes a boolean helper safe to
        // grant to anon. Without it the function would answer about anybody.
        const fix = readSql("org_rls_recursion_and_invite_disclosure_fix.sql");
        for (const fn of ["imotara_is_org_admin", "imotara_is_org_member"]) {
            const body = fix.slice(fix.indexOf(`function public.${fn}`));
            expect(body.slice(0, 700), `${fn} does not scope to auth.uid()`).toMatch(
                /om\.user_id\s*=\s*auth\.uid\(\)/,
            );
        }
    });

    it("🔑 the fix covers EVERY table that inherited the recursion", () => {
        // A partial fix leaves some tables erroring and looks like success.
        const fix = readSql("org_rls_recursion_and_invite_disclosure_fix.sql");
        for (const t of [
            "org_members", "org_invites", "organizations", "org_audit_log",
            "org_license_pools", "org_license_assignments", "api_keys",
            "cohorts", "referral_codes", "payment_invoices",
        ]) {
            expect(fix, `${t} not covered`).toMatch(new RegExp(`on public\\.${t} `));
        }
    });
});
