import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// The chat is the only page that wants the whole screen, and it kept not
// getting it. First the height: a hardcoded calc(100vh-200px) left the
// conversation 452px of a 768px laptop. Then the width: the shared <main>
// clamps every page to max-w-5xl, so on a 1600px window 576px — 36% of the
// screen — was dead margin, while the chat's own wrapper asked for max-w-7xl
// and never got it.
//
// Both fixes live in chat/layout.tsx precisely so they touch this route only.
// The thing most likely to go wrong later is someone "tidying" that wrapper
// without realising every class in it is load-bearing.

const layout = fs.readFileSync(
    path.join(__dirname, "..", "app", "chat", "layout.tsx"), "utf8");
const page = fs.readFileSync(
    path.join(__dirname, "..", "app", "chat", "page.tsx"), "utf8");
const root = fs.readFileSync(
    path.join(__dirname, "..", "app", "layout.tsx"), "utf8");

describe("the chat gets the whole screen", () => {
    it("height comes from the header's real size, not a magic number", () => {
        expect(page).toMatch(/h-\[calc\(100dvh-3\.5rem\)\]/);
        expect(page).not.toMatch(/100vh-200px|100dvh-200px/);
    });

    it("3.5rem is still what the header actually measures", () => {
        // If SiteHeader's height changes, the chat silently over- or
        // under-fills. h-14 = 3.5rem.
        const header = fs.readFileSync(
            path.join(__dirname, "..", "components", "SiteHeader.tsx"), "utf8");
        expect(header).toMatch(/<header[^>]*sticky/);
        expect(header).toMatch(/\bh-14\b/);
    });

    it("escapes main's max-width without a transform", () => {
        // mx-[calc(50%-50vw)] breaks out of a centred max-width parent while
        // staying in flow. A transform would take it out of flow and break the
        // sticky header above it.
        expect(layout).toMatch(/mx-\[calc\(50%-50vw\)\]/);
        expect(layout).not.toMatch(/-translate-x-1\/2/);
    });

    it("cancels main's vertical padding, and only vertical", () => {
        expect(layout).toMatch(/-mt-4/);
        expect(layout).toMatch(/-mb-8/);
        expect(layout).toMatch(/sm:-mt-10/);
    });

    it("relies on body clipping horizontal overflow, which it still does", () => {
        // 100vw includes the scrollbar; without this a horizontal scrollbar appears.
        expect(root).toMatch(/overflow-x-hidden/);
    });

    it("main is still max-w-5xl for every other page", () => {
        // The fix is scoped. If someone widens main globally instead, every
        // document page loses its reading measure.
        expect(root).toMatch(/max-w-5xl/);
    });
});

describe("the sidebar can give its width back", () => {
    it("remembers the choice under a versioned key", () => {
        expect(page).toMatch(/SIDEBAR_KEY = "imotara\.chat\.sidebarOpen\.v1"/);
        expect(page).toMatch(/localStorage\.setItem\(SIDEBAR_KEY/);
    });

    it("survives storage being unavailable", () => {
        // Private mode throws on localStorage access; the chat must still open.
        const read = page.slice(page.indexOf("const SIDEBAR_KEY"), page.indexOf("const [showSearch"));
        expect(read).toMatch(/catch \{[^}]*\}/);
        expect(read).toMatch(/useState\(true\)/); // defaults to shown
    });

    it("is announced properly rather than being a mystery icon", () => {
        expect(page).toMatch(/aria-expanded=\{sidebarOpen\}/);
        expect(page).toMatch(/aria-label=\{sidebarOpen \? "Hide conversation list" : "Show conversation list"\}/);
    });
});
