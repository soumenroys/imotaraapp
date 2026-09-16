/**
 * Whisper invents speech from silence. These are the real strings it produced.
 *
 * Captured on a Galaxy A27, 2026-09-12, from three recordings of a quiet room.
 * Each one landed in the message box; with auto-send on, each would have been
 * sent to the companion as the user's own words.
 *
 * The second half of this file matters more than the first. Over-rejecting
 * means a person spoke and the app pretended they hadn't — so every plausible
 * quiet, short, or non-English utterance must survive.
 */
import { describe, it, expect } from "vitest";
import { isLikelyHallucination, hasNoSpeech, isPromptEcho, WHISPER_PROMPT, whisperPromptFor } from "@/app/api/voice/transcribe/route";
import fs from "fs";
import path from "path";

describe("the actual hallucinations captured on the phone", () => {
    const REAL = [
        "If you liked it , give it a thumbs up . If you have any questions or suggestions, feel free to comment below . ... .....",
        "This is a video of a cat that was trapped by a dog. It's a dog. It's a dog. It's a dog. It's a dog.",
        "Okay. Okay. Okay.",
    ];
    it.each(REAL)("rejects: %s", (text) => {
        expect(isLikelyHallucination(text)).toBe(true);
    });
});

describe("other well-known Whisper silence output", () => {
    const KNOWN = [
        "Thanks for watching!",
        "Thank you for watching.",
        "Please subscribe to my channel",
        "Don't forget to like and subscribe",
        "See you in the next video",
        "Subtitles by the Amara.org community",
        "you",
        "Bye.",
    ];
    it.each(KNOWN)("rejects: %s", (text) => {
        expect(isLikelyHallucination(text)).toBe(true);
    });
});

describe("REAL speech must survive — a false reject silences someone", () => {
    const REAL_SPEECH = [
        "I have been feeling very anxious about work lately",
        "I don't know",                       // short, but a real answer
        "yes",                                 // one word, still speech
        "I'm okay",
        "Okay, I will try that tomorrow",      // starts with the hallucinated word
        "I feel stuck and I don't know what to do",
        "ami khub valo nei",                   // romanized Bengali
        "आज मन बहुत भारी लग रहा है",              // Hindi
        "মন খারাপ লাগছে",                        // Bengali script
        "no",
        "I think I need to talk to someone about this",
        "It's hard. It's really hard.",        // repetition, but only twice
        "I keep thinking about it again and again",
    ];
    it.each(REAL_SPEECH)("keeps: %s", (text) => {
        expect(isLikelyHallucination(text)).toBe(false);
    });
});

describe("sound-event annotations — a SECOND failure mode, found 2026-09-13", () => {
    /**
     * Captured on the same A27, hands-free, quiet room, 03:35-03:37. These
     * were auto-sent to the companion as the person's own words:
     *
     *     "**Scary music starts playing** keep an eye out.."
     *     "Wheeze"
     *
     * Neither is YouTube boilerplate and neither repeats, so the original two
     * checks let both straight through. This is Whisper ANNOTATING non-speech
     * audio rather than inventing a sentence — a different thing, and in this
     * app a worse one, because the annotation is a truthful description of the
     * room delivered as something the person said.
     *
     * The signal is strong and cheap: a person speaking into a microphone
     * cannot produce an asterisk, a square bracket or a musical note. Those
     * characters only ever come from Whisper marking audio it heard but did
     * not treat as speech — so their presence condemns the whole
     * transcription, residue included, because the residue came out of the
     * same decode of the same non-speech audio.
     */
    const ANNOTATIONS = [
        "**Scary music starts playing** keep an eye out..",  // observed
        "Wheeze",                                            // observed
        "[Music]",
        "[MUSIC PLAYING]",
        "[BLANK_AUDIO]",
        "[Applause]",
        "[silence]",
        "(upbeat music)",
        "(wind blowing)",
        "(sighs)",
        "(inaudible)",
        "*laughs*",
        "**Door creaks**",
        "\u266a\u266a\u266a",
        "\u266a upbeat music playing \u266a",
        "Coughing",
        "[Music] I don't know what to say",  // residue is not trustworthy either
    ];
    it.each(ANNOTATIONS)("rejects: %s", (text) => {
        expect(isLikelyHallucination(text)).toBe(true);
    });
});

describe("bare function words — found in production 2026-09-13, after deploying", () => {
    /**
     * Caught by running hands-free on room noise against the DEPLOYED route.
     * No annotation got through any more, but this did, and was auto-sent:
     *
     *     "the"     -> the companion replied "You left me hanging there with
     *                  'the...' - a classic suspense move, Soumen!"
     *
     * Not boilerplate, not an annotation, not repetition. It is the same shape
     * as the "you" / "bye" entry already in HALLUCINATION_PATTERNS — Whisper
     * emitting a single content-free word from noise — so it is generalised
     * here rather than added as a third one-off.
     *
     * ONLY function words. A one-word answer is common and precious in this
     * app ("tired", "numb", "no"), so the list holds nothing anybody could
     * mean on its own.
     */
    const NOISE = [
        "the", "The.", "  the  ", "a", "an", "and", "of", "to", "but",
        "and the", "of the", "it is", "that is",
    ];
    it.each(NOISE)("rejects: %s", (text) => {
        expect(isLikelyHallucination(text)).toBe(true);
    });
});

describe("but annotation-shaped words inside REAL sentences must survive", () => {
    /**
     * The whole point of the rule above is that the MARKUP is the signal, not
     * the vocabulary. Someone talking about music, coughing or sighing is
     * talking, and this app exists for exactly those sentences.
     */
    const REAL = [
        "Music helps me relax when I feel low",
        "I have been coughing all week and it is wearing me down",
        "I let out a sigh and felt a bit better",
        "There was applause and I still felt alone",
        "I just need some silence today",
        "silence",                              // a plausible one-word answer here
        "breathing",                            // ditto
        "music",                                // ditto
        "I keep thinking about the wind",
        "(I think so)",                         // real parenthetical speech
        "He said (and I quote) that it was fine",
        "My chest feels tight when I laugh",
    ];
    it.each(REAL)("keeps: %s", (text) => {
        expect(isLikelyHallucination(text)).toBe(false);
    });
});

describe("hasNoSpeech — only on strong, unanimous evidence", () => {
    it("rejects when every segment says silence with low confidence", () => {
        expect(hasNoSpeech([
            { no_speech_prob: 0.92, avg_logprob: -0.9 },
            { no_speech_prob: 0.88, avg_logprob: -0.7 },
        ])).toBe(true);
    });

    it("keeps the recording if ANY segment looks like speech", () => {
        // Someone quiet at the start, clear by the end.
        expect(hasNoSpeech([
            { no_speech_prob: 0.95, avg_logprob: -0.9 },
            { no_speech_prob: 0.10, avg_logprob: -0.2 },
        ])).toBe(false);
    });

    it("needs BOTH signals — high no_speech_prob alone is not enough", () => {
        // no_speech_prob runs high on quiet speech; logprob is the corroboration.
        expect(hasNoSpeech([{ no_speech_prob: 0.95, avg_logprob: -0.1 }])).toBe(false);
    });

    it("needs BOTH signals — low confidence alone is not enough", () => {
        // Accented or non-English speech scores poor logprob and is still speech.
        expect(hasNoSpeech([{ no_speech_prob: 0.2, avg_logprob: -0.95 }])).toBe(false);
    });

    it("never rejects when Whisper sent no segment data at all", () => {
        expect(hasNoSpeech(undefined)).toBe(false);
        expect(hasNoSpeech([])).toBe(false);
        expect(hasNoSpeech([{}])).toBe(false);
    });
});

describe("the route asks for the data it needs", () => {
    it("requests verbose_json, without which no segment data exists", async () => {
        const fs = await import("fs");
        const path = await import("path");
        const src = fs.readFileSync(
            path.join(process.cwd(), "src/app/api/voice/transcribe/route.ts"), "utf8");
        expect(src).toContain('whisperForm.append("response_format", "verbose_json")');
        // and actually consults the segments
        expect(src).toMatch(/hasNoSpeech\(json\?\.segments\)/);
    });
});

// ── The Whisper spelling hint, and the hazard it introduces ────────────────

describe("the app's own name is spelled right", () => {
    it("a prompt is sent to Whisper, and it is the product name", () => {
        // Found on a real iPad 2026-09-16: "Hi Imotara, not feeling well
        // today" came back as "Hi Emotara...". Whisper has never heard of the
        // product, so it spells it phonetically into the person's history.
        expect(WHISPER_PROMPT).toBe("Imotara");
        const route = fs.readFileSync(
            path.join(process.cwd(), "src/app/api/voice/transcribe/route.ts"), "utf8");
        // The hint is per-request now (whisperPromptFor), defaulting to the
        // product name — see "a renamed companion is hinted by ITS name".
        expect(route).toMatch(/whisperForm\.append\("prompt", whisperPrompt\)/);
    });

    it("the prompt is ONE word — the smaller the hint, the less it can leak", () => {
        // ⚠️ Whisper emits its prompt verbatim when it hears no speech: the
        // prompt sits in the decoder's context, so on silence the likeliest
        // continuation is the prompt itself. A chatty multi-sentence hint
        // would manufacture whole invented messages.
        expect(WHISPER_PROMPT.trim().split(/\s+/)).toHaveLength(1);
    });
});

describe("a prompt echoed back is not a message", () => {
    it("the bare prompt is rejected", () => {
        expect(isPromptEcho("Imotara")).toBe(true);
        expect(isLikelyHallucination("Imotara")).toBe(true);
    });

    it("case and punctuation do not smuggle it through", () => {
        for (const v of ["imotara", "IMOTARA", " Imotara. ", "Imotara!", "  imotara  "]) {
            expect(isPromptEcho(v)).toBe(true);
        }
    });

    it("⚠️ a REAL sentence containing the name still survives", () => {
        // The reason this is an exact match and not a substring test. Getting
        // this wrong would silently delete genuine messages addressed to the
        // app by name — which is how people actually talk to it.
        for (const real of [
            "Imotara, I feel awful today",
            "Hi Imotara, not feeling well today.",
            "I told Imotara everything",
            "thank you Imotara",
        ]) {
            expect(isPromptEcho(real)).toBe(false);
            expect(isLikelyHallucination(real)).toBe(false);
        }
    });

    it("does not reject other single words", () => {
        // The guard must be about OUR prompt, not about short messages.
        for (const w of ["tired", "exhausted", "lonely"]) {
            expect(isPromptEcho(w)).toBe(false);
        }
    });
});

describe("a renamed companion is hinted by ITS name", () => {
    it("the hint follows the companion's name", () => {
        // Hinting "Imotara" to someone who talks to "Maya" actively mis-hears
        // the one word they are most likely to say to it.
        expect(whisperPromptFor("Maya")).toBe("Maya");
        expect(whisperPromptFor("  Maya ")).toBe("Maya");
    });

    it("falls back to the product name when there is none", () => {
        expect(whisperPromptFor(undefined)).toBe("Imotara");
        expect(whisperPromptFor(null)).toBe("Imotara");
        expect(whisperPromptFor("")).toBe("Imotara");
    });

    it("refuses a multi-word or absurd name — the echo hazard scales with prompt length", () => {
        expect(whisperPromptFor("My dear friend")).toBe("Imotara");
        expect(whisperPromptFor("x".repeat(80))).toBe("Imotara");
    });

    it("the echo guard follows the hint, not the product name", () => {
        expect(isPromptEcho("Maya", "Maya")).toBe(true);
        expect(isLikelyHallucination("Maya", "Maya")).toBe(true);
        // and a real sentence to Maya still survives
        expect(isLikelyHallucination("Maya, I feel awful today", "Maya")).toBe(false);
    });

    it("the route passes the effective hint to BOTH Whisper and the guard", () => {
        const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/voice/transcribe/route.ts"), "utf8");
        expect(route).toMatch(/whisperForm\.append\("prompt", whisperPrompt\)/);
        expect(route).toMatch(/isLikelyHallucination\([a-zA-Z_.]+, whisperPrompt\)/);
        expect(route).toMatch(/whisperPromptFor\(formData\.get\("companionName"\)\)/);
    });
});
