/**
 * #48 (27 Nov 2026): an Odia voice message came back as "ଆଜି ମୋତে ବହୁତ ଲାଗୁଛে।" — Bengali
 * vowel signs inside Odia words. repairOdiaScript maps stray Bengali characters to their
 * Odia twins, ONLY in mostly-Odia text. Bengali text must never change.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { repairOdiaScript } from "@/lib/voice/odiaScriptRepair";

describe("Odia transcripts lose their stray Bengali letters", () => {
    it("the transcript seen live on 27 Nov", () => {
        expect(repairOdiaScript("ଆଜି ମୋତে ବହୁତ ଲାଗୁଛে।")).toBe("ଆଜି ମୋତେ ବହୁତ ଲାଗୁଛେ।");
    });
    it("a whole stray Bengali consonant + sign", () => {
        expect(repairOdiaScript("ମୁଁ ବହୁତ କ୍ଲାন্ତ")).toBe("ମୁଁ ବହୁତ କ୍ଲାନ୍ତ");
    });
    it("digits too", () => {
        expect(repairOdiaScript("ଆଜି ৩ ଦିନ ହେଲା")).toBe("ଆଜି ୩ ଦିନ ହେଲା");
    });
});

describe("⛔ never touches what it should not", () => {
    it("Bengali text is unchanged", () => {
        for (const t of ["আজ আমার খুব ক্লান্ত লাগছে।", "আমি ভালো আছি", "রাতে ঘুম আসছে না"]) {
            expect(repairOdiaScript(t)).toBe(t);
        }
    });
    it("pure Odia, other scripts and empty text are unchanged", () => {
        for (const t of ["ଆଜି ମୋତେ ବହୁତ କ୍ଲାନ୍ତ ଲାଗୁଛି", "I feel tired", "मैं थका हूँ", ""]) {
            expect(repairOdiaScript(t)).toBe(t);
        }
    });
    it("Assamese ra (ৰ) is not turned into the Odia isshar symbol", () => {
        expect(repairOdiaScript("ଆଜି ମୋତେ ବହୁତ ৰ")).toContain("ৰ");
    });
});

describe("wired into the transcription route, on the final text only", () => {
    const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/voice/transcribe/route.ts"), "utf8");
    it("the normal return passes through the repair", () => {
        expect(route).toContain("return NextResponse.json({ text: repairOdiaScript(rawText) });");
    });
    it("the no-speech path still returns empty text", () => {
        expect(route).toContain('return NextResponse.json({ text: "", discarded: "no_speech" });');
    });
});
