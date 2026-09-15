/**
 * The web app must not hear itself.
 *
 * Reported by the owner, 2026-09-15: with hands-free on, Imotara's spoken
 * reply was picked up by its own open microphone, transcribed, auto-sent, and
 * replied to — the app holding a conversation with itself, every turn of it
 * stored as something the person said.
 *
 * Mobile has never had this. It carries three guards (handleMicPress stops TTS
 * before recording; startHandsfreeIfIdle waits while currentSpeakingId() is
 * truthy; reopenMicIfHandsfree runs from speakMessage's onDone), and they were
 * measured working on a real Galaxy A27 on 2026-09-13: play=1 rec=0 for the
 * whole of playback, the mic reopening only once speech ended.
 *
 * The web had NONE of them. `autoSpeakText` never touched the recogniser, the
 * mic was held open by `rec.continuous`, the Chrome silence-timeout restarted
 * it automatically, and anything heard was auto-sent.
 *
 * The first describe runs the turn logic as real code, so the defect is
 * demonstrated rather than asserted about. The rest pin the wiring.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SRC = fs.readFileSync(
    path.join(process.cwd(), "src/app/chat/page.tsx"),
    "utf8",
);

/** Code with comments stripped — assertions must not match prose. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

// ── The loop, run as real logic ────────────────────────────────────────────

interface TurnResult { trace: string[]; cycles: number; runaway: boolean }

/**
 * One hands-free turn, ported from src/app/chat/page.tsx.
 *
 * `micShutWhileSpeaking` is the fix under test: mobile's guarantee that the
 * microphone is not listening while the app is talking.
 */
function runConversation(micShutWhileSpeaking: boolean, maxCycles = 40): TurnResult {
    const trace: string[] = [];
    let analyzing = false;
    let micOpen = true;          // rec.continuous, plus the onend auto-restart
    let cycles = 0;

    const speak = (text: string): string => {
        trace.push(`speak(${text})`);
        if (micShutWhileSpeaking) micOpen = false;
        return text;
    };
    const speechEnded = () => { if (micShutWhileSpeaking) micOpen = true; };

    const send = (text: string): string => {
        analyzing = true;
        const reply = `reply(${text})`;
        const spoken = speak(reply);
        // The real code calls speak with `void` and then clears the guard in a
        // `finally` — so it is already down while the speech is still playing.
        analyzing = false;
        return spoken;
    };

    /** rec.onresult — a transcript arrives from whatever the mic can hear. */
    const heard = (text: string): string | null => {
        if (!micOpen)  { trace.push("(mic shut — not heard)"); return null; }
        if (analyzing) { trace.push("(suppressed: analyzing)"); return null; }
        trace.push(`auto-send(${text})`);
        return send(text);
    };

    let nowPlaying = heard("i feel tired");   // the human speaks, once

    while (nowPlaying && cycles < maxCycles) {
        cycles++;
        const echo = nowPlaying;              // the speaker is playing this…
        nowPlaying = heard(echo);             // …and an open mic hears it
        if (!nowPlaying) speechEnded();
    }
    return { trace, cycles, runaway: cycles >= maxCycles };
}

describe("the conversation the app was having with itself", () => {
    it("without a speaking-guard the turn logic never terminates", () => {
        const r = runConversation(false);
        expect(r.runaway).toBe(true);
        // It heard its own first reply and answered it.
        expect(r.trace[0]).toBe("auto-send(i feel tired)");
        expect(r.trace[2]).toBe("auto-send(reply(i feel tired))");
    });

    it("with the mic shut while speaking, one human turn produces one reply", () => {
        const r = runConversation(true);
        expect(r.runaway).toBe(false);
        expect(r.cycles).toBe(1);
        expect(r.trace).toContain("(mic shut — not heard)");
    });

    it("the `analyzing` flag cannot save it — that is why a real guard is needed", () => {
        // The one guard on the auto-send path is released in a `finally` while
        // the speech is still playing, so the echo always arrives after it is
        // already down. If this ever starts passing without the mic guard,
        // something has changed about when `analyzing` is cleared.
        const r = runConversation(false);
        expect(r.trace).not.toContain("(suppressed: analyzing)");
    });
});

// ── The wiring in chat/page.tsx ────────────────────────────────────────────

describe("the microphone is shut while the app speaks", () => {
    it("there is a speaking flag the recogniser paths can see", () => {
        expect(CODE).toMatch(/speakingRef\s*=\s*useRef\(false\)/);
    });

    it("replies are spoken through the wrapper, never through bare autoSpeakText", () => {
        // Both reply paths (streaming and non-streaming) must go through it.
        expect(CODE).toMatch(/const speakReplyWithMicShut = async \(/);
        // Both reply paths: streaming and non-streaming.
        expect(CODE.match(/void speakReplyWithMicShut\(/g) ?? []).toHaveLength(2);
        // And nothing speaks around the guard any more.
        expect(CODE).not.toMatch(/void autoSpeakText\(/);
    });

    it("the wrapper stops the recogniser before speaking and marks it speaking", () => {
        const i = CODE.indexOf("const speakReplyWithMicShut");
        expect(i).toBeGreaterThan(-1);
        const body = CODE.slice(i, CODE.indexOf("\n  };", i));
        expect(body).toMatch(/speakingRef\.current = true/);
        expect(body).toMatch(/\.stop\(\)/);
        expect(body).toMatch(/await autoSpeakText\(/);
    });

    it("and it clears the flag in a finally, so a throw cannot wedge the mic shut", () => {
        const i = CODE.indexOf("const speakReplyWithMicShut");
        const body = CODE.slice(i, CODE.indexOf("\n  };", i));
        expect(body).toMatch(/finally\s*\{/);
        const fin = body.slice(body.indexOf("finally"));
        expect(fin).toMatch(/speakingRef\.current = false/);
    });
});

describe("the two paths that could re-open the mic mid-speech", () => {
    it("the Chrome silence-restart refuses while speaking", () => {
        // rec.onend fires when Chrome ends the session after ~7s of silence and
        // restarts it. Unguarded, that re-opens the mic in the middle of a
        // reply and the loop resumes.
        expect(CODE).toMatch(/handsfreeRef\.current && recognitionRef\.current === rec && !speakingRef\.current/);
    });

    it("a transcript arriving during speech is refused outright", () => {
        // Belt and braces: even if a guard above regresses, nothing the mic
        // hears while we are talking may be auto-sent as the person's words.
        const i = CODE.indexOf("rec.onresult");
        expect(i).toBeGreaterThan(-1);
        const body = CODE.slice(i, CODE.indexOf("rec.onerror", i));
        expect(body).toMatch(/if \(speakingRef\.current\) return;/);
    });
});

describe("what must NOT break", () => {
    it("hands-free still auto-sends what a person actually said", () => {
        const i = CODE.indexOf("rec.onresult");
        const body = CODE.slice(i, CODE.indexOf("rec.onerror", i));
        expect(body).toMatch(/sendMessageRef\.current\(transcript\.trim\(\)\)/);
    });

    it("the mic still comes back after the reply, or hands-free stops being hands-free", () => {
        const i = CODE.indexOf("const speakReplyWithMicShut");
        const body = CODE.slice(i, CODE.indexOf("\n  };", i));
        // Via the ref, because the wrapper lives outside toggleVoice and
        // cannot see its locals (durSecs, sessionStartMs).
        expect(body).toMatch(/restartSessionRef\.current\?\.\(\)/);
    });

    it("an explicit stop still wins over the post-speech resume", () => {
        // toggleVoice nulls recognitionRef to stop. Resuming must check that
        // the session it is resuming is still the live one.
        const i = CODE.indexOf("const speakReplyWithMicShut");
        const body = CODE.slice(i, CODE.indexOf("\n  };", i));
        expect(body).toMatch(/recognitionRef\.current === rec/);
    });

    it("the durSecs session cap survives a resume (BUG-10A must not regress)", () => {
        // onend re-arms the auto-stop timer with the REMAINING time, precisely
        // so restarts cannot defer the limit forever. The new resume path has
        // to do the same, so the shared helper is used by both.
        expect(CODE).toMatch(/const restartRecognitionSession = \(\) => \{/);
        // The ONE helper is what both paths use: onend calls it directly, and
        // the speech wrapper reaches it through the ref.
        expect(CODE).toMatch(/restartSessionRef\.current = restartRecognitionSession;/);
        const onend = CODE.slice(CODE.indexOf("rec.onend"));
        expect(onend.slice(0, 1200)).toMatch(/restartRecognitionSession\(\);/);
        // And the remaining-time maths lives in it, once.
        const helper = CODE.slice(CODE.indexOf("const restartRecognitionSession"), CODE.indexOf("rec.onend"));
        expect(helper).toMatch(/durSecs \* 1000 - elapsed/);
        expect(CODE.match(/durSecs \* 1000 - elapsed/g) ?? []).toHaveLength(1);
    });
});
