// src/__tests__/auth/ownEmailCodes.test.ts
// 🔑 #134 (owner, 12 Nov 2026): "can not we do it … without involving third party agencies?"
// Sign-in codes are made by OUR server (Supabase admin, which sends nothing) and emailed from OUR
// mailbox (the Hostinger SMTP account every org invite already uses). Supabase's own sign-ups stay
// OFF, as decided in July — accounts are created only here, behind our rate limits.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
vi.mock("server-only", () => ({}));
import { signInCodeEmail } from "@/lib/auth/codeMailer";

describe("the email", () => {
  it("the code is in the subject and the body — and there is NO link to click", () => {
    const m = signInCodeEmail("482913", "signin");
    expect(m.subject).toBe("482913 is your Imotara code");
    expect(m.text).toContain("482913");
    expect(m.html).toContain("482913");
    expect(m.html).not.toMatch(/<a\s|href=/i); // mail scanners spend links (the July bug), never codes
  });
  it("says what it is for", () => {
    expect(signInCodeEmail("1", "reset").text).toMatch(/new password/);
    expect(signInCodeEmail("1", "signin").text).toMatch(/to sign in/);
  });
  it("no AI-provider or outside-service names", () => {
    const all = Object.values(signInCodeEmail("1", "signin")).join(" ");
    expect(all).not.toMatch(/openai|gemini|resend|supabase/i);
  });
});

describe("our mailbox, not an outside service", () => {
  const MAILER = readFileSync("src/lib/auth/codeMailer.ts", "utf8");
  it("sends through the Hostinger SMTP account org invites already use", () => {
    expect(MAILER).toContain('process.env.SMTP_HOST?.trim() || "smtp.hostinger.com"');
    expect(MAILER).toContain("nodemailer.createTransport");
    expect(MAILER).not.toMatch(/from ["']resend["']|api\.resend\.com/);
  });
});

describe("the code is made without Supabase sending anything", () => {
  const ISSUE = readFileSync("src/lib/auth/issueEmailCode.ts", "utf8");
  it("account first (a new address), then the code, then our email — in that order", () => {
    const create = ISSUE.indexOf("admin.auth.admin.createUser(");
    const link = ISSUE.indexOf("admin.auth.admin.generateLink(");
    const send = ISSUE.indexOf("sendSignInCodeEmail(");
    expect(create).toBeGreaterThan(-1);
    expect(create).toBeLessThan(link);
    expect(link).toBeLessThan(send);
    expect(ISSUE).toContain('type: "magiclink"');
    expect(ISSUE).toContain("data?.properties?.email_otp");
  });
  it("a returning person (already registered) is not an error", () => {
    expect(ISSUE).toMatch(/already\|registered\|exists/);
  });
});

describe("the route", () => {
  const ROUTE = readFileSync("src/app/api/auth/email-code/route.ts", "utf8");
  it("rate-limits per IP AND per email, before any account or mail is touched", () => {
    expect(ROUTE).toMatch(/checkPersistentIpRateLimit\("auth-email-code-ip"/);
    expect(ROUTE).toMatch(/checkPersistentIpRateLimit\("auth-email-code-email"/);
    expect(ROUTE.indexOf("checkPersistentIpRateLimit(")).toBeLessThan(ROUTE.indexOf("issueEmailCode(email"));
  });
  it("never stores the address in the rate-limit table — only a hash", () => {
    expect(ROUTE).toMatch(/createHash\("sha256"\)\.update\(email\)/);
  });
  it("answers the same whether or not an account exists", () => {
    expect(ROUTE).toContain("return NextResponse.json({ ok: true });");
    const code = ROUTE.replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/exists|not found|no account/i);
  });
});

describe("🔴 found in the 12 Nov simulator test: a class joining together shares ONE connection", () => {
  it("per connection allows a whole group (60/h); per address still protects each inbox (5/h)", () => {
    const R = readFileSync("src/app/api/auth/email-code/route.ts", "utf8");
    expect(R).toMatch(/const PER_IP_PER_HOUR = 60;/);
    expect(R).toMatch(/const PER_EMAIL_PER_HOUR = 5;/);
  });
});
