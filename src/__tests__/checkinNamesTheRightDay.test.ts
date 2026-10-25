import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { buildNudge, localisedWeekday } from "@/app/api/push/cron/route";
import { getNudgeLang } from "@/lib/imotara/nudgeStrings";

/**
 * 🔴 26 Oct 2026: the web check-in says "Something from {day} has stayed with
 * me", but the cron never passed when that conversation happened — buildNudge
 * fell back to `new Date()` and named TODAY. A Wednesday conversation got
 * "Something from Sunday…" on a Sunday.
 */
const WED = new Date("2026-10-21T10:00:00Z"); // a Wednesday

describe("the check-in names the day of the conversation", () => {
    it("uses the conversation's own weekday", () => {
        const n = buildNudge("work was a lot", "en", ["work was a lot"], WED);
        expect(n.body).toMatch(/Wednesday/);
        expect(n.title).toBe(getNudgeLang("en").pt);
    });

    it("in the person's language", () => {
        const n = buildNudge("কাজের চাপ", "bn", ["কাজের চাপ"], WED);
        expect(n.body).toContain(localisedWeekday(WED, "bn") as string);
    });

    it("⛔ with no date, says nothing about a day — the generic nudge, never a guessed one", () => {
        const L = getNudgeLang("en");
        const n = buildNudge("work was a lot", "en", ["work was a lot"]);
        expect(L.gb).toContain(n.body);
        expect(n.title).toBe(L.gt);
    });

    it("⛔ an invalid date is treated as no date", () => {
        const L = getNudgeLang("en");
        expect(L.gb).toContain(buildNudge("hello", "en", ["hello"], new Date("nonsense")).body);
    });

    it("the cron passes the quoted message's own created_at", () => {
        const src = fs.readFileSync(path.join(process.cwd(), "src/app/api/push/cron/route.ts"), "utf8");
        expect(src).toMatch(/lastMessageAtMap\.set\(msg\.user_scope, at\)/);
        expect(src).toMatch(/recentMessagesMap\.get\(row\.user_id\) \?\? \[\],\s*lastMessageAtMap\.get\(row\.user_id\),\s*\)/);
        expect(src).not.toMatch(/localisedWeekday\(lastMessageAt \?\? new Date\(\)/);
    });
});
