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
import { isLikelyHallucination, hasNoSpeech } from "@/app/api/voice/transcribe/route";

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
