// #169 — the website uses Google's own sign-in button, with the old redirect as fallback.
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { canUseGis, GIS_HOSTS, GOOGLE_WEB_CLIENT_ID } from "@/components/auth/GoogleIdButton";

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");

describe("Google's own button", () => {
    it("only where Google has been told about the origin", () => {
        expect(canUseGis("www.imotara.com")).toBe(true);
        expect(canUseGis("imotara.com")).toBe(true);
        expect(canUseGis("localhost")).toBe(true);
        // aliases and previews are not registered origins ⇒ the old button
        expect(canUseGis("www.imotara.net")).toBe(false);
        expect(canUseGis("imotaraapp-abc.vercel.app")).toBe(false);
        expect(GIS_HOSTS.size).toBe(3);
    });

    it("uses the same web client Supabase accepts", () => {
        expect(GOOGLE_WEB_CLIENT_ID).toMatch(/^425826097896-980pi64uoif2o4jflm68chlf39lsdbre\.apps\.googleusercontent\.com$/);
    });

    it("sends a hashed nonce to Google and the raw one to Supabase", () => {
        const btn = read("src/components/auth/GoogleIdButton.tsx");
        expect(btn).toMatch(/nonce: hashed/);
        expect(btn).toMatch(/onTokenRef\.current\(r\.credential, raw\)/);
        expect(btn).toMatch(/auto_select: false/);
        const panel = read("src/components/auth/SignInPanel.tsx");
        expect(panel).toMatch(/signInWithIdToken\(\{ provider: "google", token: idToken, nonce: rawNonce \}\)/);
    });

    it("keeps the old Google button as the fallback (never worse than before)", () => {
        const panel = read("src/components/auth/SignInPanel.tsx");
        expect(panel).toMatch(/<GoogleIdButton[^>]*fallback=\{old\}/);
        expect(panel).toMatch(/withProvider\(o\)/);
        const btn = read("src/components/auth/GoogleIdButton.tsx");
        expect(btn).toMatch(/\{!ready && fallback\}/);
    });

    it("the CSP lets Google's button load — and only its /gsi/ path", () => {
        const cfg = read("next.config.ts");
        expect(cfg).toMatch(/script-src[^"]*https:\/\/accounts\.google\.com\/gsi\/client/);
        expect(cfg).toMatch(/style-src[^"]*https:\/\/accounts\.google\.com\/gsi\/style/);
        expect(cfg).toMatch(/connect-src[^"]*https:\/\/accounts\.google\.com\/gsi\//);
        expect(cfg).toMatch(/frame-src[^"]*https:\/\/accounts\.google\.com\/gsi\//);
        expect(cfg).not.toMatch(/https:\/\/accounts\.google\.com[ ";]/);
    });
});
