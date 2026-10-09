/**
 * U4 and U18: two ways the product reported success while failing.
 *
 * ── U4: the main reply route was SILENT in production ───────────────────
 *     const SHOULD_LOG = !PROD && process.env.NODE_ENV !== "test";
 *
 * The ONE environment where an unhandled error in the primary reply path
 * matters was the one environment that said nothing. The person got
 * `text: ""`, every client fell back to a hard-coded template, and no trace
 * existed anywhere. 🔑 That is how the 2026-10-08 outage ran unnoticed until
 * the owner reported it. /api/respond was worse still — `} catch {`, not even
 * binding the error, logging in NO environment.
 *
 * ── U18: Korean read aloud in an English voice, returned as 200 ─────────
 * resolveVoice falls back to English for any unknown key, and resolveTTSLang
 * really does return "ko-KR" for Hangul. So Korean came back as en-US-Olivia
 * reading Hangul inside xml:lang="en-US" — and the route answered 200 WITH
 * AUDIO.
 *
 * ⚠️ The 200 is the harmful part. Both clients fall back to their own device
 * voice on a non-OK, and a phone or browser very often HAS a Korean voice. By
 * succeeding with gibberish we guaranteed the one outcome worse than failing.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const raw = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const code = (f: string) =>
  raw(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const CHAT = "src/app/api/chat-reply/route.ts";
const RESPOND = "src/app/api/respond/route.ts";
const TTS = "src/app/api/tts/route.ts";
const VOICES = "src/lib/azure-tts/voices.ts";

describe("🔴 U4 — a failed reply leaves a trace in production", () => {
  it("⛔ chat-reply no longer suppresses logs in production", () => {
    const s = code(CHAT);
    expect(s).not.toMatch(/const SHOULD_LOG = !PROD/);
    expect(s).toMatch(/if \(process\.env\.NODE_ENV !== "test"\) \{/);
  });

  it("…and it logs at ERROR, so it surfaces under the error filter", () => {
    expect(code(CHAT)).toMatch(/console\.error\("\[\/api\/chat-reply\] unhandled error/);
  });

  it("🔑 the log says what the USER experienced, not just that it threw", () => {
    // "error: X" is not actionable. "the client will show a template" is.
    expect(code(CHAT)).toMatch(/client will show a template/);
  });

  it("⛔ /api/respond binds its error at all now", () => {
    const s = code(RESPOND);
    expect(s).not.toMatch(/\} catch \{\s*return NextResponse\.json\(\s*\{ ok: false, message: "Something went wrong/);
    expect(s).toMatch(/console\.error\("\[\/api\/respond\] unhandled error/);
  });

  it("⚠️ test stays quiet — suppressing noise THERE was always reasonable", () => {
    for (const f of [CHAT, RESPOND]) {
      expect(code(f)).toMatch(/process\.env\.NODE_ENV !== "test"/);
    }
  });
});

describe("🔴 U18 — no language is read aloud in another language's voice", () => {
  it("an unsupported language is refused, not faked", () => {
    const s = code(TTS);
    expect(s).toMatch(/if \(!\(baseLang in AZURE_VOICES\)\) \{/);
    expect(s).toMatch(/error: "unsupported_language"/);
    expect(s).toMatch(/status: 415/);
  });

  it("🔑 …and it is matched on the BASE tag, since callers send ko-KR not ko", () => {
    // resolveTTSLang returns "ko-KR". Checking the raw value against a table
    // keyed by "ko"/"en" would never match ANY language and 415 everything.
    expect(code(TTS)).toMatch(/const baseLang = String\(lang\)\.slice\(0, 2\)\.toLowerCase\(\);/);
  });

  it("⛔ SAFE FOR ALL 22 — every supported language is in the table", () => {
    // This is the whole reason the 415 is safe. If a supported language were
    // missing here, this change would silence it instead of fixing Korean.
    const v = raw(VOICES);
    const blk = v.slice(v.indexOf("AZURE_VOICES"));
    const table = blk.slice(0, blk.indexOf("\n};"));
    for (const lang of "en hi bn mr ta te gu pa kn ml or ur ar he ru zh ja es fr de pt id".split(" ")) {
      expect(table).toMatch(new RegExp(`\\n\\s+${lang}:\\s*\\{`));
    }
  });

  it("⚠️ Korean genuinely reaches here — resolveTTSLang returns ko-KR", () => {
    // If this stops being true the 415 is unreachable and the bug is back.
    expect(raw("src/app/chat/page.tsx")).toMatch(/return "ko-KR";/);
  });

  it("🔑 both clients turn a non-OK into their DEVICE voice, which is the point", () => {
    expect(raw("src/app/chat/page.tsx")).toMatch(/throw new Error\(`TTS \$\{res\.status\}`\)/);
    const m = "/Users/soumenroy/Projects/imotara-mobile/src/lib/tts/mobileTTS.ts";
    if (fs.existsSync(m)) {
      expect(fs.readFileSync(m, "utf8")).toMatch(/throw new Error\(`TTS API \$\{res\.status\}`\)/);
    }
  });
});
