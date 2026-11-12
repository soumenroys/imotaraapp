// src/__tests__/auth/signInForEveryone.test.ts
// 🔑 #134 (owner, 12 Nov 2026): sign in with ANY email (a 6-digit code, or a password) or with
// Google, Microsoft, Apple or LinkedIn — one panel for every "Sign in" button on the site.
// ⇒ lib/auth/signInOptions.ts · components/auth/SignInPanel.tsx
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { enabledOAuth, enabledEmail, safeTarget, callbackUrl, friendlyAuthError, OAUTH_OPTIONS } from "@/lib/auth/signInOptions";

describe("a way in is shown only once it works", () => {
  it("nothing configured ⇒ Google only, no email (exactly as before #134)", () => {
    expect(enabledOAuth(undefined).map((o) => o.id)).toEqual(["google"]);
    expect(enabledEmail(undefined)).toEqual([]);
  });
  it("the owner's list switches each one on, in a fixed order; unknown names are ignored", () => {
    expect(enabledOAuth(" linkedin_oidc, azure ,google,apple,facebook").map((o) => o.id)).toEqual(["google", "azure", "apple", "linkedin_oidc"]);
    expect(enabledEmail("password, code")).toEqual(["code", "password"]);
  });
  it("Google AND Microsoft always show their account chooser", () => {
    for (const id of ["google", "azure"]) {
      expect(OAUTH_OPTIONS.find((o) => o.id === id)?.queryParams).toEqual({ prompt: "select_account" });
    }
  });
  it("Microsoft asks for the email scope (personal accounts hide it otherwise)", () => {
    expect(OAUTH_OPTIONS.find((o) => o.id === "azure")?.scopes).toBe("email");
  });
});

describe("you come back to where you were — and only to this site", () => {
  it.each([
    ["/upgrade", "/upgrade"],
    ["/connect?tab=wallet", "/connect?tab=wallet"],
    ["//attacker", "/chat"],
    ["https:/" + "/attacker", "/chat"],
    ["/auth/callback", "/chat"],
    ["", "/chat"],
  ])("%s ⇒ %s", (input, out) => {
    expect(safeTarget(input)).toBe(out);
  });
  it("the callback carries the page, encoded", () => {
    expect(callbackUrl("https://www.imotara.com", "/connect?tab=wallet")).toBe(
      "https://www.imotara.com/auth/callback?redirectTo=%2Fconnect%3Ftab%3Dwallet",
    );
  });
});

describe("errors a person can act on", () => {
  it.each([
    ["Invalid login credentials", /don't match/],
    ["Email not confirmed", /confirm your email/],
    ["User already registered", /already an account/],
    ["Token has expired or is invalid", /expired/],
    ["For security purposes, you can only request this after 52 seconds.", /wait a minute/],
  ])("%s", (raw, rx) => {
    expect(friendlyAuthError(raw)).toMatch(rx);
  });
});

describe("the panel", () => {
  const PANEL = readFileSync("src/components/auth/SignInPanel.tsx", "utf8");
  it("codes come from OUR route — never Supabase's own mailer", () => {
    expect(PANEL).toContain('fetch("/api/auth/email-code"');
    expect(PANEL).not.toMatch(/signInWithOtp\(|auth\.signUp\(|resetPasswordForEmail\(/);
  });
  it("a code is checked as an EMAIL code", () => {
    expect(PANEL).toMatch(/verifyOtp\(\{ email: step\.email, token, type: "email" \}\)/);
  });
  it("creating an account and resetting a password = a code first, THEN a password", () => {
    expect(PANEL).toMatch(/if \(step\.intent !== "signin"\) \{[^}]*kind: "set-password"/);
    expect(PANEL).toMatch(/auth\.updateUser\(\{ password \}\)/);
  });
  it("⛔ no extra click while Google is the only way in", () => {
    expect(PANEL).toMatch(/if \(ways\.length === 1 && enabledEmail\(\)\.length === 0\)/);
  });
  it("sign-ins made on the panel are counted like the OAuth callback counts them", () => {
    expect(PANEL).toMatch(/gaEventBeforeLeaving\(signInKind\(createdAt\)/);
  });
  it("is mounted once, in the root layout", () => {
    expect(readFileSync("src/app/layout.tsx", "utf8")).toContain("<SignInPanel />");
  });
  it("the Forgot password page hands over to the panel once email sign-in is on", () => {
    const page = readFileSync("src/app/auth/forgot-password/page.tsx", "utf8");
    expect(page).toMatch(/if \(enabledEmail\(\)\.length > 0\) \{\s*openSignIn\("\/chat", \{ intent: "reset"/);
  });
});

describe("⛔ no Google-only sign-in button is left anywhere", () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) { if (f !== "__tests__") walk(p, out); }
      else if (/\.(tsx?|jsx?)$/.test(f)) out.push(p);
    }
    return out;
  }
  it("only the shared sign-in panel calls signInWithOAuth", () => {
    const callers = walk("src").filter((f) => /signInWithOAuth\(/.test(readFileSync(f, "utf8")));
    expect(callers.sort()).toEqual(["src/components/auth/SignInPanel.tsx"]);
  });
});

describe("🔴 found in the 12 Nov live test: Supabase makes 8-digit codes", () => {
  it("the panel accepts the code as it comes (6–10 digits), never a fixed 6", () => {
    const PANEL = readFileSync("src/components/auth/SignInPanel.tsx", "utf8");
    expect(PANEL).toMatch(/token\.length < CODE_MIN \|\| token\.length > CODE_MAX/);
    expect(PANEL).not.toMatch(/CODE_LENGTH|6-digit/);
  });
});
