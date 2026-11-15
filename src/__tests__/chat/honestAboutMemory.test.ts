/**
 * #150 (15 Nov 2026) — asked "do you remember?" / "is this saved?", the live
 * prompt produced INVENTED answers (measured on a local dev server, 10 cases):
 * "I do remember" (no record shown), "if you close the app this will
 * disappear", "nothing is saved anywhere" (bn), "the team can use your
 * messages to improve the service", "I can't delete past messages".
 * The rule below fixed all seven memory cases; emotional replies unchanged.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

const route = readFileSync("src/app/api/chat-reply/route.ts", "utf8");
const rule = route.slice(route.indexOf("ABOUT YOURSELF — ONLY WHEN ASKED"), route.indexOf("ABOUT YOURSELF — ONLY WHEN ASKED") + 1400);

describe("#150 the companion is honest about memory and saving", () => {
  it("the rule is in the prompt that every reply uses (not only the extended guidance)", () => {
    const at = route.indexOf("ABOUT YOURSELF — ONLY WHEN ASKED");
    const extended = route.indexOf("includeExtendedTherapeuticGuidance ? [");
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(extended);
  });

  it("forbids the three false answers that were measured", () => {
    expect(rule).toContain("NEVER claim to remember it");
    expect(rule).toMatch(/Do NOT say that nothing is kept, that everything disappears when the chat or app closes, or that nothing leaves their device/);
  });

  it("states only true things, hedged where versions differ", () => {
    expect(rule).toContain("kept on the device they are using");
    expect(rule).toContain("may also be kept in their account if they are signed in with cloud backup on");
    expect(rule).toContain("delete everything in Settings");
    expect(rule).toContain("go to our service providers");
  });

  it("never names an AI provider (owner rule, 11 Nov 2026)", () => {
    expect(rule).not.toMatch(/OpenAI|Gemini|GPT|Google/i);
  });
});
