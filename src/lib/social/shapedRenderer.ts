// src/lib/social/shapedRenderer.ts
// The card, drawn by a browser, for the scripts Satori cannot shape.
//
// 🔴 WHY A BROWSER AND NOT SOMETHING LIGHTER — MEASURED, NOT ASSUMED.
// The same stress strings through three renderers:
//
//     satori     ✗  the pre-base vowel lands before the wrong consonant.
//                   This put অভিমান on a live post as অভমিান.
//     resvg-js   ✗  marks misplaced, glyphs overlapping. I expected this one
//                   to work — it is the light answer, and it is wrong.
//     Chromium   ✓  every script correct.
//
// ⚠️ A SECOND RENDERER, NOT A REPLACEMENT. Latin keeps going through Satori:
// it is fast, has no binary behind it, and every card published so far came
// out of it ⇒ renderPicture.ts. Two renderers that both drew everything would
// drift, and the one that drifted would be the one nobody was looking at.
//
// 🔑 WHEN THIS RUNS: at APPROVAL, and the bytes are stored. ⛔ NOT on the
// request Instagram makes. Meta fetches the card URL itself, and that is the
// one request in this whole feature that must not be slow — putting a browser
// cold start on it would turn a design choice into a publish failure.

import type { Node } from "@/lib/social/compose";
import { cardHtml } from "@/lib/social/toHtml";

/** A face the page will declare for itself ⇒ cardHtml. */
export type Face = { family: string; url: string };

/**
 * The font bytes, as a data URI the page can embed.
 *
 * 🔴 BECAUSE A URL LOADS NOTHING IN THERE. Measured: the first Vercel render
 * drew every Bengali glyph as a NO GLYPH box while the layout, the motif and
 * the logo were all correct — the browser simply never got a face. Fetching
 * from inside a sandboxed container, from an about:blank origin, puts
 * network, DNS, CORS and origin policy between us and the font, and each of
 * them fails as tofu rather than as an error.
 *
 * ⛔ A FAILED FETCH IS A REFUSAL, not a render without the font — the same
 * rule Satori's loader already follows, and for the same reason: a card
 * missing its script is a card that publishes looking deliberate.
 */
export async function faceBytes(face: Face): Promise<{ ok: true; dataUri: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(face.url, { cache: "force-cache" });
    if (!res.ok) {
      return { ok: false, error: `${face.family}: the font at ${face.url} answered ${res.status}.` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    // ⚠️ The MIME follows the file, because Chromium rejects a face whose
    // declared type does not match its bytes.
    const mime = face.url.endsWith(".woff2") ? "font/woff2" : face.url.endsWith(".otf") ? "font/otf" : "font/ttf";
    return { ok: true, dataUri: `data:${mime};base64,${buf.toString("base64")}` };
  } catch (e) {
    return { ok: false, error: `${face.family}: the font could not be fetched (${(e as Error).message}).` };
  }
}

export type ShapedRender =
  | { ok: true; bytes: Uint8Array; ms: number }
  | { ok: false; error: string };

/**
 * 🔑 THE BROWSER, FROM WHEREVER THIS IS RUNNING.
 *
 * ⚠️ TWO PATHS BECAUSE THERE ARE GENUINELY TWO MACHINES. A developer's Mac
 * has a full Chromium from `playwright`; a Vercel container has none, and
 * needs the stripped build `@sparticuz/chromium` unpacks to /tmp. ⛔ Not
 * branched on NODE_ENV — a production build running locally is still a Mac,
 * and would try to launch a Linux binary.
 */
async function launch(): Promise<import("playwright-core").Browser> {
  const { chromium: core } = await import("playwright-core");

  if (process.env.VERCEL) {
    /**
     * ⚠️ The shape of this module's export differs between CJS and ESM
     * interop, so both are tried rather than one being assumed — getting it
     * wrong fails at runtime, on Vercel, and nowhere else.
     */
    const mod = (await import("@sparticuz/chromium")) as unknown as {
      default?: { args: string[]; executablePath: () => Promise<string> };
      args?: string[];
      executablePath?: () => Promise<string>;
    };
    const sparticuz = mod.default ?? (mod as { args: string[]; executablePath: () => Promise<string> });
    return core.launch({
      args: sparticuz.args,
      executablePath: await sparticuz.executablePath(),
      headless: true,
    });
  }

  const { chromium } = await import("playwright");
  // ⚠️ Cast across the two packages' identical-but-separate types. playwright
  // re-exports playwright-core's implementation; only the declarations differ.
  return chromium.launch({ headless: true }) as unknown as import("playwright-core").Browser;
}

/**
 * One card, as JPEG bytes.
 *
 * ⛔ JPEG, NOT PNG, and that is not a size preference: Instagram's Content
 * Publishing API documents JPEG and rejects PNG ⇒ the public card route.
 *
 * ⚠️ RETURNS A FAILURE RATHER THAN THROWING. The caller is an approval click,
 * and "the browser would not start" must reach a human as a sentence rather
 * than a 500.
 */
export async function renderShapedCard(args: {
  root: Node;
  width: number;
  height: number;
  faces: Face[];
  /** ⚠️ Injectable so a test can drive this without a browser. */
  launchImpl?: typeof launch;
}): Promise<ShapedRender> {
  const started = Date.now();
  let browser: import("playwright-core").Browser | null = null;

  try {
    browser = await (args.launchImpl ?? launch)();
    const page = await browser.newPage({
      viewport: { width: args.width, height: args.height },
      deviceScaleFactor: 1,
    });

    /**
     * ⛔ EVERY FACE OR NONE. A card drawn with one of its two faces missing is
     * the failure that looks deliberate — the Latin wordmark reads perfectly
     * while the words of the post are boxes.
     */
    const embedded: { family: string; dataUri: string }[] = [];
    for (const face of args.faces) {
      const bytes = await faceBytes(face);
      if (!bytes.ok) return { ok: false, error: bytes.error };
      embedded.push({ family: face.family, dataUri: bytes.dataUri });
    }

    const html = cardHtml(args.root, args.width, args.height, embedded);

    /**
     * 🔴 `networkidle`, NOT `load`. The fonts and the logo are FETCHED by the
     * page ⇒ cardHtml declares @font-face with a CDN url. `load` fires before
     * a webfont has arrived, and the screenshot would catch the fallback
     * face — a card that is subtly, plausibly wrong rather than obviously
     * broken, which is the worst kind.
     */
    await page.setContent(html, { waitUntil: "networkidle", timeout: 20_000 });

    /**
     * ⛔ AND THE FONTS ARE WAITED FOR EXPLICITLY AS WELL. `networkidle` is
     * about requests; `document.fonts.ready` is about the faces actually
     * being usable. They are not the same moment, and the gap is exactly
     * where an empty-box render comes from.
     */
    await page.evaluate("document.fonts.ready");

    const bytes = await page.screenshot({ type: "jpeg", quality: 90 });
    return { ok: true, bytes: new Uint8Array(bytes), ms: Date.now() - started };
  } catch (e) {
    return { ok: false, error: `The shaped renderer failed: ${(e as Error).message}` };
  } finally {
    // ⚠️ Always. A browser left running holds the container open and the next
    // invocation starts from a machine that is already out of memory.
    await browser?.close().catch(() => {});
  }
}
