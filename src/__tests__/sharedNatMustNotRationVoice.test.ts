/**
 * A paying user must not lose voice because strangers share their carrier.
 *
 * 🔴 U14 of the 2026-10-09 audit, VERIFIED 2026-10-10.
 *
 * /api/tts is called PER CHUNK, and /api/tts/transliterate shares the very
 * same bucket, so ONE SPOKEN REPLY legitimately costs 3–6 of the allowance.
 * At 40/min that is roughly 7–13 replies per minute FOR THE WHOLE IP.
 *
 * ⚠️ And on carrier-grade NAT — most Indian mobile networks, plus school and
 * office networks — hundreds of unrelated people share one public IP. So a
 * signed-in, paying person could be denied voice because strangers on the same
 * carrier used the budget first. The client then surfaces that 429 as
 * "Couldn't connect — using offline reply", blaming the network for what was
 * actually a quota decision.
 *
 * 🔑 THE LIMIT'S OWN COMMENT SAYS WHAT IT IS FOR: "one script minting many
 * cheap anonymous identities from a single IP". A signed-in non-anonymous
 * person is not that threat — they are already bounded by their account.
 *
 * ⛔ So the fix is NOT "raise the number", which would weaken the guard for
 * the traffic it was written to stop. The strict number moves to where the
 * threat is (anonymous, after auth) and a generous ceiling stays as the cheap
 * pre-auth DoS guard.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const raw = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
const TTS = "src/app/api/tts/route.ts";
const TRANS = "src/app/api/tts/transliterate/route.ts";

describe("🔴 the strict limit now sits where the threat is", () => {
  const s = raw(TTS);

  it("the cheap PRE-auth check uses the generous ceiling", () => {
    expect(s).toMatch(/const IP_CEILING_PER_MIN = 300;/);
    expect(s).toMatch(/checkPersistentIpRateLimit\("tts", ip, IP_CEILING_PER_MIN, 60\)/);
  });

  it("🔑 the strict 40 applies only to ANONYMOUS identities, after auth", () => {
    expect(s).toMatch(/const ANON_IP_RATE_LIMIT_PER_MIN = 40;/);
    const i = s.indexOf("if (user.is_anonymous) {");
    expect(i).toBeGreaterThan(-1);
    expect(s.slice(i, i + 700)).toMatch(
      /checkPersistentIpRateLimit\("tts-anon", ip, ANON_IP_RATE_LIMIT_PER_MIN, 60\)/,
    );
  });

  it("⛔ …on a SEPARATE bucket, or it would just re-share the same budget", () => {
    // "tts-anon" must not be "tts": reusing the bucket would mean anonymous
    // traffic eats the ceiling and the split achieves nothing.
    expect(s).toMatch(/"tts-anon"/);
  });

  it("⚠️ the pre-auth check still runs FIRST and still rejects", () => {
    // The cheap guard must survive. Losing it would let unauthenticated floods
    // reach the auth work they were meant to be rejected before.
    expect(s).toMatch(/if \(!withinRateLimit\) \{\s*return NextResponse\.json\(\{ error: "Too many requests/);
  });

  it("⛔ the anonymous DAILY cap is untouched — it is the real account guard", () => {
    expect(s).toMatch(/const ANONYMOUS_TTS_DAILY_LIMIT = 15;/);
    expect(s).toMatch(/if \(count >= ANONYMOUS_TTS_DAILY_LIMIT\)/);
  });

  it("…and a signed-in user is still required at all", () => {
    expect(s).toMatch(/if \(!user\) return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);/);
  });
});

describe("⚠️ transliterate shares the bucket on purpose, and the same ceiling", () => {
  it("it uses the ceiling, not the old 40", () => {
    const t = raw(TRANS);
    expect(t).toMatch(/const IP_CEILING_PER_MIN = 300;/);
    expect(t).toMatch(/checkPersistentIpRateLimit\("tts", ip, IP_CEILING_PER_MIN, 60\)/);
    expect(t).not.toMatch(/RATE_LIMIT_PER_MIN = 40/);
  });

  it("🔑 it still shares the 'tts' bucket — two calls in one reply, one budget", () => {
    // If these drifted apart, a reply would be counted twice over in two
    // places and the arithmetic above would stop meaning anything.
    expect(raw(TRANS)).toMatch(/checkPersistentIpRateLimit\("tts", /);
  });
});

describe("⚖️ the arithmetic the fix is based on", () => {
  it("one reply costs several requests — that is the whole premise", () => {
    // /api/tts is per chunk: web splits a reply into sentences and fetches
    // each. If that stopped being true, the ceiling could come back down.
    const web = raw("src/app/chat/page.tsx");
    expect(web).toMatch(/async function fetchChunk\(chunkText: string\)/);
    expect(web).toMatch(/const PREFETCH_DEPTH = 2;/);
  });

  it("300 still leaves a real guard: ~50–100 replies/min for one IP", () => {
    const perReplyLow = 3, perReplyHigh = 6;
    expect(Math.floor(300 / perReplyHigh)).toBe(50);
    expect(Math.floor(300 / perReplyLow)).toBe(100);
    // …versus 6–13 before, which a single busy office would exhaust.
    expect(Math.floor(40 / perReplyHigh)).toBe(6);
  });
});
