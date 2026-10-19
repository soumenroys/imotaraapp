/**
 * ⛔ TAKE THE OBJECT THAT HAS THE FUNCTION. DO NOT ASSUME WHERE IT LIVES.
 *
 * 🔴 THE DEFECT, found 19 Oct while checking something else. GIF encoding
 * threw "quantize is not a function" — and the code had a comment written for
 * that exact error, confidently explaining the opposite of what was true:
 *
 *     "`gifenc` is CommonJS: under ESM its named exports arrive on `.default`"
 *
 * ⚠️ MEASURED, by printing both modules — and in BOTH runtimes, because one
 * alone misled me. My first version of this file asserted "opposite shapes"
 * from a single tsx run, and failed under vitest.
 *
 *     gifenc   → `.default` exists and is EMPTY, under tsx AND under vitest
 *     upng-js  → `.default` carries the exports, under both
 *     upng-js's TOP-LEVEL shape differs between the two runtimes
 *
 * ⇒ `mod.default ?? mod` could never work for gifenc: `??` falls back only on
 * null/undefined, and an EMPTY object is neither — so it won, and every
 * function came back undefined. And the top-level shape is a property of the
 * RESOLVER, not the package, so it must not be written down anywhere.
 *
 * 🔑 WHY IT HID FOR SO LONG. A GIF only animates on X; X does not publish; so
 * the only way to reach this was an admin preview with ?format=gif. A path
 * that nothing exercises is a path where a confident wrong comment survives.
 */

import { describe, it, expect } from "vitest";
import { interopPick } from "@/lib/social/animate";

describe("the probe finds the function wherever it lives", () => {
  it("takes the module itself when the export is at the top level", () => {
    const mod = { thing: () => 1, default: {} };
    expect(interopPick<{ thing: () => number }>(mod, "thing", "x").thing()).toBe(1);
  });

  it("takes `.default` when the export is only there", () => {
    const mod = { default: { thing: () => 2 } };
    expect(interopPick<{ thing: () => number }>(mod, "thing", "x").thing()).toBe(2);
  });

  it("⛔ is not fooled by an EMPTY `.default`, which is the whole bug", () => {
    /**
     * 🔴 THE EXACT SHAPE OF `gifenc`. The old code was `mod.default ?? mod`;
     * `{}` is not nullish, so it was chosen and `quantize` was undefined.
     */
    const mod = { quantize: () => "real", default: {} };
    expect(interopPick<{ quantize: () => string }>(mod, "quantize", "gifenc").quantize()).toBe("real");
  });

  it("⛔ names the dependency and the export when neither carries it", () => {
    /**
     * ⚠️ AT RESOLUTION, NOT AT USE. "quantize is not a function", thrown deep
     * inside an encode, sent three rounds of debugging at the encoder itself.
     */
    expect(() => interopPick({ default: {} }, "quantize", "gifenc")).toThrow(/gifenc exports no/);
    expect(() => interopPick({ default: {} }, "quantize", "gifenc")).toThrow(/quantize/);
  });

  it("survives a module that is undefined or has no default", () => {
    expect(() => interopPick(undefined, "thing", "x")).toThrow(/x exports no/);
    expect(() => interopPick({}, "thing", "x")).toThrow(/x exports no/);
  });
});

describe("⛔ and the real modules still resolve", () => {
  /**
   * 🔑 THE HALF THAT CATCHES A VERSION BUMP. The unit cases above test the
   * probe against shapes I wrote down; these test it against the shapes the
   * installed packages ACTUALLY have, which is what changed underneath the
   * old comment and will change again.
   */
  it("gifenc yields the three functions the encoder calls", async () => {
    const g = interopPick<Record<string, unknown>>(await import("gifenc"), "quantize", "gifenc");
    for (const fn of ["GIFEncoder", "quantize", "applyPalette"]) {
      expect(typeof g[fn], `gifenc.${fn} is not a function`).toBe("function");
    }
  });

  it("upng-js yields the two the decoder calls", async () => {
    const u = interopPick<Record<string, unknown>>(await import("upng-js"), "decode", "upng-js");
    for (const fn of ["decode", "toRGBA8"]) {
      expect(typeof u[fn], `UPNG.${fn} is not a function`).toBe("function");
    }
  });

  it("🔑 gifenc's `.default` is still the empty object that caused this", async () => {
    /**
     * ⛔ THE HAZARD ITSELF, pinned — not the shape of the fix.
     *
     * 🔴 I FIRST WROTE THIS TEST AS "the two have opposite shapes", from one
     * measurement under tsx. It failed under vitest, where upng-js ALSO has
     * its exports at the top level. ⇒ The top-level shape is a property of
     * the RESOLVER, not the package, and asserting it pins an accident of
     * whichever runtime the tests happen to use.
     *
     * ⚠️ What IS stable across both runtimes, and is the actual bug: gifenc
     * ships a `.default` that exists and is empty, so `?? ` can never fall
     * back past it. If that ever stops being true the old code would start
     * working, and this comment should become history.
     */
    const gifenc = (await import("gifenc")) as Record<string, unknown>;
    const d = gifenc.default as Record<string, unknown> | undefined;
    expect(d, "gifenc no longer ships a `.default` at all").toBeDefined();
    expect(Object.keys(d!).length, "gifenc's `.default` is no longer empty").toBe(0);
    // ⛔ And this is why `mod.default ?? mod` could not work: it is not nullish.
    expect(d ?? gifenc).toBe(d);
  });
});
