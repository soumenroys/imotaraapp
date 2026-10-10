/**
 * A failure in OUR plumbing must never cost the user their input.
 *
 * 🔴 TWO REAL DEFECTS, both found on 2026-10-09 by reading production logs
 * rather than the code. Both had the same shape: something we control was
 * wrong, and the user paid for it.
 *
 * ── 1. The discarded recording ──────────────────────────────────────────
 * 2026-10-08T18:48:39Z, prod `cb0ee7c`:
 *   [voice/transcribe] Whisper 400: {"error":{"message":"Language 'bn' is
 *   not supported.","code":"unsupported_language","param":"language"}}
 *
 * `bn` WAS in WHISPER_LANGS — the comment above that set asserts "Whisper
 * supports all five", and api.openai.com disagrees. But the whitelist being
 * wrong is the small half. The big half: the route returned 502 and the
 * recording was thrown away. Someone spoke Bengali into a companion whose
 * store listing promises 22 languages, and got nothing.
 *
 * ⛔ Editing the list is a patch — it will drift the next time OpenAI changes
 * theirs, and Odia ("or") is ALREADY excluded for the same reason. The fix is
 * to make a rejected hint non-fatal: drop it, let Whisper auto-detect, and
 * log which code was refused so the list is corrected by evidence.
 *
 * ── 2. The device id in a uuid column ───────────────────────────────────
 *   [resolveUserTier] Error: invalid input syntax for type uuid:
 *   "9c95oyeo5u-muz8zub2"        (14x on /api/history, 2026-10-08)
 *
 * `getScopeFromRequest` has THREE paths. Two return a Supabase user id; the
 * third is an anonymous fallback returning a CLIENT-SUPPLIED device id. The
 * code fed all three to `resolve_user_tier(p_user_id uuid)`.
 *
 * ✅ The OUTCOME was already right — resolveUserTier catches and returns
 * `{ok:false}`, so the tier fell through to "free" and the 7-day retention
 * cutoff applied. **There was no licensing bypass.** This test says so
 * explicitly, because "uuid error in the licensing path" reads like one and
 * the next person should not have to re-derive that it isn't.
 *
 * ⚠️ The harm was noise. Fourteen alarming uuid errors every morning is how a
 * real error gets missed — and one was: the TOTAL AI OUTAGE of the same night
 * sat in that same error list.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const TRANSCRIBE = "src/app/api/voice/transcribe/route.ts";
const HISTORY = "src/app/api/history/route.ts";

describe("🔴 a rejected language hint must not cost the user their recording", () => {
  it("the STT call is factored out so it CAN be retried", () => {
    // ⚠️ RE-POINTED 2026-10-10 for the gpt-transcribe switch, not loosened.
    // `callWhisper` became `callStt` when a second model arrived, and there
    // are now THREE call sites rather than two: the first attempt, the
    // dropped-hint retry, and the fallback to the older model. The invariant
    // is unchanged — one call site would mean no recovery at all.
    const s = stripComments(read(TRANSCRIBE));
    expect(s).toMatch(/async function callStt\(form: FormData\)/);
    const calls = [...s.matchAll(/callStt\(whisperForm\)/g)].length;
    if (calls < 3) throw new Error(`only ${calls} callStt site(s) — a recovery path is gone`);
  });

  it("an unsupported_language 400 drops the hint and retries", () => {
    const s = stripComments(read(TRANSCRIBE));
    expect(s).toMatch(/unsupported_language/);
    // ⚠️ RE-POINTED. The hint used to be removed by mutating the form
    // (`whisperForm.delete("language")`). It is now dropped by REBUILDING the
    // body without it — `buildForm(model, false)` — because falling back also
    // changes the response format and the script prompt, and mutating one
    // field while forgetting another is how the bn failure survived its
    // first fix.
    expect(s).toMatch(/built = buildForm\(model, false\)/);
    expect(s).toMatch(/function buildForm\(model: SttModel, withLanguageHint = true\)/);
  });

  it("⚠️ it only retries when a language was actually SENT", () => {
    // Without this guard a 400 for any other reason would be retried
    // identically — a retry that cannot possibly succeed, costing the user
    // another 55s of waiting for the same failure.
    const s = stripComments(read(TRANSCRIBE));
    expect(s).toMatch(/whisperRes\.status === 400 && whisperForm\.has\("language"\)/);
  });

  it("🔑 the rejected code is logged, so the whitelist is fixed by evidence", () => {
    // ⚠️ RE-POINTED: the message now names the model that refused, because
    // the two models accept DIFFERENT codes and "which list do I edit?" has a
    // different answer for each. langsNameFor supplies that name.
    const s = read(TRANSCRIBE);
    expect(s).toMatch(/rejected language/);
    expect(s).toMatch(/langsNameFor\(model\)/);
  });

  it("🔑 …and the refusal is matched on `param`, which BOTH models set", () => {
    // 🔴 The trap this switch walked straight into. Measured 2026-10-10:
    //   whisper-1       code "unsupported_language", param "language"
    //   gpt-transcribe  code "invalid_value",        param "language"
    // A check on `code` alone would have gone silently inert at the model
    // switch, and the next Punjabi speaker would have lost their recording to
    // a 502 — the exact 2026-10-08 failure, reintroduced by an upgrade.
    const s = stripComments(read(TRANSCRIBE));
    expect(s).toMatch(/errJson\?\.error\?\.param === "language"/);
  });

  it("…and a genuinely failed transcription still reports failure", () => {
    // Degrading gracefully must not become reporting success. If Whisper
    // fails for a real reason, the client still needs the error.
    const s = stripComments(read(TRANSCRIBE));
    expect(s).toMatch(/error: "Transcription failed"/);
    expect(s).toMatch(/error: "quota_exceeded"/);
  });
});

describe("🔴 an anonymous device id must not be treated as a user id", () => {
  it("history checks the scope looks like a uuid before resolving a tier", () => {
    const s = stripComments(read(HISTORY));
    expect(s).toMatch(/looksLikeUserId/);
    expect(s).toMatch(
      /\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}/,
    );
  });

  it("the RPC is skipped — not called and ignored — for a device scope", () => {
    const s = stripComments(read(HISTORY));
    expect(s).toMatch(/looksLikeUserId\s*\?\s*await resolveUserTier\(scope\)/);
  });

  it("✅ and the answer is STILL free, so the 7-day cutoff is unchanged", () => {
    // The point of the fix is zero behaviour change plus zero noise. If this
    // ever stops saying "free", anonymous users have silently gained or lost
    // retention they should not have.
    const s = stripComments(read(HISTORY));
    expect(s).toMatch(/tierResult\.ok \? tierResult\.data\.effectiveTier : "free"/);
    expect(s).toMatch(/historyRetentionCutoff\(tier\)/);
  });

  it("⚠️ getScopeFromRequest really does have a non-uuid path", () => {
    // The premise of the whole fix. If this path ever goes away the guard is
    // pointless — but while it exists, scope is not always a user id.
    const s = stripComments(read(HISTORY));
    expect(s).toMatch(/sanitizeScope\(req\.headers\.get\(USER_SCOPE_HEADER\)\)/);
  });
});
