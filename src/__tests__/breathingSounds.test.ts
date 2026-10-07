import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

const WEB = path.join(__dirname, "..", "..");
const MOBILE = path.join(WEB, "..", "imotara-mobile");

const WEB_SOUNDS = path.join(WEB, "public", "sounds");
const MOBILE_SOUNDS = path.join(MOBILE, "assets", "sounds");
const TRACKS = ["rain", "ocean", "bowl"] as const;

/**
 * 🔴 THIS FILE READS THE SIBLING REPO, AND CI ONLY CHECKS OUT THIS ONE.
 *
 * Every mobile path below resolves to ../imotara-mobile, which exists on a
 * developer's machine and does NOT exist on the runner. The cross-repo
 * assertions therefore threw ENOENT in CI while passing locally — the test was
 * green for everyone who could run it and red for the only thing that gates
 * merges. It is one of ten web tests that read the mobile repo; the other nine
 * already guard, this one asserted `existsSync(...) === true` and then read the
 * file at describe-collection time, which crashes before any `it` can skip.
 *
 * Same loud-skip idiom as tierFeatureParity: the web half keeps running in CI,
 * the cross-repo half announces that it did not.
 */
const MOBILE_PRESENT = fs.existsSync(MOBILE);
const crossRepo = (what: string) => {
    if (!MOBILE_PRESENT) {
        console.warn(
            `[breathingSounds] ⚠️ SKIPPED ${what}: ${MOBILE} is not checked out. ` +
            "This guard only has teeth when both repos sit side by side.",
        );
    }
    return MOBILE_PRESENT;
};

/**
 * The three breathing ambiences exist TWICE — web serves them from
 * public/sounds, mobile bundles assets/sounds — and that is exactly how they
 * drifted: 43eadd8 replaced the warbling rain loop in mobile on 2026-09-10 and
 * web kept the old file, so web users went on hearing the bug an intern had
 * already reported. Same class as the two settings catalogs.
 *
 * These tests fail if the pair ever diverges again.
 */
describe("the same audio ships on both platforms", () => {
    it.each(TRACKS)("%s.mp3 is byte-identical on web and mobile", (track) => {
        if (!crossRepo(`${track}.mp3 byte-compare`)) return;
        const web = fs.readFileSync(path.join(WEB_SOUNDS, `${track}.mp3`));
        const mob = fs.readFileSync(path.join(MOBILE_SOUNDS, `${track}.mp3`));
        expect(web.equals(mob)).toBe(true);
    });

    it.each(TRACKS)("%s.mp3 exists on web, and on mobile when it is checked out", (track) => {
        // The web side runs everywhere — that half is not cross-repo.
        expect(fs.existsSync(path.join(WEB_SOUNDS, `${track}.mp3`))).toBe(true);
        if (!crossRepo(`${track}.mp3 presence on mobile`)) return;
        expect(fs.existsSync(path.join(MOBILE_SOUNDS, `${track}.mp3`))).toBe(true);
    });
});

describe("bundle size stays defensible", () => {
    it("the three tracks together stay well under the as-supplied 29.8 MB", () => {
        // The owner's source files were ~10 MB each at 256 kbps. Re-encoded to
        // 96k (rain, ocean) and 128k (bell — the only tonal source, where MP3
        // artifacts are audible) they come to ~11.9 MB. This is a ceiling, not
        // a target: it exists so nobody drops 256 kbps masters back in.
        if (!crossRepo("the mobile bundle-size floor/ceiling")) return;
        const total = TRACKS.reduce(
            (n, t) => n + fs.statSync(path.join(MOBILE_SOUNDS, `${t}.mp3`)).size,
            0
        );
        expect(total).toBeLessThan(16 * 1024 * 1024);
        // and a floor, so nobody silently reverts to the old thin files
        expect(total).toBeGreaterThan(8 * 1024 * 1024);
    });
});

describe('the track is labelled "Bell", not "Bowl"', () => {
    const webWidget = fs.readFileSync(
        path.join(WEB, "src", "components", "imotara", "BreathingWidget.tsx"),
        "utf8"
    );
    // ⛔ Was a bare readFileSync here. It runs at describe-COLLECTION time, so it
    // threw before any `it` could decide to skip — which is why this file alone
    // failed CI while the other nine cross-repo tests passed.
    const MODAL = path.join(MOBILE, "src", "components", "imotara", "BreathingModal.tsx");
    const mobileModal = MOBILE_PRESENT && fs.existsSync(MODAL)
        ? fs.readFileSync(MODAL, "utf8")
        : null;

    it("web shows Bell", () => {
        expect(webWidget).toMatch(/label:\s*"Bell"/);
        expect(webWidget).not.toMatch(/label:\s*"Bowl"/);
    });

    it("mobile shows Bell", () => {
        if (!crossRepo("the mobile Bell label")) return;
        expect(mobileModal).toMatch(/label:\s*"Bell"/);
        expect(mobileModal).not.toMatch(/label:\s*"Bowl"/);
    });

    it("the id stays 'bowl' on both — on web the id IS the asset URL", () => {
        // Renaming the id would mean renaming files on both platforms for no
        // user-visible gain. Nothing persists the selection, so there is also
        // no stored value that would need migrating.
        expect(webWidget).toMatch(/id:\s*"bowl"/);
        expect(webWidget).toMatch(/\/sounds\/\$\{track\}\.mp3/);
        if (!crossRepo("the mobile 'bowl' id")) return;
        expect(mobileModal).toMatch(/id:\s*"bowl"/);
    });

    it("user-facing docs say Bell too — tutorial and the help KB", () => {
        // tutorial_sync_rule: docs must move with the feature.
        const tutorial = fs.readFileSync(
            path.join(WEB, "src", "app", "tutorial", "page.tsx"),
            "utf8"
        );
        expect(tutorial).not.toMatch(/Singing Bowl/);
        expect(tutorial).toMatch(/Bell/);

        const helpMd = fs.readFileSync(
            path.join(WEB, "src", "content", "help", "getting-started.md"),
            "utf8"
        );
        expect(helpMd).toContain("Silent, Bell, Rain, Ocean");

        // helpKb.json is GENERATED from the markdown by build-help-kb.mjs —
        // if this fails, the generator was not re-run.
        const kb = fs.readFileSync(
            path.join(WEB, "src", "content", "help", "helpKb.json"),
            "utf8"
        );
        expect(kb).toContain("Silent, Bell, Rain, Ocean");
        expect(kb).not.toContain("Silent, Bowl, Rain, Ocean");
    });
});
