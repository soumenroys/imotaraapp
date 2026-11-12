// src/__tests__/org/inviteEmailsAreSentNotDropped.test.ts
// 🔴 Found in the #134 live test (12 Nov 2026): an org admin invited soumen.roy@ from the dashboard,
// saw "✓ Invite sent", and the email never arrived. The route sent it with `void sendInviteEmail(…)`
// — answering before the email left; on Vercel the function can stop the moment it answers.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const code = (f: string) => readFileSync(f, "utf8").replace(/^\s*\/\/.*$/gm, "");

describe("an invite email is waited for, and the admin is told the truth", () => {
  const ONE = code("src/app/api/org/dashboard/members/route.ts");
  it("single invite: awaited, never fire-and-forget", () => {
    expect(ONE).not.toMatch(/void sendInviteEmail\(/);
    expect(ONE).toMatch(/const emailSent = await sendInviteEmail\(/);
    expect(ONE.indexOf("await sendInviteEmail(")).toBeLessThan(ONE.indexOf("emailSent, ...(emailSent"));
  });
  it("if it failed, the admin gets the link to share", () => {
    expect(ONE).toMatch(/\.\.\.\(emailSent \? \{\} : \{ inviteUrl \}\)/);
    const PAGE = readFileSync("src/app/org/dashboard/members/page.tsx", "utf8");
    expect(PAGE).toMatch(/j\.emailSent === false/);
  });
  it("bulk invites: every email is waited for before the answer", () => {
    const BULK = code("src/app/api/org/dashboard/members/bulk/route.ts");
    expect(BULK).toMatch(/mailJobs\.push\(transporter\.sendMail\(/);
    expect(BULK.indexOf("await Promise.allSettled(mailJobs)")).toBeGreaterThan(-1);
    expect(BULK.indexOf("await Promise.allSettled(mailJobs)")).toBeLessThan(BULK.lastIndexOf("return NextResponse.json({ ok: true, summary"));
  });
  it("an empty SMTP_HOST falls back to our mail host in both", () => {
    for (const f of ["src/app/api/org/dashboard/members/route.ts", "src/app/api/org/dashboard/members/bulk/route.ts"]) {
      expect(readFileSync(f, "utf8")).toContain('process.env.SMTP_HOST?.trim() || "smtp.hostinger.com"');
    }
  });
});
