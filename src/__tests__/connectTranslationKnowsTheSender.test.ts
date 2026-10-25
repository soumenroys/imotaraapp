import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { hasMobileRepo, readMobileFile } from "./helpers/siblingRepo";

/**
 * Connect translation needs the SENDER's language (chosen at booking); without
 * it the server guesses from the text, measured wrong ~15% of the time on plain
 * English. 25 Oct 2026:
 *  - mobile never sent sourceLang at all;
 *  - web compared sender_id (an auth user id) with session.consultant_id (the
 *    consultant PROFILE id) — never equal — so every consultant message was guessed.
 */
const WEB = fs.readFileSync(path.join(process.cwd(), "src/app/connect/session/[id]/page.tsx"), "utf8");
const ROUTE = fs.readFileSync(path.join(process.cwd(), "src/app/api/connect/translate/route.ts"), "utf8");

describe("web: the consultant's messages get the consultant's language", () => {
    const fn = () => WEB.slice(WEB.indexOf("function getSenderLang"), WEB.indexOf("function getSenderLang") + 900);

    it("never compares a sender with the consultant PROFILE id", () => {
        expect(fn()).not.toMatch(/senderId === s\.consultantId/);
    });

    it("anyone who is not the user is the consultant", () => {
        expect(fn()).toMatch(/if \(senderId === s\.userId\) return s\.userLang \?\? undefined;/);
        expect(fn()).toMatch(/return s\.consultantLang \?\? undefined;\s*\}/);
    });
});

describe("server: a source language is a hint, never a reason to refuse", () => {
    it("an unrecognised sourceLang falls back to the content guess instead of a 400", () => {
        expect(ROUTE).not.toMatch(/Unsupported sourceLang/);
        expect(ROUTE).toMatch(/const hinted = rawSource !== "auto" && SUPPORTED_LANGS\.includes\(rawSource\);/);
        expect(ROUTE).toMatch(/const sourceLang = hinted \? rawSource : detectScript\(text\);/);
    });
});

(hasMobileRepo() ? describe : describe.skip)("mobile sends the sender's language", () => {
    it("both translate calls pass sourceLang from the sender", () => {
        const src = readMobileFile("src/screens/connect/ConnectScreen.tsx") ?? "";
        const calls = src.match(/sourceLang: senderLang\(/g) ?? [];
        expect(calls.length).toBe(2);
        expect(src).not.toMatch(/JSON\.stringify\(\{ text(: msg\.content)?, targetLang: lang \}\)/);
    });

    it("uses the same two-participant rule as web", () => {
        const src = readMobileFile("src/screens/connect/ConnectScreen.tsx") ?? "";
        expect(src).toMatch(/if \(senderId === session\.user_id\) return session\.user_lang \?\? undefined;\s*return session\.consultant_lang \?\? undefined;/);
    });
});
