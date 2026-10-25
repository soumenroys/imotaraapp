import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { runLocalAnalysis } from "@/lib/imotara/runLocalAnalysis";
import { EN_FELT_HEAVY_RE, EN_FELT_A_LOT_RE } from "@/lib/emotion/keywordMaps";

/**
 * 🔴 From 14 Nov 2025 to 25 Oct 2026 every web message was saved to History as
 * NEUTRAL: logUserMessageToHistory read `summary.primaryEmotion`, a field the
 * analyser's MoodSummary never had ({ headline, details }). Trends, the radar
 * and the emotional-history summary saw nothing on web.
 */
const SRC = fs.readFileSync(path.join(process.cwd(), "src/app/chat/page.tsx"), "utf8");
const logger = () => SRC.slice(SRC.indexOf("async function logUserMessageToHistory"), SRC.indexOf("const payload: any = {", SRC.indexOf("async function logUserMessageToHistory")));

describe("web History records the mood", () => {
    it("reads the per-message dominant tag — never the summary, which has no emotion", () => {
        expect(logger()).toMatch(/res\?\.perMessage\?\.\[0\]\?\.dominant/);
        expect(logger()).not.toMatch(/summary\?\.primaryEmotion/);
    });

    it("the analyser really does put the emotion there (the field this reads exists)", async () => {
        const r = await runLocalAnalysis([{ id: "1", role: "user", content: "I feel sad today", createdAt: Date.now() }] as never, 1);
        expect(r.perMessage[0].dominant.emotion).toBe("sadness");
        expect((r.summary as Record<string, unknown>).primaryEmotion).toBeUndefined();
    });

    it("falls back to the felt-phrase patterns the single-word analyser cannot see", () => {
        const l = logger();
        expect(l).toMatch(/else if \(EN_FELT_HEAVY_RE\.test\(text\)\) \{\s*\/\/[^\n]*\n\s*emotion = "sadness";/);
        expect(l).toMatch(/else if \(EN_FELT_A_LOT_RE\.test\(text\)\) \{\s*emotion = "fear";/);
    });

    it("maps the analyser's 'anxiety' to History's 'fear' bucket", () => {
        expect(logger()).toMatch(/dominant\?\.emotion === "anxiety" \? "fear"/);
    });

    it("the two real messages are caught", () => {
        expect(EN_FELT_HEAVY_RE.test("Long day. I feel heavy and I can't really say why.")).toBe(true);
        expect(EN_FELT_HEAVY_RE.test("Work has been a lot lately and I feel like I'm not doing enough.")).toBe(true);
        expect(EN_FELT_A_LOT_RE.test("Work has been a lot lately")).toBe(true);
    });

    it("the mood line uses the same patterns", () => {
        const fn = SRC.slice(SRC.indexOf("function getLocalMoodHint("), SRC.indexOf("function getLocalMoodHint(") + 4000);
        expect(fn).toMatch(/isSadText\(raw\) \|\| EN_FELT_HEAVY_RE\.test\(raw\)/);
        expect(fn).toMatch(/isStressText\(raw\) \|\| EN_FELT_A_LOT_RE\.test\(raw\)/);
    });
});
