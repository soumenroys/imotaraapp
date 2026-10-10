/**
 * 🔴 "15 a day" meant three to five spoken replies.
 *
 * ANONYMOUS_TTS_DAILY_LIMIT counts /api/tts REQUESTS, and a reply is split
 * into 3-4 chunks with each chunk its own request. So an anonymous person got
 * 3-5 spoken replies per day, after which the route returned 429 and the
 * client silently fell back to the DEVICE voice.
 *
 * That is what was reported from a physical iPhone 2026-10-10: the voice went
 * faint, badly pronounced and expressionless after a handful of replies. It
 * was not a speech bug at all — it was this quota, exhausted four times
 * faster than its number suggests.
 *
 * Owner decision the same day: "make it 15 replies per free user for now."
 *
 * ⚖️ FAILS SAFE. A client that sends no chunkIndex — every build already in
 * the wild — is counted exactly as before. Only a client that explicitly says
 * "chunk 2 of a reply I already started" is skipped, so nothing becomes
 * cheaper by accident.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const TTS = "src/app/api/tts/route.ts";
const WEB = "src/app/chat/page.tsx";

/** The server's rule, read from the server. */
function counts(chunkIndex: unknown): boolean {
    const src = read(TTS);
    expect(src).toMatch(/typeof body\.chunkIndex === "number" \? body\.chunkIndex === 0 : true/);
    return typeof chunkIndex === "number" ? chunkIndex === 0 : true;
}

describe("🔴 one unit per reply, not per chunk", () => {
    it("the first chunk of a reply counts", () => {
        expect(counts(0)).toBe(true);
    });

    it("⛔ later chunks of the SAME reply do not", () => {
        for (const i of [1, 2, 3, 7]) expect(counts(i), `chunk ${i}`).toBe(false);
    });

    it("⇒ a 4-chunk reply costs ONE unit, so 15 means 15 replies", () => {
        const spent = [0, 1, 2, 3].filter(counts).length;
        expect(spent).toBe(1);
        expect(15 / spent).toBe(15);
    });
});

describe("⚖️ it fails safe — nothing becomes cheaper by accident", () => {
    it("a request with NO chunkIndex still counts, as it always did", () => {
        // Every build in the wild sends nothing. They must be unaffected.
        expect(counts(undefined)).toBe(true);
    });

    it("…and so does a malformed one", () => {
        for (const v of [null, "0", {}, [], true]) {
            expect(counts(v), String(v)).toBe(true);
        }
    });

    it("the quota check and the limit itself are unchanged", () => {
        const src = read(TTS);
        expect(src).toMatch(/const ANONYMOUS_TTS_DAILY_LIMIT = 15;/);
        expect(src).toMatch(/count >= ANONYMOUS_TTS_DAILY_LIMIT/);
    });

    it("⛔ only ANONYMOUS identities are counted at all", () => {
        // A signed-in person has no TTS quota — which is what fixed this for
        // the owner on the day it was reported.
        expect(read(TTS)).toMatch(/if \(user\.is_anonymous && isFirstChunkOfReply\)/);
    });
});

describe("both clients send it", () => {
    it("web sends chunkIndex with every chunk", () => {
        const w = read(WEB);
        expect(w).toMatch(/async function fetchChunk\(chunkText: string, chunkIndex: number\)/);
        expect(w).toMatch(/text: chunkText, lang, gender, chunkIndex/);
        expect(w).toMatch(/fetchChunk\(chunks\[i\], i\)/);
        expect(w).toMatch(/fetchChunk\(chunks\[nextIndex\], nextIndex\)/);
    });

    it("⛔ the index passed is the real position, not a constant", () => {
        // Passing 0 everywhere would make every chunk count as a new reply —
        // the bug, restored. Passing a non-zero constant would make the quota
        // unreachable.
        const w = read(WEB);
        expect(w).not.toMatch(/fetchChunk\(chunks\[i\], 0\)/);
        expect(w).not.toMatch(/fetchChunk\(chunks\[nextIndex\], 0\)/);
    });
});
