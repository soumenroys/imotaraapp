/**
 * 🔴 2FA WAS ANNOUNCED AND NEVER ASKED FOR.
 *
 * Enrolment worked — QR code, verification, eight backup codes — and the
 * Admins screen said "2FA is enabled on your account". The login route never
 * read `totp_enabled`, so an enrolled admin was signed in by password alone.
 * A control that announces itself and does nothing is worse than none: people
 * pick a weaker password on the strength of it.
 *
 * ⚠️ Two more things were broken underneath it. `admin_sessions` had no
 * `two_fa_verified` column, so the verify route's challenge branch 401'd on
 * every request. And the eight backup codes — the only way back in after a
 * lost phone — were generated, stored, and never compared to anything.
 *
 * ⛔ THE RISK THIS FILE GUARDS IS LOCKOUT, not bypass. This is the only door
 * into the panel. Every "absent value" case below must fail OPEN (not yet
 * enforcing), because failing closed locks out the person who would fix it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sessionNeedsSecondFactor } from "@/lib/admin/twoFactor";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const login = read("src/app/api/admin/auth/login/route.ts");
const guard = read("src/app/api/admin/_auth.ts");
const verify = read("src/app/api/admin/auth/2fa/verify/route.ts");

describe("the rule itself", () => {
  it("refuses an enrolled admin whose session has not been verified", () => {
    expect(sessionNeedsSecondFactor({ totp_enabled: true }, { two_fa_verified: false })).toBe(true);
  });

  it("lets an enrolled admin through once the session is verified", () => {
    expect(sessionNeedsSecondFactor({ totp_enabled: true }, { two_fa_verified: true })).toBe(false);
  });

  it("⛔ never refuses somebody who has no second factor to give", () => {
    // 🔴 The worst possible bug here: locking out an account that cannot
    // satisfy the challenge. There is no way back from that.
    for (const t of [false, null, undefined]) {
      expect(sessionNeedsSecondFactor({ totp_enabled: t }, { two_fa_verified: false })).toBe(false);
    }
    expect(sessionNeedsSecondFactor({}, { two_fa_verified: false })).toBe(false);
    expect(sessionNeedsSecondFactor(null, null)).toBe(false);
  });

  it("⚠️ an ABSENT two_fa_verified counts as verified — the migration may not have run", () => {
    // Failing closed here would refuse every admin the moment the code deploys
    // ahead of the SQL, including whoever would have to run it.
    expect(sessionNeedsSecondFactor({ totp_enabled: true }, {})).toBe(false);
    expect(sessionNeedsSecondFactor({ totp_enabled: true }, { two_fa_verified: null })).toBe(false);
    expect(sessionNeedsSecondFactor({ totp_enabled: true }, undefined)).toBe(false);
  });
});

describe("login asks for it", () => {
  it("🔴 reads totp_enabled from the database", () => {
    // Leaving it out of the select does not fail — it reads undefined, decides
    // no factor is needed, and signs an enrolled admin straight in. A guard
    // that is skipped looks exactly like one that passed.
    const select = login.slice(login.indexOf('.select("id, email'), login.indexOf('.select("id, email') + 220);
    expect(select, "totp_enabled is not selected, so enforcement is a no-op").toContain("totp_enabled");
  });

  it("marks the new session unverified for an enrolled admin", () => {
    expect(login).toMatch(/two_fa_verified:\s*!needsSecondFactor/);
  });

  it("tells the screen not to open the panel yet", () => {
    expect(login).toMatch(/requires2fa:\s*needsSecondFactor/);
  });

  it("⛔ still logs somebody in when the migration has not run", () => {
    /**
     * 🔴 THE ONE WAY THIS COULD HAVE LOCKED EVERYBODY OUT. Inserting a column
     * that does not exist fails the insert, and a failed insert here is a
     * failed LOGIN for every admin. The retry drops the column and carries on
     * — enforcement is simply not yet on, which is how yesterday behaved.
     */
    const block = login.slice(login.indexOf("let { error: sessionErr }"));
    expect(block.slice(0, 900)).toMatch(/two_fa_verified/);
    expect(block.slice(0, 900)).toMatch(/delete sessionRow\.two_fa_verified/);
  });
});

describe("the guard enforces it", () => {
  it("uses the shared rule rather than its own copy", () => {
    expect(guard).toContain("sessionNeedsSecondFactor");
  });

  it("⚠️ selects the session with * so a missing column cannot break auth", () => {
    // Naming two_fa_verified explicitly would 42703 wherever the migration has
    // not run — and a failing auth query does not degrade, it denies everyone.
    const q = guard.slice(guard.indexOf('.from("admin_sessions")'));
    expect(q.slice(0, 200)).toContain('.select("*")');
  });

  it("answers 401 and says which problem it is", () => {
    // \u26a0\ufe0f Anchored on the CALL, not the first mention \u2014 the import line
    // comes first in the file and the slice from there showed nothing useful.
    const block = guard.slice(guard.indexOf("if (sessionNeedsSecondFactor("));
    expect(block.slice(0, 500)).toMatch(/requires2fa/);
    expect(block.slice(0, 500)).toMatch(/401/);
  });
});

describe("the challenge can actually be completed", () => {
  it("⛔ does NOT authenticate itself with requireSuperAdmin", () => {
    /**
     * 🔴 THE DEADLOCK. That guard now refuses unverified sessions — which is
     * every session reaching this route during a challenge. Using it would
     * make the one endpoint that ends the deadlock unreachable.
     */
    // \u26a0\ufe0f The CALL, not the word \u2014 the comment above the cookie read names
    // requireSuperAdmin to explain why it is not used, and a bare substring
    // check failed on that explanation.
    expect(verify).not.toMatch(/await requireSuperAdmin\(/);
    expect(verify).not.toMatch(/^import .*requireSuperAdmin/m);
    expect(verify, "it must read the session cookie itself").toContain("SESSION_COOKIE");
  });

  it("🔑 accepts a backup code, which nothing ever did before", () => {
    expect(verify).toContain("totp_backup_codes");
    expect(verify).toMatch(/sameCode/);
  });

  it("⛔ spends a backup code so it cannot be reused", () => {
    // A backup code that still works after use is a password on a sticky note
    // with extra steps.
    const block = verify.slice(verify.indexOf("usedBackupCode = true"));
    expect(block.slice(0, 400)).toMatch(/filter\(/);
    expect(block.slice(0, 400)).toMatch(/totp_backup_codes/);
  });

  it("compares backup codes in constant time", () => {
    expect(verify).toContain("timingSafeEqual");
  });

  it("⚠️ will not match a backup code before enrolment is finished", () => {
    // There are none yet; matching against an empty list must never succeed.
    expect(verify).toMatch(/row\.totp_enabled && storedBackup\.length > 0/);
  });

  it("🔑 enrolling marks the session verified, or you lock yourself out", () => {
    // Switching 2FA on would otherwise refuse the very session that switched it on.
    const enrol = verify.slice(verify.indexOf("if (!row.totp_enabled)"));
    expect(enrol.slice(0, 700)).toMatch(/markVerified/);
  });

  it("⛔ reports a failure to mark rather than claiming success", () => {
    // Returning ok when the session was not marked would send the admin back
    // into the panel, be refused by the guard, and look like the code was wrong.
    expect(verify).toMatch(/could not be marked verified/);
    expect(verify).toMatch(/admin_session_two_fa\.sql/);
  });
});

describe("the screen does not open the panel early", () => {
  const page = read("src/app/admin/page.tsx");

  it("🔴 stops at the challenge instead of signing in", () => {
    const submit = page.slice(page.indexOf("const j = await res.json();"));
    expect(submit.slice(0, 600)).toMatch(/if \(j\.requires2fa\)[\s\S]{0,80}return;/);
  });

  it("⚠️ only caches the session marker AFTER the code is accepted", () => {
    // Setting it at password time would let a reload walk straight past the
    // challenge into a panel every route is about to refuse.
    const submit = page.slice(page.indexOf("const j = await res.json();"), page.indexOf("const j = await res.json();") + 600);
    expect(submit.indexOf("requires2fa")).toBeLessThan(submit.indexOf("sessionStorage.setItem"));
  });

  it("tells somebody who lost their phone what to do", () => {
    expect(page).toMatch(/backup codes you saved/i);
  });
});
