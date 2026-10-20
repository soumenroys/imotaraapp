/**
 * 🔴 EVERY SOCIAL ALERT HAD BEEN FAILING TO SEND, AND NOTHING SAID SO.
 *
 * Read out of the production logs on 20 Oct 2026, while looking for why four
 * Instagram slots were empty:
 *
 *   [social-queue] the alert itself failed to send: validation_error
 *   Invalid `from` field. The email address needs to follow the
 *   `email@example.com` or `Name <email@example.com>` format.
 *
 * ⛔ THE CAUSE. `BROADCAST_FROM_EMAIL` is a BARE address, so `parseIdentities`
 * leaves `name` empty — correctly, there is no display name — and every
 * caller then built `${name} <${email}>`. With an empty name that is
 * `" <a@b.com>"`: a leading space and no name, which is neither accepted form.
 *
 * 🔴 WHICH IS THE WORST PLACE THIS COULD HAPPEN. These alerts are the things
 * that speak when nothing else will — "a slot passed unreviewed", "three
 * drafts were written and none passed". **A guard whose message cannot be
 * delivered is a guard that does not exist**, and its silence reads exactly
 * like everything being fine
 * ⇒ trap_a_guard_against_silence_can_itself_be_a_postmortem.
 *
 * ⚠️ AND IT WENT UNNOTICED BECAUSE THE FAILURE IS LOGGED, NOT RAISED. Each
 * sender catches the error and `console.error`s it, which is right — an alert
 * that throws would take the cron down with it — but it means the only
 * evidence lived in a log nobody reads until something else goes wrong.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { fromAddress, parseIdentities } from "@/lib/broadcast/resendClient";

/**
 * Resend's own rule, from the error message it returned:
 * `email@example.com` or `Name <email@example.com>`.
 */
function resendAccepts(from: string): boolean {
  if (/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from)) return true;
  const m = /^(.+?)\s<([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>$/.exec(from);
  return Boolean(m && m[1].trim().length > 0);
}

const ORIGINAL = process.env.BROADCAST_FROM_EMAIL;
beforeEach(() => { delete process.env.BROADCAST_FROM_EMAIL; });
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.BROADCAST_FROM_EMAIL;
  else process.env.BROADCAST_FROM_EMAIL = ORIGINAL;
});

describe("the From header the alerts actually send", () => {
  it("🔴 the LIVE value produces something Resend accepts", () => {
    /**
     * ⛔ PINNED AS THE REAL CONFIGURED ADDRESS, not a representative one. The
     * bug needed a bare address to appear at all, and a test using
     * "Name <addr>" would have passed throughout.
     */
    process.env.BROADCAST_FROM_EMAIL = "suchismita.sen@imotara.com";
    const from = fromAddress();
    expect(from).toBe("suchismita.sen@imotara.com");
    expect(resendAccepts(from), `Resend would reject ${JSON.stringify(from)}`).toBe(true);
  });

  it("⛔ and specifically is NOT the empty-name shape that was being sent", () => {
    process.env.BROADCAST_FROM_EMAIL = "suchismita.sen@imotara.com";
    expect(fromAddress()).not.toBe(" <suchismita.sen@imotara.com>");
    expect(fromAddress().startsWith(" ")).toBe(false);
    expect(resendAccepts(" <suchismita.sen@imotara.com>"), "the broken shape is considered valid, so this test proves nothing").toBe(false);
  });

  it("keeps a display name when one is configured", () => {
    process.env.BROADCAST_FROM_EMAIL = "Imotara Social <social@imotara.com>";
    expect(fromAddress()).toBe("Imotara Social <social@imotara.com>");
    expect(resendAccepts(fromAddress())).toBe(true);
  });

  it("falls back to a named sender when nothing is configured at all", () => {
    const from = fromAddress();
    expect(from).toBe("Imotara <social@imotara.com>");
    expect(resendAccepts(from)).toBe(true);
  });

  it("⚠️ an address on another domain cannot send, so it falls back rather than being used", () => {
    // `canSendFrom` already drops it; this pins that the fallback is still valid.
    process.env.BROADCAST_FROM_EMAIL = "someone@gmail.com";
    expect(parseIdentities("someone@gmail.com")).toEqual([]);
    expect(resendAccepts(fromAddress())).toBe(true);
  });

  it("⛔ every form parseIdentities can produce yields a valid From", () => {
    /**
     * 🔑 THE SWEEP, because the defect was one branch of two and a test of the
     * other branch passed happily for as long as it existed.
     */
    for (const raw of [
      "suchismita.sen@imotara.com",
      "Imotara <social@imotara.com>",
      "  spaced@imotara.com  ",
      '"Quoted Name" <info@imotara.com>',
      "a@imotara.com,b@imotara.com",
      "",
    ]) {
      process.env.BROADCAST_FROM_EMAIL = raw;
      const from = fromAddress();
      expect(resendAccepts(from), `${JSON.stringify(raw)} produced ${JSON.stringify(from)}`).toBe(true);
    }
  });
});

describe("⛔ and no sender builds that header by hand any more", () => {
  it("alert.ts goes through the one helper", () => {
    /**
     * ⚠️ There were FIVE copies of the broken line in this one file. A fix
     * applied to the sender that happened to be failing would have left the
     * other four ⇒ feedback_durable_fixes_only.
     */
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/social/alert.ts"), "utf8");
    expect(src).not.toMatch(/\$\{identity\.name\}\s*</);
    expect((src.match(/fromAddress\(\)/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });
});
