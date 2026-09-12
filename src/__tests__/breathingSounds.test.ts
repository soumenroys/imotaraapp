import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

const WEB = path.join(__dirname, "..", "..");
const MOBILE = path.join(WEB, "..", "imotara-mobile");

const WEB_SOUNDS = path.join(WEB, "public", "sounds");
const MOBILE_SOUNDS = path.join(MOBILE, "assets", "sounds");
const TRACKS = ["rain", "ocean", "bowl"] as const;

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
        const web = fs.readFileSync(path.join(WEB_SOUNDS, `${track}.mp3`));
        const mob = fs.readFileSync(path.join(MOBILE_SOUNDS, `${track}.mp3`));
        expect(web.equals(mob)).toBe(true);
    });

    it.each(TRACKS)("%s.mp3 exists on both sides at all", (track) => {
        expect(fs.existsSync(path.join(WEB_SOUNDS, `${track}.mp3`))).toBe(true);
        expect(fs.existsSync(path.join(MOBILE_SOUNDS, `${track}.mp3`))).toBe(true);
    });
});

describe("bundle size stays defensible", () => {
    it("the three tracks together stay well under the as-supplied 29.8 MB", () => {
        // The owner's source files were ~10 MB each at 256 kbps. Re-encoded to
        // 96k (rain, ocean) and 128k (bell — the only tonal source, where MP3
        // artifacts are audible) they come to ~11.9 MB. This is a ceiling, not
        // a target: it exists so nobody drops 256 kbps masters back in.
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
    const mobileModal = fs.readFileSync(
        path.join(MOBILE, "src", "components", "imotara", "BreathingModal.tsx"),
        "utf8"
    );

    it("web shows Bell", () => {
        expect(webWidget).toMatch(/label:\s*"Bell"/);
        expect(webWidget).not.toMatch(/label:\s*"Bowl"/);
    });

    it("mobile shows Bell", () => {
        expect(mobileModal).toMatch(/label:\s*"Bell"/);
        expect(mobileModal).not.toMatch(/label:\s*"Bowl"/);
    });

    it("the id stays 'bowl' on both — on web the id IS the asset URL", () => {
        // Renaming the id would mean renaming files on both platforms for no
        // user-visible gain. Nothing persists the selection, so there is also
        // no stored value that would need migrating.
        expect(webWidget).toMatch(/id:\s*"bowl"/);
        expect(mobileModal).toMatch(/id:\s*"bowl"/);
        expect(webWidget).toMatch(/\/sounds\/\$\{track\}\.mp3/);
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
