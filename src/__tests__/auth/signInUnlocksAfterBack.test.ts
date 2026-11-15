/**
 * 15 Nov 2026 (owner, reproduced live): Apple → cancel/Back ⇒ the sign-in panel came back from the
 * back/forward cache still busy — "Opening…", every button and the × disabled, nothing to unlock it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

const src = readFileSync("src/components/auth/SignInPanel.tsx", "utf8");

describe("the sign-in panel never stays locked after leaving for a provider", () => {
  it("a page restored from the back/forward cache is unlocked", () => {
    expect(src).toMatch(/addEventListener\("pageshow", unlock\)/);
    expect(src).toMatch(/const unlock = \(e: PageTransitionEvent\) => \{ if \(e\.persisted\) setBusy\(null\); \}/);
  });

  it("a redirect that never happens unlocks after a while (provider buttons and company SSO)", () => {
    const provider = src.slice(src.indexOf("async function withProvider"), src.indexOf("// As they type an email"));
    expect(provider).toMatch(/guardRedirect\(\);/);
    const sso = src.slice(src.indexOf("async function withCompanySso"), src.indexOf("async function ssoSubmit"));
    expect(sso).toMatch(/window\.location\.href = data\.url;\s*guardRedirect\(\);/);
    expect(src).toMatch(/setTimeout\(\(\) => \{ setBusy\(null\); redirectGuard\.current = null; \}, 15000\)/);
  });

  it("an error still unlocks at once (and does not arm the guard)", () => {
    const provider = src.slice(src.indexOf("async function withProvider"), src.indexOf("// As they type an email"));
    expect(provider).toMatch(/if \(err\) \{ setError\(friendlyAuthError\(err\.message\)\); setBusy\(null\); return; \}/);
  });
});

import { returnedAuthMessage, withAuthError } from "@/lib/auth/signInOptions";

describe("a sign-in that comes back without succeeding is explained (all providers + company SSO)", () => {
  it("cancel at any provider reads as a cancel, never as a scary error", () => {
    for (const c of ["access_denied", "user_cancelled_authorize", "The user denied the request", "consent_required", "interaction_required"]) {
      expect(returnedAuthMessage(c)).toMatch(/^Sign-in was cancelled — nothing has changed/);
    }
    expect(returnedAuthMessage("timeout")).toMatch(/took too long/);
    expect(returnedAuthMessage("no_session")).toMatch(/couldn't finish/);
    expect(returnedAuthMessage("Unable to exchange external code")).toBe("Something went wrong. Please try again.");
  });

  it("the error is added correctly even when the page already has a query", () => {
    expect(withAuthError("/chat", "timeout")).toBe("/chat?auth_error=timeout");
    expect(withAuthError("/admin/social?view=trouble", "access_denied")).toBe("/admin/social?view=trouble&auth_error=access_denied");
  });

  it("the callback uses it on all three ways back, and reads errors after # too", () => {
    const cb = readFileSync("src/app/auth/callback/page.tsx", "utf8");
    expect(cb.match(/withAuthError\(/g)?.length).toBe(3);
    expect(cb).not.toMatch(/\?auth_error=/);
    expect(cb).toMatch(/searchParams\.get\("error"\) \?\? hashParams\.get\("error"\)/);
  });

  it("the panel reopens with the sentence (except on pages that explain it themselves), and cleans the address", () => {
    expect(src).toMatch(/setError\(returnedAuthMessage\(code\)\);\s*setOpen\(true\);/);
    expect(src).toMatch(/EXPLAINS_OWN_AUTH_ERROR\.includes\(url\.pathname\)/);
    expect(src).toMatch(/url\.searchParams\.delete\("auth_error"\)/);
  });
});
