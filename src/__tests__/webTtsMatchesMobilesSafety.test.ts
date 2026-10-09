/**
 * Web TTS must be as hard to wedge as mobile's.
 *
 * 🔴 U1 and U13 of the 2026-10-09 audit, VERIFIED 2026-10-10 — and both are
 * the WEB TWINS of defects fixed on mobile the same night. That is the point:
 * the two platforms keep separate copies of this machinery, so a fix on one
 * side leaves the other broken until somebody looks.
 *
 * ── U1: autoSpeakText could hang forever ────────────────────────────────
 *     await new Promise<void>((resolve) => {
 *       void playChunkedTTS(text, { signal, onDone: resolve });
 *     });
 *
 * The ONLY resolve path was `onDone`, and playChunkedTTS returns WITHOUT
 * firing onDone on an AbortError. No user action is needed for that:
 * `audio.play()` rejects with AbortError whenever playback is interrupted.
 *
 * ⚠️ And the caller's safety net could not help. speakReplyWithMicShut wraps
 * this in try/finally precisely so "a TTS failure cannot wedge the microphone
 * shut" — but a `finally` never runs if the awaited promise never settles.
 * Identical in spirit to mobile's `.return()` on a suspended generator: a
 * guard that looks complete and cannot fire.
 *
 * ── U13: web had NO TTS timeouts, mobile has had both for months ────────
 *   mobileTTS.ts   TRANSLITERATE_TIMEOUT_MS = 7_000 · CHUNK_FETCH = 20_000
 *   chat/page.tsx  nothing
 *
 * ⛔ And adding them naively would have imported TWO mobile bugs at once:
 * timing out on the SHARED signal poisons every later chunk (U2), and an
 * AbortError from our own timer reads as a user stop (D2).
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const raw = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
/** ⚠️ Comment-stripped. The fix DOCUMENTS the old broken code in a comment, so
 *  a raw-text "this pattern is gone" assertion matches the explanation and
 *  fails on a correct file. Assert against code, never against prose. */
const code = (f: string) =>
  raw(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const WEB = "src/app/chat/page.tsx";
const MOBILE_TTS = "/Users/soumenroy/Projects/imotara-mobile/src/lib/tts/mobileTTS.ts";

describe("🔴 U1 — auto-speak cannot hang", () => {
  const s = raw(WEB);

  it("⛔ it no longer awaits an onDone-only promise", () => {
    expect(code(WEB)).not.toMatch(/void playChunkedTTS\(text, \{ signal: abort\.signal, onDone: resolve/);
  });

  it("🔑 it awaits the function itself, which always settles", () => {
    expect(s).toMatch(/await playChunkedTTS\(text, \{ signal: abort\.signal, emotion \}\)\.catch\(\(\) => \{\}\);/);
  });

  it("⚠️ playChunkedTTS really does always settle — the premise", () => {
    // It must not rethrow out of its own catch, or awaiting it reintroduces
    // the hang in a new disguise.
    // ⚠️ playChunkedTTS is defined AFTER autoSpeakText in this file; slicing
    // between them in source order gave an empty string and a vacuous pass.
    const c = code(WEB);
    const i = c.indexOf("async function playChunkedTTS");
    expect(i).toBeGreaterThan(-1);
    const body = c.slice(i);
    expect(body).toMatch(/\} catch \(err\) \{/);
    // its catch falls through to speechSynthesis and ends with onDone — never a rethrow
    expect(body).toMatch(/onDone\?\.\(\);/);
  });

  it("the caller's finally is still there — belt and braces", () => {
    expect(s).toMatch(/await autoSpeakText\(text, emotion\);\s*\} finally \{/);
    expect(s).toMatch(/speakingRef\.current = false;/);
  });
});

describe("🔴 U13 — both web TTS fetches are bounded, with mobile's numbers", () => {
  const s = raw(WEB);

  it("the constants match mobile exactly", () => {
    expect(s).toMatch(/const TRANSLITERATE_TIMEOUT_MS = 7_000;/);
    expect(s).toMatch(/const CHUNK_FETCH_TIMEOUT_MS = 20_000;/);
    if (fs.existsSync(MOBILE_TTS)) {
      const m = fs.readFileSync(MOBILE_TTS, "utf8");
      expect(m).toMatch(/TRANSLITERATE_TIMEOUT_MS = 7_000;/);
      expect(m).toMatch(/CHUNK_FETCH_TIMEOUT_MS = 20_000;/);
    }
  });

  it("both fetches use an armed signal, not the bare shared one", () => {
    expect(s).toMatch(/armedSignal\(signal, TRANSLITERATE_TIMEOUT_MS\)/);
    expect(s).toMatch(/armedSignal\(signal, CHUNK_FETCH_TIMEOUT_MS\)/);
    expect(s).toMatch(/signal:  tl\.signal,/);
    expect(s).toMatch(/signal:  a\.signal,/);
  });

  it("⛔ each fetch gets its OWN controller — a slow chunk cannot poison later ones", () => {
    // Mobile's U2. Timing out on the shared signal would break every
    // subsequent chunk of the same reply.
    const i = s.indexOf("function armedSignal");
    const fn = s.slice(i, i + 900);
    expect(fn).toMatch(/const ctrl = new AbortController\(\);/);
    expect(fn).toMatch(/parent\.addEventListener\("abort", onParentAbort, \{ once: true \}\)/);
  });

  it("🔑 a TIMEOUT is not mistaken for a user stop", () => {
    // Mobile's D2. The chunk loop returns silently on AbortError, so our own
    // timer must not surface as one or the speechSynthesis fallback is skipped.
    expect(s).toMatch(/if \(a\.timedOut\) throw new Error\(`TTS chunk timed out after \$\{CHUNK_FETCH_TIMEOUT_MS\}ms`\);/);
  });

  it("⚠️ and the timers are always disarmed", () => {
    expect(s).toMatch(/\} finally \{\s*tl\.disarm\(\);/);
    expect(s).toMatch(/\} finally \{\s*a\.disarm\(\);/);
  });

  it("✅ a genuine user stop still propagates to the fetch", () => {
    // Without the parent chaining, pressing stop would no longer cancel an
    // in-flight request — a regression dressed as a fix.
    const i = s.indexOf("function armedSignal");
    expect(s.slice(i, i + 900)).toMatch(/if \(parent\.aborted\) ctrl\.abort\(\);/);
  });
});
