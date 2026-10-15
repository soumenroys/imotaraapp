// scripts/verifyOrgRls.mjs
//
// Proves docs/sql/org_rls_recursion_and_invite_disclosure_fix.sql actually took,
// using the PUBLIC anon key — i.e. it checks what an attacker sees, not what the
// service role sees.
//
// 🔑 WHY A SCRIPT AND NOT A GLANCE AT THE SQL EDITOR'S "Success" MESSAGE.
// "Success. No rows returned" means the statements parsed and ran. It does not
// say the policy now behaves as intended — and this repo has been caught by
// exactly that gap before: setup is not outcome.
//
//   node scripts/verifyOrgRls.mjs
//
// Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY from the
// environment or .env.local. Read-only: it issues SELECTs with limit=1 and
// never writes.

import fs from "node:fs";

const env = { ...process.env };
try {
    for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#") || !t.includes("=")) continue;
        const [k, ...rest] = t.split("=");
        if (!env[k]) env[k] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
} catch { /* environment-only is fine */ }

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
if (!URL_ || !ANON) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    process.exit(2);
}

/** The ten tables the 42P17 recursion took down. */
const RECURSED = [
    "org_members", "org_invites", "organizations", "org_audit_log",
    "org_license_pools", "org_license_assignments", "api_keys",
    "cohorts", "referral_codes", "payment_invoices",
];

async function anonSelect(table) {
    const res = await fetch(`${URL_}/rest/v1/${table}?select=*&limit=1`, {
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    let body = null;
    try { body = await res.json(); } catch { /* non-JSON */ }
    return { status: res.status, body };
}

let failures = 0;
const fail = (m) => { console.log(`  ❌ ${m}`); failures++; };
const pass = (m) => console.log(`  ✅ ${m}`);

console.log("\n── the recursion: every table must answer 200 with [] ──");
console.log("   (200 [] is RLS WORKING — it filters rows rather than refusing)\n");
for (const t of RECURSED) {
    const { status, body } = await anonSelect(t);
    const code = body && !Array.isArray(body) ? body.code : null;
    if (code === "42P17") fail(`${t} still recurses (42P17) — the fix did not take`);
    else if (status !== 200) fail(`${t} answered ${status}${code ? ` (${code})` : ""}`);
    else if (!Array.isArray(body)) fail(`${t} answered 200 but not an array`);
    else if (body.length > 0 && t !== "org_invites") fail(`${t} returned ${body.length} ROW(S) to anon`);
    else pass(`${t} → 200 []`);
}

console.log("\n── the disclosure: org_invites must leak NOTHING ──\n");
{
    const { status, body } = await anonSelect("org_invites");
    if (Array.isArray(body) && body.length > 0) {
        // ⛔ The whole point. A single row here carries a token, and
        // /org/invite/[token] accepts an invite from a token alone.
        fail(`org_invites returned ${body.length} row(s) — "using (true)" is STILL LIVE`);
        if (body[0] && "token" in body[0]) fail("and the rows include the TOKEN column");
    } else if (status === 200) {
        pass("org_invites → 200 [] — no invite is readable by anon");
    } else {
        pass(`org_invites → ${status} (closed)`);
    }
}

console.log("\n── app_settings must no longer be world-readable ──\n");
{
    const { status, body } = await anonSelect("app_settings");
    if (Array.isArray(body) && body.length > 0) {
        fail(`app_settings returned ${body.length} row(s) — the public read is STILL LIVE`);
    } else pass(`app_settings → ${status} with no rows`);
}

console.log(
    failures === 0
        ? "\n✅ ALL CHECKS PASSED — the migration took.\n"
        : `\n❌ ${failures} CHECK(S) FAILED — the migration did not fully take.\n`,
);
process.exit(failures === 0 ? 0 : 1);
