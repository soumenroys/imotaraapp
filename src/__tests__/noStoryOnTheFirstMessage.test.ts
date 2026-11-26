/**
 * #17 C (26 Nov 2026): stories are meant to start from the 2nd user turn (mythMinTurns: 2),
 * but the ENCOURAGEMENT and HUMOR exceptions let the model tell one on the very first
 * message — 5 of 17 emotional first replies did (live check), more than doubling the reply.
 * 36% of new people never send a 2nd message, so the first reply is presence, not a story.
 * Live check after the fix: 0 of 8 first replies told a story; a 3rd-turn reply still did.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(path.join(process.cwd(), "src/app/api/chat-reply/route.ts"), "utf8");

describe("no story on the first message", () => {
    it("the first message is counted from the user's own turns", () => {
        expect(SRC).toContain("const isFirstUserTurn = userTurnCount <= 1;");
    });

    it("on the first message the story exceptions are replaced by the FIRST MESSAGE RULE", () => {
        expect(SRC).toMatch(/isFirstUserTurn\s*\?\s*"FIRST MESSAGE RULE: [^"]*Do NOT tell a story, myth, parable or anecdote/);
        expect(SRC).toMatch(/isFirstUserTurn\s*\?\s*""\s*:\s*"HUMOR EXCEPTION:/);
    });

    it("…and from the 2nd message on, both exceptions are exactly as before", () => {
        expect(SRC).toContain(": \"ENCOURAGEMENT EXCEPTION: Even in lighter or moderately emotional moments, a brief uplifting story or anecdote can warm the conversation and plant a seed of hope. Use it like a friend who says 'oh, that reminds me of something...'\"");
        expect(SRC).toContain(": \"HUMOR EXCEPTION: A witty parable, a gently ironic story, or a funny historical anecdote can be used to inject levity when someone has been dealing with something difficult across multiple turns. Laughter is also medicine.\"");
    });

    it("advice on the first message may still use a story", () => {
        expect(SRC).toMatch(/FIRST MESSAGE RULE:[^"]*Only exception: they explicitly ask for advice or what to do\./);
    });
});
