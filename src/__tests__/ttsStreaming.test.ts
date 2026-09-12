/**
 * The TTS route must not buffer Azure's audio before answering.
 *
 * It used to do `await azureRes.arrayBuffer()`, which made the audio cross the
 * network twice in series — Azure to the function, and only then the function
 * to the caller. Measured against production 2026-09-12 for one English chunk:
 *
 *   rate-limit + bearer auth    713ms
 *   quota check                  +40ms
 *   Azure synthesis            3,106ms
 *   Azure -> Vercel download     928ms   <- pure serialisation, removed
 *   total                      4,787ms
 *
 * The caller still buffers before playing, so this does not start playback
 * early; it removes the second leg from the critical path.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const src = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/tts/route.ts"), "utf8");

/**
 * Source with comments removed. The note explaining WHY the buffering was
 * taken out naturally contains the words "azureRes.arrayBuffer()", and a test
 * that greps the raw file cannot tell that mention from a call — it failed on
 * its own documentation the first time it ran.
 */
const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

describe("the audio body is streamed, not buffered", () => {
    it("passes Azure's body straight to the response", () => {
        expect(code).toMatch(/new NextResponse\(\s*azureRes\.body/);
    });

    it("never calls arrayBuffer on the Azure response", () => {
        // The single line that reintroduces the 928ms leg.
        expect(code).not.toMatch(/azureRes\.arrayBuffer\(\)/);
    });

    it("still records anonymous usage — it must not be lost with the buffer", () => {
        // The insert used to sit after arrayBuffer(). With a streamed body
        // there is no post-download moment, so it has to run before the return
        // or the anonymous TTS quota silently stops counting.
        const i = code.indexOf('event_type: "tts"');
        const j = code.search(/return new NextResponse\(\s*azureRes\.body/);
        expect(i).toBeGreaterThan(-1);
        expect(j).toBeGreaterThan(-1);
        expect(i).toBeLessThan(j);
    });

    it("still rejects a failed synthesis before streaming anything", () => {
        // azureRes.ok must be checked first, or a 401/429 from Azure would be
        // relayed to the caller as a 200 with an error body as "audio".
        const okCheck = code.indexOf("if (!azureRes.ok)");
        const stream = code.search(/return new NextResponse\(\s*azureRes\.body/);
        expect(okCheck).toBeGreaterThan(-1);
        expect(okCheck).toBeLessThan(stream);
    });

    it("keeps the audio content type and cache header", () => {
        expect(src).toContain('"Content-Type":  "audio/mpeg"');
        expect(src).toContain("max-age=86400");
    });
});
