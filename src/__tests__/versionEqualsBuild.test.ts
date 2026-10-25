import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { readMobileFile } from "./helpers/siblingRepo";

/**
 * Owner, 26 Oct 2026: version x.y.z ⇒ build number xyz, the same on web, iOS and
 * Android; z is never more than 9 (1.6.9 → 1.7.0, never 1.6.10).
 */
const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));

describe("one version, one build number, everywhere", () => {
    const digits = String(pkg.version).split(".").join("");

    it("version is x.y.z with every part a single digit", () => {
        expect(pkg.version).toMatch(/^\d\.\d\.\d$/);
    });

    it("buildNumber is the version's digits", () => {
        expect(pkg.buildNumber).toBe(digits);
    });

    const mobileApp = readMobileFile("app.json");
    (mobileApp ? it : it.skip)("iOS and Android say the same version and build", () => {
        const app = JSON.parse(mobileApp ?? "{}").expo;
        expect(app.version).toBe(pkg.version);
        expect(app.ios.buildNumber).toBe(digits);
        expect(String(app.android.versionCode)).toBe(digits);
    });
});
