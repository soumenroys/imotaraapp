import { describe, it, expect } from "vitest";
import {
    DEFAULT_REMINDER_HOUR,
    localHourIn,
    localDateIn,
    isDueNow,
} from "@/lib/reminders/schedule";

const T = (iso: string) => new Date(iso);
const KOLKATA = "Asia/Kolkata";
const NY = "America/New_York";

describe("reading the clock where the person actually is", () => {
    it("converts to the local hour", () => {
        // 14:30 UTC = 20:00 in Kolkata (+05:30)
        expect(localHourIn(T("2026-10-14T14:30:00Z"), KOLKATA)).toBe(20);
        // same instant = 10:30 in New York (EDT)
        expect(localHourIn(T("2026-10-14T14:30:00Z"), NY)).toBe(10);
    });

    it("⛔ returns null for an unknown zone rather than guessing", () => {
        // A guess would silently nudge someone in the middle of their night.
        expect(localHourIn(T("2026-10-14T14:30:00Z"), "Mars/Olympus")).toBeNull();
        expect(localHourIn(T("2026-10-14T14:30:00Z"), null)).toBeNull();
        expect(localHourIn(T("2026-10-14T14:30:00Z"), "")).toBeNull();
    });

    it("gives the local calendar date, which can differ from UTC's", () => {
        // 19:00 UTC on the 14th is already the 15th in Kolkata (00:30).
        expect(localDateIn(T("2026-10-14T19:00:00Z"), KOLKATA)).toBe("2026-10-15");
        expect(localDateIn(T("2026-10-14T19:00:00Z"), NY)).toBe("2026-10-14");
    });
});

describe("who gets nudged on this tick", () => {
    const base = { now: T("2026-10-14T14:30:00Z"), timeZone: KOLKATA };

    it("sends at the person's own hour", () => {
        expect(isDueNow({ ...base })).toBe(true); // 20:00 local
    });

    it("stays quiet at every other hour", () => {
        expect(isDueNow({ ...base, now: T("2026-10-14T13:30:00Z") })).toBe(false); // 19:00
        expect(isDueNow({ ...base, now: T("2026-10-14T15:30:00Z") })).toBe(false); // 21:00
        expect(isDueNow({ ...base, now: T("2026-10-14T03:30:00Z") })).toBe(false); // 09:00
    });

    it("honours a chosen hour", () => {
        // 03:30 UTC = 09:00 Kolkata
        expect(isDueNow({ ...base, now: T("2026-10-14T03:30:00Z"), preferredHour: 9 })).toBe(true);
        expect(isDueNow({ ...base, preferredHour: 9 })).toBe(false);
    });

    it("ignores a nonsense hour and uses the default", () => {
        expect(isDueNow({ ...base, preferredHour: 99 })).toBe(true);
        expect(isDueNow({ ...base, preferredHour: -3 })).toBe(true);
        expect(DEFAULT_REMINDER_HOUR).toBe(20);
    });

    it("⛔ never nudges twice in a day", () => {
        const twoHoursAgo = base.now.getTime() - 2 * 60 * 60 * 1000;
        expect(isDueNow({ ...base, lastNotifiedMs: twoHoursAgo })).toBe(false);
        const threeDaysAgo = base.now.getTime() - 3 * 24 * 60 * 60 * 1000;
        expect(isDueNow({ ...base, lastNotifiedMs: threeDaysAgo })).toBe(true);
    });

    it("⛔ stays quiet if they already used Imotara during THEIR day", () => {
        // 06:00 UTC = 11:30 Kolkata, same local day as the 20:00 tick.
        const earlierToday = T("2026-10-14T06:00:00Z").getTime();
        expect(isDueNow({ ...base, lastActiveMs: earlierToday })).toBe(false);
    });

    it("…and does nudge when their last visit was yesterday, their time", () => {
        // 13:00 UTC on the 13th = 18:30 Kolkata on the 13th — the previous
        // local day, even though it is under 24 hours ago.
        const yesterdayEvening = T("2026-10-13T13:00:00Z").getTime();
        expect(isDueNow({ ...base, lastActiveMs: yesterdayEvening })).toBe(true);
    });

    it("⚠️ falls back to UTC for someone with no timezone, rather than dropping them", () => {
        // Existing subscribers predate timezone capture. Silently never nudging
        // them would be a worse bug than nudging at an imperfect hour.
        expect(isDueNow({ now: T("2026-10-14T20:00:00Z"), timeZone: null })).toBe(true);
        expect(isDueNow({ now: T("2026-10-14T14:30:00Z"), timeZone: null })).toBe(false);
    });

    it("treats a malformed zone the same as none", () => {
        expect(isDueNow({ now: T("2026-10-14T20:00:00Z"), timeZone: "Not/AZone" })).toBe(true);
    });
});
