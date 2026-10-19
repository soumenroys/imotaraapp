/**
 * 🔴 THE OWNER, 19 Oct: "can not you speak the sentences as audio?"
 *
 * It solves a problem the ambient beds could not. Those ship with the app for
 * its breathing exercise, and "licensed for in-app use" and "licensed for
 * marketing" are different grants — so they were switched off pending a
 * confirmation nobody could give. ⇒ Audio we SYNTHESISE is audio we own, and
 * the question disappears rather than being answered.
 *
 * 🔑 AND IT REPLACES A GUESS WITH A MEASUREMENT. Scene length was my estimate
 * of reading speed — 380ms a word, capped at 3.8s — which is a number wearing
 * a measurement's clothes. A spoken sentence has a real duration, so the
 * scene can simply last that long.
 *
 * ⛔ NARRATION MUST FAIL TO SILENT, NEVER TO A FAILED POST. The words are the
 * post; the voice is a courtesy. That rule is the main subject of this file,
 * because I wrote it in a comment and then broke it in the code on the same
 * afternoon ⇒ getAzureConfig throws, and I called it outside the try.
 */

import { describe, it, expect } from "vitest";
process.env.SOCIAL_TOKEN_KEY ??= Buffer.alloc(32, 9).toString("base64");

import { speak } from "@/lib/social/speech";
import { storyboard } from "@/lib/social/frames";
import type { Recipe } from "@/lib/social/visualRecipe";

const recipe = {
  layout: "rule-over", palette: "forest", typeTreatment: "display",
  motif: "none", wash: "flat", script: "latin", hash: "t",
} as Recipe;

const board = (support: string) =>
  storyboard({ recipe, headline: "A headline", support, language: "en", platform: "facebook" });

/**
 * ⚠️ RUN WITH AZURE CONFIGURED, explicitly.
 *
 * ⛔ Without this a test meaning to exercise a 429 gets "not configured"
 * instead and passes for the wrong reason — which is exactly what happened
 * to the status test below on its first run. The precondition has to be set,
 * not assumed from whatever the machine happens to have.
 */
async function withAzure<T>(fn: () => Promise<T>): Promise<T> {
  const saved = { key: process.env.AZURE_SPEECH_KEY_IN, region: process.env.AZURE_SPEECH_REGION_IN };
  process.env.AZURE_SPEECH_KEY_IN = "test-key";
  process.env.AZURE_SPEECH_REGION_IN = "centralindia";
  try {
    return await fn();
  } finally {
    if (saved.key === undefined) delete process.env.AZURE_SPEECH_KEY_IN;
    else process.env.AZURE_SPEECH_KEY_IN = saved.key;
    if (saved.region === undefined) delete process.env.AZURE_SPEECH_REGION_IN;
    else process.env.AZURE_SPEECH_REGION_IN = saved.region;
  }
}

/** A fetch that answers as Azure would. */
const azureSaying = (bytes: number, status = 200) =>
  (async () =>
    ({
      ok: status === 200,
      status,
      arrayBuffer: async () => new Uint8Array(bytes).buffer,
    }) as unknown as Response) as unknown as typeof fetch;

describe("⛔ narration fails to SILENT, never to a failed post", () => {
  it("an unconfigured region is a refusal, not a thrown error", async () => {
    /**
     * 🔴 THE BUG THIS PINS, AND IT WAS MINE. `getAzureConfig` THROWS when a
     * region has no credentials. I called it outside the try, so the throw
     * escaped `speak` entirely and the caller reported "The MP4 could not be
     * encoded" — a post REFUSED at approval because a speech service was
     * unconfigured.
     *
     * ⚠️ I had written "fails to silent" in a comment two screens above the
     * code that did the opposite. A claim like that reads as true and
     * survives review; only running it found this.
     */
    const saved = { ...process.env };
    try {
      for (const s of ["IN", "US", "EU", "AP"]) {
        delete process.env[`AZURE_SPEECH_KEY_${s}`];
        delete process.env[`AZURE_SPEECH_REGION_${s}`];
      }
      const r = await speak("Anything at all.", "en");
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error("unreachable");
      expect(r.error).toMatch(/not configured/i);
    } finally {
      process.env = saved;
    }
  });

  it("⛔ a 200 carrying NO audio is a failure, not a silent clip", async () => {
    /**
     * 🔴 Azure really does answer 200 with an empty body. Treated as success
     * that becomes a scene of the right length with nothing in it — wrong,
     * and entirely plausible to anybody reading the code.
     */
    const r = await withAzure(() => speak("Hello.", "en", azureSaying(0)));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error).toMatch(/no audio/i);
  });

  it("an error status is a refusal", async () => {
    const r = await withAzure(() => speak("Hello.", "en", azureSaying(500, 429)));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.error).toMatch(/429/);
  });

  it("⛔ refuses empty text rather than asking Azure to say nothing", async () => {
    expect((await speak("   ", "en")).ok).toBe(false);
  });
});

describe("what gets spoken is what is on screen", () => {
  it("one scene per sentence, and the scene texts are carried out", () => {
    /**
     * ⛔ The narration reads `board.sceneTexts` rather than re-splitting the
     * body. Two splits is two answers, and the voice would eventually say
     * something the card does not show.
     */
    const b = board("One sentence here. A second one follows. And a third.");
    expect(b.sceneTexts.length).toBe(4); // headline + three sentences
    expect(b.sceneTexts[0]).toBe("A headline");
    expect(b.sceneTexts[1]).toContain("One sentence");
    expect(b.sceneTexts[3]).toContain("third");
  });

  it("⛔ every scene text maps to a real frame", () => {
    /**
     * 🔴 The build-up frames come FIRST, so scene indexes are not 0,1,2.
     * Laying narration against the wrong frames would put the voice ahead of
     * the words — the one failure nobody would describe as "out of sync",
     * they would just say it felt wrong.
     */
    const b = board("One. Two. Three.");
    expect(b.sceneIndexes.length).toBe(b.sceneTexts.length);
    for (const i of b.sceneIndexes) {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(b.frames.length);
    }
    // ⚠️ Strictly increasing: scenes cannot be laid out of order.
    for (let i = 1; i < b.sceneIndexes.length; i++) {
      expect(b.sceneIndexes[i]).toBeGreaterThan(b.sceneIndexes[i - 1]);
    }
  });

  it("the headline is the first thing spoken, because it is the post", () => {
    const b = board("A sentence.");
    expect(b.sceneTexts[0]).toBe("A headline");
  });
});

describe("the SSML Azure is sent", () => {
  it("⛔ asks for no leading or trailing silence", async () => {
    /**
     * 🔑 Azure pads every clip, and HOW MUCH VARIES BY VOICE — measured at
     * ~0.85s for bn-IN-TanishaaNeural against ~0.15s for most others, with a
     * user reporting the gap as "very prominent in Bengali" ⇒ /api/tts.
     *
     * ⛔ Here it is worse than a pause: the scenes are TIMED FROM these
     * durations, so the padding would silently stretch the video too.
     */
    let sent = "";
    const spy = (async (_u: string, init?: RequestInit) => {
      sent = String(init?.body ?? "");
      return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array(10).buffer } as unknown as Response;
    }) as unknown as typeof fetch;

    await withAzure(() => speak("Hello there.", "en", spy));
    expect(sent).toContain('type="Leading-exact" value="0ms"');
    expect(sent).toContain('type="Tailing-exact" value="0ms"');
  });

  it("⛔ escapes the post's own words, which are not XML", async () => {
    // A subject containing & or < would otherwise break the request, or
    // worse, change it.
    let sent = "";
    const spy = (async (_u: string, init?: RequestInit) => {
      sent = String(init?.body ?? "");
      return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array(10).buffer } as unknown as Response;
    }) as unknown as typeof fetch;

    await withAzure(() => speak(`Tea & biscuits < that`, "en", spy));
    expect(sent).toContain("&amp;");
    expect(sent).toContain("&lt;");
    expect(sent).not.toMatch(/[^&]& /);
  });
});
