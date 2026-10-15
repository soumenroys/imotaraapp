/**
 * A row-level policy does not hide a column. If a table is readable by anon at
 * all, EVERY column on it is public — and tables grow.
 *
 * 🔴 WHAT WAS FOUND, security review 2026-10-16. connect_schema.sql granted the
 * public directory read:
 *
 *   CREATE POLICY "connect_consultants_public_view" ON connect_consultants
 *     FOR SELECT USING (status = 'approved');
 *
 * Correct for the table as it then stood — display_name, bio, rate, languages.
 * The table then grew nine times, and an approved consultant's row came to
 * carry `payout_info`, `verification_docs` (photo-ID and address-proof paths),
 * `docs_notes`, `contact_email`, `contact_phone` and `digital_signature`.
 *
 * ⛔ THE APP'S OWN ROUTES WERE CAREFUL AND IT DID NOT MATTER.
 * /api/connect/consultants enumerates about twenty safe columns and names none
 * of those — but that list is advisory. The boundary is the policy, the policy
 * is row-level, and no column-level GRANT existed, so an anonymous caller
 * skipped the route and asked PostgREST for `select=*` with the published anon
 * key. Measured: that table answered anon with ROWS where every user table
 * answered [].
 *
 * 🔑 THIS GUARD IS WRITTEN FOR THE CLASS, NOT THE INSTANCE. It is the same
 * shape as the app_settings leak in the sibling migration — a policy reasoned
 * from one row's contents, applied to a whole table that later grew. Naming
 * only connect_consultants would leave the next one to be found by someone
 * else.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SQL_DIR = path.join(process.cwd(), "docs", "sql");
const files = fs.readdirSync(SQL_DIR).filter((f) => f.endsWith(".sql"));
/** ⚠️ Comments stripped: the migrations QUOTE the defects to explain them. */
const sql = (f: string) =>
    fs.readFileSync(path.join(SQL_DIR, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/--[^\n]*/g, " ");

const ALL = files.map(sql).join("\n");

/** Column names that must never be world-readable. */
const SENSITIVE =
    /^(payout_info|payout_method|verification_docs|docs_notes|digital_signature|contact_email|contact_phone|password_hash|totp_secret|token_hash|token|api_key|secret|bank_account|ifsc|upi_id|pan|aadhaar)$/i;

/** Every column each table is declared with, across create-table and add-column. */
function columnsByTable(): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    const add = (t: string, c: string) => {
        const k = t.replace(/^public\./, "").toLowerCase();
        if (!map.has(k)) map.set(k, new Set());
        map.get(k)!.add(c.toLowerCase());
    };
    for (const m of ALL.matchAll(
        /create table\s+(?:if not exists\s+)?([a-z_.]+)\s*\(([\s\S]*?)\n\s*\);/gi,
    )) {
        for (const line of m[2].split("\n")) {
            const c = line.trim().match(/^([a-z_]+)\s+[a-z]/i);
            if (c && !/^(primary|unique|constraint|check|foreign|references)$/i.test(c[1])) {
                add(m[1], c[1]);
            }
        }
    }
    for (const m of ALL.matchAll(/alter table\s+([a-z_.]+)([\s\S]*?);/gi)) {
        for (const c of m[2].matchAll(/add column\s+(?:if not exists\s+)?([a-z_]+)/gi)) {
            add(m[1], c[1]);
        }
    }
    return map;
}

/** Tables with a SELECT policy that is not scoped to the calling user. */
function worldReadableTables(): { table: string; policy: string }[] {
    const dropped = new Set<string>();
    for (const m of ALL.matchAll(/drop policy\s+(?:if exists\s+)?"([^"]+)"\s+on\s+([a-z_.]+)/gi)) {
        dropped.add(`${m[2].replace(/^public\./, "")}::${m[1]}`);
    }
    const out: { table: string; policy: string }[] = [];
    for (const m of ALL.matchAll(
        /create policy\s+"([^"]+)"\s*(?:\n\s*)?on\s+([a-z_.]+)\s+for\s+(select|all)([\s\S]*?);/gi,
    )) {
        const [, name, rawTable, , body] = m;
        const table = rawTable.replace(/^public\./, "").toLowerCase();
        if (dropped.has(`${table}::${name}`)) continue;
        if (/auth\.uid\(\)|auth\.jwt\(\)|imotara_is_org_/i.test(body)) continue; // caller-scoped
        if (/using\s*\(\s*false\s*\)/i.test(body)) continue;                     // service-role only
        out.push({ table, policy: name });
    }
    return out;
}

/** Tables whose direct grant to anon has been revoked — the fix. */
function revokedFromAnon(): Set<string> {
    const s = new Set<string>();
    for (const m of ALL.matchAll(/revoke[^;]*\son\s+(?:table\s+)?([a-z_.]+)\s+from\s+([^;]+);/gi)) {
        if (/\banon\b/i.test(m[2])) s.add(m[1].replace(/^public\./, "").toLowerCase());
    }
    return s;
}

const COLUMNS = columnsByTable();
const WORLD = worldReadableTables();
const REVOKED = revokedFromAnon();

describe("🔴 a world-readable table carries no sensitive column", () => {
    it("parses the schema at all — the control", () => {
        // ⚠️ Without this, an over-strict regex would make the whole file pass
        // vacuously, which is the failure mode of every structural test.
        expect(COLUMNS.size).toBeGreaterThan(20);
        expect(COLUMNS.get("connect_consultants")?.size ?? 0).toBeGreaterThan(20);
        expect(WORLD.length).toBeGreaterThan(0);
    });

    it("🔑 no table with a non-caller-scoped SELECT policy exposes a sensitive column", () => {
        // Unless its direct grant to anon has been revoked, in which case
        // PostgREST refuses the table outright and the policy is belt-only.
        const offenders: string[] = [];
        for (const { table, policy } of WORLD) {
            if (REVOKED.has(table)) continue;
            for (const col of COLUMNS.get(table) ?? []) {
                if (SENSITIVE.test(col)) {
                    offenders.push(`${table}.${col} is public via "${policy}"`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it("⛔ connect_consultants specifically — the instance that was found", () => {
        // Named as well as covered by the class, because this one holds real
        // identifiable people's payout and ID details and was reachable today,
        // not latent.
        const cols = COLUMNS.get("connect_consultants");
        expect(cols, "schema not parsed").toBeTruthy();
        // The columns are still there — the fix is the grant, not a drop.
        for (const c of ["payout_info", "verification_docs", "contact_phone", "digital_signature"]) {
            expect(cols!.has(c), `${c} missing — did the schema change?`).toBe(true);
        }
        expect(REVOKED.has("connect_consultants"), "anon can still read the table").toBe(true);
    });

    it("✅ the policies are kept as well as the grant revoked — belt and braces", () => {
        // If a later migration or a Supabase default restores the grant, the
        // row-level rules must still apply rather than the table being open.
        const fix = sql("connect_consultants_column_disclosure_fix.sql");
        expect(fix).not.toMatch(/drop policy[^;]*connect_consultants_public_view/i);
        expect(fix).toMatch(/revoke select on public\.connect_consultants from anon/i);
        expect(fix).toMatch(/revoke select on public\.connect_consultants from authenticated/i);
    });

    it("⚠️ and the write verbs are revoked too", () => {
        const fix = sql("connect_consultants_column_disclosure_fix.sql");
        expect(fix).toMatch(/revoke insert, update, delete on public\.connect_consultants from anon/i);
    });
});
