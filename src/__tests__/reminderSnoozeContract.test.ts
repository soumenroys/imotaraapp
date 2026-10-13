import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
    SNOOZE_DAYS,
    controlForTier,
    isValidSnoozeDays,
    snoozeUntil,
    isSuppressed,
    snoozeEndsAt,
} from "@/lib/reminders/snooze";

const AT = (iso: string) => new Date(iso);

describe("who may do what with the reminder", () => {
    it("offers free users snooze only — the owner's decision, option (a)", () => {
        expect(controlForTier("free")).toBe("snooze_only");
        expect(controlForTier(null)).toBe("snooze_only");
        expect(controlForTier(undefined)).toBe("snooze_only");
        expect(controlForTier("")).toBe("snooze_only");
    });

    it("lets paid tiers turn it off for good", () => {
        expect(controlForTier("plus")).toBe("can_disable");
        expect(controlForTier("PLUS")).toBe("can_disable");
        expect(controlForTier("enterprise")).toBe("can_disable");
    });

    it("⛔ fails CLOSED on an unknown tier", () => {
        // A typo or a renamed tier must not silently hand out a paid control.
        expect(controlForTier("plusss")).toBe("snooze_only");
        expect(controlForTier("premium")).toBe("snooze_only");
        expect(controlForTier("{}")).toBe("snooze_only");
    });

    it("offers exactly 3 and 5 days", () => {
        expect([...SNOOZE_DAYS]).toEqual([3, 5]);
        expect(isValidSnoozeDays(3)).toBe(true);
        expect(isValidSnoozeDays(5)).toBe(true);
        // ⛔ A client must not be able to snooze itself for a year.
        expect(isValidSnoozeDays(7)).toBe(false);
        expect(isValidSnoozeDays(365)).toBe(false);
        expect(isValidSnoozeDays("3")).toBe(false);
        expect(isValidSnoozeDays(null)).toBe(false);
        expect(isValidSnoozeDays(Infinity)).toBe(false);
    });
});

describe("when the reminder is suppressed", () => {
    const now = AT("2026-10-13T12:00:00.000Z");

    it("suppresses while a snooze is running, and stops when it expires", () => {
        const until = snoozeUntil(3, now);
        expect(isSuppressed(until, false, now)).toBe(true);
        expect(isSuppressed(until, false, AT("2026-10-15T12:00:00.000Z"))).toBe(true);
        // Exactly at the boundary it is over.
        expect(isSuppressed(until, false, AT("2026-10-16T12:00:00.000Z"))).toBe(false);
        expect(isSuppressed(until, false, AT("2026-10-17T00:00:00.000Z"))).toBe(false);
    });

    it("suppresses permanently when a paid user disabled it", () => {
        expect(isSuppressed(null, true, now)).toBe(true);
        expect(isSuppressed(undefined, true, now)).toBe(true);
    });

    it("does not suppress when nothing is set", () => {
        expect(isSuppressed(null, false, now)).toBe(false);
        expect(isSuppressed("", false, now)).toBe(false);
    });

    it("⛔ junk must NOT suppress — silence with no way to notice is worse", () => {
        // Treating an unparseable value as "snoozed forever" would stop a
        // person's reminders permanently and invisibly.
        expect(isSuppressed("not a date", false, now)).toBe(false);
        expect(isSuppressed("NaN", false, now)).toBe(false);
    });

    it("computes 3 and 5 days exactly", () => {
        expect(snoozeUntil(3, now)).toBe("2026-10-16T12:00:00.000Z");
        expect(snoozeUntil(5, now)).toBe("2026-10-18T12:00:00.000Z");
    });
});

describe("the resume date, which the person must be told", () => {
    const now = AT("2026-10-13T12:00:00.000Z");

    it("returns when an active snooze ends", () => {
        const end = snoozeEndsAt(snoozeUntil(5, now), now);
        expect(end?.toISOString()).toBe("2026-10-18T12:00:00.000Z");
    });

    it("returns null rather than a misleading date", () => {
        expect(snoozeEndsAt(null, now)).toBeNull();
        expect(snoozeEndsAt("garbage", now)).toBeNull();
        // Already expired — there is nothing to announce.
        expect(snoozeEndsAt("2026-10-01T00:00:00.000Z", now)).toBeNull();
    });
});

describe("the cron actually enforces the choice", () => {
    const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

    it("⛔ skips suppressed users BEFORE any other check", () => {
        // If this lived anywhere else in the loop, a snoozed person could still
        // be nudged by an earlier branch. The whole control is only real here.
        // RE-POINTED 2026-10-13: this pinned the ordering against
        // `activeUserIds.has(...)`, which isDueNow replaced when the cron moved
        // to per-person local scheduling. The INTENT is unchanged and is what
        // matters — suppression must be decided before any other per-user
        // branch, or a snoozed person could still be nudged by an earlier one.
        const cron = read("src/app/api/push/cron/route.ts");
        const suppressAt = cron.indexOf("isSuppressed(");
        const dueAt = cron.indexOf("isDueNow({");
        expect(suppressAt).toBeGreaterThan(-1);
        expect(dueAt).toBeGreaterThan(-1);
        expect(suppressAt).toBeLessThan(dueAt);
    });

    it("reads both the snooze and the permanent-off key", () => {
        const cron = read("src/app/api/push/cron/route.ts");
        expect(cron).toMatch(/SNOOZE_MEMORY_KEY/);
        expect(cron).toMatch(/DISABLED_MEMORY_KEY/);
    });
});

describe("the API refuses what the tier may not do", () => {
    const route = () =>
        fs.readFileSync(path.join(process.cwd(), "src/app/api/reminders/snooze/route.ts"), "utf8");

    it("⛔ gates 'disable' on the tier, server-side", () => {
        // A client that could set disabled for itself would have the paid
        // control for free by editing one request.
        const src = route();
        expect(src).toMatch(/controlForTier/);
        expect(src).toMatch(/upgrade_required/);
        expect(src).toMatch(/status:\s*403/);
    });

    it("⛔ validates the snooze length rather than trusting the client", () => {
        expect(route()).toMatch(/isValidSnoozeDays/);
    });

    it("never gates turning reminders back ON", () => {
        // Only switching off is a paid control. Resuming must work for everyone,
        // or a free user who snoozed could be stuck waiting it out.
        const src = route();
        const resumeBlock = src.slice(src.indexOf('action === "resume"'));
        expect(resumeBlock).not.toMatch(/upgrade_required/);
    });

    it("returns the resume date so the UI can say when reminders come back", () => {
        expect(route()).toMatch(/until,/);
    });
});

describe("the settings UI offers what the tier allows — and says what cannot be taken away", () => {
    const UI = () => fs.readFileSync(path.join(process.cwd(), "src/app/settings/page.tsx"), "utf8");

    it("offers 3 and 5 day pauses", () => {
        expect(UI()).toMatch(/\(\[3,\s*5\]\s*as const\)/);
    });

    it("⛔ shows 'Turn off' only to paid tiers", () => {
        // The API refuses it regardless, but offering a button that always
        // fails would be a worse experience than not offering it.
        const src = UI();
        expect(src).toMatch(/tier !== "free" && \(/);
    });

    it("⛔ tells the person the resume DATE, never just 'paused'", () => {
        // Silent resumption is what produces "this app won't stop notifying
        // me" reviews — on a 3-day cycle it would happen often.
        const src = UI();
        expect(src).toMatch(/reminders resume on/i);
        expect(src).toMatch(/reminderSnoozedUntil/);
    });

    it("🔑 states that the OS switch is always available", () => {
        // This sentence is load-bearing, not polish: a paywalled in-app off
        // switch is only defensible because silencing Imotara at the system
        // level is free to everyone. If people are not told, it is not a
        // remedy they have.
        expect(UI()).toMatch(/system notification settings/);
    });

    it("sends the reminder hour to the SERVER, not just localStorage", () => {
        // The push is scheduled server-side. A time kept on the device changed
        // nothing — the control looked like it worked and did not.
        const src = UI();
        const fn = src.slice(src.indexOf("function handleNotifReminderTimeChange"));
        expect(fn.slice(0, 900)).toMatch(/\/api\/profile\/sync/);
        expect(fn.slice(0, 900)).toMatch(/reminderHour/);
    });

    it("⚠️ the default hour agrees with mobile and the server", () => {
        // Three defaults for one idea (web 09:00, mobile 20:00, cron 20:00) is
        // how a feature ends up firing at a time nobody chose.
        expect(UI()).toMatch(/useState\("20:00"\)/);
    });
});
