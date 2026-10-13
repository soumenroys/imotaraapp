import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("the timezone the daily reminder depends on", () => {
    const SYNC = () => read("src/app/api/profile/sync/route.ts");

    it("is accepted by profile sync and listed as a readable key", () => {
        const src = SYNC();
        expect(src).toMatch(/push\("time_zone"/);
        // Without it in PROFILE_KEYS the value is written but never read back,
        // so a device would re-send it forever and the UI could never show it.
        expect(src).toMatch(/"time_zone",\s*"reminder_hour"/);
    });

    it("⛔ is VALIDATED against Intl, not trusted", () => {
        // The value is fed straight to Intl.DateTimeFormat in the cron. A bad
        // one would throw per user on every hourly run. A regex would happily
        // accept "Mars/Olympus", so asking Intl is the only honest check.
        const src = SYNC();
        expect(src).toMatch(/function sanitiseTimeZone/);
        expect(src).toMatch(/new Intl\.DateTimeFormat\("en",\s*\{\s*timeZone:/);
    });

    it("⛔ rejects an out-of-range reminder hour", () => {
        expect(SYNC()).toMatch(/n >= 0 && n <= 23/);
    });

    it("is actually SENT by the client — otherwise the server never learns it", () => {
        // The cron reads time_zone from user_memory. If nothing writes it,
        // everyone silently falls back to one UTC hour and the whole
        // per-person schedule is dead code.
        const settings = read("src/app/settings/page.tsx");
        expect(settings).toMatch(/resolvedOptions\(\)\.timeZone/);
        expect(settings).toMatch(/timeZone:\s*resolveTimeZone\(\)/);
    });

    it("⛔ the client returns undefined rather than guessing a zone", () => {
        const settings = read("src/app/settings/page.tsx");
        const fn = settings.slice(settings.indexOf("function resolveTimeZone"));
        expect(fn.slice(0, 400)).toMatch(/return undefined/);
    });

    it("the cron reads it back", () => {
        const cron = read("src/app/api/push/cron/route.ts");
        expect(cron).toMatch(/"time_zone"/);
        expect(cron).toMatch(/tzMap/);
    });
});
