/**
 * LIVE: does the real API accept the exact request this route now builds?
 *
 * 🔑 NOT A UNIT TEST, and deliberately not named *.test.ts so it never runs in
 * CI or on a machine with no key. The unit suite proves the SHAPE of the
 * request; only this proves OpenAI accepts it. The gap between those two is
 * where every bug in this route has lived: `bn` was in a whitelist, every test
 * agreed, and production 400'd on every Bengali turn.
 *
 * Run:  OPENAI_API_KEY=... npx vitest run --config vitest.live.config.ts
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
    STT_PRIMARY, STT_FALLBACK, responseFormatFor, whisperLanguageFor,
    scriptPromptFor, whisperPromptFor, isLikelyHallucination, hasNoSpeech,
    type SttModel,
} from "../app/api/voice/transcribe/route";

const KEY = (() => {
    if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
    const f = path.join(process.env.HOME!, ".imotara/eval.env");
    if (!fs.existsSync(f)) return "";
    const m = /OPENAI_API_KEY\s*=\s*(.+)/.exec(fs.readFileSync(f, "utf8"));
    return m ? m[1].trim() : "";
})();

const CLIPS = "/tmp/stteval";

/**
 * ⚠️ The request body, built from the ROUTE'S OWN exported decisions. Every
 * value here comes from the module under test — nothing is re-derived, so a
 * change in the route changes this request too. (The route's buildForm is a
 * closure over the request and cannot be imported; these are the same four
 * decisions it makes, each read from the route.)
 */
function buildLiveForm(model: SttModel, lang: string, clip: string) {
    const form = new FormData();
    form.append("file", new Blob([fs.readFileSync(path.join(CLIPS, clip))]), "voice.m4a");
    form.append("model", model);
    form.append("response_format", responseFormatFor(model));
    const code = whisperLanguageFor(lang, model);
    if (code) form.append("language", code);
    const name = whisperPromptFor("Imotara");
    const hint = scriptPromptFor(lang, code);
    const prompt = hint ? `${name}. ${hint}` : name;
    form.append("prompt", prompt);
    return { form, prompt, code };
}

async function send(form: FormData) {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST", headers: { Authorization: `Bearer ${KEY}` }, body: form,
    });
    return { status: res.status, body: await res.text() };
}

describe.runIf(KEY)("LIVE — the real API accepts what the route builds", () => {
    it("🔴 Bengali: accepted, and the words are real Bengali", async () => {
        const { form, code, prompt } = buildLiveForm(STT_PRIMARY, "bn", "0_bn.m4a");
        expect(code).toBe("bn");                 // the hint the old model refused
        expect(prompt).toBe("Imotara");          // so no script prompt is needed
        const r = await send(form);
        expect(r.status).toBe(200);
        const text = JSON.parse(r.body).text as string;
        console.log("   bn →", text);
        // The exact non-words whisper-1 produced for this clip.
        expect(text).not.toMatch(/ট্লান/);
        expect(text).not.toMatch(/লাগ্ছে/);
        expect(text).toMatch(/ক্লান্ত/);          // the real word
        expect(isLikelyHallucination(text, prompt)).toBe(false);
    }, 60_000);

    it("🔑 Punjabi: refused by both models, so it rides the script prompt", async () => {
        const { form, code, prompt } = buildLiveForm(STT_PRIMARY, "pa", "0_bn.m4a");
        expect(code).toBeNull();
        expect(prompt).toMatch(/[਀-੿]/);   // Gurmukhi in the prompt
        const r = await send(form);
        expect(r.status).toBe(200);               // ⛔ must NOT 400 — that was the bug
        console.log("   pa →", JSON.parse(r.body).text);
    }, 60_000);

    it("⛔ every app language is ACCEPTED by the primary — no 400s in production", async () => {
        const app = ["en","hi","bn","mr","ta","te","gu","pa","kn","ml","or","ur",
                     "ar","he","ru","zh","ja","es","fr","de","pt","id","auto"];
        const bad: string[] = [];
        for (const lang of app) {
            const { form } = buildLiveForm(STT_PRIMARY, lang, "0_bn.m4a");
            const r = await send(form);
            if (r.status !== 200) bad.push(`${lang}:${r.status}`);
        }
        expect(bad).toEqual([]);
    }, 300_000);

    it("🔴 SILENCE stays silent — the test that rejected gpt-4o-transcribe", async () => {
        for (const clip of ["sil_pure.m4a", "sil_noise.m4a"]) {
            const { form, prompt } = buildLiveForm(STT_PRIMARY, "bn", clip);
            const r = await send(form);
            expect(r.status).toBe(200);
            const j = JSON.parse(r.body);
            const text = (j.text ?? "").trim();
            console.log(`   ${clip} → ${JSON.stringify(text)}  languages=${JSON.stringify(j.languages)}`);
            // Either it says nothing, or a guard catches it. Both are safe;
            // text that survives BOTH is a sentence nobody said.
            const safe = !text || isLikelyHallucination(text, prompt) || hasNoSpeech(j.segments);
            if (!safe) throw new Error(`invented from ${clip}: ${JSON.stringify(text)}`);
        }
    }, 120_000);

    it("⚖️ the FALLBACK still works, with its own format and script prompt", async () => {
        const { form, code, prompt } = buildLiveForm(STT_FALLBACK, "bn", "0_bn.m4a");
        expect(code).toBeNull();                      // whisper-1 refuses bn
        expect(prompt).toMatch(/[ঀ-৿]/);    // so it gets the crutch
        const r = await send(form);
        expect(r.status).toBe(200);
        const j = JSON.parse(r.body);
        expect(Array.isArray(j.segments)).toBe(true); // verbose_json really arrived
        console.log("   fallback bn →", j.text?.trim());
    }, 60_000);
});
