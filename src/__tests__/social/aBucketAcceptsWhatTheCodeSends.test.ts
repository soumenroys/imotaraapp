/**
 * ⛔ THE BUCKET MUST ACCEPT EVERY TYPE THIS CODE UPLOADS.
 *
 * 🔴 THE DEFECT, live and blocking on 19 Oct. Approving a short_video failed
 * with "mime type video/mp4 is not supported" — AFTER ffmpeg had done all its
 * work. `social-cards` was created with `allowed_mime_types = ['image/jpeg']`,
 * correctly, while the only thing stored in it was a JPEG card. Video storage
 * was added to the same bucket later and nothing told the bucket.
 *
 * 🔑 AND THE CONSTRAINT WAS ALREADY WRITTEN DOWN, in cardStore.ts, three
 * functions above the code that broke it: "`.jpg` because the bucket only
 * accepts image/jpeg". ⛔ A limit recorded in a COMMENT cannot be consulted by
 * the code that has to satisfy it, and cannot fail when something stops
 * satisfying it ⇒ trap_a_constraint_nobody_told_the_writer.
 *
 * ⚠️ WHY THIS READS THE SQL FILE, which is unusual and deliberate. The bucket
 * is configured in Postgres, so no amount of TypeScript can observe it. The
 * SQL that configures it IS in this repository, and the two drifting apart is
 * precisely the failure. Holding one against the other is the only check that
 * could have caught this before it reached an approval button.
 *
 * ⛔ IT IS NOT A MIRROR. The two artifacts are written in different languages
 * by different edits for different reasons; this asserts they AGREE, not that
 * either one says something in particular.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { STORED_MIME_TYPES, STORED_BYTES_MAX, CARD_BUCKET } from "@/lib/social/cardStore";

const sql = readFileSync(join(process.cwd(), "docs/sql/social_card_store_accepts_video.sql"), "utf8");

/** The `array['a','b']` the bucket is set to, as the SQL actually spells it. */
function declaredTypes(): string[] {
  const m = sql.match(/allowed_mime_types\s*=\s*array\[([^\]]+)\]/i);
  if (!m) throw new Error("the SQL no longer sets allowed_mime_types in a form this test can read");
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

describe("what the code sends and what the bucket takes", () => {
  it("⛔ every type the code can upload is allowed by the bucket", () => {
    const allowed = new Set(declaredTypes());
    for (const type of STORED_MIME_TYPES) {
      expect(allowed.has(type), `the code uploads ${type}, which the bucket refuses`).toBe(true);
    }
  });

  it("⚠️ and the bucket allows nothing the code never sends", () => {
    /**
     * 🔑 THE OTHER DIRECTION MATTERS TOO, though less loudly. A bucket that
     * accepts types nothing uploads is a door left open — and more usefully
     * here, it catches a type REMOVED from the code without being removed
     * from the bucket, which is how a stale permission outlives its reason.
     */
    expect(declaredTypes().sort()).toEqual([...STORED_MIME_TYPES].sort());
  });

  it("the size ceiling in the SQL is the one the code documents", () => {
    const m = sql.match(/file_size_limit\s*=\s*(\d+)/i);
    expect(m, "the SQL no longer sets file_size_limit").not.toBeNull();
    expect(Number(m![1])).toBe(STORED_BYTES_MAX);
  });

  it("⛔ the SQL updates the bucket this code actually writes to", () => {
    // ⚠️ A perfect mime list on the wrong bucket fixes nothing.
    expect(sql).toContain(`'${CARD_BUCKET}'`);
  });

  it("⛔ it verifies rather than trusting the update matched a row", () => {
    /**
     * 🔴 `update … where id = '…'` that matches NOTHING is silent. This file
     * is most likely to be run against a project where the bucket does not
     * exist yet, and a silent no-op would leave the exact failure it is
     * meant to fix, with a green "Success" on the screen.
     */
    expect(sql).toMatch(/raise exception/i);
    expect(sql).toMatch(/social_card_store\.sql/);
  });
});

describe("every upload in the module declares a type that is allowed", () => {
  it("⛔ no contentType is sent that the declaration does not cover", () => {
    /**
     * ⚠️ A SOURCE ASSERTION, because the thing that broke was a call site —
     * `putVideo` sending video/mp4 — that no type system objected to. The
     * declaration above is only worth having if nothing bypasses it.
     */
    const store = readFileSync(join(process.cwd(), "src/lib/social/cardStore.ts"), "utf8");
    const sent = [...store.matchAll(/contentType:\s*[^,\n]*?"([a-z]+\/[a-z0-9.+-]+)"/g)].map((m) => m[1]);
    const alsoTernary = [...store.matchAll(/"((?:image|video|audio)\/[a-z0-9.+-]+)"/g)].map((m) => m[1]);
    const every = new Set([...sent, ...alsoTernary]);
    expect(every.size, "no content types found at all — the pattern has gone stale").toBeGreaterThan(0);
    for (const type of every) {
      expect(
        (STORED_MIME_TYPES as readonly string[]).includes(type),
        `cardStore.ts uploads ${type}, which STORED_MIME_TYPES does not declare`,
      ).toBe(true);
    }
  });
});
