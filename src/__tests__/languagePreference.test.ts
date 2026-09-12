/**
 * A DEFAULT must not outrank detection. A real CHOICE must.
 *
 * preferredLang defaulted to "en" and SettingsContext persists toneContext, so
 * every user ends up with "preferredLang":"en" in storage whether they picked
 * it or not. The resolver put profile ahead of detection, so for anyone who
 * never opened the picker — almost everyone — detection never ran at all and
 * writing in Bengali got an English reply. Verified on a device 2026-09-11:
 * stored value "en", typed "ami khub valo nei tumi kemon acho", reply came
 * back in English.
 *
 * Flipping the precedence outright was not an option: a stored "en" cannot be
 * told apart from a chosen "en", so it would have overridden people who really
 * do want English replies while writing Bengali. "auto" makes the difference
 * explicit rather than guessed.
 */
import { describe, it, expect } from "vitest";
import { statedPreference, AUTO_LANG } from "@/lib/imotara/statedPreference";

/** The resolver's shape, so the ordering itself is under test. */
function resolve(opts: { explicit?: string; profile?: string; detected?: string }) {
    const stated = statedPreference(opts.profile);
    const detected = opts.detected ?? "en";
    return opts.explicit || stated || (detected !== "en" ? detected : "en");
}

describe("not stated — detection decides", () => {
    it('"auto" falls through to detection', () => {
        expect(resolve({ profile: AUTO_LANG, detected: "bn" })).toBe("bn");
    });
    it("a missing preference falls through to detection", () => {
        expect(resolve({ profile: undefined, detected: "hi" })).toBe("hi");
    });
    it("an empty string falls through to detection", () => {
        expect(resolve({ profile: "", detected: "ta" })).toBe("ta");
    });
    it("auto with nothing detected still lands on English", () => {
        expect(resolve({ profile: AUTO_LANG, detected: "en" })).toBe("en");
    });
});

describe("stated — the choice wins, including English", () => {
    it("a chosen English beats detected Bengali", () => {
        // The case the old comment protected, and it must keep working.
        expect(resolve({ profile: "en", detected: "bn" })).toBe("en");
    });
    it("a chosen Bengali survives a line of English", () => {
        expect(resolve({ profile: "bn", detected: "en" })).toBe("bn");
    });
    it("case and padding do not defeat it", () => {
        expect(statedPreference("  EN ")).toBe("en");
        expect(statedPreference(" Auto ")).toBeUndefined();
    });
});

describe("an explicit in-message request still outranks everything", () => {
    it('"reply in Hindi" beats both a stated preference and detection', () => {
        expect(resolve({ explicit: "hi", profile: "bn", detected: "ta" })).toBe("hi");
    });
});

describe("statedPreference itself", () => {
    it.each([undefined, null, "", "   ", "auto", "AUTO"])("%s is not a preference", (v) => {
        expect(statedPreference(v as string | undefined)).toBeUndefined();
    });
    it.each(["en", "bn", "hi", "ta"])("%s is a preference", (v) => {
        expect(statedPreference(v)).toBe(v);
    });
});
