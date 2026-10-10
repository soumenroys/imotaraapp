// src/__tests__/helpers/siblingRepo.ts
/**
 * Reading the OTHER repo from a test, without breaking CI.
 *
 * 🔴 WHY THIS EXISTS. Imotara is two repos with no shared package, so a dozen
 * tests here assert things about `imotara-mobile` — that a regex was synced,
 * that a guard exists on both sides. Those assertions are genuinely valuable:
 * they are the only thing that catches cross-repo drift.
 *
 * ⛔ But four of them hardcoded `/Users/soumenroy/Projects/imotara-mobile/…`,
 * an absolute path that exists on exactly one machine. Three guarded with
 * existsSync first and silently skipped everywhere else. The fourth read the
 * file before checking, so it threw ENOENT — and **CI was red for ~25
 * consecutive runs** because of it, from `7508f30` until this was found in the
 * inbox on 2026-10-10.
 *
 * ⚠️ The guard was WRITTEN, just in the wrong order:
 *
 *     const s = fs.readFileSync("/Users/…/keywordMaps.ts", "utf8");   // throws
 *     if (!gu) { console.warn("SKIPPED — sibling repo not checked out."); return; }
 *
 * 🔑 So the lesson is not "add a guard". It is that a skip-if-absent path
 * nobody ever exercises is not a skip. This helper makes the check impossible
 * to get out of order, because returning the content and checking for absence
 * are the same operation.
 */
import fs from "fs";
import path from "path";

/**
 * The sibling checkout, resolved RELATIVE to this repo.
 *
 * ⚠️ Never an absolute path. The repo is cloned to a different directory on
 * CI, on another machine, and in a worktree; a hardcoded home directory is
 * wrong in all three.
 */
export const MOBILE_REPO = path.resolve(process.cwd(), "..", "imotara-mobile");

/** Is the sibling checkout present at all? */
export function hasMobileRepo(): boolean {
    return fs.existsSync(MOBILE_REPO);
}

/**
 * The contents of a file in the mobile repo, or `null` if it is not there.
 *
 * 🔑 `null` means "could not check", NEVER "the assertion failed". Callers
 * return early on null. Absence is the normal case in CI and must never fail
 * a build; a WRONG value is what these tests exist to catch.
 */
export function readMobileFile(relPath: string): string | null {
    const full = path.join(MOBILE_REPO, relPath);
    try {
        return fs.readFileSync(full, "utf8");
    } catch {
        return null;
    }
}

/**
 * One line, so a skip is visible in the log instead of looking like a pass.
 *
 * ⚠️ A silent skip and a pass are indistinguishable in test output, which is
 * how a cross-repo assertion can quietly stop asserting anything for months.
 */
export function noteSkipped(what: string): void {
    // eslint-disable-next-line no-console
    console.warn(`[sibling-repo] ⚠️ SKIPPED ${what} — imotara-mobile is not checked out beside this repo.`);
}
