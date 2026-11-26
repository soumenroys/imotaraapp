/**
 * #17 B (26 Nov 2026): a reply cut at the length limit used to be shown mid-sentence or
 * mid-word. Now it ends on its last full sentence — and ONLY a cut reply is touched.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { endCleanly } from "@/lib/imotara/response/endCleanly";

describe("endCleanly", () => {
    it("cuts back to the last full sentence", () => {
        // The only sentence end is too early to keep — so the half-word goes and "…" marks the pause.
        expect(endCleanly("You are not alone in this. Some days the mood just dips, and naming it can hel"))
            .toBe("You are not alone in this. Some days the mood just dips, and naming it can…");
        expect(endCleanly("That sounds heavy. It makes sense you feel tired. I wonder if wh"))
            .toBe("That sounds heavy. It makes sense you feel tired.");
    });

    it("leaves a reply that already ends on a sentence alone", () => {
        const done = "That sounds heavy. I'm here with you.";
        expect(endCleanly(done)).toBe(done);
        expect(endCleanly("Are you okay?")).toBe("Are you okay?");
        expect(endCleanly("He said “stay.”")).toBe("He said “stay.”");
    });

    it("works in Hindi and Bengali (danda) and in Chinese", () => {
        expect(endCleanly("ये अकेलापन बहुत भारी है। तुम अकेले नहीं हो। कभी-कभी किसी से बा"))
            .toBe("ये अकेलापन बहुत भारी है। तुम अकेले नहीं हो।");
        expect(endCleanly("মনটা খুব ভারী লাগছে। আমি এখানে আছি। একটু বলো তো কো"))
            .toBe("মনটা খুব ভারী লাগছে। আমি এখানে আছি।");
        expect(endCleanly("我在这里陪你。你不是一个人。有时候说出来会")).toBe("我在这里陪你。你不是一个人。");
    });

    it("never keeps a stub: if the last sentence end is too early, drop only the half-word and add …", () => {
        const out = endCleanly("Okay. Feeling like nobody really sees you can make every single evening stretch out longer than it ha");
        expect(out.endsWith("…")).toBe(true);
        expect(out.length).toBeGreaterThan(60);
        expect(out).not.toMatch(/ ha…$/);
    });

    it("a number or abbreviation is not a sentence end", () => {
        expect(endCleanly("Try breathing for 3.5 minutes, e.g. slowly in and out, until your chest feels ligh"))
            .toMatch(/…$/);
    });
});

describe("wired on both paths, only for cut replies", () => {
    const client = fs.readFileSync(path.join(process.cwd(), "src/lib/imotara/aiClient.ts"), "utf8");
    const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/chat-reply/route.ts"), "utf8");
    const web = fs.readFileSync(path.join(process.cwd(), "src/lib/imotara/respondRemote.ts"), "utf8");

    it("JSON path: trims only when finish_reason is length", () => {
        expect(client).toContain('if (finishReason === "length" && text) text = endCleanly(text);');
    });

    it("stream path: logs the cut and the route sends ONE replace event", () => {
        expect(client).toContain("stream reply TRUNCATED at maxTokens");
        expect(client).toContain("options.onTruncated?.();");
        expect(route).toContain("onTruncated: () => { truncated = true; },");
        expect(route).toMatch(/if \(truncated && streamed\.trim\(\)\) \{\s*const clean = endCleanly\(streamed\);/);
    });

    it("the web chat applies the replace event", () => {
        expect(web).toContain("const { t, replace } = JSON.parse(data)");
        expect(web).toMatch(/fullText = replace;/);
    });
});
