/**
 * L5a — where server-side licence enforcement belongs, and where it cannot go.
 *
 * 🔴 THE PLAN SAID: "13 feature keys, only 1 has a requireFeature call site.
 * The other 12 are client-only ⇒ bypassable." That framing implied twelve holes
 * to plug. Investigating it on 2026-09-17 found something different, and
 * better: **most of those features have no server surface to gate at all.**
 *
 *   EXPORT_DATA          → /api/export            ✅ enforced (data LEAVES the server)
 *   HISTORY_DAYS_LIMIT   → /api/history           ✅ enforced (server truncates by tier)
 *   HISTORY_UNLIMITED    → same route             ✅ same gate
 *   CLOUD_SYNC           → free on every tier      — nothing to enforce
 *   ADMIN_DASHBOARD      → /api/admin/*           ✅ staff auth, correctly NOT a licence tier
 *   TTS_ADVANCED         → excluded (L5b)          ⛔ gating it changes how a reply SOUNDS
 *   TRENDS_INSIGHTS  ┐
 *   COMPANION_LETTER │   computed in the BROWSER from the user's own local
 *   GROWTH_ARC       │   data and stored in localStorage. No endpoint. No row.
 *   REPLY_CADENCE    │   Nothing crosses the wire, so there is nothing to gate.
 *   SEARCH_MODE      │
 *   MULTI_PROFILE    │
 *   CHILD_SAFE_MODE  ┘
 *
 * ⇒ Bypassing the client gate on a localStorage feature gets you a letter your
 * own browser wrote from your own history. No server cost, no data leak. The
 * client gate is the right and only place for those — it is product UX, not
 * security theatre.
 *
 * ⚠️ IF YOU LATER MOVE one of those features server-side — a letter generated
 * by an API, trends computed on the server — it becomes a real resource and
 * MUST get a requireFeature guard at that point. This test is the tripwire.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const exists = (rel: string) => fs.existsSync(path.join(ROOT, rel));

describe("server enforcement sits where a server resource is at stake", () => {
    it("🔴 /api/export requires the feature — data leaves the server here", () => {
        const route = read("src/app/api/export/route.ts");
        expect(route).toMatch(/requireFeature\(\s*req\s*,\s*"EXPORT_DATA"\s*\)/);
    });

    it("🔴 /api/history truncates by tier — the server decides what it returns", () => {
        const route = read("src/app/api/history/route.ts");
        expect(route).toMatch(/historyRetentionCutoff/);
        expect(route).toMatch(/resolveUserTier/);
    });

    it("🔴 admin routes are gated by STAFF AUTH, never by a licence tier", () => {
        // Buying a plan must never grant admin access. If this ever starts
        // reading a tier, something has gone badly wrong.
        const route = read("src/app/api/admin/dashboard/route.ts");
        expect(route).toMatch(/adminAuthorized/);
        expect(route).not.toMatch(/requireFeature|resolveUserTier/);
    });

    it("⚠️ the localStorage features still have NO server route — the tripwire", () => {
        // If any of these appear, the feature moved server-side and now needs a
        // requireFeature guard. Failing here is not a bug in the test; it is the
        // test doing its job.
        for (const rel of [
            "src/app/api/letters/route.ts",
            "src/app/api/companion-letter/route.ts",
            "src/app/api/trends/route.ts",
            "src/app/api/insights/route.ts",
            "src/app/api/growth-arc/route.ts",
            "src/app/api/profiles/route.ts",
        ]) {
            expect(exists(rel), `${rel} now exists — it needs requireFeature`).toBe(false);
        }
    });

    it("the companion letter is still browser-side, which is why it needs no gate", () => {
        const lib = read("src/lib/imotara/companionLetter.ts");
        expect(lib).toMatch(/^\/\/[\s\S]*?"use client"/m);
        expect(lib).toMatch(/localStorage/);
    });
});
