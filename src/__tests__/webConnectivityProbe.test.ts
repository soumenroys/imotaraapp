/**
 * The web online/offline probe.
 *
 * Two things were wrong here until 2026-10-05, both in the direction that
 * hurts the people on the worst connections:
 *
 *   PROBE_TIMEOUT_MS = 3000   a timeout lands in the catch and reads as
 *                             OFFLINE, so on a slow network every probe
 *                             failed and the person was told they were
 *                             offline for as long as it stayed poor.
 *   a gstatic fallback        unreachable from a browser, and asking a third
 *                             party whether WE are reachable answers the
 *                             wrong question. Mobile dropped the same probe
 *                             on 2026-09-16; web still carried it.
 *
 * What the probe gets RIGHT, and must keep: any http response — including a
 * 5xx — counts as online. One endpoint's health must never decide whether the
 * product works. Mobile's online.ts was brought into line with this file, not
 * the other way round.
 */
import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

const SRC = fs.readFileSync(
    path.join(__dirname, "..", "hooks", "useOnlineStatus.ts"),
    "utf8",
);
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("the web connectivity probe", () => {
    it("⚠️ gives a slow network time to answer", () => {
        // ⛔ Do not lower this to "detect offline faster". Detecting offline
        // faster is not the goal; not declaring it wrongly is.
        const m = CODE.match(/PROBE_TIMEOUT_MS\s*=\s*([\d_]+)/);
        expect(m).not.toBeNull();
        expect(Number(m![1].replace(/_/g, ""))).toBeGreaterThanOrEqual(15_000);
    });

    it("⛔ asks our own endpoint, never a third party", () => {
        expect(CODE).not.toMatch(/gstatic|connectivitycheck|googleapis/);
        expect(CODE).toMatch(/PROBE_PATH\s*=\s*"\/api\/health"/);
    });

    it("⛔ any http response counts as online, even a 5xx", () => {
        // /api/health returns 500 when an env var is missing. Treating that as
        // offline would let one renamed variable take every client down.
        expect(CODE).toMatch(/return true;/);
        expect(CODE).not.toMatch(/\.status\s*===\s*200|response\.ok/);
    });

    it("only a thrown request means offline", () => {
        expect(CODE).toMatch(/catch[\s\S]{0,40}return false;/);
    });
});
