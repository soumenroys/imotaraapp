import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { aiKeyFor } from "@/lib/imotara/aiKeys";

/**
 * Owner, 26 Oct 2026: separate AI keys per background feature, so each one's
 * cost is visible and cappable, a runaway job can only exhaust its own cap, and
 * a leaked key can be revoked alone. Until a feature key is created, everything
 * keeps using the shared key — shipping this changes nothing by itself.
 */
const KEYS = ["OPENAI_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY_OUTREACH", "GEMINI_API_KEY_SOCIAL"];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

describe("aiKeyFor picks the feature's own key, else the shared one", () => {
    it("no feature ⇒ the shared key (chat replies)", () => {
        process.env.OPENAI_API_KEY = "shared-o";
        process.env.OPENAI_API_KEY_OUTREACH = "own-o";
        expect(aiKeyFor("openai")).toBe("shared-o");
    });

    it("a feature with its own key ⇒ that key", () => {
        process.env.OPENAI_API_KEY = "shared-o";
        process.env.OPENAI_API_KEY_OUTREACH = "own-o";
        expect(aiKeyFor("openai", "outreach")).toBe("own-o");
        process.env.GEMINI_API_KEY = "shared-g";
        process.env.GEMINI_API_KEY_SOCIAL = "own-g";
        expect(aiKeyFor("gemini", "social")).toBe("own-g");
    });

    it("a feature without its own key, or with a blank one ⇒ the shared key", () => {
        process.env.OPENAI_API_KEY = "shared-o";
        delete process.env.OPENAI_API_KEY_OUTREACH;
        expect(aiKeyFor("openai", "outreach")).toBe("shared-o");
        process.env.OPENAI_API_KEY_OUTREACH = "   ";
        expect(aiKeyFor("openai", "outreach")).toBe("shared-o");
    });
});

describe("every background feature names itself; chat never does", () => {
    const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

    it.each([
        ["src/lib/social/writer.ts", "social"],
        ["src/lib/social/trends.ts", "trends"],
        ["src/lib/outreach/writer.ts", "outreach"],
        ["src/lib/broadcast/autoBroadcast.ts", "newsletter"],
    ])("%s passes feature: %s", (file, feature) => {
        expect(read(file)).toContain(`feature: "${feature}"`);
    });

    it("social pictures and animation use the social Gemini key", () => {
        for (const f of ["src/lib/social/illustration.ts", "src/lib/social/animatePicture.ts"]) {
            const src = read(f);
            expect(src).toContain('aiKeyFor("gemini", "social")');
            expect(src).not.toMatch(/process\.env\.GEMINI_API_KEY\b/);
        }
    });

    it("the AI client reads keys only through aiKeyFor", () => {
        const src = read("src/lib/imotara/aiClient.ts");
        expect(src).not.toMatch(/const apiKey = process\.env\.(OPENAI|GEMINI)_API_KEY;/);
        expect(src.match(/aiKeyFor\("openai", options\.feature\)/g)).toHaveLength(2);
        expect(src.match(/aiKeyFor\("gemini", options\.feature\)/g)).toHaveLength(2);
    });

    it("⛔ aiClient.ts is \"use server\": it exports no plain (non-async) function", () => {
        // A sync export there failed the production build on 26 Oct 2026; vitest
        // and tsc both passed. The helper lives in aiKeys.ts instead.
        const src = read("src/lib/imotara/aiClient.ts");
        expect(src).toMatch(/^"use server";/m);
        expect(src).not.toMatch(/^export function /m);
        expect(src).not.toMatch(/^export const \w+ = \(/m);
    });

    it("⛔ chat replies never pass a feature, so they keep the shared key", () => {
        expect(read("src/app/api/chat-reply/route.ts")).not.toMatch(/feature: "(social|trends|outreach|newsletter)"/);
    });
});
