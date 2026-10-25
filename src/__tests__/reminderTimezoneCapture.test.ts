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

describe("🔴 the timezone must not depend on someone opening Settings", () => {
    it("is captured when a push subscription is created", () => {
        // The daily check-in fires at the person's LOCAL hour. With no timezone
        // isDueNow falls back to the same hour in UTC, and the default is
        // 20:00 — which is 01:30 in India. Collecting it only in Settings would
        // have woken every existing subscriber who never reopens that page, in
        // the middle of the night, in the main market.
        const route = read("src/app/api/push/subscribe/route.ts");
        expect(route).toMatch(/subscription\.timeZone/);
        expect(route).toMatch(/key: "time_zone"/);
    });

    it("⛔ validates it there too, rather than trusting the client", () => {
        const route = read("src/app/api/push/subscribe/route.ts");
        expect(route).toMatch(/new Intl\.DateTimeFormat\("en",\s*\{\s*timeZone:/);
    });

    it("⛔ a failed timezone write never fails the SUBSCRIPTION", () => {
        // A missing timezone is an imperfect hour; a failed subscription is no
        // reminders at all. The second must not be caused by the first.
        const route = read("src/app/api/push/subscribe/route.ts");
        const after = route.slice(route.indexOf("time_zone upsert failed"));
        expect(after).toMatch(/return NextResponse\.json\(\{ ok: true \}\)/);
    });

    it("🔴 …and the row carries `confidence`, like every other write here", () => {
        // ⚠️ A SILENT-FAILURE guard, not a style rule. The timezone write is
        // deliberately non-fatal, so if user_memory.confidence is NOT NULL with
        // no default, omitting the field fails the upsert and NOBODY EVER FINDS
        // OUT — the subscription still returns ok, and the person is still
        // nudged at 20:00 UTC. The two writes that are already live in
        // production (profile/sync, push/cron) both set it; this one must too.
        const route = read("src/app/api/push/subscribe/route.ts");
        const block = route.slice(route.indexOf('key: "time_zone"'));
        // ⚠️ Present AND inside the live check constraint: this used to pin `confidence: 1`,
        //    which the database rejects — the test guarded the very value that broke it
        //    (25 Oct 2026, 0 subscriptions ever saved) ⇒ pushSubscriptionsCanBeSaved.test.ts.
        expect(block.slice(0, 200)).toMatch(/confidence: 0\.9/);
    });

    it("the client actually sends it with the subscription", () => {
        const settings = read("src/app/settings/page.tsx");
        expect(settings).toMatch(/\.\.\.sub\.toJSON\(\),\s*timeZone: resolveTimeZone\(\)/);
    });
});
