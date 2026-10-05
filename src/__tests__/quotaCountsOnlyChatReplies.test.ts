/**
 * The free daily allowance is 20 CHAT REPLIES, not 20 events.
 *
 * 🔴 WHY THIS EXISTS. `usage_events` is written by four routes — chat_reply,
 * tts, voice_transcribe and settings_search — and until 2026-10-05 the chat
 * quota counter selected ALL of them for the day. So the advertised "20 cloud
 * AI replies per day" was really 20 events of any kind: listening to a reply
 * aloud, or dictating a message, silently spent the replies someone was
 * promised.
 *
 * Measured on production over 30 days: 422 chat_reply against 360 others
 * (tts 210, voice_transcribe 79, settings_search 71) — 46% of quota-consuming
 * events were not chat replies. A voice-heavy free user lost roughly half of
 * what we publish on the pricing page, in the KB, and in the JSON-LD served
 * to Google.
 *
 * It was never a deliberate design: tts, voice/transcribe and settings-search
 * each already filter to their OWN event_type for their own limits. The chat
 * counter was the only one that did not. Per-feature counters are the design;
 * this restores it.
 *
 * ⚠️ These are source-level assertions on purpose. The alternative is standing
 * up Supabase to prove a `.eq()` is present, which tests the mock rather than
 * the route. The property that matters here is structural: every quota counter
 * names the event type it is counting.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

/**
 * Strip comments before matching. Two reasons: the explanatory note inside the
 * chat quota query is longer than the query itself, and a comment that merely
 * MENTIONS tts would otherwise look like the counter counting tts rows.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Every head/count query against usage_events in a file, comments removed. */
function countingQueries(src: string): string[] {
  const clean = stripComments(src);
  return [...clean.matchAll(/\.from\("usage_events"\)([\s\S]{0,800}?);/g)]
    .map((m) => m[1])
    .filter((block) => block.includes('count: "exact"'));
}

/** The quota counters, and the single event type each one is allowed to count. */
const COUNTERS: Array<{ file: string; eventType: string; label: string }> = [
  { file: "src/app/api/chat-reply/route.ts",      eventType: "chat_reply",       label: "chat (OpenAI path)" },
  { file: "src/app/api/respond/route.ts",         eventType: "chat_reply",       label: "chat (template path)" },
  { file: "src/app/api/tts/route.ts",             eventType: "tts",              label: "text-to-speech" },
  { file: "src/app/api/voice/transcribe/route.ts", eventType: "voice_transcribe", label: "transcription" },
  { file: "src/app/api/settings-search/route.ts", eventType: "settings_search",  label: "settings search" },
];

describe("every quota counter is scoped to one event type", () => {
  it.each(COUNTERS)("$label counts only $eventType", ({ file, eventType }) => {
    // Each counting query must name the event type it is counting.
    const counts = countingQueries(read(file));
    expect(counts.length).toBeGreaterThan(0);
    for (const block of counts) {
      expect(block).toContain(`.eq("event_type", "${eventType}")`);
    }
  });
});

describe("the chat allowance cannot be spent by other features", () => {
  const CHAT_ROUTES = [
    "src/app/api/chat-reply/route.ts",
    "src/app/api/respond/route.ts",
  ];

  it.each(CHAT_ROUTES)("%s does not count tts/voice/settings rows", (file) => {
    const counts = countingQueries(read(file));
    expect(counts.length).toBeGreaterThan(0);

    for (const block of counts) {
      for (const foreign of ["tts", "voice_transcribe", "settings_search"]) {
        expect(block).not.toContain(`"${foreign}"`);
      }
    }
  });

  it("still enforces a limit — this is not a removal of the cap", () => {
    // The fix makes the counter narrower, not absent. If the 20 ever
    // disappears, that is a different decision and should not ride in on
    // this change.
    expect(read("src/app/api/respond/route.ts")).toMatch(/>=\s*20/);
  });
});

describe("the published promise and the code agree", () => {
  it("the KB still promises 20 cloud AI replies per day", () => {
    // If the number in the KB changes, this test is the prompt to change the
    // code too — the two drifted apart once already.
    const kb = read("src/content/help/plans-and-payments.md");
    expect(kb).toMatch(/20 cloud (AI )?replies per day/i);
  });
});
