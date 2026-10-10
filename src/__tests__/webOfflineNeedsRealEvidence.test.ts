/**
 * Web's half of "it says offline on full wifi".
 *
 * 🔴 Reported on mobile 2026-10-10 — "showing offline though the tower is
 * full or wifi is strongly available" — and this hook had the identical
 * flaw: a SINGLE failed probe called setIsOnline(false).
 *
 * The probe is a real request to /api/health, a serverless function, so a
 * cold start or a momentary stall makes it miss its 15s window while the
 * connection is perfectly fine.
 *
 * ⚖️ Same asymmetry the 15s timeout in this file is already justified by: a
 * false "offline" degrades the experience, a false "online" costs seconds.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(
    path.join(process.cwd(), "src/hooks/useOnlineStatus.ts"), "utf8");

describe("🔴 one failed probe must not declare the browser offline", () => {
    it("offline needs the probe to fail twice", () => {
        expect(SRC).toMatch(/const OFFLINE_CONFIRMATIONS = 2;/);
        expect(SRC).toMatch(/if \(consecutiveFailures >= OFFLINE_CONFIRMATIONS\) setIsOnline\(false\);/);
    });

    it("a success resets the count immediately", () => {
        // Otherwise two failures an hour apart would add up to a false offline.
        expect(SRC).toMatch(/if \(online\) \{\s*\n\s*consecutiveFailures = 0;\s*\n\s*setIsOnline\(true\);/);
    });

    it("⛔ the probe no longer sets offline directly on one result", () => {
        // The shape of the bug: `setIsOnline(online)` with no counting.
        expect(SRC).not.toMatch(/setIsOnline\(online\)/);
    });
});

describe("⚖️ the browser's own signal still wins instantly", () => {
    it("the OS offline event flips it with no confirmation", () => {
        // When the OS says the network is gone, it IS gone — no need to wait.
        expect(SRC).toMatch(/const markOffline = \(\) => \{ if \(mounted\) setIsOnline\(false\); \};/);
    });

    it("the OS online event clears the failure count too", () => {
        expect(SRC).toMatch(/const markOnline = \(\) => \{ if \(mounted\) \{ consecutiveFailures = 0; setIsOnline\(true\); \} \};/);
    });

    it("both are still registered", () => {
        expect(SRC).toMatch(/addEventListener\("online", markOnline\)/);
        expect(SRC).toMatch(/addEventListener\("offline", markOffline\)/);
    });
});

describe("⚠️ what must NOT have changed", () => {
    it("any HTTP response still counts as online, even a 5xx", () => {
        // Asking "did we reach Imotara" — not "is Imotara healthy".
        expect(SRC).toMatch(/return true; \/\/ any HTTP response/);
    });

    it("the 15s probe timeout is intact", () => {
        // Shortening it is what used to pin slow connections to "offline".
        expect(SRC).toMatch(/const PROBE_TIMEOUT_MS = 15_000;/);
    });

    it("the counter is declared before the handler that resets it", () => {
        // A listener registered above a `let` would be a temporal-dead-zone
        // hazard if it fired during the effect body.
        expect(SRC.indexOf("let consecutiveFailures = 0;"))
            .toBeLessThan(SRC.indexOf("const markOnline ="));
    });
});
