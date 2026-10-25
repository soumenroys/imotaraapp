import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { hasMobileRepo, readMobileFile } from "./helpers/siblingRepo";

/**
 * App Links / Universal Links, step 1 of 2 (owner approved 25 Oct 2026).
 *
 * WHY: on Android, Google sign-in hands the session tokens back through an
 * imotara://auth/callback#… link. Any app can register imotara://, so another
 * app could receive them. A VERIFIED https link can only open the app that owns
 * the domain. Step 1 publishes the proofs and declares the links; step 2 (after
 * 1.6.1 is installed and verified on real phones) moves the handoff to
 * https://www.imotara.com/auth/app-callback with imotara:// kept as fallback.
 *
 * ⛔ www.imotara.com, never the apex: imotara.com 308-redirects to www, and
 *    Android REFUSES to follow redirects when it verifies assetlinks.json.
 * ⛔ Only two narrow paths are claimed, so ordinary imotara.com links people tap
 *    still open the website, not the app.
 */
const pub = (p: string) => fs.readFileSync(path.join(process.cwd(), "public/.well-known", p), "utf8");

describe("the website proves it belongs to the app", () => {
    it("assetlinks.json names the package and the Play app-signing certificate", () => {
        const a = JSON.parse(pub("assetlinks.json"));
        expect(a[0].relation).toEqual(["delegate_permission/common.handle_all_urls"]);
        expect(a[0].target.package_name).toBe("com.imotara.imotara");
        // From Play Console → App integrity → App signing key (25 Oct 2026).
        expect(a[0].target.sha256_cert_fingerprints).toContain(
            "CE:14:BA:1A:43:54:A6:0A:0A:31:D8:87:FB:7E:49:0F:00:69:4E:C2:3F:3B:59:46:A0:FE:ED:71:62:1B:5A:30",
        );
    });

    it("apple-app-site-association names the team + bundle and claims only the two paths", () => {
        const a = JSON.parse(pub("apple-app-site-association"));
        const d = a.applinks.details[0];
        expect(d.appIDs).toEqual(["MY64TKZ69W.com.imotara.imotara"]);
        expect(d.components.map((c: { "/": string }) => c["/"])).toEqual(["/open/*", "/auth/app-callback*"]);
    });

    it("both are served as JSON (the Apple file has no extension)", () => {
        const v = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"));
        const hdr = (src: string) =>
            v.headers.find((h: { source: string }) => h.source === src)?.headers.find((x: { key: string }) => x.key === "Content-Type")?.value;
        expect(hdr("/.well-known/apple-app-site-association")).toBe("application/json");
        expect(hdr("/.well-known/assetlinks.json")).toBe("application/json");
    });
});

(hasMobileRepo() ? describe : describe.skip)("the app claims the same links", () => {
    it("Android: autoVerify intent filter on www.imotara.com for exactly the two paths", () => {
        const app = JSON.parse(readMobileFile("app.json") ?? "{}");
        const f = app.expo.android.intentFilters.find((x: { autoVerify?: boolean }) => x.autoVerify);
        expect(f).toBeTruthy();
        const data = f.data as { scheme: string; host: string; pathPrefix: string }[];
        expect(data.every((d) => d.scheme === "https" && d.host === "www.imotara.com")).toBe(true);
        expect(data.map((d) => d.pathPrefix).sort()).toEqual(["/auth/app-callback", "/open"]);
    });

    it("iOS: associated domain on www.imotara.com", () => {
        const app = JSON.parse(readMobileFile("app.json") ?? "{}");
        expect(app.expo.ios.associatedDomains).toEqual(["applinks:www.imotara.com"]);
    });
});
