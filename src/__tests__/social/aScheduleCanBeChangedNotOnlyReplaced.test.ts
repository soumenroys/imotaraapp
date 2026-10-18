/**
 * 🔴 A SCHEDULE WAS CREATE-ONLY, AND NOTHING SAID SO.
 *
 * The PATCH route has always accepted the name, the brief, the channels, the
 * languages, the days, the hour, the tone, the length AND the topic pools.
 * The screen only ever sent `active`. So the only way to change what a live
 * schedule writes about was to delete it and make another — and deleting one
 * severs its posts from it, which is the record of what went out in the
 * company's name.
 *
 * ⚠️ FOUND BY TRYING TO DO IT. Not by reading the code, not by a test: by
 * needing to add a topic pool to a running schedule on 18 Oct and finding the
 * product had no way to do it at all. ⇒ An API that supports something the UI
 * never calls is indistinguishable, from the outside, from an API that does
 * not support it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const form = read("src/app/admin/social/_components/NewSchedule.tsx");
const page = read("src/app/admin/social/schedules/page.tsx");
const route = read("src/app/api/admin/social/schedules/[id]/route.ts");

describe("the form can edit, not only create", () => {
  it("sends PATCH to the schedule's own url when editing", () => {
    expect(form).toMatch(/editing \? `\/api\/admin\/social\/schedules\/\$\{editing\.id\}`/);
    expect(form).toMatch(/method: editing \? "PATCH" : "POST"/);
  });

  /**
   * ⛔ EVERY FIELD THE ROUTE ACCEPTS MUST BE REACHABLE, or this becomes the
   * same bug one layer down: a form that edits four of nine things, with no
   * sign of which five it silently ignores.
   */
  it("prefills every field the route can change", () => {
    for (const field of [
      "editing?.name",
      "editing?.brief",
      "editing?.platforms",
      "editing?.content_type",
      "editing?.topic_pool",
      "editing?.languages",
      "editing?.post_at",
      "editing?.days",
      "editing?.tone",
      "editing?.length_hint",
      "editing?.auto_publish",
    ]) {
      expect(form, `${field} is never read, so editing a schedule would reset it`).toContain(field);
    }
  });

  /**
   * ⚠️ `post_at` comes back from Postgres as "09:30:00" and a time input
   * wants "09:30". Without the slice the field renders empty, and saving an
   * empty one fails the route's own `HH:MM` check — which reads as the edit
   * being broken rather than as a format.
   */
  it("trims the seconds off the stored time", () => {
    expect(form).toMatch(/String\(editing\?\.post_at \?\? "09:30"\)\.slice\(0, 5\)/);
  });

  it("the topic pools it offers are the shared ones", () => {
    // 🔑 Which is what makes a NEW pool editable into an OLD schedule at all.
    expect(form).toMatch(/const POOLS = TOPIC_POOLS\.map\(/);
  });
});

describe("the page opens it", () => {
  it("has an Edit control on the schedule, not only Pause", () => {
    expect(page).toMatch(/setEditing\(s\)/);
    expect(page).toContain(">\n                        Edit\n                      </button>");
  });

  /**
   * 🔴 WITHOUT A KEY, REACT KEEPS THE FIRST SCHEDULE'S STATE. Opening schedule
   * A, closing it, then opening schedule B would show B's name on A's brief,
   * pools and days — and saving would write one schedule's words onto another.
   * The component only reads `editing` in its useState initialisers, which run
   * once per mounted instance.
   */
  it("⛔ keys the form on the schedule, so switching re-reads its values", () => {
    expect(page).toMatch(/key=\{editing\?\.id \?\? "new"\}/);
  });

  it("closes an open edit when a new schedule is started", () => {
    const toggle = page.slice(page.indexOf("onClick={() => {"), page.indexOf('{creating ? "Close"'));
    expect(toggle).toContain("setEditing(null)");
  });

  it("⚠️ says that posts already written keep their old words", () => {
    // Editing the brief does not rewrite yesterday's drafts, and somebody will
    // otherwise assume it did.
    expect(page).toMatch(/Posts already written keep the words they were written with/);
  });
});

describe("the route this leans on", () => {
  it("accepts the topic pool, which is the field that prompted all this", () => {
    expect(route).toMatch(/if \(body\.topicPool !== undefined\) patch\.topic_pool = body\.topicPool;/);
  });

  it("is owner-guarded like the rest of the schedule writes", () => {
    expect(route).toMatch(/requireSocial(Owner|Admin)\(/);
  });
});
