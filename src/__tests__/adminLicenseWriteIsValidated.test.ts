/**
 * An admin cannot write a tier or status the system does not understand.
 *
 * 🔴 WHY THIS EXISTS. `admin/licenses/[userId]/route.ts` did:
 *
 *     if (tier   !== undefined) updates.tier   = tier;
 *     if (status !== undefined) updates.status = status;
 *
 * with no validation, and did not even import a guard — while the ORG routes
 * next door (organizations/[orgId]/pools, .../members, org/dashboard/members)
 * all check with isLicenseTier and return 400. This one was simply missed.
 *
 * The failure was SILENT, which is what made it dangerous. A typo — "Plus",
 * "PRO", "premuim" — wrote straight into `licenses.tier`; `normaliseTier`
 * mapped the unknown value to `free` on read; and a PAYING USER WAS DOWNGRADED
 * TO FREE. Nothing threw. The admin saw their edit succeed.
 *
 * 🔑 Same family as the AsyncStorage trap recorded at the tier rename:
 * `isValidTier(raw) ? raw : "FREE"` silently drops every paid user to FREE.
 * Unknown-tier handling fails safe for the SYSTEM and unsafe for the USER, so
 * the write is the only place it can be caught.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
    TIER_ORDER, isLicenseTier,
    LICENSE_STATUSES, isLicenseStatus,
} from "@/types/license";

const ROOT  = path.join(__dirname, "..", "..");
const route = fs.readFileSync(
    path.join(ROOT, "src/app/api/admin/licenses/[userId]/route.ts"), "utf8",
);
const code  = route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("the status guard", () => {
    it("accepts exactly the four real statuses", () => {
        // Verified against production 2026-09-25: the table holds `trial` and
        // `valid`; `invalid` and `expired` are reachable from the admin UI.
        expect([...LICENSE_STATUSES]).toEqual(["valid", "invalid", "expired", "trial"]);
        for (const s of LICENSE_STATUSES) expect(isLicenseStatus(s)).toBe(true);
    });

    it.each([["Valid"], ["VALID"], ["active"], ["cancelled"], [""], [null], [undefined], [42]])(
        "rejects %p",
        (bad) => expect(isLicenseStatus(bad)).toBe(false),
    );
});

describe("the tier guard still holds the line", () => {
    it.each([["Plus"], ["PRO"], ["pro"], ["premuim"], ["premium"], [""], [null], [7]])(
        "rejects %p",
        (bad) => expect(isLicenseTier(bad)).toBe(false),
    );

    it("🔑 'pro' and 'premium' are REJECTED as writes even though they READ as plus", () => {
        // TIER_ALIASES normalises them on read, for legacy rows. That must not
        // make them writable — storing an alias reintroduces the drift the
        // rename removed.
        expect(isLicenseTier("pro")).toBe(false);
        expect(isLicenseTier("premium")).toBe(false);
        expect(TIER_ORDER).not.toContain("pro");
    });
});

describe("the admin PATCH validates before writing", () => {
    it("🔴 it rejects an unknown tier with 400", () => {
        expect(code).toMatch(/!isLicenseTier\(body\.tier\)/);
        expect(code).toMatch(/tier must be one of[\s\S]{0,120}status:\s*400/);
    });

    it("🔴 it rejects an unknown status with 400", () => {
        expect(code).toMatch(/!isLicenseStatus\(body\.status\)/);
        expect(code).toMatch(/status must be one of[\s\S]{0,120}status:\s*400/);
    });

    it("🔴 the check happens BEFORE the update payload is built", () => {
        // A guard after the write would be decoration.
        const guard  = code.indexOf("isLicenseTier(body.tier)");
        const write  = code.indexOf("updates.tier");
        expect(guard).toBeGreaterThan(-1);
        expect(write).toBeGreaterThan(-1);
        expect(guard).toBeLessThan(write);
    });

    it("the error names the allowed values, so an admin can self-correct", () => {
        expect(code).toMatch(/TIER_ORDER\.join/);
        expect(code).toMatch(/LICENSE_STATUSES\.join/);
    });
});

describe("no private copies of these unions survive", () => {
    it("🔴 the admin UI no longer redeclares the status union", () => {
        // It kept its own `type LicenseStatus = "valid" | "invalid" | ...`,
        // a third copy that could drift from the API and the guard.
        const ui = fs.readFileSync(path.join(ROOT, "src/app/admin/page.tsx"), "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
        expect(ui).not.toMatch(/type LicenseStatus\s*=\s*"valid"/);
        expect(ui).toMatch(/LicenseStatusCode/);
    });
});
