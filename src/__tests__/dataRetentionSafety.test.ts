// Guards on the only job in this system that destroys user data on a timer,
// with nobody watching and no undo.
//
// 🔴 THE PROPERTY THAT MATTERS MOST IS "FAILS CLOSED". A mis-set flag must
// leave the job inert, never leave it deleting. These assert that asymmetry
// directly, by driving the real function with real env values, rather than
// asserting that some line of source exists.

import { describe, it, expect, afterEach } from "vitest";

import {
    RETENTION_INACTIVE_MONTHS,
    RETENTION_GRACE_DAYS,
    retentionEnforcing,
} from "@/lib/account/retentionPolicy";
import { USER_ID_TABLES } from "@/lib/account/purgeUserData";

const ORIGINAL = process.env.IMOTARA_RETENTION_ENFORCE;

afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.IMOTARA_RETENTION_ENFORCE;
    else process.env.IMOTARA_RETENTION_ENFORCE = ORIGINAL;
});

describe("retention enforcement fails CLOSED", () => {
    it("is off when the variable is absent", () => {
        delete process.env.IMOTARA_RETENTION_ENFORCE;
        expect(retentionEnforcing()).toBe(false);
    });

    // ⚠️ Each of these is a plausible way a human sets a boolean env var, and
    // every one of them must leave the job inert. The ADMIN_SECRET_DISABLED
    // review on the same day turned on exactly this ambiguity — there a
    // mis-spelled flag failed OPEN, which is why this one is pinned to fail
    // closed and pinned by test rather than by comment.
    for (const value of ["", "1", "True", "TRUE", "yes", "on", "false", " true"]) {
        it(`is off for ${JSON.stringify(value)}`, () => {
            process.env.IMOTARA_RETENTION_ENFORCE = value;
            expect(retentionEnforcing()).toBe(false);
        });
    }

    it("is on ONLY for the exact string \"true\"", () => {
        process.env.IMOTARA_RETENTION_ENFORCE = "true";
        expect(retentionEnforcing()).toBe(true);
    });
});

describe("the retention numbers", () => {
    // 🔑 These are the numbers /privacy publishes, because the page imports
    // these very constants. Pinning BOTH matters: a test that checked only the
    // months would pass with the grace period silently set to zero, which is
    // erasure without notice.
    it("warns at 24 months", () => {
        expect(RETENTION_INACTIVE_MONTHS).toBe(24);
    });

    it("gives 30 days of grace after the warning", () => {
        expect(RETENTION_GRACE_DAYS).toBe(30);
    });

    it("never allows erasure without a real notice period", () => {
        expect(RETENTION_GRACE_DAYS).toBeGreaterThan(0);
        expect(RETENTION_INACTIVE_MONTHS).toBeGreaterThan(0);
    });
});

describe("the purge cascade", () => {
    // ⛔ This is the drift guard the shared module exists for. If someone adds
    // a table of user data to the user-facing delete and forgets the retention
    // job, or vice versa, it is silent — and the data survives forever on the
    // accounts the privacy policy promises were erased.
    it("covers every table the account-delete cascade knew about", () => {
        for (const table of ["user_memory", "licenses", "payment_licenses", "usage_events"]) {
            expect(USER_ID_TABLES).toContain(table);
        }
    });

    // imotara_history is keyed "<userId>:<rowId>", so it needs a LIKE and is
    // handled separately. It must NOT appear in the eq()-based list, or the
    // delete would silently match nothing.
    it("excludes the composite-key table from the eq() list", () => {
        expect(USER_ID_TABLES).not.toContain("imotara_history");
    });
});
