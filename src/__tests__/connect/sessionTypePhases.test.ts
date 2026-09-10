import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Audio and video sessions are phase 3. Three places have to agree about that,
// and for a while they did not: both registration UIs disabled the options and
// labelled them "Coming soon", the booking screen refused them — and the API
// accepted them anyway. Server validation laxer than the client is how a
// companion ends up advertising a modality nobody can book, which is exactly
// what was found in production (1 of 8 companions carrying "video").
//
// When phase 3 ships, all three unlock together and this test says so.

const p = (...s: string[]) => path.join(__dirname, "..", "..", ...s);
const api      = fs.readFileSync(p("app", "api", "connect", "consultant", "register", "route.ts"), "utf8");
const register = fs.readFileSync(p("app", "connect", "register", "page.tsx"), "utf8");
const booking  = fs.readFileSync(p("app", "connect", "session", "new", "page.tsx"), "utf8");

describe("audio and video are refused consistently", () => {
    it("the API accepts only chat", () => {
        expect(api).toMatch(/const VALID_SESSION_TYPES = \["chat"\];/);
        expect(api).toMatch(/const NOT_YET_BOOKABLE_SESSION_TYPES = \["audio", "video"\];/);
    });

    it("the API rejects them rather than silently dropping them", () => {
        // Quietly stripping a modality from someone's profile leaves them
        // believing they offer it. Say so instead.
        expect(api).toMatch(/not available yet/);
        expect(api).toMatch(/status: 400/);
        const block = api.slice(api.indexOf("const notYet ="), api.indexOf("const normalizedSessionTypes"));
        expect(block).toMatch(/return NextResponse\.json\(/);
    });

    it("the registration UI disables and labels them", () => {
        expect(register).toMatch(/const locked = \(opt as any\)\.phase > 1;/);
        expect(register).toMatch(/disabled=\{locked\}/);
        expect(register).toMatch(/\{locked \? " · Coming soon" : ""\}/);
    });

    it("the booking screen still refuses them", () => {
        const modes = booking.slice(booking.indexOf("const SESSION_MODES"), booking.indexOf("] as const"));
        expect(modes).toMatch(/key: "audio",[\s\S]*?available: false/);
        expect(modes).toMatch(/key: "video",[\s\S]*?available: false/);
        expect(modes).toMatch(/key: "chat",[\s\S]*?available: true/);
    });

    it("the three agree — nothing offers what another refuses", () => {
        const apiAllows = /const VALID_SESSION_TYPES = \[([^\]]*)\]/.exec(api)![1]
            .split(",").map(s => s.trim().replace(/"/g, "")).filter(Boolean);
        const bookable = [...booking.matchAll(/key: "(\w+)",[\s\S]{0,120}?available: (true|false)/g)]
            .filter(m => m[2] === "true").map(m => m[1]);
        expect(apiAllows.sort()).toEqual(bookable.sort());
    });
});
