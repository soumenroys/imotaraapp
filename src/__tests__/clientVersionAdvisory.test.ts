/**
 * The stale-client advisory must never be able to lock anyone out.
 *
 * 🔴 WHY THIS EXISTS. The advisory was added because retiring `pro_*` and
 * repricing left 1.4.1 and 1.3.2 rendering `plus_annual ₹699` while Play bills
 * ₹1,299 — and nothing could be done, because no client sent its version.
 *
 * ⚠️ The danger in the fix is worse than the bug it prepares for. Every client
 * in the field today sends NO version header. If "no version" ever resolved to
 * "stale", the first deploy would tell the entire install base it must update —
 * to reach a state it is already in for some, and cannot reach at all for
 * others. That is an outage traded for a display bug.
 *
 * So these tests pin the fail-open direction specifically. Each one is a way the
 * feature could turn into a lockout, asserted not to.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isClientStale, minSupportedVersion, parseVersion, CLIENT_VERSION_HEADER }
    from "@/lib/imotara/clientVersion";

/** Minimal stand-in for the bits of Request the helper touches. */
const reqWith = (version?: string) => ({
    headers: {
        get: (n: string) =>
            n.toLowerCase() === CLIENT_VERSION_HEADER && version !== undefined ? version : null,
    },
});

const ENV = "IMOTARA_MIN_SUPPORTED_APP_VERSION";
let original: string | undefined;
beforeEach(() => { original = process.env[ENV]; delete process.env[ENV]; });
afterEach(() => { if (original === undefined) delete process.env[ENV]; else process.env[ENV] = original; });

describe("🔴 fail-open — none of these may ever report stale", () => {
    it("is OFF by default: no minimum configured ⇒ nothing is stale", () => {
        expect(minSupportedVersion()).toBeNull();
        expect(isClientStale(reqWith("1.0.0"))).toBe(false);
        expect(isClientStale(reqWith(undefined))).toBe(false);
    });

    it("a client sending NO version header is never stale", () => {
        process.env[ENV] = "1.4.4";
        // This is every client in the field today. If this ever flips to true,
        // the whole install base is told to update on the next deploy.
        expect(isClientStale(reqWith(undefined))).toBe(false);
    });

    it("an unparseable or empty version is never stale", () => {
        process.env[ENV] = "1.4.4";
        for (const v of ["", "   ", "unknown", "banana", "v1.4.3", "1.4", "null"]) {
            expect(isClientStale(reqWith(v))).toBe(false);
        }
    });

    it("a malformed MINIMUM disables the feature rather than gating everyone", () => {
        for (const bad of ["banana", "1.4", "", "  "]) {
            process.env[ENV] = bad;
            expect(minSupportedVersion()).toBeNull();
            expect(isClientStale(reqWith("1.0.0"))).toBe(false);
        }
    });
});

describe("it does compare correctly when it is on", () => {
    beforeEach(() => { process.env[ENV] = "1.4.4"; });

    it("older versions are stale", () => {
        for (const v of ["1.4.3", "1.4.0", "1.3.2", "1.2.7", "0.9.9"]) {
            expect(isClientStale(reqWith(v))).toBe(true);
        }
    });

    it("equal and newer versions are not stale", () => {
        for (const v of ["1.4.4", "1.4.5", "1.5.0", "2.0.0"]) {
            expect(isClientStale(reqWith(v))).toBe(false);
        }
    });

    it("compares numerically, not as strings", () => {
        // "1.10.0" < "1.9.0" as strings, and the opposite as versions. A string
        // compare here would tell a NEWER client it is out of date.
        process.env[ENV] = "1.10.0";
        expect(isClientStale(reqWith("1.9.0"))).toBe(true);
        expect(isClientStale(reqWith("1.10.0"))).toBe(false);
        expect(isClientStale(reqWith("1.11.0"))).toBe(false);
    });

    it("ignores the build suffix the app appends", () => {
        // appVersion.ts sends `1.4.3+143`. The build number distinguishes two
        // builds of one version; it never decides staleness.
        expect(isClientStale(reqWith("1.4.3+143"))).toBe(true);
        expect(isClientStale(reqWith("1.4.4+144"))).toBe(false);
        expect(parseVersion("1.4.3+143").parts).toEqual([1, 4, 3]);
    });
});
