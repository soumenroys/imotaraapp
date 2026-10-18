/**
 * 🔴 THE PANEL ASKED FOR A PASSWORD IT ALREADY HAD.
 *
 * The sign-in marker lives in sessionStorage, which is per tab. The session
 * itself is an httpOnly cookie good for eight hours. So opening /admin in a
 * second tab — or reopening it after closing the first — showed the login form
 * to somebody who was still signed in, while /admin/social, /admin/analytics
 * and /admin/crisis-events worked perfectly in that same tab, because they ask
 * the server instead of the tab.
 *
 * ⚠️ Found by opening the panel in a fresh tab during an end-to-end pass:
 * /api/admin/auth/me returned 200 while the login card was on screen. No test,
 * type check or build could have shown that — only using it from a cold tab.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(process.cwd(), "src/app/admin/page.tsx"), "utf8");

/**
 * The mount effect only.
 *
 * ⚠️ Anchored on the sessionStorage read, not on the fetch URL —
 * SuperAdminsSection calls /api/admin/auth/me too and is declared earlier in
 * the file, so indexOf on the URL found the wrong one and the first version of
 * these tests failed against correct code.
 */
const mountEffect = (() => {
  const from = page.indexOf("const saved = sessionStorage.getItem(SESSION_KEY)");
  return page.slice(from, from + 1600);
})();

describe("a cold tab asks the server, not the person", () => {
  it("🔑 falls back to /api/admin/auth/me when the tab has no marker", () => {
    // The cookie is the authority on whether somebody is signed in.
    // sessionStorage was only ever a cache of that answer, and a cache miss
    // is not a sign-out.
    expect(mountEffect).toMatch(/api\/admin\/auth\/me/);
  });

  it("⛔ holds the screen while it asks, so the login card never flashes", () => {
    expect(page).toMatch(/const \[checking, setChecking\] = useState\(true\)/);
    // 🔑 The gate must be checked BEFORE the login form is returned, or the
    // form renders for a beat and the fix is invisible to anyone but a test.
    expect(page.indexOf("if (checking)")).toBeLessThan(page.indexOf("if (!token) return <LoginGate"));
  });

  it("⛔ and always stops holding it, whatever the answer was", () => {
    // A failed check must land on the login form, never on a spinner that
    // never resolves — which would lock an admin out of their own panel.
    expect(mountEffect).toMatch(/\.finally\([\s\S]{0,160}setChecking\(false\)/);
  });

  it("restores the role in the same breath", () => {
    // Otherwise the nav renders with role null for a moment and hides
    // Broadcast from the owner who just opened the page.
    expect(mountEffect).toMatch(/setMyRole\(who\.role\)/);
  });
});

describe("signing out still signs you out", () => {
  it("🔴 clears the COOKIE, not just the tab", () => {
    /**
     * ⛔ THE ONE WAY THIS FIX COULD GO WRONG. If sign-out only cleared
     * sessionStorage, the next mount would ask the server, get a 200 from the
     * cookie that was never revoked, and sign the person straight back in —
     * a sign-out button that does nothing.
     */
    const signOut = page.slice(page.indexOf("const signOut = async ()"));
    expect(signOut.slice(0, 500)).toMatch(/api\/admin\/auth\/logout/);
    expect(signOut.slice(0, 500)).toMatch(/sessionStorage\.removeItem\(SESSION_KEY\)/);
    // The cookie goes first; clearing the tab before revoking would leave a
    // window where a reload restores the session.
    const body = signOut.slice(0, 500);
    expect(body.indexOf("auth/logout")).toBeLessThan(body.indexOf("sessionStorage.removeItem"));
  });
});
