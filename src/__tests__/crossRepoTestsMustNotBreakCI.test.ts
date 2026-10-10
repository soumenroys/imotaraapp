/**
 * A test that reads the OTHER repo must SKIP in CI, not fail it.
 *
 * 🔴 CI WAS RED FOR ~25 CONSECUTIVE RUNS and nobody noticed until the failure
 * email turned up in the inbox on 2026-10-10. The cause was one line added in
 * `7508f30`:
 *
 *     const s = fs.readFileSync(
 *       "/Users/soumenroy/Projects/imotara-mobile/src/lib/emotion/keywordMaps.ts", "utf8");
 *     if (!gu) { console.warn("SKIPPED — sibling repo not checked out."); return; }
 *
 * ⚠️ The skip was WRITTEN. It was just after the read, so `readFileSync` threw
 * ENOENT and the guard was never reached. On the author's machine the file
 * exists, so the broken branch was never once executed.
 *
 * 🔑 THE REAL LESSON, and why this file exists rather than just a fix: a
 * skip-if-absent path that nobody ever exercises is not a skip. Three sibling
 * tests had the guard in the right order and quietly did nothing on CI for
 * months; the fourth had it in the wrong order and broke the build. Both
 * outcomes come from the same thing — an absolute home-directory path and a
 * branch that only runs on one machine.
 *
 * ⛔ Every claim of "CI green" between 7508f30 and 2026-10-10 was false.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { readMobileFile, hasMobileRepo, MOBILE_REPO } from "./helpers/siblingRepo";

const TESTS_DIR = path.join(process.cwd(), "src/__tests__");

function everyTestFile(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (/\.(test|live)\.tsx?$/.test(e.name) || e.name.endsWith(".ts")) out.push(full);
        }
    };
    walk(TESTS_DIR);
    return out;
}

describe("🔑 the helper's ABSENCE path is exercised, not just written", () => {
    it("a missing file returns null instead of throwing", () => {
        // This is the exact code path CI takes: the whole sibling directory is
        // absent, readFileSync raises ENOENT, and the caller must get null.
        expect(readMobileFile("does/not/exist/anywhere.ts")).toBeNull();
    });

    it("a missing DIRECTORY returns null too", () => {
        expect(readMobileFile("no_such_dir/no_such_file.ts")).toBeNull();
    });

    it("…and a real file comes back as a string when the sibling IS present", () => {
        if (!hasMobileRepo()) {
            // Honest: on CI there is nothing to assert here.
            expect(readMobileFile("package.json")).toBeNull();
            return;
        }
        const pkg = readMobileFile("package.json");
        expect(typeof pkg).toBe("string");
        expect(pkg).toContain("imotara");
    });

    it("⛔ the path is DERIVED from cwd, not written down", () => {
        // ⚠️ MY OWN FIRST VERSION OF THIS ASSERTED `not.toMatch(/^\/Users\//)`
        // on the resolved value — and failed, correctly. On this machine
        // path.resolve(cwd, "..", "imotara-mobile") IS under /Users; that is
        // the right answer. The defect was never the VALUE, it was writing
        // the value down. So check the helper's source, not its output.
        expect(path.isAbsolute(MOBILE_REPO)).toBe(true);
        expect(MOBILE_REPO).toMatch(/imotara-mobile$/);
        expect(MOBILE_REPO).toBe(path.resolve(process.cwd(), "..", "imotara-mobile"));

        const helper = fs.readFileSync(
            path.join(TESTS_DIR, "helpers/siblingRepo.ts"), "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
        expect(helper).not.toMatch(/["'`]\/Users\//);
        expect(helper).toMatch(/path\.resolve\(process\.cwd\(\), "\.\.", "imotara-mobile"\)/);
    });
});

describe("⛔ no test may hardcode a machine-specific path", () => {
    it("nothing under src/__tests__ contains an absolute /Users/ path", () => {
        const offenders: string[] = [];
        for (const f of everyTestFile()) {
            const src = fs.readFileSync(f, "utf8");
            // Strip comments: the history above is allowed to QUOTE the old path.
            const code = src
                .replace(/\/\*[\s\S]*?\*\//g, "")
                .replace(/^\s*\/\/.*$/gm, "");
            if (/["'`]\/Users\//.test(code)) offenders.push(path.relative(process.cwd(), f));
        }
        if (offenders.length) {
            throw new Error(
                "these tests hardcode an absolute home-directory path, which is wrong on CI, " +
                "on another machine and in a worktree:\n  " + offenders.join("\n  "),
            );
        }
    });

    it("🔑 …and every sibling-repo read goes through the helper", () => {
        // The other half: a correctly-guarded raw readFileSync still leaves the
        // order-of-operations trap open for the next edit.
        const offenders: string[] = [];
        for (const f of everyTestFile()) {
            if (f.endsWith("helpers/siblingRepo.ts")) continue;
            const code = fs.readFileSync(f, "utf8")
                .replace(/\/\*[\s\S]*?\*\//g, "")
                .replace(/^\s*\/\/.*$/gm, "");
            if (!/imotara-mobile/.test(code)) continue;
            const usesHelper = /from "\.\.?\/?.*helpers\/siblingRepo"/.test(code)
                || /readMobileFile|MOBILE_REPO|hasMobileRepo/.test(code);
            // path.join(..., "imotara-mobile", ...) built relatively is also fine.
            const relativeJoin = /path\.(join|resolve)\([^)]*imotara-mobile/.test(code)
                || /"\.\.", *"imotara-mobile"/.test(code);
            if (!usesHelper && !relativeJoin) offenders.push(path.relative(process.cwd(), f));
        }
        if (offenders.length) {
            throw new Error(
                "these tests reach into imotara-mobile without the siblingRepo helper " +
                "or a relative path join:\n  " + offenders.join("\n  "),
            );
        }
    });
});

describe("⚠️ all five known call sites, pinned", () => {
    it.each([
        ["englishIsNotGujarati",       "readMobileFile("],
        ["webTtsMatchesMobilesSafety", "MOBILE_REPO"],
        ["noPaidWorkThatCannotBeUsed", "MOBILE_REPO"],
        ["anOutageIsNotAnEmptyAnalysis", "MOBILE_REPO"],
        // 🔑 The FIFTH, which my own grep missed and this file's guard found.
        ["aFailureMustLeaveATrace",      "MOBILE_REPO"],
    ])("%s uses the helper", (name, marker) => {
        const src = fs.readFileSync(path.join(TESTS_DIR, `${name}.test.ts`), "utf8");
        expect(src).toContain(marker);
    });

    it("🔴 the one that broke CI now checks BEFORE it reads", () => {
        const src = fs.readFileSync(path.join(TESTS_DIR, "englishIsNotGujarati.test.ts"), "utf8");
        const read = src.indexOf('readMobileFile("src/lib/emotion/keywordMaps.ts")');
        const guard = src.indexOf("if (s === null)");
        expect(read).toBeGreaterThan(-1);
        expect(guard).toBeGreaterThan(read);   // guard immediately after, on the RESULT
        expect(src).not.toMatch(/fs\.readFileSync\(\s*$/m);
    });
});
