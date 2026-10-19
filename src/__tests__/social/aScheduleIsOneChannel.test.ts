/**
 * 🔴 A SCHEDULE IS ONE CHANNEL — and the reason is not tidiness.
 *
 * The owner, 19 Oct: "Ensure Scheduler is working for every social media
 * separately, not as one schedule for all social medias."
 *
 * A shared schedule shares its BRIEF, its content type, its angles and its
 * languages. Only the clock could ever differ, through `platform_times`. So
 * "a carousel on Instagram, written from an angle shaped for a list" was
 * literally unaskable: choosing it would have changed Facebook too. The
 * measurement that proves the brief is what decides the shape is recorded in
 * topicPools.ts — `ways-of-saying` produced 3/3 product-shaped posts under the
 * live brief and 2/2 real lists under a neutral one.
 *
 * ⛔ AND THE REGRESSION THIS GUARDS. Turning the picker into a radio would
 * silently drop a channel from the existing two-channel schedule the moment
 * somebody opened it to change the time — and the only symptom would be a
 * feed that quietly stopped ⇒ trap_a_frozen_decision_outlives_its_rule.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
process.env.SOCIAL_TOKEN_KEY ??= Buffer.alloc(32, 9).toString("base64");

import { slotsInHorizon } from "@/lib/social/horizon";

const form = readFileSync(join(process.cwd(), "src/app/admin/social/_components/NewSchedule.tsx"), "utf8");

describe("the form asks for one channel", () => {
  it("a new schedule picks ONE, as a radio", () => {
    const at = form.indexOf('type={legacyMultiChannel ? "checkbox" : "radio"}');
    expect(at).toBeGreaterThan(-1);
    // ⚠️ And choosing one REPLACES the selection rather than adding to it.
    expect(form).toContain("setPlatforms([p.id])");
  });

  it("⛔ an existing two-channel schedule keeps its checkboxes", () => {
    expect(form).toContain("const legacyMultiChannel = (editing?.platforms?.length ?? 0) > 1;");
    // The per-channel time block belongs to the old shape only.
    expect(form).not.toMatch(/\{platforms\.length > 1 && \(/);
  });

  it("and says so, rather than changing behaviour in silence", () => {
    expect(form).toMatch(/This is the old shape/);
  });
});

/**
 * 🔑 THE BACKEND NEVER NEEDED CHANGING, and that is worth pinning rather than
 * remembering: the horizon walks `platforms`, so one channel is an array of
 * one and two is an array of two. ⛔ A "fix" that made the backend
 * single-channel would have broken the live schedule.
 */
describe("one channel per schedule works end to end", () => {
  const base = {
    id: "s1",
    post_at: "17:00:00",
    timezone: "Asia/Kolkata",
    days: [0, 1, 2, 3, 4, 5, 6],
    active: true,
    platform_times: null,
  };
  const NOW = new Date("2026-10-19T05:08:00Z");

  it("two single-channel schedules produce exactly what one shared one did", () => {
    const shared = slotsInHorizon(
      { ...base, id: "shared", platforms: ["facebook", "instagram"], platform_times: { instagram: { post_at: "17:00" } }, post_at: "17:30:00" },
      NOW,
    );
    const split = [
      ...slotsInHorizon({ ...base, id: "shared", platforms: ["facebook"], post_at: "17:30:00" }, NOW),
      ...slotsInHorizon({ ...base, id: "shared", platforms: ["instagram"], post_at: "17:00:00" }, NOW),
    ];
    const key = (x: { platform: string; scheduledFor: string }) => `${x.platform}|${x.scheduledFor}`;
    expect(new Set(split.map(key))).toEqual(new Set(shared.map(key)));
  });

  it("⛔ and they are genuinely independent — switching one off leaves the other", () => {
    // 🔴 THE WHOLE POINT. Under one shared schedule, `active: false` silenced
    // both channels and there was no way to stop one.
    const fb = slotsInHorizon({ ...base, id: "fb", platforms: ["facebook"], active: false }, NOW);
    const ig = slotsInHorizon({ ...base, id: "ig", platforms: ["instagram"] }, NOW);
    expect(fb).toEqual([]);
    expect(ig.length).toBeGreaterThan(0);
  });
});
