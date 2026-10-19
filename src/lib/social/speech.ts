// src/lib/social/speech.ts
// The post, spoken — for the moving card's audio track.
//
// 🔴 WHY THIS EXISTS AT ALL, AND IT IS NOT MAINLY ABOUT SOUND.
//
// The ambient beds the app ships could not be used: "licensed for in-app use"
// and "licensed for marketing" are different grants and nobody had confirmed
// which these carry ⇒ renderAnimation.AMBIENT_BEDS. Audio we SYNTHESISE is
// audio we own, so the question disappears rather than being answered.
//
// 🔑 AND IT FIXES A FUDGE. Scene length was my ESTIMATE of reading speed —
// 380ms a word, capped — which is a guess dressed as a number. When the
// sentences are spoken, each scene can last exactly as long as its sentence
// actually takes to say ⇒ renderAnimation. That is a measurement.
//
// ⚠️ THE VOICE IS THE PRODUCT'S OWN, which the owner decided knowingly on 19
// Oct. The consideration they overruled is worth keeping visible: this is the
// voice somebody hears when they are having a bad night and chose to talk to
// something, and in a feed a user may hear their companion reading a post.
// ⛔ Consistency was the argument for it — it is the same product, and a
// different voice would be a different promise.
//
// ⛔ IT READS WHAT IS ON SCREEN AND NOTHING ELSE. No separate script: every
// word spoken has already been through the gate as part of the post. A script
// written for the ear would be words published without that review.

import { getAzureConfig } from "@/lib/azure-tts/regionRouter";
import { resolveVoice, AZURE_LOCALE } from "@/lib/azure-tts/voices";

export type Spoken =
  | { ok: true; mp3: Uint8Array }
  | { ok: false; error: string };

/** XML, because the text goes inside SSML and a stray `&` breaks the request. */
function escapeSsml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * One line, spoken.
 *
 * 🔑 `mstts:silence ... 0ms` ON BOTH ENDS, and this is not a detail. Azure
 * pads every clip with leading and trailing silence, and HOW MUCH VARIES BY
 * VOICE — measured at ~0.85s for bn-IN-TanishaaNeural against ~0.15s for most
 * others ⇒ the note in /api/tts/route.ts, where a user reported the resulting
 * gap as "very prominent in Bengali". Stacked once per sentence that would
 * put a different, unpredictable pause between every scene — and the scenes
 * are timed FROM these durations, so the padding would silently stretch the
 * video too.
 *
 * ⚠️ RETURNS A FAILURE RATHER THAN THROWING. A video with no narration is a
 * video; a failed approval because a speech service was busy is not.
 */
export async function speak(
  text: string,
  language: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Spoken> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Nothing to say." };

  /**
   * 🔴 THIS THROWS, AND I CALLED IT OUTSIDE THE TRY. Found by running it:
   * `getAzureConfig` raises when a region's credentials are missing, the
   * throw escaped `speak` entirely, and the caller reported it as "The MP4
   * could not be encoded" — a post refused at approval because a speech
   * service was unconfigured.
   *
   * ⛔ THE WHOLE DESIGN SAYS NARRATION FAILS TO SILENT. I had written that in
   * a comment two screens up while the code did the opposite, which is
   * exactly the kind of claim that survives review because it reads as true.
   */
  let config: { key: string; region: string };
  try {
    config = getAzureConfig(null);
  } catch (e) {
    return { ok: false, error: `Azure speech is not configured here (${(e as Error).message}).` };
  }
  if (!config?.key || !config?.region) {
    return { ok: false, error: "Azure speech is not configured here, so the video has no narration." };
  }

  const locale = AZURE_LOCALE[language] ?? "en-US";
  const voice = resolveVoice(language, undefined);

  const ssml =
    `<speak version="1.0" xml:lang="${locale}" ` +
    `xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts">` +
    `<voice name="${voice}">` +
    `<mstts:silence type="Leading-exact" value="0ms"/>` +
    `<mstts:silence type="Tailing-exact" value="0ms"/>` +
    `${escapeSsml(trimmed)}</voice></speak>`;

  try {
    const res = await fetchImpl(
      `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": config.key,
          "Content-Type": "application/ssml+xml",
          // ⚠️ Mono 24kHz: this is narration under a card, not music, and the
          // file travels inside a video that is already being re-encoded.
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
          "User-Agent": "ImotaraApp",
        },
        body: ssml,
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!res.ok) {
      return { ok: false, error: `Azure answered ${res.status} when asked to speak the post.` };
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0) {
      // ⛔ A 200 with no audio is a real Azure outcome and would otherwise
      // become a silent scene of the right length — wrong, and plausible.
      return { ok: false, error: "Azure returned no audio." };
    }
    return { ok: true, mp3: bytes };
  } catch (e) {
    return { ok: false, error: `The speech service could not be reached (${(e as Error).message}).` };
  }
}
